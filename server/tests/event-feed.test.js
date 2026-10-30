import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { executeLegalAction } from '../legalActions.js';

test('rolagens após o setup registram resultado no histórico de todos', () => {
  const game = Game.createGame('TEST01', {id:'human',name:'João'}, false, true, 'random', true, false);
  assert.equal(Game.addPlayer(game, {id:'bot',name:'Bot'}).success, true);
  assert.equal(Game.startGame(game).success, true);
  assert.equal(game.phase, 'playing');
  game.eventLog = [];
  // More than one roll checks both the 7 case and resource-distributing rolls.
  for (let n = 0; n < 15; n++) {
    game.turnPhase = 'roll';
    const player = game.players[game.currentPlayerIndex];
    const result = executeLegalAction(game, player.id, {type:'rollDice'});
    assert.equal(result.success, true);
    assert.ok(game.eventLog.some(event => event.message.includes('🎲')), 'a rolagem deve ser registrada');
  }
  const view = Game.getPlayerView(game, 'human');
  assert.ok(Array.isArray(view.eventLog));
  assert.ok(view.eventLog.some(event => event.message.includes('🎲')));
  assert.equal(view.__publicSnapshot, undefined);
});

test('recursos obtidos nos dados aparecem pelo nome e não como cartas genéricas', () => {
  const game = Game.createGame('TEST02', {id:'a',name:'Ana'}, false, true, 'random', true, false);
  Game.addPlayer(game, {id:'b',name:'Beto'});
  Game.startGame(game);
  game.eventLog = [];
  let earned = false;
  for (let n = 0; n < 60; n++) {
    game.turnPhase = 'roll';
    const result = Game.rollDice(game, game.players[game.currentPlayerIndex].id);
    assert.equal(result.success, true);
    if (Object.values(result.resourceGains || {}).some(g => Object.values(g).some(v => typeof v === 'number' && v > 0))) {
      earned = true;
      break;
    }
  }
  assert.ok(earned, 'o tabuleiro inicial deve produzir recursos em alguma rolagem');
  assert.ok(game.eventLog.some(e => /recebeu .*(madeira|tijolo|trigo|lã|minério) pelos dados/.test(e.message)));
});
