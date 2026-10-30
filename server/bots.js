import * as Game from './gameLogic.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function scoreVertex(game, key) {
  const adjacent = Game.getVertexAdjacentHexes(game, key);
  let score = 0;
  const seen = new Set();
  for (const hex of adjacent) {
    if (!hex || !hex.resource || !hex.number) continue;
    const probability = 6 - Math.abs(7 - hex.number);
    score += probability * 1.4;
    if (!seen.has(hex.resource)) {
      score += 2.5;
      seen.add(hex.resource);
    }
  }
  return score;
}

function chooseSetupSettlement(game, playerId) {
  return Object.keys(game.vertices)
    .filter(key => Game.canPlaceSettlement(game, playerId, key, true).valid)
    .map(key => ({ key, score: scoreVertex(game, key) + Math.random() * 0.15 }))
    .sort((a, b) => b.score - a.score)[0]?.key;
}

function chooseSetupRoad(game, playerId, settlement) {
  return Object.keys(game.edges)
    .filter(key => Game.canPlaceRoad(game, playerId, key, true, settlement).valid)
    .map(key => {
      return { key, score: Math.random() };
    })
    .sort((a, b) => b.score - a.score)[0]?.key;
}

function chooseRobber(game, playerIndex) {
  const candidates = Object.entries(game.hexes).filter(([key, hex]) => key !== game.robber && hex.resource);
  return candidates.map(([key, hex]) => {
    let score = 0;
    Object.values(game.vertices).forEach(v => {
      if (v?.building && v.owner !== playerIndex) score += 1;
    });
    return { key, score: score + (hex.number ? 6 - Math.abs(7 - hex.number) : 0) + Math.random() };
  }).sort((a, b) => b.score - a.score)[0]?.key;
}

function discardForBot(player, amount) {
  const resources = Object.fromEntries(RESOURCES.map(r => [r, 0]));
  const priority = [...RESOURCES].sort((a, b) => player.resources[a] - player.resources[b]);
  let left = amount;
  for (const resource of priority) {
    const take = Math.min(left, player.resources[resource]);
    resources[resource] = take;
    left -= take;
    if (!left) break;
  }
  return resources;
}

function bestAffordableAction(game, playerId) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  const player = game.players[playerIndex];
  const canAfford = cost => Object.entries(cost).every(([r, n]) => player.resources[r] >= n);
  if (player.cities > 0 && canAfford({ ore: 3, grain: 2 })) {
    const key = Object.keys(game.vertices).find(k => game.vertices[k]?.owner === playerIndex && game.vertices[k]?.building === 'settlement');
    if (key && Game.upgradeToCity(game, playerId, key).success) return true;
  }
  if (player.settlements > 0 && canAfford({ brick: 1, lumber: 1, wool: 1, grain: 1 })) {
    const candidates = Object.keys(game.vertices)
      .filter(k => Game.canPlaceSettlement(game, playerId, k).valid)
      .map(k => ({ key: k, score: scoreVertex(game, k) }))
      .sort((a, b) => b.score - a.score);
    for (const item of candidates) if (Game.placeSettlement(game, playerId, item.key).success) return true;
  }
  if (player.roads > 0 && canAfford({ brick: 1, lumber: 1 })) {
    const candidates = Object.keys(game.edges).filter(k => Game.canPlaceRoad(game, playerId, k).valid);
    if (candidates.length && Game.placeRoad(game, playerId, candidates[Math.floor(Math.random() * candidates.length)]).success) return true;
  }
  if (canAfford({ ore: 1, grain: 1, wool: 1 }) && game.devCardDeck?.length) {
    if (Game.buyDevCard(game, playerId).success) return true;
  }
  return false;
}

export async function runBotTurn(game, broadcast) {
  if (game.__botBusy || game.phase === 'waiting' || game.phase === 'finished') return;
  game.__botBusy = true;
  try {
    let safety = 0;
    while (game.phase !== 'finished' && safety++ < 30) {
      const player = game.players[game.currentPlayerIndex];
      if (!player?.isBot) break;
      const id = player.id;
      await sleep(650);

      if (game.phase === 'setup') {
        const settlement = chooseSetupSettlement(game, id);
        if (!settlement || !Game.placeSettlement(game, id, settlement).success) break;
        const road = chooseSetupRoad(game, id, settlement);
        if (!road || !Game.placeRoad(game, id, road, true, settlement).success) break;
        Game.advanceSetup(game, id);
      } else if (game.turnPhase === 'roll') {
        Game.rollDice(game, id);
      } else if (game.turnPhase === 'discard') {
        const info = game.discardingPlayers.find(d => d.playerIndex === game.currentPlayerIndex);
        if (info) Game.discardCards(game, id, discardForBot(player, info.cardsToDiscard));
        else break;
      } else if (game.turnPhase === 'robber') {
        const hexKey = chooseRobber(game, game.currentPlayerIndex);
        const victim = game.players.filter((p, i) => i !== game.currentPlayerIndex && Object.values(p.resources).some(n => n > 0))
          .sort((a, b) => b.victoryPoints - a.victoryPoints)[0];
        if (!hexKey || !Game.moveRobber(game, id, hexKey, victim?.id).success) break;
      } else if (game.turnPhase === 'main') {
        let actions = 0;
        while (actions++ < 8 && bestAffordableAction(game, id)) {
          await sleep(250);
          if (game.phase === 'finished') break;
        }
        if (game.phase !== 'finished') Game.endTurn(game, id);
      } else break;
      broadcast();
    }
  } finally {
    game.__botBusy = false;
    broadcast();
    if (game.phase !== 'finished' && game.players[game.currentPlayerIndex]?.isBot) {
      setTimeout(() => runBotTurn(game, broadcast), 250);
    }
  }
}
