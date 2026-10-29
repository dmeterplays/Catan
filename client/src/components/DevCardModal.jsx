import { useState } from 'react';
import './DevCardModal.css';
import { nomeRecurso } from '../i18n';

const DEV_CARD_INFO = {
  knight: {
    name: 'Cavaleiro',
    icon: '⚔️',
    description: 'Mova o ladrão e roube de um adversário. Conta para o Maior Exército.',
    playable: true
  },
  victoryPoint: {
    name: 'Ponto de Vitória',
    icon: '🏆',
    description: 'Vale 1 PV. Revelado no fim do jogo ou quando você vencer.',
    playable: false
  },
  roadBuilding: {
    name: 'Construção de Estradas',
    icon: '🛤️',
    description: 'Construa 2 estradas de graça.',
    playable: true
  },
  yearOfPlenty: {
    name: 'Ano da Abundância',
    icon: '🌈',
    description: 'Pegue 2 recursos quaisquer do banco.',
    playable: true
  },
  monopoly: {
    name: 'Monopólio',
    icon: '💰',
    description: 'Escolha um recurso. Todos os jogadores entregam a você todas as cartas desse tipo.',
    playable: true
  }
};

const PROGRESS_CARD_INFO = {
  inventor: { name: 'Inventor (Ciência)', icon: '📗', description: 'Pegue 2 recursos quaisquer do banco.', playable: true, track: 'science' },
  engineer: { name: 'Engenheiro (Ciência)', icon: '📗', description: 'Construa 2 estradas de graça.', playable: true, track: 'science' },
  constitution: { name: 'Constituição (Política)', icon: '📘', description: '+1 Ponto de Vitória. Contado automaticamente.', playable: false, track: 'politics' },
  commercialMonopoly: { name: 'Monopólio Comercial (Comércio)', icon: '📒', description: 'Escolha um recurso. Todos os jogadores entregam a você todas as cartas desse tipo.', playable: true, track: 'trade' }
};

const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
const RESOURCE_ICONS = {
  brick: '🧱',
  lumber: '🪵',
  wool: '🐑',
  grain: '🌾',
  ore: '⛏️'
};

function DevCardModal({ socket, myPlayer, isMyTurn, turnPhase, yearOfPlentyPicks, isCitiesAndKnights, onClose, addNotification }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [monopolyResource, setMonopolyResource] = useState(null);

  // Can play dev cards before rolling (roll phase) or after rolling (main phase)
  const canPlay = isMyTurn && (turnPhase === 'roll' || turnPhase === 'main');

  const handlePlayCard = (cardType, track = null) => {
    if (cardType === 'monopoly' || cardType === 'commercialMonopoly') {
      setSelectedCard(cardType);
      return;
    }

    const eventName = isCitiesAndKnights ? 'playProgressCard' : 'playDevCard';
    const payload = isCitiesAndKnights ? { track, cardType, params: {} } : { cardType, params: {} };
    
    socket.emit(eventName, payload, (response) => {
      if (response.success) {
        const info = isCitiesAndKnights ? PROGRESS_CARD_INFO[cardType] : DEV_CARD_INFO[cardType];
        addNotification(`Jogou ${info.name}!`);
        if (cardType === 'knight' || cardType === 'roadBuilding' || cardType === 'engineer') {
          onClose();
        }
      } else {
        addNotification(response.error);
      }
    });
  };

  const handleMonopoly = () => {
    if (!monopolyResource) {
      addNotification('Selecione um recurso');
      return;
    }

    const eventName = isCitiesAndKnights ? 'playProgressCard' : 'playDevCard';
    const payload = isCitiesAndKnights 
      ? { track: 'trade', cardType: 'commercialMonopoly', params: { resource: monopolyResource } }
      : { cardType: 'monopoly', params: { resource: monopolyResource } };

    socket.emit(eventName, payload, (response) => {
      if (response.success) {
        addNotification(`Monopólio de ${nomeRecurso(monopolyResource)}!`);
        onClose();
      } else {
        addNotification(response.error);
      }
    });
  };

  const handleYearOfPlentyPick = (resource) => {
    socket.emit('yearOfPlentyPick', { resource }, (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  };

  // Group cards by type
  const cardCounts = {};
  if (isCitiesAndKnights && myPlayer.progressCards) {
    Object.keys(myPlayer.progressCards).forEach(track => {
      myPlayer.progressCards[track].forEach(card => {
        cardCounts[card] = (cardCounts[card] || 0) + 1;
      });
    });
  } else {
    myPlayer.developmentCards?.forEach(card => {
      cardCounts[card] = (cardCounts[card] || 0) + 1;
    });
  }

  let newCards = [];
  if (isCitiesAndKnights && myPlayer.newProgressCards) {
    Object.keys(myPlayer.newProgressCards).forEach(track => {
      newCards.push(...myPlayer.newProgressCards[track]);
    });
  } else {
    newCards = myPlayer.newDevCards || [];
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dev-card-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <h2>Cartas de Desenvolvimento</h2>

        {/* Year of Plenty resource picking */}
        {yearOfPlentyPicks > 0 && (
          <div className="year-of-plenty-picker">
            <h3>Ano da Abundância - escolha {yearOfPlentyPicks} recurso(s)</h3>
            <div className="resource-buttons">
              {RESOURCES.map(r => (
                <button
                  key={r}
                  className="resource-pick-btn"
                  onClick={() => handleYearOfPlentyPick(r)}
                >
                  <span className="icon">{RESOURCE_ICONS[r]}</span>
                  <span className="name">{nomeRecurso(r)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monopoly resource selection */}
        {selectedCard === 'monopoly' && (
          <div className="monopoly-picker">
            <h3>Escolha o recurso a monopolizar</h3>
            <div className="resource-buttons">
              {RESOURCES.map(r => (
                <button
                  key={r}
                  className={`resource-pick-btn ${monopolyResource === r ? 'selected' : ''}`}
                  onClick={() => setMonopolyResource(r)}
                >
                  <span className="icon">{RESOURCE_ICONS[r]}</span>
                  <span className="name">{nomeRecurso(r)}</span>
                </button>
              ))}
            </div>
            <div className="monopoly-actions">
              <button onClick={() => setSelectedCard(null)}>Cancelar</button>
              <button className="confirm" onClick={handleMonopoly}>Confirmar</button>
            </div>
          </div>
        )}

        {/* Cards list */}
        {!selectedCard && (
          <>
            {Object.keys(cardCounts).length === 0 && newCards.length === 0 ? (
              <p className="no-cards">Você não tem cartas de {isCitiesAndKnights ? 'progresso' : 'desenvolvimento'}.</p>
            ) : (
              <>
                {/* Playable cards */}
                <div className="card-list">
                  {Object.entries(cardCounts).map(([cardType, count]) => {
                    const info = isCitiesAndKnights ? PROGRESS_CARD_INFO[cardType] : DEV_CARD_INFO[cardType];
                    const isPlayable = info.playable && canPlay;
                    
                    return (
                      <div key={cardType} className={`dev-card ${isPlayable ? 'playable' : ''}`}>
                        <div className="card-header">
                          <span className="card-icon">{info.icon}</span>
                          <span className="card-name">{info.name}</span>
                          <span className="card-count">×{count}</span>
                        </div>
                        <p className="card-description">{info.description}</p>
                        {info.playable && (
                          <button
                            className="play-card-btn"
                            onClick={() => handlePlayCard(cardType, info.track)}
                            disabled={!isPlayable}
                          >
                            Jogar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* New cards (bought this turn) */}
                {newCards.length > 0 && (
                  <div className="new-cards">
                    <h4>{isCitiesAndKnights ? "Sacadas Neste Turno (ainda não podem ser jogadas)" : "Compradas Neste Turno (ainda não podem ser jogadas)"}</h4>
                    <div className="card-list small">
                      {newCards.map((cardType, idx) => {
                        const info = isCitiesAndKnights ? PROGRESS_CARD_INFO[cardType] : DEV_CARD_INFO[cardType];
                        return (
                          <div key={idx} className="dev-card new">
                            <span className="card-icon">{info.icon}</span>
                            <span className="card-name">{info.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DevCardModal;

