import { useEffect, useState } from 'react';
import './CardReveal.css';

const DEV_CARD_INFO = {
  knight: {
    name: 'Cavaleiro',
    icon: '⚔️',
    description: 'Mova o ladrão para um novo hexágono e roube um recurso de um adversário que tenha uma construção ao lado dele.',
    color: '#8b4513',
    bgGradient: 'linear-gradient(135deg, #654321 0%, #8b4513 50%, #a0522d 100%)'
  },
  victoryPoint: {
    name: 'Ponto de Vitória',
    icon: '🏆',
    description: 'Vale 1 Ponto de Vitória! Ele fica em SEGREDO dos outros jogadores até você vencer. Só você pode ver este PV.',
    color: '#ffd700',
    bgGradient: 'linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #ffec8b 100%)'
  },
  roadBuilding: {
    name: 'Construção de Estradas',
    icon: '🛤️',
    description: 'Construa 2 estradas imediatamente e de graça, seguindo as regras normais de posicionamento.',
    color: '#2e8b57',
    bgGradient: 'linear-gradient(135deg, #1e5a37 0%, #2e8b57 50%, #3cb371 100%)'
  },
  yearOfPlenty: {
    name: 'Ano da Abundância',
    icon: '🌈',
    description: 'Pegue 2 cartas de recurso quaisquer do banco. Podem ser 2 iguais ou diferentes.',
    color: '#4169e1',
    bgGradient: 'linear-gradient(135deg, #2a4494 0%, #4169e1 50%, #6495ed 100%)'
  },
  monopoly: {
    name: 'Monopólio',
    icon: '💰',
    description: 'Escolha 1 recurso. Todos os outros jogadores devem entregar a você TODAS as cartas desse tipo.',
    color: '#9932cc',
    bgGradient: 'linear-gradient(135deg, #6a1b9a 0%, #9932cc 50%, #ba55d3 100%)'
  }
};

function CardReveal({ cardType, onClose }) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const cardInfo = DEV_CARD_INFO[cardType];
  
  useEffect(() => {
    // Start flip animation after a short delay
    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
    }, 500);
    
    // End animation state
    const animTimer = setTimeout(() => {
      setIsAnimating(false);
    }, 1500);
    
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(animTimer);
    };
  }, []);
  
  if (!cardInfo) return null;
  
  return (
    <div className="card-reveal-overlay" onClick={onClose}>
      <div className="card-reveal-container">
        <div className={`card-reveal ${isFlipped ? 'flipped' : ''} ${isAnimating ? 'animating' : ''}`}>
          {/* Card Back */}
          <div className="card-face card-back">
            <div className="card-back-design">
              <div className="card-back-pattern">
                <span className="card-back-icon">🎴</span>
              </div>
              <div className="card-back-text">Carta de Desenvolvimento</div>
            </div>
          </div>
          
          {/* Card Front */}
          <div 
            className="card-face card-front"
            style={{ background: cardInfo.bgGradient }}
          >
            <div className="card-border">
              <div className="card-header">
                <span className="card-icon-large">{cardInfo.icon}</span>
                <h2 className="card-title">{cardInfo.name}</h2>
              </div>
              
              <div className="card-body">
                <div className="card-art">
                  <span className="card-art-icon">{cardInfo.icon}</span>
                </div>
                <p className="card-description">{cardInfo.description}</p>
              </div>
              
              <div className="card-footer">
                <span className="card-type">Carta de Desenvolvimento</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="card-reveal-hint">Clique em qualquer lugar para fechar</p>
      </div>
    </div>
  );
}

export default CardReveal;

