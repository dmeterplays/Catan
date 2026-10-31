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
  if (isPirateBlocking(game,eKey)) return {valid:false,error:'O pirata bloqueia este lado do mar'};
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

const SCENARIO_LAND = [
  [0,-2],[1,-2],[2,-2],[-1,-1],[0,-1],[1,-1],[2,-1],
  [-2,0],[-1,0],[0,0],[1,0],[2,0],
  [-2,1],[-1,1],[0,1],[1,1],[-2,2],[-1,2],[0,2]
];
const SCENARIO_MAIN_SEA = [
  [3,-3],[3,-2],[3,-1],[3,0],[2,1],[1,2],[0,3],[-1,3],[-2,3],[-3,3]
];
const SCENARIO_ISLANDS = [
  [4,-4],[5,-4],[4,-3],
  [5,-1],[6,-1],[6,0],
  [4,2],[5,2],[4,3]
];
const SCENARIO_OTHER_SEA = [[3,-4],[4,-5],[3,1],[3,2]];
const LAND_TERRAINS = {
  fields:{resource:'grain',color:'#d4a942'},
  hills:{resource:'brick',color:'#c45a2c'},
  mountains:{resource:'ore',color:'#6b6b6b'},
  pasture:{resource:'wool',color:'#90c26a'},
  forest:{resource:'lumber',color:'#2d5a27'},
  desert:{resource:null,color:'#e8d5a3'},
  gold:{resource:null,color:'#ddb52e'},
  sea:{resource:null,color:'#1482b4'}
};
const MAIN_LAND_TYPES=[
  ...Array(4).fill('fields'),...Array(3).fill('hills'),
  ...Array(3).fill('mountains'),...Array(4).fill('pasture'),
  ...Array(4).fill('forest'),'desert'
];
const ISLAND_LAND_TYPES=[
  'fields','hills','hills','mountains','mountains','pasture','forest','gold','gold'
];
const MAIN_TOKENS=[2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const ISLAND_TOKENS=[2,3,4,5,6,8,9,10,11];
function shuffleList(items) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}
const makeKey=([q,r])=>`${q},${r}`;
const makeEdge=(q,r,d)=>`e_${q}_${r}_${d}`;
const makeVertex=(q,r,d)=>`v_${q}_${r}_${d}`;
/**
 * The distribution follows the 4-player component table on p.5.
 * This is an original, repeatable axial layout, not a tracing of the
 * printed copyrighted hex artwork. Terrain and number placements shuffle.
 */
export function buildSeafarersBoard({random=true}={}) {
  const hexes={};
  function put(coords,types,tokens,island) {
    const t=random?shuffleList(types):[...types];
    const nums=random?shuffleList(tokens):[...tokens];
    let n=0;
    coords.forEach(([q,r],i)=>{
      const terrain=t[i],style=LAND_TERRAINS[terrain];
      hexes[`${q},${r}`]={q,r,terrain,resource:style.resource,color:style.color,
        number:terrain==='desert'||terrain==='sea'?null:nums[n++],island};
    });
  }
  put(SCENARIO_LAND,MAIN_LAND_TYPES,MAIN_TOKENS,'main');
  put(SCENARIO_ISLANDS,ISLAND_LAND_TYPES,ISLAND_TOKENS,'islet');
  [...SCENARIO_MAIN_SEA,...SCENARIO_OTHER_SEA].forEach(([q,r])=>{
    hexes[`${q},${r}`]={q,r,terrain:'sea',resource:null,color:LAND_TERRAINS.sea.color,number:null,island:null};
  });
  const vertices={},edges={};
  Object.values(hexes).forEach(h=>{
    for(let d=0;d<6;d++){
      vertices[makeVertex(h.q,h.r,d)]={building:null,owner:null};
      edges[makeEdge(h.q,h.r,d)]={road:false,ship:false,owner:null};
    }
  });
  const types=['BRICK','LUMBER','WOOL','GRAIN','ORE','GENERIC','GENERIC','GENERIC','GENERIC'];
  const coastal=[];
  SCENARIO_LAND.forEach(([q,r])=>{
    for(let d=0;d<6;d++){
      const key=makeEdge(q,r,d);
      const alternatives=getEquivalentEdges(q,r,d);
      if(alternatives.some(v=>v.q!==q||v.r!==r ? hexes[`${v.q},${v.r}`]?.terrain==='sea':false))
        coastal.push({key,q,r,d});
    }
  });
  // Select spaced-out land/sea edges to distribute ports around mainland.
  const picked=[];
  for(let i=0;i<9;i++) {
    const ix=Math.floor((i+.4)*coastal.length/9);
    const candidate=coastal[Math.min(ix,coastal.length-1)];
    if(candidate && !picked.some(p=>p.key===candidate.key)) picked.push(candidate);
  }
  const portTypes=random?shuffleList(types):types;
  const portValues={
    GENERIC:{ratio:3,resource:null},
    BRICK:{ratio:2,resource:'brick'},LUMBER:{ratio:2,resource:'lumber'},
    WOOL:{ratio:2,resource:'wool'},GRAIN:{ratio:2,resource:'grain'},ORE:{ratio:2,resource:'ore'}
  };
  const ports=picked.map((e,i)=>({id:i,vertices:[makeVertex(e.q,e.r,e.d),makeVertex(e.q,e.r,(e.d+1)%6)],
    type:portTypes[i],...portValues[portTypes[i]]}));
  const robber=Object.keys(hexes).find(k=>hexes[k].terrain==='desert');
  return {hexes,edges,vertices,ports,robber,pirate:'3,-2'};
}

export function isMainIslandSetupVertex(game,vKey) {
  const match=/^v_(-?\d+)_(-?\d+)_(\d+)$/.exec(vKey);
  if(!match) return false;
  return getEquivalentVertices(...match.slice(1).map(Number)).some(({q,r})=>
    game.hexes[`${q},${r}`]?.island==='main');
}
export function isSmallIslandVertex(game,vKey) {
  const match=/^v_(-?\d+)_(-?\d+)_(\d+)$/.exec(vKey);
  if(!match) return false;
  return getEquivalentVertices(...match.slice(1).map(Number)).some(({q,r})=>
    game.hexes[`${q},${r}`]?.island==='islet');
}
export function isPirateBlocking(game,eKey) {
  if (!game.pirate) return false;
  const match=/^e_(-?\d+)_(-?\d+)_(\d+)$/.exec(eKey);
  if(!match) return false;
  return getEquivalentEdges(...match.slice(1).map(Number))
    .some(({q,r})=>`${q},${r}`===game.pirate);
}
export function placeShip(game,playerId,eKey,{setup=false,settlementKey=null}={}) {
  const isSetup=game.phase==='setup';
  if(isSetup!==setup) return {success:false,error:'Fase de construção incorreta'};
  if(isSetup && game.players[game.currentPlayerIndex]?.id!==playerId)
    return {success:false,error:'Aguarde sua vez na preparação'};
  if(!isSetup && !(game.phase==='playing' &&
    (game.players[game.currentPlayerIndex]?.id===playerId && game.turnPhase==='main' ||
    game.turnPhase==='specialBuild' && game.specialBuildingPhase &&
    game.players[game.specialBuildIndex]?.id===playerId)))
    return {success:false,error:'Não pode construir barcos agora'};
  const validation=canPlaceShip(game,playerId,eKey,{setup,settlementKey});
  if(!validation.valid)return {success:false,error:validation.error};
  if(isPirateBlocking(game,eKey))return {success:false,error:'O pirata bloqueia este lado do mar'};
  const owner=game.players.findIndex(p=>p.id===playerId);
  const player=game.players[owner];
  game.edges[eKey]={road:false,ship:true,owner,builtTurn:game.turnSequence||0};
  if(!setup && !(game.freeRoads>0)) {
    player.resources.lumber--;player.resources.wool--;
  } else if(!setup && game.freeRoads>0) game.freeRoads--;
  player.ships--;
  return {success:true};
}
