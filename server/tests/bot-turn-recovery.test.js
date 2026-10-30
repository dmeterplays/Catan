import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { runBotTurn } from '../bots.js';
import { getLegalActions } from '../legalActions.js';

function makeGame() {
  const game = Game.createGame('SEVEN1', {id:'human',name:'Pessoa'}, false, true, 'random', false, false);
  assert.equal(Game.addPlayer(game, {id:'bot',name:'Bot'}).success, true);
  game.players[1].isBot = true;
  game.phase = 'playing';
  game.turnPhase = 'roll';
  game.currentPlayerIndex = 1;
  game.hasRolledThisTurn = false;
  game.players[1].resources = {brick:8,lumber:0,wool:0,grain:0,ore:0};
  game.eventLog = [];
  return game;
}

test('rolagem de 7 do bot descarta automaticamente e avança ao ladrão', async () => {
  const game = makeGame();
  const random = Math.random;
  let calls = 0;
  Math.random = () => (calls++ % 2 ? .7 : .2); // 2 + 5 = 7
  try {
    let broadcasts = 0;
    await runBotTurn(game, () => broadcasts++, {delayMs:0,maxActions:1,autoContinue:false});
    assert.equal(game.diceRoll.total,7);
    assert.equal(game.players[1].resources.brick,4);
    assert.equal(game.turnPhase,'robber');
    assert.deepEqual(game.discardingPlayers,[]);
    assert.ok(getLegalActions(game,'bot').some(a => a.type === 'moveRobber'));
    assert.ok(broadcasts > 0);
    assert.equal(game.__botBusy,false);
  } finally {
    Math.random = random;
  }
});

test('bot descarta após 7 e espera o descarte obrigatório do humano', async () => {
  const game = makeGame();
  game.players[0].resources.brick = 8;
  const random = Math.random;
  let calls=0;
  Math.random = () => (calls++ % 2 ? .7 : .2);
  try {
    await runBotTurn(game, () => {}, {delayMs:0,maxActions:1,autoContinue:false});
    assert.equal(game.turnPhase,'discard');
    assert.equal(game.players[1].resources.brick,4);
    assert.equal(game.players[0].resources.brick,8);
    assert.ok(game.discardingPlayers.some(item => item.playerIndex === 0));
    assert.ok(getLegalActions(game,'human').some(a => a.type === 'discard'));
  } finally {
    Math.random=random;
  }
});

test('bot completa turno normal e devolve a vez ao humano', async () => {
  const game = makeGame();
  game.players[1].resources = {brick:0,lumber:0,wool:0,grain:0,ore:0};
  const random=Math.random;
  Math.random=()=>.5; // 4+4=8
  try {
    await runBotTurn(game, () => {}, {delayMs:0,maxActions:30,autoContinue:false});
    assert.equal(game.currentPlayerIndex,0);
    assert.equal(game.turnPhase,'roll');
    assert.equal(game.__botBusy,false);
    assert.ok(game.eventLog.some(e => e.message.includes('🎲')));
  } finally {
    Math.random=random;
  }
});

test('bot retoma o turno quando o humano termina o descarte', async () => {
  const game = makeGame();
  game.players[0].resources.brick = 8;
  const random=Math.random;
  let calls=0;
  Math.random=()=> (calls++ % 2 ? .7 : .2);
  try {
    await runBotTurn(game, () => {}, {delayMs:0,maxActions:1,autoContinue:false});
    assert.equal(game.turnPhase,'discard');
  } finally { Math.random=random; }
  const discarded = Game.discardCards(game,'human',{brick:4,lumber:0,wool:0,grain:0,ore:0});
  assert.equal(discarded.success,true);
  assert.equal(game.turnPhase,'robber');
  // The websocket handler now calls runBotTurn after human discard.
  await runBotTurn(game, () => {}, {delayMs:0,maxActions:1,autoContinue:false});
  assert.equal(game.turnPhase,'main');
  assert.equal(game.__botBusy,false);
});
