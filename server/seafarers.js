/**
 * Navegantes / Seafarers — scenario 1, 4-player foundation.
 * Sources: user's Portuguese manual, pp. 2–5.
 *
 * This module deliberately does not enable the mode yet. A fully playable
 * scenario still needs ocean-map integration, ship controls, pirate, gold
 * selection, longest trade route and scenario victory handling.
 */
import { getEquivalentEdges, getEquivalentVertices, getVertexEdges } from './gameLogic.js';

export const NAVIGATORS_SCENARIO_1 = Object.freeze({
  id: 'new-shores-4',
  name: 'Rumo a Novas Margens',
  players: 4,
  victoryPoints: 14,
  bonusFirstSettlementOnSmallIsland: 2,
  initialPlacementArea: 'main-island',
  initialPortCount: 9,
  shipCost: Object.freeze({ lumber: 1, wool: 1 }),
  // Official manual p. 5; figures include sea hexes.
  mainIsland: Object.freeze({
    sea: 10, desert: 1, gold: 0,
    fields: 4, hills: 3, mountains: 3, pasture: 4, forest: 4,
    numberTokens: 18
  }),
  smallIslands: Object.freeze({
    sea: 4, desert: 0, gold: 2,
    fields: 1, hills: 2, mountains: 2, pasture: 1, forest: 1,
    numberTokens: 9
  }),
  ports: Object.freeze({ specific: 5, generic: 4 }),
  piratesAndRobber: true
});

export const NAVIGATORS_SHIP_LIMIT = 15;
export function isSea(hex) { return !!hex && hex.terrain === 'sea'; }
export function isLand(hex) { return !!hex && hex.terrain !== 'sea'; }

/** Classify a physical edge using both equivalent axial keys. */
export function getWaterEdgeType(game, eKey) {
  const match = /^e_(-?\d+)_(-?\d+)_(\d+)$/.exec(eKey);
  if (!match) return null;
  const alternatives = getEquivalentEdges(Number(match[1]),Number(match[2]),Number(match[3]));
  const surrounding = alternatives
    .map(({q,r}) => game.hexes[`${q},${r}`])
    .filter(Boolean);
  if (!surrounding.length) return null;
  if (surrounding.length === 1) return isSea(surrounding[0]) ? 'sea' : 'coast';
  if (surrounding.every(isSea)) return 'sea';
  if (surrounding.every(isLand)) return 'land';
  return 'coast';
}

function vertexKeysEquivalent(one,two) {
  if (one === two) return true;
  const m = /^v_(-?\d+)_(-?\d+)_(\d+)$/.exec(one);
  return !!m && getEquivalentVertices(Number(m[1]),Number(m[2]),Number(m[3]))
    .some(({q,r,dir}) => `v_${q}_${r}_${dir}` === two);
}
function buildingAt(game,vKey) {
  for (const [key,vert] of Object.entries(game.vertices)) {
    if (vert.building && vertexKeysEquivalent(key,vKey)) return vert;
  }
  return null;
}
function shipAt(game,eKey) {
  const match=/^e_(-?\d+)_(-?\d+)_(\d+)$/.exec(eKey);
  if (!match) return null;
  for(const {q,r,dir} of getEquivalentEdges(Number(match[1]),Number(match[2]),Number(match[3]))) {
    const edge=game.edges[`e_${q}_${r}_${dir}`];
    if(edge?.ship || edge?.road) return edge;
  }
  return null;
}

export function canPlaceShip(game, playerId, eKey, { setup = false, settlementKey = null } = {}) {
  if (!game.isSeafarers) return {valid:false,error:'Navegantes não está ativo'};
  const owner=game.players.findIndex(p=>p.id===playerId);
  if(owner<0) return {valid:false,error:'Jogador desconhecido'};
  const actor=game.players[owner];
  if (!game.edges[eKey]) return {valid:false,error:'Posição inválida'};
  if (!['sea','coast'].includes(getWaterEdgeType(game,eKey)))
    return {valid:false,error:'Barcos somente no mar ou na costa'};
  if (shipAt(game,eKey)) return {valid:false,error:'Este lado já está ocupado'};
  if ((actor.ships ?? NAVIGATORS_SHIP_LIMIT) < 1) return {valid:false,error:'Sem barcos disponíveis'};
  if (setup && !settlementKey) return {valid:false,error:'Barco inicial precisa de aldeia'};
  if (!setup && ((actor.resources?.lumber||0)<1 || (actor.resources?.wool||0)<1))
    return {valid:false,error:'Necessário 1 madeira e 1 lã'};
  const m=/^e_(-?\d+)_(-?\d+)_(\d+)$/.exec(eKey);
  const [q,r,d]=m.slice(1).map(Number);
  const ends=[`v_${q}_${r}_${d}`,`v_${q}_${r}_${(d+1)%6}`];
  const connected=ends.some(endpoint=>{
    const vertex=buildingAt(game,endpoint);
    if (vertex?.owner===owner) return true;
    if (vertex && vertex.owner!==owner) return false;
    if(setup) return settlementKey && vertexKeysEquivalent(endpoint,settlementKey);
    return getVertexEdges(endpoint).some(edgeKey=>{
      const match=/^e_(-?\d+)_(-?\d+)_(\d+)$/.exec(edgeKey);
      if(!match) return false;
      return getEquivalentEdges(...match.slice(1).map(Number)).some(({q,r,dir})=>{
        const route=game.edges[`e_${q}_${r}_${dir}`];
        return route?.ship && route.owner===owner;
      });
    });
  });
  if(!connected) return {valid:false,error:'Conecte ao seu barco ou a uma aldeia/cidade'};
  return {valid:true};
}
