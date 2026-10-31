import * as Game from './gameLogic.js';
import { getLegalActions, executeLegalAction } from './legalActions.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const names = {brick:'tijolo',lumber:'madeira',wool:'lã',grain:'trigo',ore:'minério'};
const format = items => Object.keys(names).filter(key => (items?.[key] || 0) > 0)
  .map(key => `${items[key]} ${names[key]}`).join(', ');
function log(game, message) {
  game.eventLog ||= [];
  game.eventLog.push({id:(game.__eventSeq=(game.__eventSeq||0)+1),at:Date.now(),message});
  if(game.eventLog.length>100) game.eventLog.shift();
  game.__skipResourceDelta = true;
}


function vertexScore(game, key) {
  const adjacent = Game.getVertexAdjacentHexes(game, key);
  let score = 0;
  const seen = new Set();
  for (const hex of adjacent) {
    if (!hex?.resource || !hex.number) continue;
    score += (6 - Math.abs(7 - hex.number)) * 1.5;
    if (!seen.has(hex.resource)) { score += 2; seen.add(hex.resource); }
  }
  return score;
}

function discardChoice(player, amount) {
  const result = Object.fromEntries(RESOURCES.map(r => [r, 0]));
  const order = [...RESOURCES].sort((a, b) => (player.resources[a] || 0) - (player.resources[b] || 0));
  let left = amount;
  for (const resource of order) {
    const take = Math.min(left, player.resources[resource] || 0);
    result[resource] = take;
    left -= take;
    if (!left) break;
  }
  return result;
}

function chooseAction(game, player, options) {
  if (!options.length) return null;
  const playerIndex = game.players.findIndex(p => p.id === player.id);
  const rank = action => {
    switch (action.type) {
      case 'placeSettlement': return 100 + vertexScore(game, action.vertexKey);
      case 'upgradeToCity': return 90;
      case 'buyDevCard': return 70;
      case 'bankTrade': return (game.__botBankTrades || 0) < 1 && (player.resources[action.getResource] || 0) === 0 && (player.resources[action.giveResource] || 0) >= action.giveAmount + 1 ? 65 : -10;
      case 'respondToTrade': return action.accept ? 90 : 5;
      case 'placeRoad': return game.isSeafarers ? 35 : 40;
      case 'placeShip': return game.phase === 'setup' ? 58 : 48;
      case 'pickGoldResource': return 80 + (player.resources[action.resource] < 2 ? 4 : 0);
      case 'movePirate': return 48 + (action.victimPlayerIds?.length || 0) * 5;
      case 'moveRobber': {
        const hex = game.hexes[action.hexKey];
        const victims = action.victimPlayerIds || [];
        const strongest = victims.some(id => {
          const p = game.players.find(x => x.id === id);
          return p && p.victoryPoints >= 5;
        });
        return 50 + (strongest ? 10 : 0) + (hex?.number ? 6 - Math.abs(7 - hex.number) : 0);
      }
      case 'rollDice': return 100;
      case 'endTurn': return 0;
      case 'endSpecialBuild': return -1;
      default: return 1;
    }
  };
  if (options[0]?.type === 'discard') {
    const option = options[0];
    return { type: 'discard', resources: discardChoice(player, option.cardsToDiscard) };
  }
  if (options.some(a => a.type === 'respondToTrade')) {
    const offer = game.tradeOffer;
    const offered = RESOURCES.reduce((n, resource) => n + (offer.offer?.[resource] || 0), 0);
    const requested = RESOURCES.reduce((n, resource) => n + (offer.request?.[resource] || 0), 0);
    const useful = RESOURCES.reduce((n, resource) => {
      const held = player.resources?.[resource] || 0;
      return n + (offer.offer?.[resource] || 0) * (held < 2 ? 2 : 0.5) - (offer.request?.[resource] || 0) * (held <= 2 ? 2 : 1);
    }, 0);
    const accept = offered > 0 && requested > 0 && useful >= 1 && options.some(a => a.type === 'respondToTrade' && a.accept);
    return { type: 'respondToTrade', accept };
  }
  const sorted = [...options].sort((a, b) => rank(b) - rank(a));
  const selected = sorted[0];
  if ((selected?.type === 'moveRobber' || selected?.type === 'movePirate') && selected.victimPlayerIds?.length) {
    const target = game.players.filter(p => selected.victimPlayerIds.includes(p.id))
      .sort((a, b) => b.victoryPoints - a.victoryPoints)[0];
    return { type: selected.type, hexKey: selected.hexKey, stealFromPlayerId: target?.id };
  }
  return selected;
}


// In a 5–8-player Special Building Phase, the acting player differs from
// currentPlayerIndex. During setup/main phases these indices are identical.
export function getBotActor(game) {
  if (game.phase === 'waiting' || game.phase === 'finished') return null;
  if (game.isSeafarers && game.turnPhase === 'goldPick') {
    const pending = game.players.find((p,i) => p.isBot && (game.pendingGoldPicks?.[i] || 0)>0);
    return pending || null;
  }
  const index = game.phase === 'playing' && game.turnPhase === 'specialBuild' && game.specialBuildingPhase
    ? game.specialBuildIndex : game.currentPlayerIndex;
  const player = game.players[index];
  return player?.isBot ? player : null;
}

export async function runBotTurn(game, broadcast, { delayMs = 500, maxActions = 40, autoContinue = true } = {}) {
  if (game.__botBusy || game.phase === 'waiting' || game.phase === 'finished') return;
  game.__botBusy = true;
  try {
    let safety = 0;
    let lastSpecialKey = null;
    let specialActions = 0;
    while (game.phase !== 'finished' && safety++ < maxActions) {
      const player = getBotActor(game);
      if (!player) break;
      const special = game.turnPhase === 'specialBuild' && game.specialBuildingPhase;
      // Each bot may make up to two strategic construction choices during
      // its special window; this prevents repeated purchases until the deck
      // empties and keeps an eight-player match moving quickly.
      const specialKey = special ? `${game.specialBuildIndex}:${game.currentPlayerIndex}` : null;
      if (specialKey !== lastSpecialKey) {
        lastSpecialKey = specialKey;
        specialActions = 0;
      }
      if (delayMs > 0) await sleep(special ? Math.min(delayMs, 220) : delayMs);
      const options = getLegalActions(game, player.id);
      const action = special && specialActions >= 2
        ? options.find(option => option.type === 'endSpecialBuild')
        : chooseAction(game, player, options);
      if (!action) break;
      if (action.type === 'bankTrade' && (game.__botBankTrades || 0) >= 1) { game.__botBankTrades = 0; continue; }
      const result = executeLegalAction(game, player.id, action);
      if (result.success && action.type === 'bankTrade')
        log(game, `🏦 ${player.name} trocou ${action.giveAmount} ${names[action.giveResource]} por 1 ${names[action.getResource]} no banco`);
      if (!result.success) {
        console.warn('Bot action rejected:', action.type, result.error);
        if (action.type !== 'endTurn' && options.some(a => a.type === 'endTurn')) {
          executeLegalAction(game, player.id, { type: 'endTurn' });
          broadcast();
        }
        break;
      }
      // A bot's 7 can require several bots to discard. Resolve them immediately;
      // without this, the current bot has no legal action and appears frozen.
      if (action.type === 'rollDice' && game.turnPhase === 'discard') {
        runBotDiscards(game, broadcast);
      }
      if (special && action.type !== 'endSpecialBuild') specialActions++;
      if (action.type === 'bankTrade') game.__botBankTrades = (game.__botBankTrades || 0) + 1;
      if (action.type === 'endTurn') game.__botBankTrades = 0;
      broadcast();
      if (action.type === 'endTurn') break;
      if (game.isSeafarers && game.turnPhase === 'goldPick' && !getBotActor(game)) break;
      // A special-build pass may hand the opportunity directly to another
      // bot; the next loop iteration picks that bot rather than the turn owner.
    }
  } catch (error) {
    console.error('[Catan bot] Unexpected error while resolving turn:', error);
    // Keep the game responsive and provide a visible diagnostic instead of
    // leaving __botBusy set and the bot silently frozen.
    game.eventLog ||= [];
    game.eventLog.push({
      id: (game.__eventSeq = (game.__eventSeq || 0) + 1),
      at: Date.now(),
      message: '⚠️ Erro automático no turno do bot; tentando recuperar a partida'
    });
    if (game.eventLog.length > 100) game.eventLog.shift();
    try {
      const current = game.players[game.currentPlayerIndex];
      if (current?.isBot && game.phase === 'playing' && game.turnPhase === 'main') {
        const end = executeLegalAction(game, current.id, { type: 'endTurn' });
        if (!end.success) console.error('[Catan bot] Could not recover turn:', end.error);
      }
    } catch (recoveryError) {
      console.error('[Catan bot] Recovery failed:', recoveryError);
    }
  } finally {
    game.__botBusy = false;
    broadcast();
    if (autoContinue && game.phase !== 'finished' && getBotActor(game)) {
      try {
        if (game.turnPhase === 'discard') runBotDiscards(game, broadcast);
        const id = getBotActor(game)?.id;
        if (getLegalActions(game, id).length) {
          setTimeout(() => { void runBotTurn(game, broadcast).catch(error => console.error('[Catan bot] Restart failed:', error)); }, 250);
        }
      } catch (error) {
        console.error('[Catan bot] Failed to schedule next action:', error);
      }
    }
  }
}


export function runBotDiscards(game, broadcast) {
  if (game.turnPhase !== 'discard') return;
  for (const pending of [...(game.discardingPlayers || [])]) {
    const player = game.players[pending.playerIndex];
    if (!player?.isBot) continue;
    const options = getLegalActions(game, player.id);
    const action = chooseAction(game, player, options);
    if (!action || action.type !== 'discard') continue;
    const result = executeLegalAction(game, player.id, action);
    if (!result.success) console.warn('Bot discard rejected:', result.error);
    else broadcast();
  }
}

export function runBotTradeResponses(game, broadcast) {
  if (!game.tradeOffer) return;
  for (const player of game.players) {
    if (!player.isBot || !game.tradeOffer || game.tradeOffer.from === game.players.indexOf(player)) continue;
    const actions = getLegalActions(game, player.id).filter(a => a.type === 'respondToTrade');
    if (!actions.length) continue;
    const choice = chooseAction(game, player, actions);
    const proposed = game.tradeOffer ? {from:game.tradeOffer.from,offer:{...game.tradeOffer.offer},request:{...game.tradeOffer.request}} : null;
    const result = executeLegalAction(game, player.id, choice);
    if (result.success && result.traded && proposed)
      log(game, `🤝 ${game.players[proposed.from]?.name} trocou ${format(proposed.offer)} por ${format(proposed.request)} com ${player.name}`);
    if (result.success) broadcast();
  }
}
