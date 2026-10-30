import test from 'node:test';
import assert from 'node:assert/strict';
import { soundEventsForTransition } from '../soundEvents.js';

const start = {phase:'setup',winner:null,rollId:0,rollTotal:null,longestRoad:null,largestArmy:null};
test('começo da partida toca o sino somente uma vez',()=>{
  const playing={...start,phase:'playing'};
  assert.deepEqual(soundEventsForTransition(start,playing),['sail']);
  assert.deepEqual(soundEventsForTransition(playing,playing),[]);
});
test('rolagem regular e sete produzem sons exclusivos sem duplicação',()=>{
  const normal={...start,phase:'playing',rollId:1,rollTotal:8};
  assert.deepEqual(soundEventsForTransition({...normal,rollId:0},normal),['dice']);
  const seven={...normal,rollId:2,rollTotal:7};
  assert.deepEqual(soundEventsForTransition(normal,seven),['seven']);
  assert.deepEqual(soundEventsForTransition(seven,seven),[]);
});
test('marcos e vitória são eventos públicos sem informação secreta',()=>{
  const playing={...start,phase:'playing'};
  const longRoad={...playing,longestRoad:1};
  assert.deepEqual(soundEventsForTransition(playing,longRoad),['milestone']);
  const army={...longRoad,largestArmy:2};
  assert.deepEqual(soundEventsForTransition(longRoad,army),['milestone']);
  const ended={...army,phase:'finished',winner:'red'};
  assert.deepEqual(soundEventsForTransition(army,ended),['victory']);
  assert.deepEqual(soundEventsForTransition(ended,ended),[]);
});
