import * as Game from './gameLogic.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const hasCost = (player, cost) => Object.entries(cost).every(([key, n]) => (player.resources?.[key] || 0) >= n);

export function getLegalActions(game, playerId) {
  const index = game.players.findIndex(p => p.id === playerId);
  if (index < 0 || ['waiting', 'finished'].includes(game.phase)) return [];
  const player = game.players[index];
  const pendingTrade = game.tradeOffer && game.tradeOffer.from !== index && !game.tradeOffer.responses?.[playerId];
  if (game.players[game.currentPlayerIndex]?.id !== playerId && !(game.turnPhase === 'discard' && game.discardingPlayers?.some(p => p.playerIndex === index)) && !pendingTrade) return [];
  const actions = [];
  const add = (type, data = {}) => actions.push({ type, ...data });

  if (pendingTrade) {
    const offer = game.tradeOffer;
    const canAccept = RESOURCES.every(resource => (player.resources?.[resource] || 0) >= (offer.request?.[resource] || 0));
    add('respondToTrade', { accept: false });
    if (canAccept) add('respondToTrade', { accept: true });
    if (game.players[game.currentPlayerIndex]?.id !== playerId) return actions;
  }

  if (game.phase === 'setup') {
    if (game.setupSettlementKey) {
      Object.keys(game.edges).forEach(edgeKey => {
        if (Game.canPlaceRoad(game, playerId, edgeKey, true, game.setupSettlementKey).valid)
          add('placeRoad', { edgeKey, setup: true, lastSettlement: game.setupSettlementKey });
      });
    } else {
      Object.keys(game.vertices).forEach(vertexKey => {
        if (Game.canPlaceSettlement(game, playerId, vertexKey, true).valid)
          add('placeSettlement', { vertexKey, setup: true });
      });
    }
    return actions;
  }

  if (game.turnPhase === 'discard') {
    const pending = game.discardingPlayers?.find(p => p.playerIndex === index);
    if (pending) add('discard', {
      cardsToDiscard: pending.cardsToDiscard,
      available: Object.fromEntries(RESOURCES.map(r => [r, player.resources?.[r] || 0]))
    });
    return actions;
  }

  if (game.turnPhase === 'robber') {
    Object.entries(game.hexes).forEach(([hexKey, hex]) => {
      if (hexKey === game.robber || !hex.resource) return;
      const victims = Game.getPlayersOnHex(game, hexKey, index)
        .filter(i => Object.values(game.players[i].resources || {}).some(n => n > 0))
        .map(i => game.players[i].id);
      add('moveRobber', { hexKey, victimPlayerIds: victims });
    });
    return actions;
  }

  if (game.turnPhase === 'roll') { add('rollDice'); return actions; }
  if (!['main', 'specialBuild'].includes(game.turnPhase)) return actions;
  const special = game.turnPhase === 'specialBuild';

  if (player.settlements > 0 && hasCost(player, { brick: 1, lumber: 1, wool: 1, grain: 1 }))
    Object.keys(game.vertices).forEach(vertexKey => {
      if (Game.canPlaceSettlement(game, playerId, vertexKey).valid) add('placeSettlement', { vertexKey });
    });
  if (player.roads > 0 && (hasCost(player, { brick: 1, lumber: 1 }) || (game.freeRoads || 0) > 0))
    Object.keys(game.edges).forEach(edgeKey => {
      if (Game.canPlaceRoad(game, playerId, edgeKey).valid) add('placeRoad', { edgeKey });
    });
  if (player.cities > 0 && hasCost(player, { ore: 3, grain: 2 }))
    Object.keys(game.vertices).forEach(vertexKey => {
      const v = game.vertices[vertexKey];
      if (v?.owner === index && v?.building === 'settlement') add('upgradeToCity', { vertexKey });
    });
  if (!special && !game.tradeOffer) {
    for (const giveResource of RESOURCES) {
      const ratio = Game.getTradeRatio(game, index, giveResource);
      if ((player.resources?.[giveResource] || 0) < ratio) continue;
      for (const getResource of RESOURCES) {
        if (getResource !== giveResource) add('bankTrade', { giveResource, giveAmount: ratio, getResource });
      }
    }
  }
  if (!special && hasCost(player, { ore: 1, grain: 1, wool: 1 }) && game.devCardDeck?.length) add('buyDevCard');
  if (!special) add('endTurn');
  return actions;
}

export function executeLegalAction(game, playerId, action) {
  if (!action || typeof action.type !== 'string') return { success: false, error: 'Ação inválida.' };
  const legal = getLegalActions(game, playerId);
  const option = legal.find(item => item.type === action.type &&
    (action.type === 'discard' || action.type === 'moveRobber'
      ? item === legal.find(candidate => candidate.type === action.type && candidate.hexKey === action.hexKey)
      : Object.keys(action).every(key => key === 'type' || item[key] === action[key])));
  if (!option) return { success: false, error: 'Essa opção não está mais disponível.' };

  switch (action.type) {
    case 'placeSettlement': {
      const result = Game.placeSettlement(game, playerId, action.vertexKey);
      if (result.success && game.phase === 'setup') game.setupSettlementKey = action.vertexKey;
      return result;
    }
    case 'placeRoad': {
      const result = Game.placeRoad(game, playerId, action.edgeKey, !!action.setup, option.lastSettlement);
      if (result.success && action.setup) {
        delete game.setupSettlementKey;
        return Game.advanceSetup(game, playerId);
      }
      return result;
    }
    case 'upgradeToCity': return Game.upgradeToCity(game, playerId, action.vertexKey);
    case 'rollDice': return Game.rollDice(game, playerId);
    case 'buyDevCard': return Game.buyDevCard(game, playerId);
    case 'bankTrade': return Game.bankTrade(game, playerId, action.giveResource, action.giveAmount, action.getResource);
    case 'respondToTrade': return Game.respondToTrade(game, playerId, action.accept);
    case 'endTurn': return Game.endTurn(game, playerId);
    case 'discard': {
      const counts = action.resources;
      if (!counts || typeof counts !== 'object' || RESOURCES.some(r => !Number.isInteger(counts[r] || 0) || (counts[r] || 0) < 0 || (counts[r] || 0) > (option.available[r] || 0)) ||
          Object.keys(counts).some(r => !RESOURCES.includes(r)) ||
          RESOURCES.reduce((sum, r) => sum + (counts[r] || 0), 0) !== option.cardsToDiscard)
        return { success: false, error: 'Seleção de descarte inválida.' };
      return Game.discardCards(game, playerId, counts);
    }
    case 'moveRobber': {
      const victimId = action.stealFromPlayerId || null;
      if (victimId && !option.victimPlayerIds.includes(victimId))
        return { success: false, error: 'Jogador escolhido não pode ser roubado nesse hexágono.' };
      return Game.moveRobber(game, playerId, action.hexKey, victimId);
    }
    default: return { success: false, error: 'Tipo de ação não suportado.' };
  }
}
