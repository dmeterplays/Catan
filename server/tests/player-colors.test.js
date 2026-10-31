import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../gameLogic.js';

test('paleta comporta oito jogadores com cores distintas e inclui rosa', () => {
  assert.ok(Game.PLAYER_COLORS.length >= 12);
  assert.ok(Game.PLAYER_COLORS.includes('#f25ca2'));
  assert.equal(new Set(Game.PLAYER_COLORS).size, Game.PLAYER_COLORS.length);
  const game = Game.createGame('COLORS8', {id:'p0', name:'Jogador 0'}, true);
  for (let i = 1; i < 8; i++) assert.equal(Game.addPlayer(game, {id:'p'+i,name:'Jogador '+i}).success, true);
  assert.equal(new Set(game.players.map(p => p.color)).size, 8);
  assert.ok(game.players.some(p => p.color === '#f25ca2'));
});
test('modo padrão continua atribuindo quatro cores diferentes', () => {
  const game = Game.createGame('COLORS4',{id:'p0',name:'Jogador 0'});
  for(let i=1;i<4;i++) Game.addPlayer(game,{id:'p'+i,name:'Jogador '+i});
  assert.equal(new Set(game.players.map(p=>p.color)).size,4);
});
