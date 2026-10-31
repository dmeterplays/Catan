import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../gameLogic.js';
import { NAVIGATORS_SCENARIO_1, getWaterEdgeType, canPlaceShip } from '../seafarers.js';

test('cenário 1 para quatro jogadores segue quantidades do manual',()=>{
  const spec=NAVIGATORS_SCENARIO_1;
  assert.equal(spec.players,4);
  assert.equal(spec.victoryPoints,14);
  assert.equal(spec.bonusFirstSettlementOnSmallIsland,2);
  const total=p=>Object.entries(p).filter(([k])=>k!=='numberTokens').reduce((n,[,v])=>n+v,0);
  assert.equal(total(spec.mainIsland),29);
  assert.equal(total(spec.smallIslands),13);
  assert.equal(spec.mainIsland.sea+spec.smallIslands.sea,14);
  assert.equal(spec.smallIslands.gold,2);
  assert.equal(spec.ports.specific+spec.ports.generic,9);
});
function fixture(){
  const game=createGame('NAV1',{id:'a',name:'Ana'});
  game.isSeafarers=true;
  game.hexes['1,0'].terrain='sea';
  game.hexes['1,0'].resource=null;
  game.players[0].ships=15;
  game.players[0].resources.lumber=2;
  game.players[0].resources.wool=2;
  return game;
}
test('barco usa madeira e lã, não pode ser colocado numa estrada de terra',()=>{
  const game=fixture();
  assert.equal(getWaterEdgeType(game,'e_0_0_1'),'coast');
  assert.equal(getWaterEdgeType(game,'e_0_0_4'),'land');
  assert.equal(canPlaceShip(game,'a','e_0_0_4').valid,false);
});
test('aldeia costeira permite barco no lado costeiro durante setup',()=>{
  const game=fixture();
  game.vertices['v_0_0_1']={building:'settlement',owner:0};
  assert.equal(canPlaceShip(game,'a','e_0_0_1',{setup:true,settlementKey:'v_0_0_1'}).valid,true);
  assert.equal(canPlaceShip(game,'a','e_0_0_1').valid,true);
});
test('não é possível continuar uma estrada diretamente com barco nem passar por aldeia adversária',()=>{
  const game=fixture();
  game.edges['e_0_0_0']={road:true,owner:0};
  assert.equal(canPlaceShip(game,'a','e_0_0_1').valid,false);
  game.vertices['v_0_0_1']={building:'settlement',owner:1};
  assert.equal(canPlaceShip(game,'a','e_0_0_1').valid,false);
});
test('um lado costeiro já ocupado por estrada não aceita barco',()=>{
  const game=fixture();
  game.vertices['v_0_0_1']={building:'settlement',owner:0};
  game.edges['e_0_0_1']={road:true,owner:0};
  assert.equal(canPlaceShip(game,'a','e_0_0_1').valid,false);
});
