import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';
import { runBotDiscards } from '../bots.js';

function fixture() {
  return {
    phase: 'playing', turnPhase: 'discard', currentPlayerIndex: 0,
    players: [
      { id: 'human', resources: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }, isBot: false },
      { id: 'bot', resources: { brick: 8, lumber: 0, wool: 0, grain: 0, ore: 0 }, isBot: true }
    ],
    discardingPlayers: [{ playerIndex: 1, cardsToDiscard: 4 }]
  };
}

test('jogador fora do turno pode descartar quando solicitado', () => {
  const game = fixture();
  assert.equal(getLegalActions(game, 'bot')[0]?.type, 'discard');
  assert.deepEqual(getLegalActions(game, 'human'), []);
});

test('descartes inválidos são rejeitados', () => {
  const game = fixture();
  assert.equal(executeLegalAction(game, 'bot', { type: 'discard', resources: { brick: 5 } }).success, false);
  assert.equal(game.players[1].resources.brick, 8);
});

test('bot descarta exatamente o necessário usando a camada legal', () => {
  const game = fixture();
  let broadcasts = 0;
  runBotDiscards(game, () => broadcasts++);
  assert.equal(game.players[1].resources.brick, 4);
  assert.equal(game.discardingPlayers.length, 0);
  assert.equal(game.turnPhase, 'robber');
  assert.ok(broadcasts > 0);
});

test('ação de outro jogador é rejeitada fora do descarte', () => {
  const game = fixture();
  game.turnPhase = 'roll';
  game.discardingPlayers = [];
  assert.deepEqual(getLegalActions(game, 'bot'), []);
  assert.equal(executeLegalAction(game, 'bot', { type: 'rollDice' }).success, false);
});
