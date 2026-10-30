import { useState, useEffect, useCallback, useRef } from 'react';
import HexBoard from './HexBoard';
import PlayerPanel from './PlayerPanel';
import ResourceCards from './ResourceCards';
import ActionPanel from './ActionPanel';
import TradeModal from './TradeModal';
import DiceDisplay from './DiceDisplay';
import Chat from './Chat';
import DevCardModal from './DevCardModal';
import DiscardModal from './DiscardModal';
import CardReveal from './CardReveal';
import InfoPopup, { useInfoPopup, INFO_DATA } from './InfoPopup';
import Confetti from './Confetti';
import { nomeRecurso, nomeTrilha } from '../i18n';
import './GameBoard.css';

const AVAILABLE_COLORS = [
  { value: '#e63946', label: 'Vermelho' },
  { value: '#457b9d', label: 'Azul' },
  { value: '#f4a261', label: 'Laranja' },
  { value: '#2a9d8f', label: 'Verde-azulado' },
  { value: '#6a994e', label: 'Verde' },
  { value: '#9d4edd', label: 'Roxo' },
  { value: '#e07b53', label: 'Coral' },
  { value: '#4a90d9', label: 'Azul-aço' }
];

function GameBoard({ socket, gameState, playerId, gameCode, chatMessages, onLeaveGame, addNotification }) {
  const [selectedAction, setSelectedAction] = useState(null); // 'settlement', 'road', 'city'
  const [dismissedBarbarianResult, setDismissedBarbarianResult] = useState(false);
  const [lastPlacedSettlement, setLastPlacedSettlement] = useState(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showDevCardModal, setShowDevCardModal] = useState(false);
  const [pendingRobberHex, setPendingRobberHex] = useState(null);
  const [playersOnHex, setPlayersOnHex] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [resourceGainNotification, setResourceGainNotification] = useState(null);
  const [revealedCard, setRevealedCard] = useState(null);
  const [lastTradeOfferId, setLastTradeOfferId] = useState(null);
  const [dismissedTradeId, setDismissedTradeId] = useState(null);
  const [showDice, setShowDice] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [showEventLog, setShowEventLog] = useState(false);
  useEffect(() => { const id = setInterval(() => setClockNow(Date.now()), 500); return () => clearInterval(id); }, []);
  const [lastNotifiedRoll, setLastNotifiedRoll] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  // Info popup for right-click
  const { popup: infoPopup, showInfo, showHexInfo, closePopup: closeInfoPopup } = useInfoPopup();
  
  const myPlayer = gameState.players[gameState.myIndex];
  const currentPlayer = gameState.phase !== 'waiting' ? gameState.players[gameState.currentPlayerIndex] : null;
  const isMyTurn = gameState.phase !== 'waiting' && gameState.currentPlayerIndex === gameState.myIndex;
  const isSetup = gameState.phase === 'setup';
  const isWaiting = gameState.phase === 'waiting';
  const isHost = gameState.players[0]?.id === playerId;
  const remainingSeconds = gameState.turnDeadline ? Math.max(0, Math.ceil((gameState.turnDeadline - clockNow) / 1000)) : null;
  const clockLabel = remainingSeconds === null ? 'Sem limite' : `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  const needsToDiscard = gameState.discardingPlayers?.some(
    d => d.playerIndex === gameState.myIndex
  );
  
  // 5-8 player extension: Special Building Phase
  const isSpecialBuildPhase = gameState.specialBuildingPhase && gameState.turnPhase === 'specialBuild';
  const isMySpecialBuild = isSpecialBuildPhase && gameState.specialBuildIndex === gameState.myIndex;
  const canBuildNow = isMyTurn || isMySpecialBuild;

  // Auto-hide dice display after 5 seconds
  useEffect(() => {
    if (gameState.diceRoll && gameState.turnPhase !== 'roll') {
      // Show the dice
      setShowDice(true);
      setDismissedBarbarianResult(false);
      
      // Hide dice after 5 seconds
      const timer = setTimeout(() => {
        setShowDice(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else if (gameState.turnPhase === 'roll') {
      // Reset when new turn starts (waiting for roll)
      setShowDice(false);
    }
  }, [gameState.diceRoll?.dice1, gameState.diceRoll?.dice2, gameState.turnPhase, gameState.currentPlayerIndex]);

  // Listen for personal resource received events (shows center popup for your own gains)
  useEffect(() => {
    const handleResourcesReceived = ({ gains, fromRoll }) => {
      const resourceNames = { brick: '🧱', lumber: '🪵', wool: '🐑', grain: '🌾', ore: '⛏️' };
      const gainsList = Object.entries(gains)
        .filter(([_, amount]) => amount > 0)
        .map(([resource, amount]) => `${resourceNames[resource]} ${amount}`)
        .join(' ');
      
      if (gainsList) {
        // Show center popup for your own resources
        setResourceGainNotification({ gains, fromRoll, gainsList });
        setTimeout(() => setResourceGainNotification(null), 4000);
      }
    };
    
    socket.on('resourcesReceived', handleResourcesReceived);
    return () => socket.off('resourcesReceived', handleResourcesReceived);
  }, [socket]);

  // Listen for all resource distributions (public info - everyone sees who got what)
  useEffect(() => {
    const handleResourcesDistributed = ({ fromRoll, allGains }) => {
      const resourceNames = { brick: '🧱', lumber: '🪵', wool: '🐑', grain: '🌾', ore: '⛏️' };
      
      allGains.forEach(({ playerName, playerId: gainPlayerId, gains }) => {
        const gainsList = Object.entries(gains)
          .filter(([_, amount]) => amount > 0)
          .map(([resource, amount]) => `${resourceNames[resource]}${amount}`)
          .join(' ');
        
        if (gainPlayerId === playerId) {
          // Your own gains
          addNotification(`🎲 Você recebeu: ${gainsList}`);
        } else {
          // Other player's gains
          addNotification(`🎲 ${playerName} recebeu: ${gainsList}`);
        }
      });
    };
    
    socket.on('resourcesDistributed', handleResourcesDistributed);
    return () => socket.off('resourcesDistributed', handleResourcesDistributed);
  }, [socket, playerId, addNotification]);

  // Listen for steal notifications
  useEffect(() => {
    const resourceIcons = { brick: '🧱', lumber: '🪵', wool: '🐑', grain: '🌾', ore: '⛏️' };
    
    const handleStealResult = ({ type, resource, otherPlayer }) => {
      const icon = resourceIcons[resource] || resource;
      if (type === 'stole') {
        addNotification(`🥷 Você roubou ${icon} ${nomeRecurso(resource)} de ${otherPlayer}!`);
      } else {
        addNotification(`😢 ${otherPlayer} roubou ${icon} ${nomeRecurso(resource)} de você!`);
      }
    };
    
    socket.on('stealResult', handleStealResult);
    return () => socket.off('stealResult', handleStealResult);
  }, [socket, addNotification]);

  // Notify when a progress card is drawn from dice roll
  useEffect(() => {
    if (gameState?.lastDrawnProgressCards) {
      const myCard = gameState.lastDrawnProgressCards.find(c => c.playerId === playerId);
      if (myCard) {
        const icon = myCard.track === 'science' ? '📗' : myCard.track === 'politics' ? '📘' : '📒';
        addNotification(`${icon} Você sacou uma carta de progresso de ${nomeTrilha(myCard.track)}!`);
      }
    }
  }, [gameState?.diceRoll]);

  // Listen for special building phase events (5-8 player extension)
  useEffect(() => {
    const handleSpecialBuildStarted = ({ currentBuilder }) => {
      if (currentBuilder === playerId) {
        addNotification('🏗️ Fase de Construção Especial - Sua vez de construir!');
      }
    };
    
    const handleSpecialBuildNext = ({ currentBuilder }) => {
      if (currentBuilder === playerId) {
        addNotification('🏗️ Sua vez na Fase de Construção Especial!');
      }
    };
    
    const handleSpecialBuildEnded = () => {
      addNotification('Fase de Construção Especial encerrada');
    };
    
    socket.on('specialBuildingPhaseStarted', handleSpecialBuildStarted);
    socket.on('specialBuildNext', handleSpecialBuildNext);
    socket.on('specialBuildingPhaseEnded', handleSpecialBuildEnded);
    
    return () => {
      socket.off('specialBuildingPhaseStarted', handleSpecialBuildStarted);
      socket.off('specialBuildNext', handleSpecialBuildNext);
      socket.off('specialBuildingPhaseEnded', handleSpecialBuildEnded);
    };
  }, [socket, playerId, addNotification]);

  // Track new chat messages for notification dot
  useEffect(() => {
    if (chatMessages.length > lastMessageCount) {
      // Only increment unread if chat is closed and message is from another player
      if (!showChat) {
        const newMessages = chatMessages.slice(lastMessageCount);
        const otherPlayerMessages = newMessages.filter(msg => msg.playerId !== playerId);
        if (otherPlayerMessages.length > 0) {
          setUnreadMessages(prev => prev + otherPlayerMessages.length);
        }
      }
      setLastMessageCount(chatMessages.length);
    }
  }, [chatMessages, lastMessageCount, showChat, playerId]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Auto-open trade modal when there's a pending trade from another player
  useEffect(() => {
    const tradeOffer = gameState.tradeOffer;
    const isTradeFromMe = tradeOffer?.from === gameState.myIndex;
    
    // Create a unique ID for this trade to track if we've already shown it
    const tradeId = tradeOffer ? `${tradeOffer.from}-${JSON.stringify(tradeOffer.offer)}` : null;
    
    if (tradeOffer && !isTradeFromMe && tradeId !== lastTradeOfferId) {
      // New trade from another player - auto open the modal
      setShowTradeModal(true);
      setLastTradeOfferId(tradeId);
      setDismissedTradeId(null); // Reset dismissed state for new trade
      const traderName = gameState.players[tradeOffer.from]?.name || 'Um jogador';
      addNotification(`${traderName} quer trocar com você!`);
    } else if (!tradeOffer) {
      // Trade was cancelled or completed - clear all trade state
      setLastTradeOfferId(null);
      setDismissedTradeId(null);
    }
  }, [gameState.tradeOffer, gameState.myIndex, gameState.players, lastTradeOfferId, addNotification]);

  // Auto-select action during setup
  useEffect(() => {
    if (isSetup && isMyTurn) {
      // Check if we need to place settlement or road
      const mySettlements = Object.values(gameState.vertices)
        .filter(v => v.owner === gameState.myIndex && v.building === 'settlement').length;
      const myRoads = Object.values(gameState.edges)
        .filter(e => e.owner === gameState.myIndex && e.road).length;
      
      const expectedSettlements = gameState.setupPhase === 0 ? 1 : 2;
      const expectedRoads = gameState.setupPhase === 0 ? 1 : 2;
      
      if (mySettlements < expectedSettlements) {
        setSelectedAction('settlement');
      } else if (myRoads < expectedRoads) {
        setSelectedAction('road');
      } else {
        setSelectedAction(null);
      }
    }
  }, [isSetup, isMyTurn, gameState]);

  // Reset roll notification tracker when turn phase goes back to 'roll' (new turn)
  useEffect(() => {
    if (gameState.turnPhase === 'roll') {
      setLastNotifiedRoll(null);
    }
  }, [gameState.turnPhase]);

  // Handle dice roll notification (only for 7 - robber)
  useEffect(() => {
    if (gameState.diceRoll && gameState.turnPhase !== 'roll') {
      // Create unique key for this roll to prevent duplicate notifications
      const rollKey = `${gameState.diceRoll.dice1}-${gameState.diceRoll.dice2}-${gameState.currentPlayerIndex}`;
      
      // Only notify for 7 (robber) - regular rolls are shown in the dice display
      if (rollKey !== lastNotifiedRoll && gameState.diceRoll.total === 7) {
        const roller = gameState.players[gameState.currentPlayerIndex];
        addNotification(`⚠️ ${roller.name} tirou 7! Mova o ladrão.`);
        setLastNotifiedRoll(rollKey);
      } else if (rollKey !== lastNotifiedRoll) {
        setLastNotifiedRoll(rollKey);
      }
    }
  }, [gameState.diceRoll, gameState.turnPhase, gameState.currentPlayerIndex, gameState.players, lastNotifiedRoll, addNotification]);

  // Handle winner
  useEffect(() => {
    if (gameState.winner) {
      const winner = gameState.players.find(p => p.id === gameState.winner);
      addNotification(`🎉 ${winner.name} venceu o jogo!`);
    }
  }, [gameState.winner]);

  const handleRollDice = useCallback(() => {
    socket.emit('performAction', { action: { type: 'rollDice' } }, (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handlePlaceSettlement = useCallback((vertexKey) => {
    socket.emit('performAction', { action: { type: 'placeSettlement', vertexKey, ...(isSetup ? { setup: true } : {}) } }, (response) => {
      if (response.success) {
        setLastPlacedSettlement(vertexKey);
        if (isSetup) {
          setSelectedAction('road');
        } else {
          setSelectedAction(null);
        }
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, isSetup, addNotification]);

  const handlePlaceRoad = useCallback((edgeKey) => {
    socket.emit('performAction', { action: { type: 'placeRoad', edgeKey, ...(isSetup ? { setup: true } : {}),  } }, (response) => {
      if (response.success) {
        if (isSetup) {
          // Advance setup
          setLastPlacedSettlement(null);
        } else if (gameState.freeRoads > 1) {
          // Still have free roads from Road Building card
          setSelectedAction('road');
        } else {
          setSelectedAction(null);
        }
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, isSetup, lastPlacedSettlement, gameState.freeRoads, addNotification]);

  const handleUpgradeToCity = useCallback((vertexKey) => {
    socket.emit('performAction', { action: { type: 'upgradeToCity', vertexKey } }, (response) => {
      if (response.success) {
        setSelectedAction(null);
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleHexClick = useCallback((hexKey) => {
    if (gameState.turnPhase === 'robber' && isMyTurn) {
      if (hexKey === gameState.robber) {
        addNotification('É preciso mover o ladrão para outro hexágono');
        return;
      }
      
      // Get players on this hex
      socket.emit('getPlayersOnHex', { hexKey }, (response) => {
        if (response.success && response.players.length > 0) {
          setPendingRobberHex(hexKey);
          setPlayersOnHex(response.players);
        } else {
          // No players to steal from, just move
          socket.emit('performAction', { action: { type: 'moveRobber', hexKey, stealFromPlayerId: null } }, (res) => {
            if (!res.success) {
              addNotification(res.error);
            }
          });
        }
      });
    }
  }, [gameState.turnPhase, gameState.robber, isMyTurn, socket, addNotification]);

  const handleStealFromPlayer = useCallback((stealPlayerId) => {
    socket.emit('performAction', { action: { type: 'moveRobber', hexKey: pendingRobberHex, stealFromPlayerId: stealPlayerId } }, (response) => {
      if (response.success) {
        setPendingRobberHex(null);
        setPlayersOnHex([]);
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, pendingRobberHex, addNotification]);

  const handleEndTurn = useCallback(() => {
    socket.emit('performAction', { action: { type: 'endTurn' } }, (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleBuyDevCard = useCallback(() => {
    socket.emit('performAction', { action: { type: 'buyDevCard' } }, (response) => {
      if (response.success) {
        setRevealedCard(response.card);
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleBuyCityImprovement = useCallback((track) => {
    socket.emit('buyCityImprovement', { track }, (response) => {
      if (response.success) {
        addNotification(`Melhoria de ${nomeTrilha(track)} aprimorada!`);
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);
  
  const handleRecruitKnight = useCallback(() => {
    socket.emit('recruitKnight', (response) => {
      if (!response.success) addNotification(response.error);
    });
  }, [socket, addNotification]);

  const handleActivateKnight = useCallback((level) => {
    socket.emit('activateKnight', { level }, (response) => {
      if (!response.success) addNotification(response.error);
    });
  }, [socket, addNotification]);

  const handleUpgradeKnight = useCallback((fromLevel) => {
    socket.emit('upgradeKnight', { fromLevel }, (response) => {
      if (!response.success) addNotification(response.error);
    });
  }, [socket, addNotification]);

  const handleAddBot = useCallback(() => {
    if (!socket?.connected) {
      addNotification('Sem conexão com o servidor. Verifique se o backend está online.');
      return;
    }
    socket.timeout(5000).emit('addBot', (error, response) => {
      if (error) {
        addNotification('O servidor não respondeu ao pedido de adicionar bot. Verifique se o backend foi atualizado.');
      } else if (!response?.success) {
        addNotification(response?.error || 'Não foi possível adicionar o bot.');
      }
    });
  }, [socket, addNotification]);

  const handleRemoveBot = useCallback(() => {
    if (!socket?.connected) {
      addNotification('Sem conexão com o servidor.');
      return;
    }
    socket.timeout(5000).emit('removeBot', (error, response) => {
      if (error) {
        addNotification('O servidor não respondeu ao pedido de remover bot.');
      } else if (!response?.success) {
        addNotification(response?.error || 'Não foi possível remover o bot.');
      }
    });
  }, [socket, addNotification]);

  const handleStartGame = useCallback(() => {
    socket.emit('startGame', (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleShuffleBoard = useCallback(() => {
    socket.emit('shuffleBoard', (response) => {
      if (response.success) {
        addNotification('Tabuleiro embaralhado!');
      } else {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleSendChat = useCallback((message) => {
    socket.emit('chatMessage', { message });
  }, [socket]);

  const getStatusMessage = () => {
    const maxPlayers = gameState.maxPlayers || 4;
    if (gameState.phase === 'waiting') {
      const modeText = gameState.isExtended ? '(Modo 5-8 Jogadores)' : '';
      return `Prévia do Tabuleiro ${modeText} - Aguardando jogadores... (${gameState.players.length}/${maxPlayers})`;
    }
    if (gameState.phase === 'finished') {
      const winner = gameState.players.find(p => p.id === gameState.winner);
      return `🎉 ${winner.name} venceu!`;
    }
    if (needsToDiscard) {
      const discardInfo = gameState.discardingPlayers.find(
        d => d.playerIndex === gameState.myIndex
      );
      return `Descarte ${discardInfo.cardsToDiscard} cartas`;
    }
    if (isSetup) {
      return isMyTurn 
        ? `Posicione sua ${gameState.setupPhase === 0 ? 'primeira' : 'segunda'} aldeia e estrada`
        : `${currentPlayer?.name} está posicionando...`;
    }
    // Special Building Phase (5-8 player extension)
    if (isSpecialBuildPhase) {
      if (isMySpecialBuild) {
        return '🏗️ Fase de Construção Especial - Construa ou compre cartas e depois passe a vez';
      }
      const specialBuilder = gameState.players[gameState.specialBuildIndex];
      return `🏗️ Fase de Construção Especial - vez de ${specialBuilder?.name} construir`;
    }
    if (!isMyTurn) {
      return `Vez de ${currentPlayer?.name}`;
    }
    switch (gameState.turnPhase) {
      case 'roll': return 'Role os dados';
      case 'robber': return 'Mova o ladrão';
      case 'discard': return 'Aguardando os jogadores descartarem';
      case 'main': return 'Construa, troque ou encerre o turno';
      default: return '';
    }
  };
  
  // Handler to end special building phase turn
  const handleEndSpecialBuild = useCallback(() => {
    socket.emit('endSpecialBuild', (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  const handleColorChange = useCallback((color) => {
    socket.emit('changeColor', { color }, (response) => {
      if (!response.success) {
        addNotification(response.error);
      }
    });
  }, [socket, addNotification]);

  return (
    <>
      {gameState.phase === 'playing' && (
        <div style={{position:'fixed',top:10,left:'50%',transform:'translateX(-50%)',zIndex:1200,background:'#202b37',color:'#fff',padding:'7px 14px',borderRadius:9,border:'1px solid #bd9b57',fontWeight:700}}>
          ⏱️ {currentPlayer?.name}: <span style={{color:remainingSeconds !== null && remainingSeconds <= 20 ? '#ff7777':'#fff'}}>{clockLabel}</span>
          <button type="button" onClick={() => setShowEventLog(v => !v)} style={{marginLeft:12}}>📜 Histórico</button>
        </div>
      )}
      {showEventLog && (
        <aside style={{position:'fixed',right:12,top:70,zIndex:1300,width:320,maxWidth:'90vw',maxHeight:'60vh',overflowY:'auto',background:'#202b37',color:'#fff',padding:14,borderRadius:10,border:'1px solid #bd9b57'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}><strong>📜 Acontecimentos</strong><button onClick={() => setShowEventLog(false)}>✕</button></div>
          {(gameState.eventLog || []).slice().reverse().map(event => <p key={event.id} style={{borderBottom:'1px solid #555',padding:'5px 0',fontSize:13}}>{new Date(event.at).toLocaleTimeString('pt-BR')} — {event.message}</p>)}
          {!gameState.eventLog?.length && <p>Nenhum acontecimento registrado.</p>}
        </aside>
      )}
    <div className="game-board">
      {/* Header */}
      <div className="game-header">
        <div className="game-code-display">
          <span className="label">Código da Partida:</span>
          <span className="code">{gameCode}</span>
        </div>
        
        <div className="turn-indicator">
          {currentPlayer ? (
            <div 
              className="current-player-badge"
              style={{ backgroundColor: currentPlayer.color }}
            >
              {currentPlayer.name}
            </div>
          ) : (
            <div className="current-player-badge waiting-badge">
              Sala de Espera
            </div>
          )}
          <span className="status-message">{getStatusMessage()}</span>
        </div>

        <button className="leave-btn" onClick={onLeaveGame}>
          Sair da Partida
        </button>
      </div>

      {/* Main game area */}
      <div className="game-main">
        {/* Left sidebar - Players */}
        <div className="sidebar left-sidebar">
          <h3>Jogadores</h3>
          {gameState.players.map((player, idx) => (
            <PlayerPanel 
              key={player.id}
              player={player}
              isCurrentTurn={idx === gameState.currentPlayerIndex}
              isMe={idx === gameState.myIndex}
              longestRoad={gameState.longestRoadPlayer === idx}
              largestArmy={gameState.largestArmyPlayer === idx}
              gameOver={gameState.phase === 'finished'}
              isCitiesAndKnights={gameState.isCitiesAndKnights}
              onRightClick={(e, key, extra) => {
                if (extra) {
                  // Custom info passed
                  e.preventDefault();
                  showInfo(e, key, extra);
                } else {
                  showInfo(e, key);
                }
              }}
            />
          ))}
          
          {isWaiting && (
            <div className="waiting-controls">
              <div className="color-selector" style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ccc' }}>Escolha Sua Cor</h4>
                <div className="color-swatches" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {AVAILABLE_COLORS.map(c => {
                    const isTaken = gameState.players.some(p => p.color === c.value && p.id !== myPlayer.id);
                    return (
                      <button
                        key={c.value}
                        className={`color-swatch ${myPlayer.color === c.value ? 'selected' : ''}`}
                        style={{ 
                          backgroundColor: c.value, 
                          opacity: isTaken ? 0.3 : 1,
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          border: myPlayer.color === c.value ? '2px solid white' : '2px solid transparent',
                          cursor: isTaken ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isTaken}
                        title={isTaken ? 'Cor já escolhida' : c.label}
                        onClick={() => handleColorChange(c.value)}
                      />
                    );
                  })}
                </div>
              </div>

              {isHost && !gameState.isExtended && !gameState.isCitiesAndKnights && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button type="button" className="shuffle-btn" onClick={handleAddBot} disabled={gameState.players.length >= (gameState.maxPlayers || 4)}>🤖 Adicionar bot</button>
                  <button type="button" className="shuffle-btn" onClick={handleRemoveBot} disabled={!gameState.players.some(p => p.isBot)}>Remover bot</button>
                </div>
              )}
              {isHost && (
                <>
                  <button 
                    className="shuffle-btn"
                    onClick={handleShuffleBoard}
                    disabled={gameState.mapType === 'standard'} // Can't shuffle standard beginner map
                  >
                    🔀 Embaralhar Tabuleiro
                  </button>
                  <button 
                    className="start-game-btn"
                    onClick={handleStartGame}
                    disabled={gameState.players.length < 2}
                  >
                    ▶️ Iniciar Partida ({gameState.players.length}/{gameState.maxPlayers || 4})
                  </button>
                </>
              )}
              {!isHost && (
                <p className="waiting-text">Aguardando o anfitrião iniciar...</p>
              )}
            </div>
          )}
        </div>

        {/* Center - Board */}
        <div className="board-container">
          <HexBoard 
            hexes={gameState.hexes}
            vertices={gameState.vertices}
            edges={gameState.edges}
            robber={gameState.robber}
            players={gameState.players}
            ports={gameState.ports || []}
            selectedAction={selectedAction}
            isMyTurn={isMyTurn}
            canBuildNow={canBuildNow}
            myIndex={gameState.myIndex}
            gamePhase={gameState.phase}
            turnPhase={gameState.turnPhase}
            onPlaceSettlement={handlePlaceSettlement}
            onPlaceRoad={handlePlaceRoad}
            onUpgradeToCity={handleUpgradeToCity}
            onHexClick={handleHexClick}
            onHexRightClick={showHexInfo}
            lastPlacedSettlement={lastPlacedSettlement}
            freeRoads={gameState.freeRoads}
            legalActions={gameState.legalActions || []}
          />
          
          {/* Dice display - auto-hides after 5 seconds */}
          {showDice && gameState.diceRoll && (
            <DiceDisplay 
              roll={gameState.diceRoll} 
              onRightClick={(e, key, extra) => showInfo(e, key, extra)}
            />
          )}
        </div>

        {/* Right sidebar - Actions */}
        <div className="sidebar right-sidebar">
          {gameState.phase === 'playing' && (
            <>
              <ActionPanel 
                isMyTurn={isMyTurn}
                turnPhase={gameState.turnPhase}
                selectedAction={selectedAction}
                setSelectedAction={setSelectedAction}
                onRollDice={handleRollDice}
                onEndTurn={handleEndTurn}
                onBuyDevCard={handleBuyDevCard}
                onOpenTrade={() => setShowTradeModal(true)}
                onOpenDevCards={() => setShowDevCardModal(true)}
                onBuyCityImprovement={handleBuyCityImprovement}
                onRecruitKnight={handleRecruitKnight}
                onActivateKnight={handleActivateKnight}
                onUpgradeKnight={handleUpgradeKnight}
                isCitiesAndKnights={gameState.isCitiesAndKnights}
                player={myPlayer}
                freeRoads={gameState.freeRoads}
                yearOfPlentyPicks={gameState.yearOfPlentyPicks}
                devCardsLeft={gameState.devCardDeck}
                isSpecialBuildPhase={isSpecialBuildPhase}
                isMySpecialBuild={isMySpecialBuild}
              />
            </>
          )}
          
          <button 
            className="chat-toggle"
            onClick={() => setShowChat(!showChat)}
          >
            💬 Chat
            {unreadMessages > 0 && (
              <span className="chat-notification-dot">{unreadMessages}</span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom - My Resources */}
      <div className="my-resources-bar">
        <ResourceCards 
          resources={myPlayer.resources} 
          minimal
          onRightClick={(e, resourceKey) => showInfo(e, resourceKey)}
        />
        
        <div className="dev-cards-summary" onClick={() => setShowDevCardModal(true)}>
          <span className="label">Cartas de Desenvolvimento:</span>
          <span className="count">{myPlayer.developmentCards?.length || 0}</span>
          {myPlayer.newDevCards?.length > 0 && (
            <span className="new-badge">+{myPlayer.newDevCards.length} nova(s)</span>
          )}
        </div>
      </div>

      {/* Robber Phase Banner - shows when player needs to move the robber */}
      {gameState.turnPhase === 'robber' && isMyTurn && (
        <div className="robber-notification-banner">
          <span className="robber-icon">🥷</span>
          <span className="robber-text">
            <strong>Mova o Ladrão!</strong> Clique em um hexágono para colocar o ladrão nele.
          </span>
        </div>
      )}

      {/* Discard Phase Banner - shows when waiting for others to discard */}
      {gameState.turnPhase === 'discard' && isMyTurn && (
        <div className="discard-notification-banner">
          <span className="discard-icon">⏳</span>
          <span className="discard-text">
            Aguardando os jogadores descartarem cartas...
          </span>
        </div>
      )}

      {/* Special Building Phase Banner (5-8 player extension) */}
      {isMySpecialBuild && (
        <div className="special-build-banner">
          <span className="special-build-icon">🏗️</span>
          <span className="special-build-text">
            <strong>Fase de Construção Especial!</strong> Você pode construir estradas, aldeias, cidades ou comprar cartas de desenvolvimento. Trocas não são permitidas.
          </span>
          <button className="special-build-done-btn" onClick={handleEndSpecialBuild}>
            Terminar Construção
          </button>
        </div>
      )}
      
      {/* Barbarian Tracker Banner */}
      {gameState.isCitiesAndKnights && (
        <div className="barbarian-tracker-banner">
          <span className="barbarian-icon">🏴‍☠️</span>
          <span className="barbarian-text">
            <strong>Frota Bárbara:</strong> {gameState.barbarianPosition}/7 casas até o ataque
          </span>
        </div>
      )}
      
      {/* Barbarian Attack Result Modal */}
      {gameState.lastBarbarianResult && !dismissedBarbarianResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', zIndex: 1000, pointerEvents: 'auto' }}>
            <h2 style={{ color: gameState.lastBarbarianResult.won ? '#4caf50' : '#f44336' }}>
              {gameState.lastBarbarianResult.won ? '🛡️ Catan Defendida!' : '🔥 Os Bárbaros Saquearam!'}
            </h2>
            <p style={{ margin: '20px 0', fontSize: '1.2rem' }}>
              Força dos Bárbaros: <strong>{gameState.lastBarbarianResult.barbarianStrength}</strong>
              <br/>
              Força dos Cavaleiros de Catan: <strong>{gameState.lastBarbarianResult.catanStrength}</strong>
            </p>
            <p style={{ marginBottom: '20px', color: '#ffd700' }}>
              {gameState.lastBarbarianResult.details}
            </p>
            <button className="primary-btn" onClick={() => setDismissedBarbarianResult(true)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Trade Notification Banner - shows when there's a pending trade from another player */}
      {gameState.tradeOffer && 
       gameState.tradeOffer.from !== gameState.myIndex && 
       !showTradeModal && 
       dismissedTradeId !== lastTradeOfferId && (
        <div className="trade-notification-banner">
          <span className="trade-icon">🤝</span>
          <span className="trade-text" onClick={() => setShowTradeModal(true)}>
            <strong>{gameState.players[gameState.tradeOffer.from]?.name}</strong> quer trocar com você!
          </span>
          <button className="view-trade-btn" onClick={() => setShowTradeModal(true)}>Ver Troca</button>
          <button 
            className="dismiss-trade-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setDismissedTradeId(lastTradeOfferId);
            }}
            title="Dispensar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modals */}
      {showTradeModal && (
        <TradeModal 
          socket={socket}
          gameState={gameState}
          myPlayer={myPlayer}
          isMyTurn={isMyTurn}
          onClose={() => setShowTradeModal(false)}
          addNotification={addNotification}
        />
      )}

      {showDevCardModal && (
        <DevCardModal 
          socket={socket}
          myPlayer={myPlayer}
          isMyTurn={isMyTurn}
          turnPhase={gameState.turnPhase}
          yearOfPlentyPicks={gameState.yearOfPlentyPicks}
          isCitiesAndKnights={gameState.isCitiesAndKnights}
          onClose={() => setShowDevCardModal(false)}
          addNotification={addNotification}
        />
      )}

      {revealedCard && (
        <CardReveal 
          cardType={revealedCard}
          onClose={() => setRevealedCard(null)}
        />
      )}

      {needsToDiscard && (
        <DiscardModal 
          socket={socket}
          player={myPlayer}
          cardsToDiscard={
            gameState.discardingPlayers.find(d => d.playerIndex === gameState.myIndex)?.cardsToDiscard
          }
          addNotification={addNotification}
        />
      )}

      {/* Steal selection modal */}
      {pendingRobberHex && playersOnHex.length > 0 && (
        <div className="modal-overlay">
          <div className="steal-modal">
            <h3>Roubar de quem?</h3>
            <div className="steal-options">
              {playersOnHex.map(p => (
                <button 
                  key={p.id}
                  className="steal-btn"
                  onClick={() => handleStealFromPlayer(p.id)}
                  disabled={!p.hasResources}
                >
                  {p.name}
                  {!p.hasResources && <span className="no-cards">(sem cartas)</span>}
                </button>
              ))}
            </div>
            {/* Show OK button if no players have cards to steal */}
            {playersOnHex.every(p => !p.hasResources) && (
              <button 
                className="steal-ok-btn"
                onClick={() => handleStealFromPlayer(null)}
              >
                OK
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resource gain notification */}
      {resourceGainNotification && (
        <div className="resource-gain-popup">
          <div className="resource-gain-title">🎲 Tirou {resourceGainNotification.fromRoll}</div>
          <div className="resource-gain-content">
            Você recebeu: {resourceGainNotification.gainsList}
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && (
        <Chat 
          messages={chatMessages}
          onSend={handleSendChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Info Popup for right-click help */}
      {infoPopup && (
        <InfoPopup 
          position={infoPopup.position}
          info={infoPopup.info}
          onClose={closeInfoPopup}
        />
      )}

      {/* Victory celebration with confetti */}
      {gameState.phase === 'finished' && gameState.winner && (
        <Confetti 
          winner={gameState.players.find(p => p.id === gameState.winner)}
          onBackToLobby={onLeaveGame}
        />
      )}
    </div>
    </>
  );
}

export default GameBoard;

