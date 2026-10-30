import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';

function createExtended(count) {
  const game = Game.createGame('SP' + count, {id:'p0', name:'Jogador 0'}, true, true, 'random', false, false);
  for (let i = 1; i < count; i++) {
    assert.equal(Game.addPlayer(game, {id:'p'+i, name:'Jogador '+i}).success,true);
  }
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=0;
  for (const p of game.players) {
    p.resources={brick:8,lumber:8,wool:8,grain:8,ore:8};
  }
  return game;
}

for (const count of [5,8]) {
  test(`fase especial passa por ${count - 1} jogadores e retorna ao turno normal (${count} jogadores)`,()=>{
    const game=createExtended(count);
    assert.equal(Game.endTurn(game,'p0').success,true);
    assert.equal(game.turnPhase,'specialBuild');
    assert.equal(game.specialBuildingPhase,true);
    for(let i=1;i<count;i++) {
      const builder='p'+i;
      assert.equal(game.specialBuildIndex,i);
      const actions=getLegalActions(game,builder);
      assert.ok(actions.some(a=>a.type==='buyDevCard'),'construtor deve poder comprar desenvolvimento');
      assert.ok(actions.some(a=>a.type==='placeRoad'),'construtor deve poder construir estrada');
      assert.equal(actions.some(a=>a.type==='bankTrade'),false,'troca proibida na fase especial');
      assert.equal(actions.some(a=>a.type==='endTurn'),false,'não encerrar turno principal');
      assert.deepEqual(getLegalActions(game,'p0'),[],'turno anterior não pode construir');
      const purchased=executeLegalAction(game,builder,{type:'buyDevCard'});
      assert.equal(purchased.success,true);
      assert.equal(Game.endSpecialBuild(game,'p0').success,false);
      assert.equal(Game.endSpecialBuild(game,builder).success,true);
    }
    assert.equal(game.specialBuildingPhase,false);
    assert.equal(game.turnPhase,'roll');
    assert.equal(game.currentPlayerIndex,1);
  });
}

test('jogador não autorizado não constrói por métodos diretos durante a fase especial',()=>{
  const game=createExtended(5);
  assert.equal(Game.endTurn(game,'p0').success,true);
  const roadKey=Object.keys(game.edges)[0];
  const vertexKey=Object.keys(game.vertices)[0];
  const before=structuredClone(game.players[0].resources);
  assert.equal(Game.placeRoad(game,'p0',roadKey).success,false);
  assert.equal(Game.placeSettlement(game,'p0',vertexKey).success,false);
  assert.deepEqual(game.players[0].resources,before);
});

test('fase especial desabilitada não é iniciada com cinco jogadores',()=>{
  const game=createExtended(5);
  game.enableSpecialBuild=false;
  assert.equal(Game.endTurn(game,'p0').success,true);
  assert.equal(game.turnPhase,'roll');
  assert.equal(game.currentPlayerIndex,1);
});
