import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import {relocateKnight} from '../knightBoard.js';

function createRoom(size) {
  const game=Game.createGame('ck-test',{id:'p0',name:'Player 0'},size>4,true,'random',true,true,false);
  for(let i=1;i<size;i++) assert.equal(Game.addPlayer(game,{id:'p'+i,name:'Player '+i}).success,true);
  const result=Game.startGame(game);
  assert.equal(result.success,true);
  assert.equal(game.players.length,size);
  return game;
}
test('4 and 8 player C&K rooms start with cities and correctly scaled maps',()=>{
  for(const size of [4,8]) {
    const game=createRoom(size);
    assert.equal(game.victoryTarget,size===8?16:13);
    assert.equal(game.phase,'playing');
    assert.equal(game.players.every(p=>p.cities<=3),true);
    assert.ok(Object.values(game.vertices).filter(v=>v.building==='city').length>=size);
    assert.ok(game.players.every(p=>p.commodities && p.cKKnights));
  }
});
test('city improvements can grant and transfer an adapted metropolis',()=>{
  const game=createRoom(4);
  game.currentPlayerIndex=0;
  game.turnPhase='main';
  const p=game.players[0];
  p.commodities.paper=20;
  for(let i=0;i<4;i++) assert.equal(Game.buyCityImprovement(game,p.id,'science').success,true);
  assert.ok(p.metropolisTracks.includes('science'));
  assert.equal(game.metropolises.science.playerId,p.id);
  assert.equal(p.cityImprovements.science,4);
});
test('knights deploy on owned roads and require activation before moving',()=>{
  const game=createRoom(4);
  game.currentPlayerIndex=0;
  game.turnPhase='main';
  const p=game.players[0];
  p.resources.ore+=2;p.resources.wool+=2;p.resources.grain+=2;
  const r=Game.recruitKnight(game,p.id);
  assert.equal(r.success,true);
  const unit=Object.values(game.knightPieces)[0];
  assert.ok(unit);
  assert.equal(unit.owner,0);
  assert.equal(Game.activateKnight(game,p.id,'basic').success,true);
  assert.equal(unit.active,true);
  assert.equal(relocateKnight(game,p.id,unit.id,'v_999_999_0').success,false);
});
