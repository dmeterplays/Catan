import * as Game from './gameLogic.js';
import { getLegalActions, executeLegalAction } from './legalActions.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      case 'placeRoad': return 40;
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
    const accept = offered >= requested && options.some(a => a.type === 'respondToTrade' && a.accept);
    return { type: 'respondToTrade', accept };
  }
  const sorted = [...options].sort((a, b) => rank(b) - rank(a));
  const selected = sorted[0];
  if (selected?.type === 'moveRobber' && selected.victimPlayerIds?.length) {
    const target = game.players.filter(p => selected.victimPlayerIds.includes(p.id))
      .sort((a, b) => b.victoryPoints - a.victoryPoints)[0];
    return { type: 'moveRobber', hexKey: selected.hexKey, stealFromPlayerId: target?.id };
  }
  return selected;
}

export async function runBotTurn(game, broadcast) {
  if (game.__botBusy || game.phase === 'waiting' || game.phase === 'finished') return;
  game.__botBusy = true;
  try {
    let safety = 0;
    while (game.phase !== 'finished' && safety++ < 40) {
      const player = game.players[game.currentPlayerIndex];
      if (!player?.isBot) break;
      await sleep(500);
      const options = getLegalActions(game, player.id);
      const action = chooseAction(game, player, options);
      if (!action) break;
      if (action.type === 'bankTrade' && (game.__botBankTrades || 0) >= 1) break;
      const result = executeLegalAction(game, player.id, action);
      if (!result.success) {
        console.warn('Bot action rejected:', action.type, result.error);
        break;
      }
      if (action.type === 'bankTrade') game.__botBankTrades = (game.__botBankTrades || 0) + 1;
      if (action.type === 'endTurn') game.__botBankTrades = 0;
      broadcast();
      if (action.type === 'endTurn') break;
    }
  } finally {
    game.__botBusy = false;
    broadcast();
    if (game.phase !== 'finished' && game.players[game.currentPlayerIndex]?.isBot && getLegalActions(game, game.players[game.currentPlayerIndex].id).length) {
      setTimeout(() => runBotTurn(game, broadcast), 250);
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
    const result = executeLegalAction(game, player.id, choice);
    if (result.success) broadcast();
  }
}
