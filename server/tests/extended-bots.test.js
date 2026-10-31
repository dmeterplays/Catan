import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';
import { getLegalActions, executeLegalAction } from '../legalActions.js';
import { getBotActor, runBotTurn } from '../bots.js';

function extendedGame(players = 8) {
  const game=Game.createGame('BOTS8', {id:'human',name:'Humano'}, true, true, 'random', false, false);
  for(let i=1;i<players;i++) {
    const id='bot'+i;
    assert.equal(Game.addPlayer(game,{id,name:'Bot '+i}).success,true);
    game.players.find(p=>p.id===id).isBot=true;
  }
  assert.equal(game.maxPlayers,8);
  assert.equal(game.players.length,players);
  assert.equal(new Set(game.players.map(p=>p.color)).size,players);
  return game;
}

test('sala ampliada aceita sete bots, mas nunca um nono participante', () => {
  const game=extendedGame(8);
  assert.equal(Game.addPlayer(game,{id:'bot8',name:'Bot 8'}).success,false);
  assert.equal(Game.getPlayerView(game,'human').players.length,8);
});

test('sete bots realizam sua preparação inicial no mapa maior', async () => {
  const game=extendedGame(8);
  assert.equal(Game.startGame(game).success,true);
  assert.equal(game.phase,'setup');
  let actions=0;
  for(let i=0;i<40 && game.phase==='setup';i++){
    const current=game.players[game.currentPlayerIndex];
    if(current.isBot) {
      assert.equal(getBotActor(game)?.id,current.id);
      await runBotTurn(game,()=>{}, {delayMs:0,maxActions:5,autoContinue:false});
    } else {
      const legal=getLegalActions(game,'human');
      const step=legal.find(a=>a.type===(game.setupSettlementKey?'placeRoad':'placeSettlement'));
      assert.ok(step,'humano tem local disponível na preparação');
      assert.equal(executeLegalAction(game,'human',step).success,true);
    }
    actions++;
  }
  assert.equal(game.phase,'playing','preparação de oito jogadores deve terminar');
  assert.ok(['roll','main','robber','discard','specialBuild'].includes(game.turnPhase));
  assert.ok(actions>0);
  for(const player of game.players) {
    assert.ok(player.settlements<=3,`${player.name} construiu pelo menos duas aldeias`);
    assert.ok(player.roads<=13,`${player.name} construiu pelo menos duas estradas`);
  }
});

for(const count of [5,8]) {
  test(`bots concluem a fase especial em mesa com ${count} jogadores`, async()=>{
    const game=extendedGame(count);
    game.phase='playing';
    game.currentPlayerIndex=0;
    game.turnPhase='main';
    for(const player of game.players) player.resources={brick:0,lumber:0,wool:0,grain:0,ore:0};
    assert.equal(Game.endTurn(game,'human').success,true);
    assert.equal(game.turnPhase,'specialBuild');
    assert.equal(getBotActor(game)?.id,game.players[1].id);
    assert.equal(getLegalActions(game,game.players[1].id).some(a=>a.type==='endSpecialBuild'),true);
    await runBotTurn(game,()=>{}, {delayMs:0,maxActions:count-1,autoContinue:false});
    assert.equal(game.specialBuildingPhase,false,'todos os bots passaram a vez especial');
    assert.equal(game.turnPhase,'roll');
    assert.equal(game.currentPlayerIndex,1);
    assert.equal(game.__botBusy,false);
  });
}

test('bot pode construir estrategicamente e depois passar a fase especial',async()=>{
  const game=extendedGame(5);
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=0;
  game.players[1].resources={brick:0,lumber:0,wool:3,grain:3,ore:3};
  assert.equal(Game.endTurn(game,'human').success,true);
  const initialDeck=game.devCardDeck.length;
  await runBotTurn(game,()=>{}, {delayMs:0,maxActions:3,autoContinue:false});
  assert.equal(game.devCardDeck.length,initialDeck-2,'bot comprou até duas cartas na janela');
  assert.equal(game.specialBuildIndex,2,'bot passou a oportunidade para o próximo');
  assert.equal(game.turnPhase,'specialBuild');
});

test('janela especial de jogador humano continua esperando ação humana',async()=>{
  const game=extendedGame(5);
  game.phase='playing';
  game.turnPhase='main';
  game.currentPlayerIndex=1;
  game.players[1].isBot=true;
  assert.equal(Game.endTurn(game,'bot1').success,true);
  const next=game.players[game.specialBuildIndex];
  assert.ok(next.isBot);
  await runBotTurn(game,()=>{}, {delayMs:0,maxActions:4,autoContinue:false});
  assert.equal(game.specialBuildIndex,0);
  assert.equal(getBotActor(game),null);
  assert.equal(getLegalActions(game,'human').some(a=>a.type==='endSpecialBuild'),true);
});
