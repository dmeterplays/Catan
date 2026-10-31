import { useEffect, useMemo, useRef, useState } from 'react';
import './HexBoard.css';
import { Illustration as ResourceIllustration } from './CardArt';

// Hex geometry constants - POINTY-TOP orientation
const HEX_SIZE = 58;
// Inset textures visually separates tiles without moving roads, ports or vertices.
const HEX_TEXTURE_INSET = 5.1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.2;

const TERRAIN_ASSETS = {
  forest: '/textures/forest-v2.png',
  hills: '/textures/hills-v2.png',
  pasture: '/textures/pasture-v2.png',
  fields: '/textures/fields-v2.png',
  mountains: '/textures/mountain-v2.png',
  desert: '/textures/desert-v2.png'
};

// Convert axial coordinates to pixel position (POINTY-TOP)
function axialToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * (3 / 2) * r;
  return { x, y };
}

// Get vertex position for POINTY-TOP hex
// Direction 0 = top, going clockwise: 1=upper-right, 2=lower-right, 3=bottom, 4=lower-left, 5=upper-left
function getVertexPosition(q, r, direction) {
  const center = axialToPixel(q, r);
  // For pointy-top, vertex 0 is at top (90 degrees from right = -90 from standard)
  // Angles: 0=90°, 1=30°, 2=-30°, 3=-90°, 4=-150°, 5=150°
  const angle = (90 - 60 * direction) * Math.PI / 180;
  return {
    x: center.x + HEX_SIZE * Math.cos(angle),
    y: center.y - HEX_SIZE * Math.sin(angle)
  };
}

// Generate hex path for POINTY-TOP orientation
function hexPath(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    // Pointy-top: first vertex at top (90 degrees)
    const angle = (90 - 60 * i) * Math.PI / 180;
    points.push(`${cx + size * Math.cos(angle)},${cy - size * Math.sin(angle)}`);
  }
  return `M${points.join('L')}Z`;
}

// Number token colors based on probability
function getNumberColor(num) {
  if (num === 6 || num === 8) return '#d32f2f';
  return '#173f18';
}

// Crisp, browser-independent resource marks for the harbor sails.
function renderPortResourceIcon(resource, x, y) {
  if (resource === 'brick') {
    return (
      <g fill="#b94d2c" stroke="#7e2f1d" strokeWidth="0.7">
        <rect x={x - 7} y={y - 5} width="7" height="5" rx="0.8" />
        <rect x={x + 1} y={y - 5} width="7" height="5" rx="0.8" />
        <rect x={x - 4} y={y + 1} width="8" height="5" rx="0.8" />
      </g>
    );
  }

  if (resource === 'lumber') {
    return (
      <g stroke="#71421f" strokeWidth="3" strokeLinecap="round">
        <line x1={x - 6} y1={y - 4} x2={x + 5} y2={y + 3} />
        <line x1={x - 5} y1={y + 2} x2={x + 6} y2={y - 5} />
      </g>
    );
  }

  if (resource === 'wool') {
    return (
      <g stroke="#756653" strokeWidth="0.8">
        <circle cx={x - 4} cy={y} r="4" fill="#fffdf3" />
        <circle cx={x} cy={y - 3} r="4.5" fill="#fffdf3" />
        <circle cx={x + 4} cy={y} r="4" fill="#fffdf3" />
        <ellipse cx={x + 6} cy={y + 2} rx="2.8" ry="3.5" fill="#9a856a" />
      </g>
    );
  }

  if (resource === 'grain') {
    return (
      <g fill="none" stroke="#c78b16" strokeWidth="1.5" strokeLinecap="round">
        <line x1={x} y1={y + 6} x2={x} y2={y - 6} />
        <path d={`M${x},${y-3} q-5,-3 -5,-6 M${x},${y} q5,-3 5,-6 M${x},${y+3} q-5,-2 -5,-5`} />
      </g>
    );
  }

  if (resource === 'ore') {
    return (
      <g fill="#8e979b" stroke="#586267" strokeWidth="0.8">
        <path d={`M${x-7},${y+5} L${x-4},${y-4} L${x+1},${y-6} L${x+4},${y+3} Z`} />
        <path d={`M${x},${y+5} L${x+4},${y-3} L${x+8},${y+4} Z`} />
      </g>
    );
  }

  return (
    <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="900" fill="#75452c">?</text>
  );
}


const PORT_LABELS = {
  brick: { name: 'TIJOLO', fill: '#b95637', ink: '#ffffff' },
  lumber: { name: 'MADEIRA', fill: '#307b40', ink: '#ffffff' },
  wool: { name: 'LÃ', fill: '#8dbd51', ink: '#162b0d' },
  grain: { name: 'TRIGO', fill: '#e8bf4e', ink: '#392605' },
  ore: { name: 'MINÉRIO', fill: '#82949c', ink: '#ffffff' }
};

// Shared board-game piece silhouettes: settlement and upgraded city remain
// distinguishable even when shrunk or rendered in dark player colors.
// Separate roofs and walls make the miniature pieces readable on all terrains.
function settlementRoofPath(x, y) {
  return `M ${x - 13} ${y - 1} L ${x} ${y - 13} L ${x + 13} ${y - 1} Z`;
}
function settlementBodyPath(x, y) {
  return `M ${x - 10} ${y - 1} H ${x + 10} V ${y + 9} H ${x - 10} Z`;
}
function cityMainRoofPath(x, y) {
  return `M ${x - 14} ${y - 2} L ${x - 2} ${y - 14} L ${x + 10} ${y - 2} Z`;
}
function cityMainBodyPath(x, y) {
  return `M ${x - 12} ${y - 2} H ${x + 8} V ${y + 10} H ${x - 12} Z`;
}
function cityAnnexRoofPath(x, y) {
  return `M ${x + 4} ${y - 1} L ${x + 13} ${y - 10} L ${x + 22} ${y - 1} Z`;
}
function cityAnnexBodyPath(x, y) {
  return `M ${x + 6} ${y - 1} H ${x + 20} V ${y + 8} H ${x + 6} Z`;
}

// Create a position key for deduplication (rounded to avoid float issues)
function posKey(x, y) {
  return `${Math.round(x * 10)},${Math.round(y * 10)}`;
}

function HexBoard({ 
  hexes, 
  vertices, 
  edges, 
  robber,
  players,
  ports = [],
  selectedAction,
  isMyTurn,
  canBuildNow = false,
  myIndex,
  gamePhase,
  turnPhase,
  onPlaceSettlement,
  onPlaceRoad,
  onUpgradeToCity,
  onHexClick,
  onHexRightClick,
  lastPlacedSettlement,
  freeRoads,
  legalActions = []
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);
  const dragMoved = useRef(false);
  const previousPieces = useRef(null);
  const [newPieces, setNewPieces] = useState({ roads: [], buildings: [] });
  useEffect(() => {
    const current = {
      roads: Object.entries(edges).filter(([, e]) => e.road).map(([key]) => key),
      buildings: Object.entries(vertices).filter(([, v]) => v.building).map(([key, v]) => key + ':' + v.building)
    };
    if (previousPieces.current) {
      const previous = previousPieces.current;
      setNewPieces({
        roads: current.roads.filter(key => !previous.roads.includes(key)),
        buildings: current.buildings.filter(key => !previous.buildings.includes(key))
      });
      const timeout = setTimeout(() => setNewPieces({ roads: [], buildings: [] }), 750);
      previousPieces.current = current;
      return () => clearTimeout(timeout);
    }
    previousPieces.current = current;
  }, [edges, vertices]);

  // Calculate board bounds
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(hexes).forEach(hex => {
      const pos = axialToPixel(hex.q, hex.r);
      minX = Math.min(minX, pos.x - HEX_SIZE * 1.1);
      maxX = Math.max(maxX, pos.x + HEX_SIZE * 1.1);
      minY = Math.min(minY, pos.y - HEX_SIZE * 1.1);
      maxY = Math.max(maxY, pos.y + HEX_SIZE * 1.1);
    });
    return { minX, maxX, minY, maxY };
  }, [hexes]);

  // Enough room for ports, while keeping the island dominant like the reference.
  const boardPadding = 72;
  const width = bounds.maxX - bounds.minX + boardPadding * 2;
  const height = bounds.maxY - bounds.minY + boardPadding * 2;
  const offsetX = -bounds.minX + boardPadding;
  const offsetY = -bounds.minY + boardPadding;
  const zoomedWidth = width / zoom;
  const zoomedHeight = height / zoom;
  const maxPanX = Math.max(0, (width - zoomedWidth) / 2);
  const maxPanY = Math.max(0, (height - zoomedHeight) / 2);
  const clampedPanX = Math.min(maxPanX, Math.max(-maxPanX, pan.x));
  const clampedPanY = Math.min(maxPanY, Math.max(-maxPanY, pan.y));
  const zoomedX = (width - zoomedWidth) / 2 + clampedPanX;
  const zoomedY = (height - zoomedHeight) / 2 + clampedPanY;

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const adjustZoom = (delta) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))));
  };

  const handleBoardWheel = (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const handlePointerDown = (event) => {
    if (zoom <= 1 || event.button !== 0) return;
    dragMoved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: clampedPanX,
      panY: clampedPanY
    });
  };

  const handlePointerMove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = event.clientX - dragState.clientX;
    const deltaY = event.clientY - dragState.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragMoved.current = true;

    const nextX = dragState.panX - deltaX * (zoomedWidth / rect.width);
    const nextY = dragState.panY - deltaY * (zoomedHeight / rect.height);
    setPan({
      x: Math.min(maxPanX, Math.max(-maxPanX, nextX)),
      y: Math.min(maxPanY, Math.max(-maxPanY, nextY))
    });
  };

  const handlePointerUp = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  };

  const preventClickAfterDrag = (event) => {
    if (!dragMoved.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragMoved.current = false;
  };

  // Check if vertex can be placed
  // Use canBuildNow which includes special building phase
  const canPlaceAtVertex = (vKey) => {
    if (gamePhase === 'setup') {
      if (!isMyTurn) return false;
      if (selectedAction === 'settlement') return legalActions.some(a => a.type === 'placeSettlement' && a.vertexKey === vKey);
    }
    if (gamePhase === 'playing') {
      if (!canBuildNow) return false;
      if ((turnPhase === 'main' || turnPhase === 'specialBuild') && selectedAction === 'settlement') return legalActions.some(a => a.type === 'placeSettlement' && a.vertexKey === vKey);
    }
    return false;
  };

  // Check if vertex can be upgraded
  const canUpgradeVertex = (vKey, vertex) => {
    if (!canBuildNow) return false;
    if (gamePhase !== 'playing') return false;
    if (turnPhase !== 'main' && turnPhase !== 'specialBuild') return false;
    if (selectedAction !== 'city') return false;
    if (vertex.building !== 'settlement' || vertex.owner !== myIndex) return false;
    return legalActions.some(a => a.type === 'upgradeToCity' && a.vertexKey === vKey);
  };

  // Check if edge can be placed
  const canPlaceAtEdge = (edgeKey) => {
    if (gamePhase === 'setup') {
      if (!isMyTurn) return false;
      if (selectedAction === 'road') return legalActions.some(a => a.type === 'placeRoad' && a.edgeKey === edgeKey);
    }
    if (gamePhase === 'playing') {
      if (!canBuildNow) return false;
      if ((turnPhase === 'main' || turnPhase === 'specialBuild') && selectedAction === 'road') return legalActions.some(a => a.type === 'placeRoad' && a.edgeKey === edgeKey);
      if (freeRoads > 0 && selectedAction === 'road') return legalActions.some(a => a.type === 'placeRoad' && a.edgeKey === edgeKey);
    }
    return false;
  };

  // Can click on hex (for robber)
  const canClickHex = turnPhase === 'robber' && isMyTurn;

  // Parse vertex/edge keys
  const parseVertexKey = (key) => {
    const match = key.match(/v_(-?\d+)_(-?\d+)_(\d+)/);
    if (!match) return null;
    return { q: parseInt(match[1]), r: parseInt(match[2]), dir: parseInt(match[3]) };
  };

  const parseEdgeKey = (key) => {
    const match = key.match(/e_(-?\d+)_(-?\d+)_(\d+)/);
    if (!match) return null;
    return { q: parseInt(match[1]), r: parseInt(match[2]), dir: parseInt(match[3]) };
  };

  // Get edge endpoints - edge direction i connects vertex i to vertex (i+1)%6
  const getEdgeEndpoints = (q, r, dir) => {
    const center = axialToPixel(q, r);
    
    // Vertex angles for pointy-top hex (vertex 0 at top, going clockwise)
    const angles = [90, 30, -30, -90, -150, 150];
    
    const angle1 = angles[dir] * Math.PI / 180;
    const angle2 = angles[(dir + 1) % 6] * Math.PI / 180;
    
    return {
      v1: {
        x: center.x + HEX_SIZE * Math.cos(angle1),
        y: center.y - HEX_SIZE * Math.sin(angle1)
      },
      v2: {
        x: center.x + HEX_SIZE * Math.cos(angle2),
        y: center.y - HEX_SIZE * Math.sin(angle2)
      }
    };
  };

  // SIMPLE APPROACH: Get all roads directly from edges that have road: true
  // No deduplication - if same road appears twice, it just overlaps (no visual issue)
  const roads = useMemo(() => {
    const roadList = [];
    
    Object.entries(edges).forEach(([key, edge]) => {
      if (!edge.road) return;
      
      const parsed = parseEdgeKey(key);
      if (!parsed) return;
      
      // Calculate the two vertex positions for this edge
      const { v1, v2 } = getEdgeEndpoints(parsed.q, parsed.r, parsed.dir);
      
      roadList.push({
        key,
        owner: edge.owner,
        v1,
        v2
      });
    });
    
    return roadList;
  }, [edges]);

  // Get unique edge positions for clickable areas (edges without roads)
  const clickableEdges = useMemo(() => {
    const edgeList = [];
    const seenPositions = new Set();
    
    // First, mark all positions that have roads
    const roadPositions = new Set();
    Object.entries(edges).forEach(([key, edge]) => {
      if (!edge.road) return;
      const parsed = parseEdgeKey(key);
      if (!parsed) return;
      const { v1, v2 } = getEdgeEndpoints(parsed.q, parsed.r, parsed.dir);
      const pk = [posKey(v1.x, v1.y), posKey(v2.x, v2.y)].sort().join('|');
      roadPositions.add(pk);
    });
    
    // Now add clickable areas for edges without roads
    Object.entries(edges).forEach(([key, edge]) => {
      const parsed = parseEdgeKey(key);
      if (!parsed) return;
      
      const { v1, v2 } = getEdgeEndpoints(parsed.q, parsed.r, parsed.dir);
      const pk = [posKey(v1.x, v1.y), posKey(v2.x, v2.y)].sort().join('|');
      
      // Skip if there's already a road at this position
      if (roadPositions.has(pk)) return;
      
      // Skip if we've already added this position
      if (seenPositions.has(pk)) return;
      
      seenPositions.add(pk);
      edgeList.push({
        key,
        v1,
        v2
      });
    });
    
    return edgeList;
  }, [edges]);

  // Get unique vertices - merge buildings from equivalent vertex keys
  const uniqueVertices = useMemo(() => {
    const seen = new Map();
    const result = [];
    
    Object.entries(vertices).forEach(([key, vertex]) => {
      const parsed = parseVertexKey(key);
      if (!parsed) return;
      
      // Check if hex exists
      if (!hexes[`${parsed.q},${parsed.r}`]) return;
      
      const pos = getVertexPosition(parsed.q, parsed.r, parsed.dir);
      const pk = posKey(pos.x, pos.y);
      
      if (!seen.has(pk)) {
        seen.set(pk, { key, vertex, pos, parsed });
        result.push({ key, vertex, pos, parsed });
      } else {
        // If we already have this vertex, update if this one has a building
        const existing = seen.get(pk);
        if (vertex.building && !existing.vertex.building) {
          const idx = result.findIndex(r => r.key === existing.key);
          if (idx !== -1) {
            result[idx] = { key, vertex, pos, parsed };
            seen.set(pk, { key, vertex, pos, parsed });
          }
        }
      }
    });
    
    return result;
  }, [vertices, hexes]);

  // Only the edges used by one hex belong to the island shoreline.
  const coastEdges = useMemo(() => {
    const edgeMap = new Map();

    Object.values(hexes).forEach((hex) => {
      for (let dir = 0; dir < 6; dir += 1) {
        const { v1, v2 } = getEdgeEndpoints(hex.q, hex.r, dir);
        const key = [posKey(v1.x, v1.y), posKey(v2.x, v2.y)].sort().join('|');
        const current = edgeMap.get(key);
        edgeMap.set(key, current ? { ...current, count: current.count + 1 } : { v1, v2, count: 1 });
      }
    });

    return [...edgeMap.values()].filter((edge) => edge.count === 1);
  }, [hexes]);



  return (
    <div className="hex-board-shell">
      <svg 
        className={`hex-board ${zoom > 1 ? 'zoomed' : ''} ${dragState ? 'dragging' : ''}`}
        viewBox={`${zoomedX} ${zoomedY} ${zoomedWidth} ${zoomedHeight}`}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        onWheel={handleBoardWheel}
        onDoubleClick={() => setZoom(1)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={preventClickAfterDrag}
      >
      <defs>
        <linearGradient id="ocean-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1685bd" />
          <stop offset="100%" stopColor="#08689f" />
        </linearGradient>

        {Object.values(hexes).map((hex) => {
          const pos = axialToPixel(hex.q, hex.r);
          return (
            <clipPath id={`hex-clip-${hex.q}-${hex.r}`} key={`clip-${hex.q}-${hex.r}`}>
              <path d={hexPath(pos.x, pos.y, HEX_SIZE - HEX_TEXTURE_INSET)} />
            </clipPath>
          );
        })}

        <filter id="hex-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#315019" floodOpacity="0.34"/>
        </filter>
        
        {/* Building shadow */}
        <filter id="building-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="2" dy="4" stdDeviation="2" floodColor="#000000" floodOpacity="0.7"/>
        </filter>

      </defs>
      
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        {/* Water background */}
        <rect 
          x={bounds.minX - boardPadding}
          y={bounds.minY - boardPadding}
          width={width}
          height={height}
          rx="24"
          fill="url(#ocean-gradient)"
        />
        
        {/* Animated wave shimmer overlay */}
        <g opacity="0.15">
          {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((offset, i) => (
            <path
              key={`wave-${i}`}
              d={`M${bounds.minX - 80} ${bounds.minY - 60 + offset} Q${bounds.minX + width/4} ${bounds.minY - 70 + offset}, ${bounds.minX + width/2} ${bounds.minY - 60 + offset} T${bounds.maxX + 60} ${bounds.minY - 60 + offset}`}
              stroke="#64b5f6"
              strokeWidth="2"
              fill="none"
              opacity={0.5 - i * 0.04}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0; ${15 + i * 2} ${3}; 0 0`}
                dur={`${4 + i * 0.5}s`}
                repeatCount="indefinite"
              />
            </path>
          ))}
        </g>
        
        {/* Layered shoreline, drawn only around the island perimeter. */}
        {coastEdges.map(({ v1, v2 }, index) => (
          <g key={`coast-${index}`}>
            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#8bd6e5" strokeWidth="22" strokeLinecap="round" />
            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#fff4cf" strokeWidth="15" strokeLinecap="round" />
            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#e9c86f" strokeWidth="7" strokeLinecap="round" />
          </g>
        ))}
        
        {/* Hexes */}
        {Object.entries(hexes).map(([key, hex]) => {
          const pos = axialToPixel(hex.q, hex.r);
          const isRobberHere = robber === key;
          
          return (
            <g 
              key={key} 
              className={`hex ${canClickHex ? 'clickable' : ''} ${isRobberHere ? 'has-robber' : ''}`}
              onClick={() => canClickHex && legalActions.some(a => a.type === 'moveRobber' && a.hexKey === key) && onHexClick(key)}
              onContextMenu={(e) => onHexRightClick && onHexRightClick(e, hex)}
              style={{ cursor: 'context-menu' }}
            >
              {/* Soft raised base and golden board-game rim. */}
              <path
                d={hexPath(pos.x, pos.y + 3, HEX_SIZE - 1.1)}
                fill="#8a6a18"
                filter="url(#hex-shadow)"
              />
              <path
                d={hexPath(pos.x, pos.y, HEX_SIZE - 1.1)}
                fill="#dcb534"
                stroke="#9f7c13"
                strokeWidth="3"
              />
              <image
                href={TERRAIN_ASSETS[hex.terrain]}
                x={pos.x - HEX_SIZE}
                y={pos.y - HEX_SIZE}
                width={HEX_SIZE * 2}
                height={HEX_SIZE * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#hex-clip-${hex.q}-${hex.r})`}
              />
              <path
                d={hexPath(pos.x, pos.y, HEX_SIZE - HEX_TEXTURE_INSET)}
                fill="none"
                stroke="#b68c15"
                strokeWidth="2"
              />
              
              {/* Number token */}
              {hex.number && (
                <g>
                  <rect
                    x={pos.x - 20}
                    y={pos.y - 5}
                    width="40"
                    height="37"
                    rx="7"
                    fill="#fffef6"
                    stroke="rgba(76, 70, 35, 0.18)"
                    strokeWidth="1"
                    filter="url(#building-shadow)"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 17}
                    textAnchor="middle"
                    fontSize="22"
                    fontWeight="900"
                    fontFamily="Trebuchet MS, Arial, sans-serif"
                    fill={getNumberColor(hex.number)}
                  >
                    {hex.number}
                  </text>
                  {/* Probability dots use real SVG circles to stay crisp at every scale. */}
                  {Array.from({ length: 6 - Math.abs(7 - hex.number) }).map((_, dotIndex, dots) => (
                    <circle
                      key={`probability-${dotIndex}`}
                      cx={pos.x + (dotIndex - (dots.length - 1) / 2) * 5}
                      cy={pos.y + 27.5}
                      r="2"
                      fill={getNumberColor(hex.number)}
                    />
                  ))}
                </g>
              )}
              
              {/* Robber figurine */}
              {isRobberHere && (
                <g className="robber">
                  <image
                    href="/pieces/robber-v2.png"
                    x={pos.x - 22}
                    y={pos.y - 43}
                    width="44"
                    height="66"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#building-shadow)"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Clickable edge areas (only shown when placing roads and no road exists) */}
        {clickableEdges.filter(({ key }) => canPlaceAtEdge(key)).map(({ key, v1, v2 }) => (
          <line
            key={`click-${key}`}
            x1={v1.x}
            y1={v1.y}
            x2={v2.x}
            y2={v2.y}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="10"
            strokeLinecap="round"
            className="edge-placeholder"
            onClick={() => onPlaceRoad(key)}
          />
        ))}

        {/* Roads - rendered separately from clickable areas */}
        {roads.map(({ key, owner, v1, v2 }) => (
          <g key={`road-${key}`} className={newPieces.roads.includes(key) ? "piece-road-appear" : ""}>
            {/* Black outline behind the road for visibility */}
            <line
              x1={v1.x}
              y1={v1.y}
              x2={v2.x}
              y2={v2.y}
              stroke="#000"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Colored road */}
            <line
              x1={v1.x}
              y1={v1.y}
              x2={v2.x}
              y2={v2.y}
              stroke={players[owner]?.color || '#ff0000'}
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Vertices (settlements/cities) */}
        {uniqueVertices.map(({ key, vertex, pos }) => {
          const canPlace = canPlaceAtVertex(key) && !vertex.building;
          const canUpgrade = canUpgradeVertex(key, vertex);
          
          return (
            <g key={key} className={`vertex-group ${newPieces.buildings.includes(key + ":" + vertex.building) ? "piece-building-appear" : ""}`}>
              {/* Compact settlement with distinct 45° roof, wall and door. */}
              {vertex.building === 'settlement' && (
                <g className={`settlement ${canUpgrade ? 'upgradeable' : ''}`} onClick={() => canUpgrade && onUpgradeToCity(key)}>
                  <path d={settlementBodyPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={settlementRoofPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={settlementBodyPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d={settlementRoofPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.8" strokeLinejoin="round" filter="url(#building-shadow)" />
                  <path d={`M ${pos.x - 9} ${pos.y - 2} L ${pos.x} ${pos.y - 11} L ${pos.x + 9} ${pos.y - 2}`} fill="none" stroke="#ffffff99" strokeWidth="1.25" strokeLinejoin="round" />
                  <rect x={pos.x - 2.6} y={pos.y + 2} width="5.2" height="7" rx="0.9" fill="#583923" stroke="#24170e" strokeWidth="0.65" />
                  <circle cx={pos.x + 1.2} cy={pos.y + 5.6} r="0.6" fill="#dfc88a" />
                </g>
              )}

              {/* Upgraded city with recognizable house, windows and side annex. */}
              {vertex.building === 'city' && (
                <g className="city">
                  <path d={cityMainBodyPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={cityMainRoofPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={cityAnnexBodyPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={cityAnnexRoofPath(pos.x, pos.y + 2)} fill="#0005" />
                  <path d={cityMainBodyPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d={cityMainRoofPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.8" strokeLinejoin="round" filter="url(#building-shadow)" />
                  <path d={cityAnnexBodyPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d={cityAnnexRoofPath(pos.x, pos.y)} fill={players[vertex.owner]?.color || '#e63946'} stroke="#252321" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d={`M ${pos.x - 10} ${pos.y - 3} L ${pos.x - 2} ${pos.y - 11} L ${pos.x + 6} ${pos.y - 3}`} fill="none" stroke="#ffffff99" strokeWidth="1.25" strokeLinejoin="round" />
                  <path d={`M ${pos.x + 8} ${pos.y - 2} L ${pos.x + 13} ${pos.y - 7} L ${pos.x + 18} ${pos.y - 2}`} fill="none" stroke="#ffffff99" strokeWidth="1.1" strokeLinejoin="round" />
                  <rect x={pos.x - 6.2} y={pos.y + 2.5} width="5.2" height="7.5" rx="0.9" fill="#583923" stroke="#24170e" strokeWidth="0.65" />
                  <circle cx={pos.x - 2.5} cy={pos.y + 6.2} r="0.6" fill="#dfc88a" />
                  <rect x={pos.x + 1.4} y={pos.y + 0.9} width="4.5" height="4.5" rx="0.5" fill="#c9e5f6" stroke="#344653" strokeWidth="0.75" />
                  <path d={`M ${pos.x + 3.65} ${pos.y + 1} V ${pos.y + 5.4} M ${pos.x + 1.5} ${pos.y + 3.15} H ${pos.x + 5.8}`} stroke="#567085" strokeWidth="0.55" />
                  <rect x={pos.x + 12.3} y={pos.y + 2} width="3.5" height="3.5" rx="0.5" fill="#c9e5f6" stroke="#344653" strokeWidth="0.7" />
                </g>
              )}

              {/* Clickable placeholder for placing settlements */}
              {canPlace && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="10"
                  className="vertex-placeholder"
                  onClick={() => onPlaceSettlement(key)}
                />
              )}
            </g>
          );
        })}

        {/* Ports */}
        {ports.map((port) => {
          // Get positions of the two vertices this port connects to
          const v1Key = port.vertices[0];
          const v2Key = port.vertices[1];
          
          const v1Match = v1Key.match(/v_(-?\d+)_(-?\d+)_(\d+)/);
          const v2Match = v2Key.match(/v_(-?\d+)_(-?\d+)_(\d+)/);
          
          if (!v1Match || !v2Match) return null;
          
          const v1Pos = getVertexPosition(
            parseInt(v1Match[1]), 
            parseInt(v1Match[2]), 
            parseInt(v1Match[3])
          );
          const v2Pos = getVertexPosition(
            parseInt(v2Match[1]), 
            parseInt(v2Match[2]), 
            parseInt(v2Match[3])
          );
          
          // Calculate midpoint of the edge (center of hexagon edge near port)
          const midX = (v1Pos.x + v2Pos.x) / 2;
          const midY = (v1Pos.y + v2Pos.y) / 2;
          
          // Calculate outward direction (perpendicular to edge, pointing away from board center)
          // Edge vector
          const edgeX = v2Pos.x - v1Pos.x;
          const edgeY = v2Pos.y - v1Pos.y;
          // Perpendicular vector (rotate 90 degrees)
          let perpX = -edgeY;
          let perpY = edgeX;
          // Normalize
          const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
          perpX /= perpLen;
          perpY /= perpLen;
          // Make sure it points outward (away from center 0,0)
          const dotProduct = perpX * midX + perpY * midY;
          if (dotProduct < 0) {
            perpX = -perpX;
            perpY = -perpY;
          }
          
          // Dock geometry
          const dockWidth = 16;
          const dockLen = 36;
          const thickness = 5;
          
          // Unit vector along the edge
          let uX = edgeX / perpLen;
          let uY = edgeY / perpLen;
          
          // Top plank corners
          const p1x = midX - uX * (dockWidth / 2);
          const p1y = midY - uY * (dockWidth / 2);
          const p2x = midX + uX * (dockWidth / 2);
          const p2y = midY + uY * (dockWidth / 2);
          const p3x = p2x + perpX * dockLen;
          const p3y = p2y + perpY * dockLen;
          const p4x = p1x + perpX * dockLen;
          const p4y = p1y + perpY * dockLen;
          
          const cx = midX + perpX * 33;
          const cy = midY + perpY * 33;
          const badge = PORT_LABELS[port.resource];
          const labelX = midX + perpX * 66;
          const labelY = midY + perpY * 66;
          
          return (
            <g key={port.id} className="port">
              {/* Dock Side Wall (Thickness) */}
              <polygon 
                points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y} ${p4x},${p4y+thickness} ${p3x},${p3y+thickness} ${p2x},${p2y+thickness} ${p1x},${p1y+thickness}`} 
                fill="#875322" 
              />
              {/* Dock Top Plank */}
              <polygon 
                points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`} 
                fill="#d5963e"
                stroke="#8b541f"
                strokeWidth="1"
              />
              {[0.22, 0.44, 0.66, 0.88].map((step) => (
                <line
                  key={`plank-${step}`}
                  x1={p1x + perpX * dockLen * step}
                  y1={p1y + perpY * dockLen * step}
                  x2={p2x + perpX * dockLen * step}
                  y2={p2y + perpY * dockLen * step}
                  stroke="#9c6125"
                  strokeWidth="1"
                />
              ))}
              {/* Ship */}
              <g className="ship">
                {/* Foam and rounded wooden hull. */}
                <ellipse cx={cx} cy={cy + 13} rx="22" ry="5" fill="#8de1f0" opacity="0.9" />
                <ellipse cx={cx} cy={cy + 11} rx="18" ry="3.5" fill="#d9fbff" />
                <path
                  d={`M${cx-21},${cy-3} Q${cx},${cy+4} ${cx+21},${cy-3} Q${cx+16},${cy+13} ${cx},${cy+14} Q${cx-16},${cy+13} ${cx-21},${cy-3} Z`}
                  fill="#c77825"
                  stroke="#75401b"
                  strokeWidth="1.5"
                />
                <path d={`M${cx-17},${cy+3} Q${cx},${cy+10} ${cx+17},${cy+3}`} fill="none" stroke="#f0ad45" strokeWidth="2" />
                <path d={`M${cx-20},${cy-3} Q${cx},${cy+2} ${cx+20},${cy-3}`} fill="none" stroke="#6c3819" strokeWidth="2" />

                {/* Mast, white sail and pennant. */}
                <rect x={cx - 1.5} y={cy - 37} width="3" height="36" rx="1" fill="#704119" />
                <path
                  d={`M${cx+2},${cy-34} Q${cx+24},${cy-29} ${cx+21},${cy-8} Q${cx+12},${cy-5} ${cx+2},${cy-7} Z`}
                  fill="#fffef7"
                  stroke="#d7d1c4"
                  strokeWidth="1.2"
                />
                <path d={`M${cx+1},${cy-37} L${cx+15},${cy-36} L${cx+3},${cy-31} Z`} fill="#fffef7" stroke="#d7d1c4" strokeWidth="0.8" />

                {/* Large, separate plaque: type and trade ratio remain readable. */}
              </g>
              <g transform={`translate(${labelX}, ${labelY})`} className="port-label" style={{ pointerEvents: 'none' }}>
                <title>{badge ? `Porto de ${badge.name.toLowerCase()} — 2 para 1` : 'Porto genérico — 3 para 1'}</title>
                <rect x="-23" y="-26" width="46" height="54" rx="8" fill="#fff9e9" stroke="#624421" strokeWidth="2.2" />
                <rect x="-20" y="-23" width="40" height="19" rx="5" fill="#214c80" />
                <text x="0" y="-8.4" textAnchor="middle" fontSize="15" fontWeight="900" fontFamily="Arial, sans-serif" fill="#fff">{port.ratio}:1</text>
                <rect x="-20" y="-1" width="40" height="25" rx="4" fill={badge?.fill || '#efdfb2'} stroke="#9a7a41" strokeWidth="0.7" />
                {port.resource ? (
                  // Same original SVG illustration used inside the resource cards.
                  <g transform="translate(-10.2,-3) scale(0.25)">
                    <ResourceIllustration type={port.resource} />
                  </g>
                ) : (
                  <text x="0" y="15.5" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="Arial, sans-serif" fill="#46381e">QUALQUER</text>
                 )}
              </g>
            </g>
          );
        })}
        </g>
      </svg>

      <div className="board-zoom-controls" aria-label="Controles de zoom do tabuleiro">
        <button type="button" onClick={() => adjustZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Diminuir zoom">−</button>
        <button type="button" className="zoom-level" onClick={() => setZoom(1)} title="Restaurar zoom">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => adjustZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Aumentar zoom">+</button>
      </div>
    </div>
  );
}

export default HexBoard;
