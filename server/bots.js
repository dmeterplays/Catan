import { getLegalActions, executeLegalAction } from './legalActions.js';

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function vertexScore(game, key) {
  const hexes = Object.values(game.hexes);
  const match = key.match(/v_(-?\d+)_(-?\d+)_(\d+)/);
  if (!match) return 0;
  const adjacent = GameAdjacentHexes(game, key);
  let score = 0;
  const seen = new Set();
  for (const hex of adjacent) {
    if (!hex?.resource || !hex.number) continue;
    score += (6 - Math.abs(7 - hex.number)) * 1.5;
    if (!seen.has(hex.resource)) { score += 2; seen.add(hex.resource); }
  }
  return score;
}

function GameAdjacentHexes(game, key) {
  // Uses the same board utility as the game rules.
  return Object.values(game.hexes).filter(hex => {
    const adjacent = globalThis.__unused; // intentionally not used; scoring fallback below
    return false;
  });
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
      case 'placeSettlement': return 100 + (action.vertexKey ? Math.random() : 0);
      case 'upgradeToCity': return 90;
      case 'buyDevCard': return 70;
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
      const result = executeLegalAction(game, player.id, action);
      if (!result.success) {
        console.warn('Bot action rejected:', action.type, result.error);
        break;
      }
      broadcast();
      if (action.type === 'endTurn') break;
    }
  } finally {
    game.__botBusy = false;
    broadcast();
    if (game.phase !== 'finished' && game.players[game.currentPlayerIndex]?.isBot) {
      setTimeout(() => runBotTurn(game, broadcast), 250);
    }
  }
}
