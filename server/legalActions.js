import * as Game from './gameLogic.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];

function hasCost(player, cost) {
  return Object.entries(cost).every(([resource, amount]) => (player.resources?.[resource] || 0) >= amount);
}

/**
 * The single source of truth for choices available to a player.
 * Both the human client and bot policy consume this list.
 */
export function getLegalActions(game, playerId) {
  const playerIndex = game.players.findIndex(player => player.id === playerId);
  if (playerIndex < 0 || game.phase === 'waiting' || game.phase === 'finished') return [];
  const player = game.players[playerIndex];
  const isCurrent = game.players[game.currentPlayerIndex]?.id === playerId;
  if (!isCurrent) return [];

  const actions = [];
  const add = (type, params = {}) => actions.push({ type, ...params });

  if (game.phase === 'setup') {
    const settlements = Object.keys(game.vertices).filter(key =>
      Game.canPlaceSettlement(game, playerId, key, true).valid
    );
    settlements.forEach(vertexKey => add('placeSettlement', { vertexKey, setup: true }));
    if (game.setupSettlementKey) {
      Object.keys(game.edges).filter(key =>
        Game.canPlaceRoad(game, playerId, key, true, game.setupSettlementKey).valid
      ).forEach(edgeKey => add('placeRoad', { edgeKey, setup: true, lastSettlement: game.setupSettlementKey }));
    }
    return actions;
  }

  if (game.turnPhase === 'discard') {
    const pending = game.discardingPlayers?.find(item => item.playerIndex === playerIndex);
    if (pending) add('discard', {
      cardsToDiscard: pending.cardsToDiscard,
      available: Object.fromEntries(RESOURCES.map(resource => [resource, player.resources[resource] || 0]))
    });
    return actions;
  }

  if (game.turnPhase === 'robber') {
    Object.entries(game.hexes).filter(([key, hex]) => key !== game.robber && hex.resource)
      .forEach(([hexKey]) => {
        const victims = Game.getPlayersOnHex(game, hexKey, playerIndex)
          .filter(index => Object.values(game.players[index].resources || {}).some(count => count > 0))
          .map(index => game.players[index].id);
        add('moveRobber', { hexKey, victimPlayerIds: victims });
      });
    return actions;
  }

  if (game.turnPhase === 'roll') {
    add('rollDice');
    return actions;
  }

  if (game.turnPhase !== 'main' && game.turnPhase !== 'specialBuild') return actions;

  const specialBuild = game.turnPhase === 'specialBuild';
  if (player.settlements > 0 && hasCost(player, { brick: 1, lumber: 1, wool: 1, grain: 1 })) {
    Object.keys(game.vertices).filter(key => Game.canPlaceSettlement(game, playerId, key).valid)
      .forEach(vertexKey => add('placeSettlement', { vertexKey }));
  }
  if (player.roads > 0 && (hasCost(player, { brick: 1, lumber: 1 }) || (player.freeRoads || 0) > 0)) {
    Object.keys(game.edges).filter(key => Game.canPlaceRoad(game, playerId, key).valid)
      .forEach(edgeKey => add('placeRoad', { edgeKey }));
  }
  if (player.cities > 0 && hasCost(player, { ore: 3, grain: 2 })) {
    Object.keys(game.vertices).filter(key =>
      game.vertices[key]?.owner === playerIndex && game.vertices[key]?.building === 'settlement'
    ).forEach(vertexKey => add('upgradeToCity', { vertexKey }));
  }
  if (!specialBuild && hasCost(player, { ore: 1, grain: 1, wool: 1 }) && game.devCardDeck?.length) {
    add('buyDevCard');
  }
  if (!specialBuild) add('endTurn');
  return actions;
}

/** Re-checks the current legal list immediately before executing an action. */
export function executeLegalAction(game, playerId, action) {
  if (!action || typeof action.type !== 'string') return { success: false, error: 'Ação inválida.' };
  const legal = getLegalActions(game, playerId);
  const matches = legal.some(option => option.type === action.type &&
    Object.keys(action).every(key => key === 'type' || option[key] === action[key]));
  if (!matches) return { success: false, error: 'Essa opção não está mais disponível.' };

  switch (action.type) {
    case 'placeSettlement': {\n      const result = Game.placeSettlement(game, playerId, action.vertexKey);\n      if (result.success && game.phase === 'setup') game.setupSettlementKey = action.vertexKey;\n      return result;\n    }
    case 'placeRoad': {\n      const result = Game.placeRoad(game, playerId, action.edgeKey, !!action.setup, action.lastSettlement);\n      if (result.success && action.setup) {\n        delete game.setupSettlementKey;\n        return Game.advanceSetup(game, playerId);\n      }\n      return result;\n    }
    case 'upgradeToCity': return Game.upgradeToCity(game, playerId, action.vertexKey);
    case 'rollDice': return Game.rollDice(game, playerId);
    case 'buyDevCard': return Game.buyDevCard(game, playerId);
    case 'endTurn': return Game.endTurn(game, playerId);
    case 'discard': return Game.discardCards(game, playerId, action.resources);
    case 'moveRobber': {
      const victimId = action.stealFromPlayerId || null;
      if (victimId && !legal.find(option => option.type === 'moveRobber' && option.hexKey === action.hexKey)?.victimPlayerIds.includes(victimId)) {
        return { success: false, error: 'Jogador escolhido não pode ser roubado nesse hexágono.' };
      }
      return Game.moveRobber(game, playerId, action.hexKey, victimId);
    }
    default: return { success: false, error: 'Tipo de ação não suportado.' };
  }
}
