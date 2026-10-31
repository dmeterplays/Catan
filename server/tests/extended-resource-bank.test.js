import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';

function newGame(extended=false) {
  const game=Game.createGame('BANK'+Number(extended),{id:'host',name:'Anfitrião'},extended,true,'random',false,false);
  Game.addPlayer(game,{id:'guest',name:'Convidado'});
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=0;
  return game;
}

test('modo padrão começa com 19 de cada recurso e mantém 25 cartas de desenvolvimento',()=>{
  const game=newGame(false);
  const view=Game.getPlayerView(game,'host');
  assert.deepEqual(view.bankResources,{brick:19,lumber:19,wool:19,grain:19,ore:19});
  assert.equal(view.devCardDeck,25);
});
test('modo 5–8 começa com 38 cartas por recurso e 50 de desenvolvimento',()=>{
  const game=newGame(true);
  const view=Game.getPlayerView(game,'host');
  assert.deepEqual(view.bankResources,{brick:38,lumber:38,wool:38,grain:38,ore:38});
  assert.equal(view.devCardDeck,50);
});
test('banco do modo ampliado diminui conforme os jogadores recebem cartas e recupera quando gastam',()=>{
  const game=newGame(true);
  game.players[0].resources.lumber=7;
  game.players[1].resources.lumber=8;
  assert.equal(Game.getPlayerView(game,'guest').bankResources.lumber,23);
  game.players[0].resources.lumber-=3; // construção devolve cartas ao banco
  assert.equal(Game.getPlayerView(game,'guest').bankResources.lumber,26);
});
test('banco sem cartas impede troca bancária e Ano de Abundância',()=>{
  const game=newGame(true);
  game.players[1].resources.ore=38;
  game.players[0].resources.lumber=4;
  const before=structuredClone(game.players[0].resources);
  assert.equal(Game.bankTrade(game,'host','lumber',4,'ore').success,false);
  assert.deepEqual(game.players[0].resources,before);
  game.yearOfPlentyPicks=2;
  assert.equal(Game.yearOfPlentyPick(game,'host','ore').success,false);
  assert.equal(game.yearOfPlentyPicks,2);
});
test('rolagem não cria recursos além da reserva física',()=>{
  const game=newGame(true);
  const hex=Object.values(game.hexes).find(h=>h.resource==='brick');
  assert.ok(hex);
  hex.number=8;
  game.vertices[`v_${hex.q}_${hex.r}_0`]={building:'settlement',owner:0};
  game.players[1].resources.brick=38;
  game.turnPhase='roll';
  const original=Math.random;
  Math.random=()=>.5; // 4 + 4 = 8
  try {
    const roll=Game.rollDice(game,'host');
    assert.equal(roll.success,true);
    assert.equal(game.players[0].resources.brick,0);
    assert.equal(roll.resourceGains[0].brick,0);
    assert.equal(Game.getBankResourceCount(game,'brick'),0);
  } finally { Math.random=original; }
});
