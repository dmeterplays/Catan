import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';

function fixture(blockingBuilding = 'settlement') {
  const game = Game.createGame('ROADS1', {id:'red',name:'Vermelho'}, false, true, 'standard', false, false);
  assert.equal(Game.addPlayer(game,{id:'blue',name:'Azul'}).success,true);
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=0;
  game.players[0].resources={brick:8,lumber:8,wool:0,grain:0,ore:0};
  game.edges['e_0_0_0']={road:true,owner:0};
  // Edges 0 and 1 meet at physical vertex 1, which is owned by the opponent.
  game.vertices['v_0_0_1']={building:blockingBuilding,owner:1};
  return game;
}

for (const building of ['settlement','city']) {
  test(`adversário com ${building} bloqueia expansão de estrada`, () => {
    const game=fixture(building);
    assert.equal(Game.canPlaceRoad(game,'red','e_0_0_1').valid,false);
    assert.equal(executeLegalAction(game,'red',{type:'placeRoad',edgeKey:'e_0_0_1'}).success,false);
    assert.equal(getLegalActions(game,'red').some(a=>a.type==='placeRoad'&&a.edgeKey==='e_0_0_1'),false);
    assert.equal(game.edges['e_0_0_1'].road,false);
  });
  test(`estrada gratuita não atravessa ${building} adversária`, () => {
    const game=fixture(building);
    game.freeRoads=1;
    assert.equal(Game.canPlaceRoad(game,'red','e_0_0_1').valid,false);
  });
}

test('aldeia própria permite estender estrada pelo cruzamento', () => {
  const game=fixture();
  game.vertices['v_0_0_1']={building:'settlement',owner:0};
  assert.equal(Game.canPlaceRoad(game,'red','e_0_0_1').valid,true);
});

test('construção na outra ponta permite estrada sem atravessar aldeia adversária', () => {
  const game=fixture();
  game.vertices['v_0_0_2']={building:'settlement',owner:0};
  assert.equal(Game.canPlaceRoad(game,'red','e_0_0_1').valid,true);
});
