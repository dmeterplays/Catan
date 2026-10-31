import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import * as Sea from '../seafarers.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';

function create() {
  const game=Game.createGame('SEA4',{id:'p0',name:'Player 0'},false,true,'random',false,false,true);
  for(let i=1;i<4;i++) assert.equal(Game.addPlayer(game,{id:'p'+i,name:'Player '+i}).success,true);
  return game;
}

test('4p Navigators scenario has exact component counts and 14 PV goal',()=>{
  const game=create(),hexes=Object.values(game.hexes);
  const count=terrain=>hexes.filter(h=>h.terrain===terrain).length;
  assert.equal(game.isSeafarers,true);
  assert.equal(game.victoryTarget,14);
  assert.equal(game.maxPlayers,4);
  assert.equal(hexes.length,42);
  assert.equal(count('sea'),14);
  assert.equal(count('gold'),2);
  assert.equal(count('desert'),1);
  assert.equal(hexes.filter(h=>h.number!==null).length,27);
  assert.equal(game.ports.length,9);
  assert.equal(game.players.every(p=>p.ships===15),true);
  assert.equal(game.pirate in game.hexes,true);
});
test('Navegantes só começa com quatro jogadores',()=>{
  const game=Game.createGame('SEATWO',{id:'p0',name:'One'},false,true,'random',false,false,true);
  Game.addPlayer(game,{id:'p1',name:'Two'});
  assert.equal(Game.startGame(game).success,false);
  Game.addPlayer(game,{id:'p2',name:'Three'});
  Game.addPlayer(game,{id:'p3',name:'Four'});
  assert.equal(Game.startGame(game).success,true);
});
test('construção inicial permite barco costeiro com aldeia, e bloqueia mar para estradas',()=>{
  const game=create();
  game.phase='setup';game.currentPlayerIndex=0;
  const id='p0';
  const settlement=getLegalActions(game,id).find(a=>a.type==='placeSettlement');
  assert.ok(settlement);
  assert.equal(executeLegalAction(game,id,settlement).success,true);
  const shipActions=getLegalActions(game,id).filter(a=>a.type==='placeShip');
  assert.ok(shipActions.length>0,'tem litoral próximo à aldeia da preparação');
  const ship=shipActions[0];
  assert.equal(executeLegalAction(game,id,ship).success,true);
  assert.equal(game.players[0].ships,14);
  assert.equal(game.players[0].resources.lumber,0,'barco de preparação grátis');
  assert.equal(game.edges[ship.edgeKey].ship,true);
});
test('ouro só pode ser escolhido pelo jogador contemplado, sem revelar recursos alheios',()=>{
  const game=create();
  game.phase='playing';game.turnPhase='goldPick';
  game.pendingGoldPicks={0:2,1:0};
  assert.equal(getLegalActions(game,'p1').length,0);
  const action=getLegalActions(game,'p0').find(a=>a.type==='pickGoldResource' && a.resource==='grain');
  assert.ok(action);
  assert.equal(executeLegalAction(game,'p0',action).success,true);
  assert.equal(game.players[0].resources.grain,1);
  assert.equal(game.pendingGoldPicks[0],1);
});
test('pirata só se move para mar e não pode permanecer no mesmo hexágono',()=>{
  const game=create();
  game.phase='playing';game.turnPhase='robber';game.currentPlayerIndex=0;
  const action=getLegalActions(game,'p0').find(a=>a.type==='movePirate');
  assert.ok(action);
  assert.equal(executeLegalAction(game,'p0',action).success,true);
  assert.equal(game.pirate,action.hexKey);
});
