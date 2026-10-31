/**
 * Cities & Knights: positioned knights for the multiplayer adaptation.
 * Recruited units automatically occupy a free intersection on their road network.
 * Active units may move once per turn along an owned road (one edge).
 */
import {getEquivalentEdges,getEquivalentVertices,getVertexEdges} from './gameLogic.js';

const parse = (key,prefix) => new RegExp('^'+prefix+'_(-?\\d+)_(-?\\d+)_(\\d+)$').exec(key);
const vertexAliases = k => {const m=parse(k,'v');return m?getEquivalentVertices(...m.slice(1).map(Number)).map(v=>`v_${v.q}_${v.r}_${v.dir}`):[];};
const edgeAliases = k => {const m=parse(k,'e');return m?getEquivalentEdges(...m.slice(1).map(Number)).map(v=>`e_${v.q}_${v.r}_${v.dir}`):[];};
const canonical = k => edgeAliases(k).sort()[0] || k;
const sameVertex = (a,b)=>vertexAliases(a).includes(b);
const buildingAt = (game,key)=>vertexAliases(key).some(k=>game.vertices[k]?.building);
const knightAt = (game,key)=>Object.values(game.knightPieces||{}).find(p=>sameVertex(p.vertexKey,key));
const ownedEdge = (game,key,owner)=>edgeAliases(key).some(k=>game.edges[k]?.road && game.edges[k]?.owner===owner);
const adjacentOwnRoad = (game,key,owner)=>getVertexEdges(key).some(k=>ownedEdge(game,k,owner));
const connected = (game,from,to,owner)=> {
 const roads = new Set(getVertexEdges(from).filter(k=>ownedEdge(game,k,owner)).map(canonical));
 return getVertexEdges(to).some(k=>roads.has(canonical(k)) && ownedEdge(game,k,owner));
};
export function deployKnight(game,owner,level='basic') {
 game.knightPieces ||= {};
 const occupied=new Set();
 const destinations=Object.keys(game.vertices).filter(k=>!buildingAt(game,k) && !knightAt(game,k)
   && adjacentOwnRoad(game,k,owner));
 const location=destinations[0];
 if(!location)return null;
 const id=`knight-${++game.__knightSequence || 1}`;
 const piece={id,owner,vertexKey:location,level,active:false,lastMovedTurn:-1};
 game.knightPieces[id]=piece;
 return piece;
}
export function syncKnightState(game,owner,fromLevel,toLevel,activate=false) {
 const pieces=Object.values(game.knightPieces||{}).filter(p=>p.owner===owner);
 const unit=pieces.find(p=>p.level===fromLevel && (activate?!p.active:!p.active))
   || pieces.find(p=>p.level===fromLevel);
 if(!unit)return;
 if(activate)unit.active=true;
 else {unit.level=toLevel;unit.active=false;}
}
export function relocateKnight(game,playerId,unitId,targetKey) {
 if(!game.isCitiesAndKnights||game.phase!=='playing'||game.turnPhase!=='main')
   return {success:false,error:'Não é possível mover cavaleiros nesta fase'};
 const owner=game.players.findIndex(p=>p.id===playerId);
 if(owner<0||owner!==game.currentPlayerIndex)return {success:false,error:'Não é seu turno'};
 const piece=game.knightPieces?.[unitId];
 if(!piece||piece.owner!==owner||!piece.active)return {success:false,error:'Ative um cavaleiro seu primeiro'};
 if(piece.lastMovedTurn===(game.turnSequence||0))return {success:false,error:'Este cavaleiro já foi movido neste turno'};
 if(!game.vertices[targetKey]||buildingAt(game,targetKey))return {success:false,error:'O destino precisa estar vazio'};
 if(!connected(game,piece.vertexKey,targetKey,owner))return {success:false,error:'O destino deve estar ligado por uma estrada sua'};
 const target=knightAt(game,targetKey);
 if(target) {
   if(target.owner===owner)return {success:false,error:'Já existe um cavaleiro seu nesse local'};
   const power={basic:1,strong:2,mighty:3};
   if(power[piece.level]<=power[target.level])return {success:false,error:'É preciso um cavaleiro mais forte para expulsar o adversário'};
   delete game.knightPieces[target.id];
   const loser=game.players[target.owner];
   loser.cKKnights[target.active?'active':'inactive'][target.level]--;
 }
 piece.vertexKey=targetKey;
 piece.lastMovedTurn=game.turnSequence||0;
 piece.active=false;
 const actor=game.players[owner];
 actor.cKKnights.active[piece.level]--;
 actor.cKKnights.inactive[piece.level]++;
 return {success:true};
}
