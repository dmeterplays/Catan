import { useState, useEffect } from 'react';
import './DiceDisplay.css';
import { nomeTrilha } from '../i18n';

const DICE_FACES = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅'
};

function DiceDisplay({ roll, onRightClick }) {
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 800);
    return () => clearTimeout(timer);
  }, [roll]);

  if (!roll) return null;

  const isSeven = roll.total === 7;

  const handleContextMenu = (e) => {
    if (onRightClick) {
      e.preventDefault();
      onRightClick(e, 'diceRoll', {
        title: `Rolagem de Dados: ${roll.total}`,
        icon: '🎲',
        description: isSeven 
          ? 'Tirar 7 ativa o ladrão! Jogadores com 8 ou mais cartas devem descartar metade. Depois, mova o ladrão e roube.'
          : `Hexágonos com o número ${roll.total} produzem recursos para as aldeias/cidades vizinhas.`,
        number: roll.total
      });
    }
  };

  return (
    <div 
      className={`dice-display ${animating ? 'animating' : ''} ${isSeven ? 'seven' : ''}`}
      onContextMenu={handleContextMenu}
      title="Clique com o botão direito para ver informações"
      style={{ cursor: 'context-menu' }}
    >
      <div className="dice-container">
        <div className="die die-white">{DICE_FACES[roll.die1]}</div>
        {roll.eventDie && (
          <div className="die die-event" title={`Evento: ${roll.eventDie === 'barbarian' ? 'bárbaros' : nomeTrilha(roll.eventDie)}`}>
            {roll.eventDie === 'barbarian' ? '🏴‍☠️' : 
             roll.eventDie === 'science' ? '📗' : 
             roll.eventDie === 'politics' ? '📘' : '📒'}
          </div>
        )}
        <div className={`die ${roll.eventDie ? 'die-red' : ''}`}>{DICE_FACES[roll.die2]}</div>
      </div>
      <div className="dice-total">
        {roll.total}
        {isSeven && <span className="robber-alert">🥷 Ladrão!</span>}
      </div>
    </div>
  );
}

export default DiceDisplay;
