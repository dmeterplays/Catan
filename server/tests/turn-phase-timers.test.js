import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';

function create() {
  const game = Game.createGame('TIME01', {id:'a',name:'Ana'}, false, true, 'random', false, false);
  Game.addPlayer(game, {id:'b',name:'Beto'});
  Game.startGame(game);
  return game;
}
test('preparação automática encontra aldeia e estrada legais até passar a vez',()=>{
  const game=create();
  for (let n=0;n<game.players.length*4;n++) {
    const id=game.players[game.currentPlayerIndex].id;
    const actions=getLegalActions(game,id);
    const type=game.setupSettlementKey ? 'placeRoad' : 'placeSettlement';
    const action=actions.find(a=>a.type===type);
    assert.ok(action,`há ação de preparação ${type}`);
    const result=executeLegalAction(game,id,action);
    assert.equal(result.success,true,result.error);
  }
  assert.equal(game.phase,'playing');
  assert.equal(game.turnPhase,'roll');
});
test('picks de Ano de Abundância e estradas gratuitas são privados',()=>{
  const game=create();
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=game.players.findIndex(p=>p.id==='a');
  game.freeRoads=2;
  game.yearOfPlentyPicks=2;
  const owner=Game.getPlayerView(game,'a');
  const stranger=Game.getPlayerView(game,'b');
  assert.equal(owner.freeRoads,2);
  assert.equal(owner.yearOfPlentyPicks,2);
  assert.equal(stranger.freeRoads,0);
  assert.equal(stranger.yearOfPlentyPicks,0);
});
test('novo ID de rolagem aparece na visão sem revelar mãos de terceiros',()=>{
  const game=create();game.phase='playing';game.turnPhase='roll';game.currentPlayerIndex=game.players.findIndex(p=>p.id==='a');
  const result=Game.rollDice(game,'a');
  assert.equal(result.success,true);
  const view=Game.getPlayerView(game,'b');
  assert.equal(view.rollSerial,game.__publicRollEvent.id);
  assert.equal(typeof view.players[game.currentPlayerIndex].resources,'number');
});
