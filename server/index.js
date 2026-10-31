/**
 * ============================================================================
 * CATAN GAME SERVER
 * ============================================================================
 * 
 * Express + Socket.io server for multiplayer Catan game.
 * Handles real-time game communication, session management, and game state.
 * 
 * Features:
 * - WebSocket-based real-time multiplayer
 * - Game room management with 6-character codes
 * - Automatic cleanup of stale games
 * - Connection limits for free tier hosting
 * - Keep-alive ping endpoint for Render free tier
 * 
 * @author Viral Doshi
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as GameLogic from './gameLogic.js';
import * as Seafarers from './seafarers.js';
import { runBotTurn, runBotDiscards, runBotTradeResponses, getBotActor } from './bots.js';
import { soundEventsForTransition } from './soundEvents.js';
import { getLegalActions, executeLegalAction } from './legalActions.js';

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// HTTP ENDPOINTS
// ============================================================================

/** Server info and health check */
app.get('/', (req, res) => {
  res.json({
    name: 'Catan Game Server',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      socket: 'ws://[this-url]'
    },
    author: 'Viral Doshi'
  });
});

/** Detailed health check with server stats */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    activeGames: games.size,
    maxGames: MAX_CONCURRENT_GAMES,
    connectedPlayers: totalConnectedPlayers,
    maxPlayers: MAX_TOTAL_PLAYERS,
    timestamp: new Date().toISOString()
  });
});

/** Status endpoint for client to check if server has capacity */
app.get('/status', (req, res) => {
  const isAtCapacity = totalConnectedPlayers >= MAX_TOTAL_PLAYERS || games.size >= MAX_CONCURRENT_GAMES;
  res.json({
    available: !isAtCapacity,
    players: totalConnectedPlayers,
    maxPlayers: MAX_TOTAL_PLAYERS,
    games: games.size,
    maxGames: MAX_CONCURRENT_GAMES
  });
});

/** Lightweight keep-alive ping (prevents Render free tier from sleeping) */
app.get('/ping', (req, res) => {
  res.send('pong');
});

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ============================================================================
// IN-MEMORY STATE
// ============================================================================

/** Map of gameCode -> game state object */
const games = new Map();

/** Map of socketId -> { gameId, playerId } for tracking player connections */
const playerSockets = new Map();

// Connection limits for free tier hosting (Render, Heroku, etc.)
const MAX_CONCURRENT_GAMES = 50;
const MAX_TOTAL_PLAYERS = 200;
let totalConnectedPlayers = 0;

// ============================================================================
// AUTOMATIC CLEANUP
// ============================================================================

/** Clean up games that have been idle for 3+ hours */
setInterval(() => {
  const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
  let cleanedCount = 0;
  games.forEach((game, id) => {
    if (game.createdAt && game.createdAt < threeHoursAgo) {
      games.delete(id);
      cleanedCount++;
    }
  });
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} stale games. Active games: ${games.size}`);
  }
}, 30 * 60 * 1000); // Check every 30 minutes

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Generate a 6-character alphanumeric game code (excludes ambiguous chars like 0/O, 1/I) */
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Timer and public action history are authoritative on the server.
function recordEvent(game, message) {
  game.eventLog ||= [];
  game.eventLog.push({ id: (game.__eventSeq = (game.__eventSeq || 0) + 1), at: Date.now(), message });
  if (game.eventLog.length > 100) game.eventLog.shift();
}
function syncTurnTimer(game) {
  if (game.phase === 'waiting' || game.phase === 'finished') {
    game.turnDeadline = null;
    game.__timerOwner = null;
    return;
  }
  const phase = game.phase === 'setup' ? 'setup' : game.turnPhase;
  const activeIndex = phase === 'specialBuild' ? game.specialBuildIndex : game.currentPlayerIndex;
  const owner = game.players[activeIndex]?.id || '';
  // Discard deadline is SHARED across every pending player; individual discards
  // must not restart the 15-second clock.
  const key = phase === 'discard'
    ? `discard:${game.__publicRollEvent?.id || 0}`
    : phase === 'setup'
      ? `setup:${owner}:${game.setupPhase}:${game.setupSettlementKey || 'settlement'}`
      : `${phase}:${owner}`;
  const seconds = phase === 'roll' ? 5
    : phase === 'discard' ? 15
    : phase === 'setup' ? 45
    : phase === 'specialBuild' ? 45
    : phase === 'main' ? game.turnTimeLimit : 30;
  if (key !== game.__timerOwner) {
    game.__timerOwner = key;
    game.turnDeadline = seconds > 0 ? Date.now() + seconds * 1000 : null;
  }
}

function automaticDiscard(game, playerId, amount) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { success: false };
  const resources = {brick:0,lumber:0,wool:0,grain:0,ore:0};
  const cards = Object.entries(resources).flatMap(([resource]) =>
    Array.from({length:player.resources?.[resource] || 0}, () => resource));
  // Random discard keeps the player's concealed resource composition private.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.slice(0, amount).forEach(resource => { resources[resource]++; });
  return GameLogic.discardCards(game, playerId, resources);
}

setInterval(() => {
  for (const [gameId, game] of games) {
    syncTurnTimer(game);
    if (!game.turnDeadline || Date.now() < game.turnDeadline || game.__botBusy || game.__timerExpiring) continue;
    game.__timerExpiring = true;
    try {
      const player = game.players[game.currentPlayerIndex];
      if (!player) continue;
      if (game.phase === 'setup') {
        const legal = getLegalActions(game, player.id);
        const action = legal.find(a => a.type === (game.setupSettlementKey ? 'placeRoad' : 'placeSettlement')) ||
          (game.isSeafarers && game.setupSettlementKey ? legal.find(a=>a.type==='placeShip') : null);
        if (action) {
          const result = executeLegalAction(game, player.id, action);
          if (result.success) recordEvent(game, `⏱️ ${player.name}: posição inicial definida automaticamente`);
        }
      } else if (game.turnPhase === 'discard') {
        for (const pending of [...(game.discardingPlayers || [])]) {
          const discarding = game.players[pending.playerIndex];
          if (!discarding || discarding.isBot) continue;
          const result = automaticDiscard(game, discarding.id, pending.cardsToDiscard);
          if (result.success) recordEvent(game, `⏱️ ${discarding.name} descartou ${pending.cardsToDiscard} cartas automaticamente (ocultas)`);
        }
        runBotDiscards(game, () => broadcastGameState(gameId));
      } else if (game.turnPhase === 'roll') {
        if (!player.isBot) {
          const roll = GameLogic.rollDice(game, player.id);
          if (roll.success) recordEvent(game, `⏱️ ${player.name}: dados lançados automaticamente após 5 segundos`);
        }
      } else if (game.turnPhase === 'goldPick') {
        for(const [index,amount] of Object.entries(game.pendingGoldPicks||{})){
          const winner=game.players[Number(index)];
          for(let n=0;n<amount;n++){
            const resource=['grain','lumber','brick','ore','wool'].find(r=>GameLogic.getBankResourceCount(game,r)>0);
            if(resource)GameLogic.pickGoldResource(game,winner.id,resource);
          }
        }
        recordEvent(game,'⏱️ Recursos de ouro pendentes escolhidos automaticamente');
      } else if (game.turnPhase === 'main') {
        if (!player.isBot) {
          game.tradeOffer = null;
          const result = GameLogic.endTurn(game, player.id);
          if (result.success) recordEvent(game, `⏱️ Tempo esgotado: turno de ${player.name} encerrado`);
        }
      } else if (game.turnPhase === 'specialBuild') {
        const builder = game.players[game.specialBuildIndex];
        if (builder) {
          const result = GameLogic.endSpecialBuild(game, builder.id);
          if (result.success) recordEvent(game, `⏱️ ${builder.name} passou a construção especial automaticamente`);
        }
      } else {
        // Robber decisions retain a grace period rather than forcing a
        // potentially illegal action or consuming a development-card effect.
        game.turnDeadline = Date.now() + 30000;
      }
      broadcastGameState(gameId);
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(gameId));
    } catch (error) {
      console.error('[Catan timer] Falha ao executar ação automática:', error);
      game.turnDeadline = Date.now() + 15000;
    } finally {
      game.__timerExpiring = false;
    }
  }
}, 1000);


const RESOURCE_NAMES = {brick:'tijolo',lumber:'madeira',wool:'lã',grain:'trigo',ore:'minério'};
function formatResources(resources = {}) {
  return Object.entries(RESOURCE_NAMES).filter(([key]) => resources[key] > 0)
    .map(([key, name]) => `${resources[key]} ${name}`).join(', ') || 'nenhum recurso';
}
function logTrade(game, fromIndex, partnerId, offer, request) {
  const from = game.players[fromIndex]?.name || 'Jogador';
  const partner = game.players.find(p => p.id === partnerId)?.name || 'Jogador';
  recordEvent(game, `🤝 ${from} trocou ${formatResources(offer)} por ${formatResources(request)} com ${partner}`);
  game.__skipResourceDelta = true;
}
/** Send player-specific game state to each player in a game */
function broadcastGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return;
  const snapshot = {
    buildings: Object.fromEntries(Object.entries(game.vertices || {}).filter(([k,v]) => v.owner !== undefined && v.owner !== null && v.building).map(([k,v]) => [k, `${v.owner}:${v.building}`])),
    roads: Object.fromEntries(Object.entries(game.edges || {}).filter(([k,v]) => v.owner !== undefined && v.owner !== null).map(([k,v]) => [k, v.owner])),
    player: game.currentPlayerIndex,
    phase: game.phase,
    winner: game.winner || null,
    rollTotal: game.__publicRollEvent?.roll?.total ?? null,
    rollId: game.__publicRollEvent?.id || 0,
    robberyId: game.__publicRobberyEvent?.id || 0,
    devCardsRemaining: game.devCardDeck?.length ?? 0,
    // Only internal server snapshot: never expose this to client views.
    resourceCounts: game.players.map(player => Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, player.resources?.[key] || 0]))),
    cardTotals: game.players.map(player => Object.values(player.resources || {}).reduce((sum, count) => sum + count, 0)),
    longestRoad: game.longestRoadPlayer,
    largestArmy: game.largestArmyPlayer
  };
  const previous = game.__publicSnapshot;
  if (previous) {
    for (const [key, value] of Object.entries(snapshot.buildings)) {
      if (previous.buildings[key] !== value) {
        const [owner, building] = value.split(':');
        recordEvent(game, `🏠 ${game.players[Number(owner)]?.name || 'Jogador'} construiu ${building === 'city' ? 'uma cidade' : 'uma aldeia'}`);
      }
    }
    for (const [key, owner] of Object.entries(snapshot.roads)) {
      if (previous.roads[key] !== owner) recordEvent(game, `🛤️ ${game.players[owner]?.name || 'Jogador'} construiu uma estrada`);
    }
    const newRoll = snapshot.rollId !== previous.rollId && game.__publicRollEvent;
    const newRobbery = snapshot.robberyId !== previous.robberyId && game.__publicRobberyEvent;
    // Dice events are already recorded atomically by GameLogic.rollDice().
    // Suppress duplicate generic hand-delta entries for the same roll.
    if (newRobbery) {
      const robbery = game.__publicRobberyEvent;
      recordEvent(game, `🥷 ${robbery.thiefName} roubou uma carta de ${robbery.victimName} (recurso oculto)`);
    }
    if (snapshot.devCardsRemaining < previous.devCardsRemaining)
      recordEvent(game, `📜 ${game.players[game.currentPlayerIndex]?.name || 'Jogador'} comprou ${previous.devCardsRemaining - snapshot.devCardsRemaining} carta(s) de desenvolvimento (tipo oculto)`);
    if (!game.__skipResourceDelta && !newRoll && !newRobbery) {
      snapshot.cardTotals.forEach((total, idx) => {
        const difference = total - (previous.cardTotals?.[idx] ?? total);
        if (!difference) return;
        const name = game.players[idx]?.name || 'Jogador';
        const before = previous.resourceCounts?.[idx] || {};
        const after = snapshot.resourceCounts[idx];
        const received = {};
        const lost = {};
        for (const key of Object.keys(RESOURCE_NAMES)) {
          const delta = (after[key] || 0) - (before[key] || 0);
          if (delta > 0) received[key] = delta;
          if (delta < 0) lost[key] = -delta;
        }
        // Public income and spending are descriptive. Robber theft is excluded above.
        if (Object.keys(received).length)
          recordEvent(game, `📥 ${name} recebeu ${formatResources(received)}`);
        if (Object.keys(lost).length)
          recordEvent(game, `📤 ${name} gastou/perdeu ${formatResources(lost)}`);
      });
    }
    if (snapshot.longestRoad !== previous.longestRoad) {
      if (previous.longestRoad != null) recordEvent(game, `🛤️ ${game.players[previous.longestRoad]?.name} perdeu a Maior Estrada`);
      if (snapshot.longestRoad != null) recordEvent(game, `🏆 ${game.players[snapshot.longestRoad]?.name} conquistou a Maior Estrada!`);
    }
    if (snapshot.largestArmy !== previous.largestArmy) {
      if (previous.largestArmy != null) recordEvent(game, `⚔️ ${game.players[previous.largestArmy]?.name} perdeu o Maior Exército`);
      if (snapshot.largestArmy != null) recordEvent(game, `🏆 ${game.players[snapshot.largestArmy]?.name} conquistou o Maior Exército!`);
    }
    if (snapshot.player !== previous.player && game.phase === 'playing')
      recordEvent(game, `▶️ Vez de ${game.players[snapshot.player]?.name || 'Jogador'}`);
  }
  // Send authoritative one-shot sound cues to every connected player.
  // No dependence on the feed, its text formatting, or private card state.
  for (const sound of soundEventsForTransition(previous, snapshot)) {
    broadcastToGame(gameId, 'gameSound', {
      sound,
      id: (game.__soundEventId = (game.__soundEventId || 0) + 1)
    });
  }
  game.__publicSnapshot = snapshot;
  game.__skipResourceDelta = false;
  
  syncTurnTimer(game);
  game.players.forEach(player => {
    const socketId = [...playerSockets.entries()]
      .find(([_, v]) => v.gameId === gameId && v.playerId === player.id)?.[0];
    
    if (socketId) {
      const playerView = GameLogic.getPlayerView(game, player.id);
      playerView.legalActions = getLegalActions(game, player.id);
      playerView.eventLog = game.eventLog || [];
      io.to(socketId).emit('gameState', playerView);
    }
  });
}

/** Broadcast an event to all players in a game (same data to everyone) */
function broadcastToGame(gameId, event, data) {
  const game = games.get(gameId);
  if (!game) return;
  
  game.players.forEach(player => {
    const socketId = [...playerSockets.entries()]
      .find(([_, v]) => v.gameId === gameId && v.playerId === player.id)?.[0];
    
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  });
}

// ============================================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  socket.on('performAction', ({ action } = {}, callback = () => {}) => {
    const info = playerSockets.get(socket.id);
    const game = info && games.get(info.gameId);
    if (!game) return callback({ success: false, error: 'Não está em uma partida.' });
    const result = executeLegalAction(game, info.playerId, action);
    if (result.success) {
      if (action.type === 'placeSettlement') broadcastToGame(info.gameId, 'settlementPlaced', { vertexKey: action.vertexKey, playerId: info.playerId });
      if (action.type === 'placeRoad') broadcastToGame(info.gameId, 'roadPlaced', { edgeKey: action.edgeKey, playerId: info.playerId });
      if (action.type === 'placeShip') {
        const player=game.players.find(p=>p.id===info.playerId);
        recordEvent(game,`⛵ ${player?.name || 'Jogador'} construiu um barco`);
      }
      if (action.type === 'movePirate') {
        recordEvent(game,'🏴‍☠️ O pirata mudou de posição');
        if(result.stolenInfo) {
          const stolen=result.stolenInfo;
          game.__skipResourceDelta=true;
          for(const [id,type] of [[stolen.thief,'stole'],[stolen.victim,'stolen']]){
            const recipient=[...playerSockets.entries()].find(([,v])=>v.gameId===info.gameId&&v.playerId===id)?.[0];
            if(recipient)io.to(recipient).emit('stealResult',{
              type,resource:stolen.resource,
              otherPlayer:type==='stole'?stolen.victimName:stolen.thiefName});
          }
        }
      }
      if (action.type === 'upgradeToCity') broadcastToGame(info.gameId, 'cityBuilt', { vertexKey: action.vertexKey, playerId: info.playerId });
      if (action.type === 'endTurn') broadcastToGame(info.gameId, 'turnEnded', { playerId: info.playerId });
      if (action.type === 'moveRobber') broadcastToGame(info.gameId, 'robberMoved', { hexKey: action.hexKey, playerId: info.playerId });
      broadcastGameState(info.gameId);
      runBotDiscards(game, () => broadcastGameState(info.gameId));
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(info.gameId));
    }
    callback(result);
  });

  // --------------------------------------------------------------------
  // CONNECTION MANAGEMENT
  // --------------------------------------------------------------------
  
  // Check if server is at capacity
  if (totalConnectedPlayers >= MAX_TOTAL_PLAYERS) {
    console.log('Server at capacity, rejecting connection:', socket.id);
    socket.emit('serverFull', { 
      message: 'Server is at maximum capacity. Please try again in a few minutes.',
      players: totalConnectedPlayers,
      maxPlayers: MAX_TOTAL_PLAYERS
    });
    socket.disconnect(true);
    return;
  }
  
  totalConnectedPlayers++;
  console.log(`Player connected: ${socket.id} (Total: ${totalConnectedPlayers}/${MAX_TOTAL_PLAYERS})`);
  
  // --------------------------------------------------------------------
  // GAME CREATION AND JOINING
  // --------------------------------------------------------------------
  
  /** Create a new game room as the host */
  socket.on('createGame', ({ playerName, isExtended = false, enableSpecialBuild = true, mapType = 'random', autoSetup = false, isCitiesAndKnights = false, turnTimeLimit = 120, isSeafarers = false }, callback) => {
    if (isSeafarers && (isExtended || isCitiesAndKnights))
      return callback({success:false,error:'Navegantes é um modo independente para 4 jogadores'});
    // Check game limit
    if (games.size >= MAX_CONCURRENT_GAMES) {
      callback({ 
        success: false, 
        error: 'Server has reached maximum number of games. Please try again later.' 
      });
      return;
    }
    
    const gameCode = generateGameCode();
    const playerId = uuidv4();
    
    const game = GameLogic.createGame(gameCode, {
      id: playerId,
      name: playerName
    }, isExtended, enableSpecialBuild, mapType, autoSetup && !isSeafarers, isCitiesAndKnights, isSeafarers);
    
    game.turnTimeLimit = [0, 60, 120, 180, 300].includes(Number(turnTimeLimit)) ? Number(turnTimeLimit) : 120;
    game.eventLog = [];
    // Add timestamp for cleanup
    game.createdAt = Date.now();
    
    games.set(gameCode, game);
    playerSockets.set(socket.id, { gameId: gameCode, playerId });
    socket.join(gameCode);
    
    console.log(`Game ${gameCode} created by ${playerName}`);
    
    callback({ 
      success: true, 
      playerId,
      gameCode: gameCode.toUpperCase(),
      gameState: { ...GameLogic.getPlayerView(game, playerId), legalActions: getLegalActions(game, playerId) }
    });
  });

  /** Host adds a server-controlled bot to a classic-game lobby. */
  socket.on('addBot', (callback = () => {}) => {
    const info = playerSockets.get(socket.id);
    const game = info && games.get(info.gameId);
    if (!game || game.phase !== 'waiting' || game.players[0].id !== info.playerId)
      return callback({ success: false, error: 'Somente o anfitrião pode adicionar bots antes da partida.' });
    if (game.isCitiesAndKnights)
      return callback({ success: false, error: 'Bots ainda não estão disponíveis em Cidades e Cavaleiros.' });
    if (game.players.length >= game.maxPlayers)
      return callback({ success: false, error: 'A sala já está cheia.' });
    const botId = 'bot-' + uuidv4();
    const result = GameLogic.addPlayer(game, { id: botId, name: 'Bot ' + (game.players.filter(p => p.isBot).length + 1) });
    if (!result.success) return callback(result);
    game.players.find(p => p.id === botId).isBot = true;
    broadcastGameState(info.gameId);
    callback({ success: true });
  });

  socket.on('removeBot', (callback = () => {}) => {
    const info = playerSockets.get(socket.id);
    const game = info && games.get(info.gameId);
    if (!game || game.phase !== 'waiting' || game.players[0].id !== info.playerId)
      return callback({ success: false, error: 'Somente o anfitrião pode remover bots antes da partida.' });
    const index = game.players.findLastIndex(p => p.isBot);
    if (index < 0) return callback({ success: false, error: 'Não há bots para remover.' });
    game.players.splice(index, 1);
    game.players.forEach((p, i) => { p.color = GameLogic.PLAYER_COLORS[i]; p.turnOrder = null; });
    broadcastGameState(info.gameId);
    callback({ success: true });
  });

  /** Allow a player to pick their color in the lobby */
  socket.on('changeColor', ({ color }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return callback({ success: false, error: 'Not in a game' });
    
    const game = games.get(playerInfo.gameId);
    if (!game || game.phase !== 'waiting') return callback({ success: false, error: 'Cannot change color now' });
    
    // Only allow server-defined colors; never trust arbitrary client CSS values.
    if (typeof color !== 'string' || !GameLogic.PLAYER_COLORS.includes(color)) {
      return callback({ success: false, error: 'Cor inválida' });
    }

    // Check if color is already taken
    const isTaken = game.players.some(p => p.color === color && p.id !== playerInfo.playerId);
    if (isTaken) return callback({ success: false, error: 'Color already taken' });
    
    const player = game.players.find(p => p.id === playerInfo.playerId);
    if (player) {
      player.color = color;
      broadcastGameState(playerInfo.gameId);
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Player not found' });
    }
  });
  
  /** Join an existing game room using a game code */
  socket.on('joinGame', ({ gameCode, playerName }, callback) => {
    const game = games.get(gameCode.toUpperCase());
    
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    const playerId = uuidv4();
    const result = GameLogic.addPlayer(game, { id: playerId, name: playerName });
    
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }
    
    playerSockets.set(socket.id, { gameId: gameCode.toUpperCase(), playerId });
    socket.join(gameCode.toUpperCase());
    
    console.log(`${playerName} joined game ${gameCode}`);
    
    callback({
      success: true,
      gameCode: gameCode.toUpperCase(),
      playerId,
      gameState: GameLogic.getPlayerView(game, playerId)
    });
    
    // Notify all players
    broadcastToGame(gameCode.toUpperCase(), 'playerJoined', { playerName });
    broadcastGameState(gameCode.toUpperCase());
  });
  
  // --------------------------------------------------------------------
  // GAME FLOW CONTROLS
  // --------------------------------------------------------------------
  
  /** Start the game (host only) - randomizes player order and begins setup */
  socket.on('startGame', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    // Only host can start
    if (game.players[0].id !== playerInfo.playerId) {
      callback({ success: false, error: 'Only host can start the game' });
      return;
    }
    
    const result = GameLogic.startGame(game);
    
    if (result.success) {
      // The departure bell belongs to clicking "Start Game", not to finishing
      // setup. Emitted exactly once for the successful startGame action.
      broadcastToGame(playerInfo.gameId, 'gameSound', {
        sound: 'sail',
        id: (game.__soundEventId = (game.__soundEventId || 0) + 1)
      });
      broadcastToGame(playerInfo.gameId, 'gameStarted', { 
        turnOrder: result.turnOrder 
      });
      broadcastGameState(playerInfo.gameId);
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(playerInfo.gameId));
    }
    
    callback(result);
  });
  
  /** Shuffle the board layout (host only, before game starts) */
  socket.on('shuffleBoard', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    // Only host can shuffle
    if (game.players[0].id !== playerInfo.playerId) {
      callback({ success: false, error: 'Only host can shuffle the board' });
      return;
    }
    
    const result = GameLogic.shuffleBoard(game);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'boardShuffled', {});
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // TURN ACTIONS
  // --------------------------------------------------------------------
  
  /** Roll dice at start of turn - distributes resources or triggers robber */
  socket.on('rollDice', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.rollDice(game, playerInfo.playerId);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'diceRolled', { 
        roll: result.roll,
        playerId: playerInfo.playerId 
      });
      
      // Broadcast resource gains to all players (resource gains are public in Catan)
      if (result.resourceGains) {
        // Collect all gains for broadcast
        const allGains = [];
        game.players.forEach((player, idx) => {
          const gains = result.resourceGains[idx];
          const hasGains = Object.values(gains).some(v => v > 0);
          if (hasGains) {
            allGains.push({
              playerId: player.id,
              playerName: player.name,
              playerIndex: idx,
              gains
            });
          }
        });
        
        // Broadcast all resource gains to everyone in the game
        if (allGains.length > 0) {
          broadcastToGame(playerInfo.gameId, 'resourcesDistributed', {
            fromRoll: result.roll.total,
            allGains
          });
        }
        
        // Also send personal notification to each player who received resources
        game.players.forEach((player, idx) => {
          const gains = result.resourceGains[idx];
          const hasGains = Object.values(gains).some(v => v > 0);
          if (hasGains) {
            const socketEntry = [...playerSockets.entries()]
              .find(([_, v]) => v.gameId === playerInfo.gameId && v.playerId === player.id);
            if (socketEntry) {
              io.to(socketEntry[0]).emit('resourcesReceived', { 
                gains,
                fromRoll: result.roll.total
              });
            }
          }
        });
      }
      
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Validate ship re-positioning entirely on the server. */
  socket.on('moveShip',({fromEdge,toEdge}={},callback=()=>{})=>{
    const info=playerSockets.get(socket.id);
    const game=info&&games.get(info.gameId);
    if(!game)return callback({success:false,error:'Partida não encontrada'});
    const result=Seafarers.moveShip(game,info.playerId,fromEdge,toEdge);
    if(result.success){
      GameLogic.refreshLongestRoad(game);
      recordEvent(game,`⛵ ${game.players.find(p=>p.id===info.playerId)?.name} moveu um barco`);
      broadcastGameState(info.gameId);
    }
    callback(result);
  });

  /** Discard cards when a 7 is rolled (for players with >7 cards) */
  socket.on('discardCards', ({ resources }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.discardCards(game, playerInfo.playerId, resources);

    if (result.success) {
      // If the current player is a bot, resume its interrupted robber phase
      // once all human/bot discards are resolved.
      runBotDiscards(game, () => broadcastGameState(playerInfo.gameId));
      broadcastGameState(playerInfo.gameId);
      if (getBotActor(game) && game.turnPhase !== 'discard') {
        void runBotTurn(game, () => broadcastGameState(playerInfo.gameId));
      }
    }
    
    callback(result);
  });
  
  /** Move robber and optionally steal from a player */
  socket.on('moveRobber', ({ hexKey, stealFromPlayerId }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.moveRobber(game, playerInfo.playerId, hexKey, stealFromPlayerId);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'robberMoved', { hexKey });
      
      // Send steal notifications to both players
      if (result.stolenInfo) {
        const { resource, thief, thiefName, victim, victimName } = result.stolenInfo;
        
        // Notify the thief what they stole
        const thiefSocket = [...playerSockets.entries()]
          .find(([_, v]) => v.gameId === playerInfo.gameId && v.playerId === thief)?.[0];
        if (thiefSocket) {
          io.to(thiefSocket).emit('stealResult', { 
            type: 'stole',
            resource,
            otherPlayer: victimName
          });
        }
        
        // Notify the victim what was stolen from them
        const victimSocket = [...playerSockets.entries()]
          .find(([_, v]) => v.gameId === playerInfo.gameId && v.playerId === victim)?.[0];
        if (victimSocket) {
          io.to(victimSocket).emit('stealResult', { 
            type: 'stolen',
            resource,
            otherPlayer: thiefName
          });
        }
      }
      
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // BUILDING ACTIONS
  // --------------------------------------------------------------------
  
  /** Place a settlement on a vertex */
  socket.on('placeSettlement', ({ vertexKey, isSetup }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.placeSettlement(game, playerInfo.playerId, vertexKey);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'settlementPlaced', { 
        vertexKey, 
        playerId: playerInfo.playerId 
      });
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Place a road on an edge */
  socket.on('placeRoad', ({ edgeKey, isSetup, lastSettlement }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.placeRoad(game, playerInfo.playerId, edgeKey, isSetup, lastSettlement);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'roadPlaced', { 
        edgeKey, 
        playerId: playerInfo.playerId 
      });
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Upgrade an existing settlement to a city */
  socket.on('upgradeToCity', ({ vertexKey }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.upgradeToCity(game, playerInfo.playerId, vertexKey);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'cityBuilt', { 
        vertexKey, 
        playerId: playerInfo.playerId 
      });
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // CITIES & KNIGHTS
  // --------------------------------------------------------------------
  
  /** Buy a city improvement */
  socket.on('buyCityImprovement', ({ track }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.buyCityImprovement(game, playerInfo.playerId, track);
    
    if (result.success) {
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  socket.on('recruitKnight', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return callback({ success: false, error: 'Not in a game' });
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.recruitKnight(game, playerInfo.playerId);
    
    if (result.success) broadcastGameState(playerInfo.gameId);
    callback(result);
  });
  
  socket.on('activateKnight', ({ level }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return callback({ success: false, error: 'Not in a game' });
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.activateKnight(game, playerInfo.playerId, level);
    
    if (result.success) broadcastGameState(playerInfo.gameId);
    callback(result);
  });
  
  socket.on('upgradeKnight', ({ fromLevel }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return callback({ success: false, error: 'Not in a game' });
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.upgradeKnight(game, playerInfo.playerId, fromLevel);
    
    if (result.success) broadcastGameState(playerInfo.gameId);
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // DEVELOPMENT CARDS
  // --------------------------------------------------------------------
  
  /** Buy a development card from the deck */
  socket.on('buyDevCard', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.buyDevCard(game, playerInfo.playerId);
    
    if (result.success) {
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Play a development card */
  socket.on('playDevCard', ({ cardType, params }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.playDevCard(game, playerInfo.playerId, cardType, params);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'devCardPlayed', { 
        cardType, 
        playerId: playerInfo.playerId 
      });
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Play a progress card */
  socket.on('playProgressCard', ({ track, cardType, params }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.playProgressCard(game, playerInfo.playerId, track, cardType, params);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'progressCardPlayed', { 
        cardType, 
        playerId: playerInfo.playerId 
      });
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Pick a resource for Year of Plenty card */
  socket.on('yearOfPlentyPick', ({ resource }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.yearOfPlentyPick(game, playerInfo.playerId, resource);
    
    if (result.success) {
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // TRADING
  // --------------------------------------------------------------------
  
  /** Trade with the bank (uses port ratios if available) */
  socket.on('bankTrade', ({ giveResource, giveAmount, getResource }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.bankTrade(game, playerInfo.playerId, giveResource, giveAmount, getResource);

    if (result.success) {
      recordEvent(game, `🏦 ${game.players.find(p => p.id === playerInfo.playerId)?.name} trocou ${giveAmount} ${RESOURCE_NAMES[giveResource]} por 1 ${RESOURCE_NAMES[getResource]} no banco`);
      game.__skipResourceDelta = true;
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Propose a trade to other players */
  socket.on('proposeTrade', ({ offer, request }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.proposeTrade(game, playerInfo.playerId, offer, request);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'tradeProposed', { 
        from: playerInfo.playerId,
        offer,
        request
      });
      broadcastGameState(playerInfo.gameId);
      const proposed = game.tradeOffer ? {from:game.tradeOffer.from,offer:{...game.tradeOffer.offer},request:{...game.tradeOffer.request}} : null;
      runBotTradeResponses(game, () => {
        if (proposed && !game.tradeOffer) {
          // If a bot accepted the trade, its resources changed; log only the final result.
          // Completion is logged by the bot action executor before broadcasting.
        }
        broadcastGameState(playerInfo.gameId);
      });
    }
    
    callback(result);
  });
  
  /** Accept or decline a trade offer */
  socket.on('respondToTrade', ({ accept }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const proposed = game.tradeOffer ? {from:game.tradeOffer.from,offer:{...game.tradeOffer.offer},request:{...game.tradeOffer.request}} : null;
    const result = GameLogic.respondToTrade(game, playerInfo.playerId, accept);
    if (result.success && result.traded && proposed) logTrade(game, proposed.from, playerInfo.playerId, proposed.offer, proposed.request);
    
    if (result.success) {
      if (result.traded) {
        broadcastToGame(playerInfo.gameId, 'tradeAccepted', { 
          by: playerInfo.playerId 
        });
      } else {
        broadcastToGame(playerInfo.gameId, 'tradeDeclined', { 
          by: playerInfo.playerId 
        });
      }
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  /** Cancel an active trade offer */
  socket.on('cancelTrade', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.cancelTrade(game, playerInfo.playerId);
    
    if (result.success) {
      broadcastToGame(playerInfo.gameId, 'tradeCancelled', {});
      broadcastGameState(playerInfo.gameId);
    }
    
    callback(result);
  });
  
  // --------------------------------------------------------------------
  // TURN MANAGEMENT
  // --------------------------------------------------------------------
  
  /** Advance to next player during setup phase */
  socket.on('advanceSetup', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.advanceSetup(game, playerInfo.playerId);
    
    if (result.success) {
      broadcastGameState(playerInfo.gameId);
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(playerInfo.gameId));
    }
    
    callback(result);
  });
  
  /** End the current player's turn */
  socket.on('endTurn', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.endTurn(game, playerInfo.playerId);
    
    if (result.success) {
      if (result.specialBuildingPhase) {
        broadcastToGame(playerInfo.gameId, 'specialBuildingPhaseStarted', { 
          playerId: playerInfo.playerId,
          currentBuilder: game.players[game.specialBuildIndex]?.id
        });
      } else {
        broadcastToGame(playerInfo.gameId, 'turnEnded', { playerId: playerInfo.playerId });
      }
      broadcastGameState(playerInfo.gameId);
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(playerInfo.gameId));
    }
    
    callback(result);
  });
  
  /** End special building phase for current player (5-8 player games) */
  socket.on('endSpecialBuild', (callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const result = GameLogic.endSpecialBuild(game, playerInfo.playerId);
    
    if (result.success) {
      if (result.specialBuildingPhaseEnded) {
        broadcastToGame(playerInfo.gameId, 'specialBuildingPhaseEnded', {});
        broadcastToGame(playerInfo.gameId, 'turnEnded', { playerId: playerInfo.playerId });
      } else {
        broadcastToGame(playerInfo.gameId, 'specialBuildNext', { 
          currentBuilder: game.players[game.specialBuildIndex]?.id 
        });
      }
      broadcastGameState(playerInfo.gameId);
      if (getBotActor(game)) void runBotTurn(game, () => broadcastGameState(playerInfo.gameId));
    }

    callback(result);
  });

  // --------------------------------------------------------------------
  // UTILITY QUERIES
  // --------------------------------------------------------------------
  
  /** Get list of players with buildings on a hex (for robber stealing) */
  socket.on('getPlayersOnHex', ({ hexKey }, callback) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a game' });
      return;
    }
    
    const game = games.get(playerInfo.gameId);
    const playerIdx = game.players.findIndex(p => p.id === playerInfo.playerId);
    if(game.isSeafarers && game.hexes[hexKey]?.terrain==='sea') {
      const victims=Seafarers.getPirateVictims(game,hexKey,playerInfo.playerId);
      return callback({success:true,players:victims.map(id=>({
        id,name:game.players.find(p=>p.id===id)?.name,hasResources:true}))});
    }
    const playerIndices = GameLogic.getPlayersOnHex(game, hexKey, playerIdx);
    
    const players = playerIndices.map(idx => ({
      id: game.players[idx].id,
      name: game.players[idx].name,
      hasResources: Object.values(game.players[idx].resources).reduce((a, b) => a + b, 0) > 0
    }));
    
    callback({ success: true, players });
  });
  
  // --------------------------------------------------------------------
  // CHAT
  // --------------------------------------------------------------------
  
  /** Broadcast a chat message to all players in the game */
  socket.on('chatMessage', ({ message }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;
    
    const game = games.get(playerInfo.gameId);
    if (!game) return;
    
    const player = game.players.find(p => p.id === playerInfo.playerId);
    if (!player) return;
    
    broadcastToGame(playerInfo.gameId, 'chatMessage', {
      playerName: player.name,
      playerColor: player.color,
      message,
      timestamp: Date.now()
    });
  });
  
  // --------------------------------------------------------------------
  // CONNECTION LIFECYCLE
  // --------------------------------------------------------------------
  
  /** Handle player disconnection */
  socket.on('disconnect', () => {
    totalConnectedPlayers = Math.max(0, totalConnectedPlayers - 1);
    
    const playerInfo = playerSockets.get(socket.id);
    
    if (playerInfo) {
      const game = games.get(playerInfo.gameId);
      if (game) {
        const player = game.players.find(p => p.id === playerInfo.playerId);
        if (player) {
          broadcastToGame(playerInfo.gameId, 'playerDisconnected', { 
            playerName: player.name 
          });
        }
      }
      
      playerSockets.delete(socket.id);
    }
    
    console.log(`Player disconnected: ${socket.id} (Total: ${totalConnectedPlayers}/${MAX_TOTAL_PLAYERS})`);
  });
  
  /** Reconnect to an existing game (e.g., after page refresh) */
  socket.on('reconnect', ({ gameCode, playerId }, callback) => {
    const game = games.get(gameCode);
    
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      callback({ success: false, error: 'Player not found in game' });
      return;
    }
    
    // Remove old socket mapping if exists
    for (const [socketId, info] of playerSockets.entries()) {
      if (info.gameId === gameCode && info.playerId === playerId) {
        playerSockets.delete(socketId);
        break;
      }
    }
    
    playerSockets.set(socket.id, { gameId: gameCode, playerId });
    socket.join(gameCode);
    
    callback({
      success: true,
      gameState: GameLogic.getPlayerView(game, playerId)
    });
    
    broadcastToGame(gameCode, 'playerReconnected', { playerName: player.name });
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Catan server running on port ${PORT}`);
});

