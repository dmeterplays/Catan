import { useState, useEffect, useCallback } from 'react';
import './InfoPopup.css';
import { nomeRecurso } from '../i18n';

// Centralized info data for all game elements
const INFO_DATA = {
  // Player card symbols
  settlements: {
    icon: '🏠',
    title: 'Aldeias',
    description: 'Pequenas construções que valem 1 Ponto de Vitória cada. Produzem 1 recurso quando sai o número de um hexágono vizinho.',
    cost: '🧱1 🪵1 🐑1 🌾1'
  },
  cities: {
    icon: '🏰',
    title: 'Cidades',
    description: 'Aldeias melhoradas que valem 2 Pontos de Vitória. Produzem 2 recursos quando sai o número de um hexágono vizinho.',
    cost: '⛏️3 🌾2'
  },
  roads: {
    icon: '━',
    title: 'Estradas',
    description: 'Conectam suas aldeias e cidades. A maior estrada contínua (5 ou mais) rende 2 PV de bônus.',
    cost: '🧱1 🪵1'
  },
  devCards: {
    icon: '📜',
    title: 'Cartas de Desenvolvimento',
    description: 'Cartas especiais com vários poderes: Cavaleiros, Pontos de Vitória, Construção de Estradas, Ano da Abundância, Monopólio.',
    cost: '⛏️1 🌾1 🐑1'
  },
  victoryPoints: {
    icon: '🏆',
    title: 'Pontos de Vitória',
    description: 'O primeiro jogador a chegar a 10 PV vence! Ganham-se PV com aldeias (1), cidades (2), maior estrada (2), maior exército (2) e cartas de PV.',
  },
  longestRoad: {
    icon: '🛤️',
    title: 'Maior Estrada',
    description: 'O jogador com a maior estrada contínua de 5 ou mais trechos ganha 2 Pontos de Vitória.',
  },
  largestArmy: {
    icon: '⚔️',
    title: 'Maior Exército',
    description: 'O jogador que jogou 3 ou mais cartas de Cavaleiro (o maior número) ganha 2 Pontos de Vitória.',
  },
  knights: {
    icon: '🛡️',
    title: 'Cavaleiros Jogados',
    description: 'Número de cartas de Cavaleiro jogadas. 3 ou mais cavaleiros podem render o bônus de Maior Exército (2 PV).',
  },
  
  // Resources
  brick: {
    icon: '🧱',
    title: 'Tijolo',
    description: 'Produzido por Colinas (hexágonos marrons/vermelhos). Usado em estradas e aldeias.',
    terrain: 'Colinas'
  },
  lumber: {
    icon: '🪵',
    title: 'Madeira',
    description: 'Produzida por Florestas (hexágonos verde-escuros). Usada em estradas e aldeias.',
    terrain: 'Floresta'
  },
  wool: {
    icon: '🐑',
    title: 'Lã',
    description: 'Produzida por Pastos (hexágonos verde-claros). Usada em aldeias e cartas de desenvolvimento.',
    terrain: 'Pasto'
  },
  grain: {
    icon: '🌾',
    title: 'Trigo',
    description: 'Produzido por Campos (hexágonos amarelos). Usado em aldeias, cidades e cartas de desenvolvimento.',
    terrain: 'Campos'
  },
  ore: {
    icon: '⛏️',
    title: 'Minério',
    description: 'Produzido por Montanhas (hexágonos cinza). Usado em cidades e cartas de desenvolvimento.',
    terrain: 'Montanhas'
  },
  
  // Terrain types
  hills: {
    icon: '🧱',
    title: 'Colinas',
    description: 'Produz Tijolo quando sai o número da ficha.',
    resource: 'Tijolo'
  },
  forest: {
    icon: '🪵',
    title: 'Floresta',
    description: 'Produz Madeira quando sai o número da ficha.',
    resource: 'Madeira'
  },
  pasture: {
    icon: '🐑',
    title: 'Pasto',
    description: 'Produz Lã quando sai o número da ficha.',
    resource: 'Lã'
  },
  fields: {
    icon: '🌾',
    title: 'Campos',
    description: 'Produz Trigo quando sai o número da ficha.',
    resource: 'Trigo'
  },
  mountains: {
    icon: '⛏️',
    title: 'Montanhas',
    description: 'Produz Minério quando sai o número da ficha.',
    resource: 'Minério'
  },
  desert: {
    icon: '🏜️',
    title: 'Deserto',
    description: 'Não produz nada. O ladrão começa aqui.',
    resource: 'Nenhum'
  },
  
  // Port types
  portGeneric: {
    icon: '⚓',
    title: 'Porto Genérico 3:1',
    description: 'Troque 3 cartas iguais de qualquer recurso por 1 de qualquer outro recurso.',
  },
  portBrick: {
    icon: '🧱',
    title: 'Porto de Tijolo 2:1',
    description: 'Troque 2 Tijolos por 1 de qualquer outro recurso.',
  },
  portLumber: {
    icon: '🪵',
    title: 'Porto de Madeira 2:1',
    description: 'Troque 2 Madeiras por 1 de qualquer outro recurso.',
  },
  portWool: {
    icon: '🐑',
    title: 'Porto de Lã 2:1',
    description: 'Troque 2 Lãs por 1 de qualquer outro recurso.',
  },
  portGrain: {
    icon: '🌾',
    title: 'Porto de Trigo 2:1',
    description: 'Troque 2 Trigos por 1 de qualquer outro recurso.',
  },
  portOre: {
    icon: '⛏️',
    title: 'Porto de Minério 2:1',
    description: 'Troque 2 Minérios por 1 de qualquer outro recurso.',
  },
  
  // Game elements
  robber: {
    icon: '🥷',
    title: 'O Ladrão',
    description: 'Bloqueia a produção de recursos neste hexágono. É movido quando sai 7 ou quando se joga um Cavaleiro.',
  },
  diceRoll: {
    icon: '🎲',
    title: 'Rolagem de Dados',
    description: 'Soma de dois dados (2-12). Hexágonos com este número produzem recursos. O 7 ativa o ladrão.',
  },
  turnOrder: {
    icon: '🔢',
    title: 'Ordem dos Turnos',
    description: 'O número indica quando este jogador joga. É sorteado no início da partida.',
  },
};

// Number probability info
const NUMBER_PROBABILITIES = {
  2: { dots: 1, probability: '2,8%', rolls: '1 em 36' },
  3: { dots: 2, probability: '5,6%', rolls: '2 em 36' },
  4: { dots: 3, probability: '8,3%', rolls: '3 em 36' },
  5: { dots: 4, probability: '11,1%', rolls: '4 em 36' },
  6: { dots: 5, probability: '13,9%', rolls: '5 em 36' },
  8: { dots: 5, probability: '13,9%', rolls: '5 em 36' },
  9: { dots: 4, probability: '11,1%', rolls: '4 em 36' },
  10: { dots: 3, probability: '8,3%', rolls: '3 em 36' },
  11: { dots: 2, probability: '5,6%', rolls: '2 em 36' },
  12: { dots: 1, probability: '2,8%', rolls: '1 em 36' },
};

function InfoPopup({ position, info, onClose }) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleEscape = (e) => e.key === 'Escape' && onClose();
    
    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!info) return null;

  // Adjust position to keep popup on screen
  const style = {
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 200),
  };

  return (
    <div className="info-popup" style={style} onClick={e => e.stopPropagation()}>
      <div className="info-popup-header">
        <span className="info-popup-icon">{info.icon}</span>
        <span className="info-popup-title">{info.title}</span>
      </div>
      <div className="info-popup-body">
        <p className="info-popup-description">{info.description}</p>
        {info.cost && (
          <div className="info-popup-cost">
            <span className="cost-label">Custo:</span> {info.cost}
          </div>
        )}
        {info.resource && (
          <div className="info-popup-detail">
            <span className="detail-label">Recurso:</span> {info.resource}
          </div>
        )}
        {info.terrain && (
          <div className="info-popup-detail">
            <span className="detail-label">Terreno:</span> {info.terrain}
          </div>
        )}
        {info.number && (
          <div className="info-popup-number">
            <span className="detail-label">Ficha de Número:</span> {info.number}
            {NUMBER_PROBABILITIES[info.number] && (
              <span className="probability">
                ({NUMBER_PROBABILITIES[info.number].probability} de chance)
              </span>
            )}
          </div>
        )}
      </div>
      <div className="info-popup-hint">Clique em qualquer lugar para fechar</div>
    </div>
  );
}

// Hook for managing info popup state
export function useInfoPopup() {
  const [popup, setPopup] = useState(null);

  const showInfo = useCallback((e, infoKey, extraData = {}) => {
    e.preventDefault();
    e.stopPropagation();
    
    const baseInfo = INFO_DATA[infoKey] || {};
    
    // If neither baseInfo nor extraData has content, don't show popup
    if (!baseInfo.title && !extraData.title) return;
    
    setPopup({
      position: { x: e.clientX, y: e.clientY },
      info: { ...baseInfo, ...extraData }
    });
  }, []);

  const showHexInfo = useCallback((e, hex) => {
    e.preventDefault();
    e.stopPropagation();
    
    const terrainInfo = INFO_DATA[hex.terrain] || {};
    const resourceIcon = {
      brick: '🧱', lumber: '🪵', wool: '🐑', grain: '🌾', ore: '⛏️'
    }[hex.resource] || '❌';
    
    const info = {
      icon: resourceIcon,
      title: terrainInfo.title || (hex.terrain.charAt(0).toUpperCase() + hex.terrain.slice(1)),
      description: terrainInfo.description || 'Um hexágono de terreno do tabuleiro.',
      resource: hex.resource ? (nomeRecurso(hex.resource).charAt(0).toUpperCase() + nomeRecurso(hex.resource).slice(1)) : 'Nenhum',
      number: hex.number
    };
    
    setPopup({
      position: { x: e.clientX, y: e.clientY },
      info
    });
  }, []);

  const closePopup = useCallback(() => setPopup(null), []);

  return { popup, showInfo, showHexInfo, closePopup };
}

export { INFO_DATA, NUMBER_PROBABILITIES };
export default InfoPopup;

