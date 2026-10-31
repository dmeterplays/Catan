import { useState } from 'react';
import RulesModal from './RulesModal';
import './Lobby.css';

function Lobby({ onCreateGame, onJoinGame, error, setError, serverUrl, setServerUrl, connected }) {
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [isExtended, setIsExtended] = useState(false);
  const [enableSpecialBuild, setEnableSpecialBuild] = useState(true);
  const [mapType, setMapType] = useState('random');
  const [autoSetup, setAutoSetup] = useState(false);
  const [turnTimeLimit, setTurnTimeLimit] = useState(120);
  const [isCitiesAndKnights, setIsCitiesAndKnights] = useState(false);
  const [isSeafarers, setIsSeafarers] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('catanServerUrl', tempUrl);
    setServerUrl(tempUrl);
    setShowSettings(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Digite seu nome');
      return;
    }
    
    if (mode === 'create') {
      onCreateGame(playerName.trim(), isExtended, enableSpecialBuild, mapType, autoSetup && !isSeafarers, isCitiesAndKnights, turnTimeLimit, isSeafarers);
    } else if (mode === 'join') {
      if (!gameCode.trim()) {
        setError('Digite o código da partida');
        return;
      }
      onJoinGame(gameCode.trim().toUpperCase(), playerName.trim());
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-bg"></div>
      
      {/* Animated sun rays */}
      <div className="sun-rays"></div>
      
      {/* Floating clouds */}
      <div className="cloud cloud-1"></div>
      <div className="cloud cloud-2"></div>
      <div className="cloud cloud-3"></div>
      <div className="cloud cloud-4"></div>
      
      {/* Birds */}
      <div className="birds birds-1">
        <svg width="30" height="12" viewBox="0 0 30 12"><path d="M0 6 Q7 0 15 6 Q23 0 30 6" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none"/></svg>
      </div>
      <div className="birds birds-2">
        <svg width="20" height="8" viewBox="0 0 20 8"><path d="M0 4 Q5 0 10 4 Q15 0 20 4" stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none"/></svg>
      </div>
      <div className="birds birds-3">
        <svg width="25" height="10" viewBox="0 0 25 10"><path d="M0 5 Q6 0 12 5 Q19 0 25 5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" fill="none"/></svg>
      </div>
      
      {/* Rules Button */}
      <button 
        className="rules-btn"
        onClick={() => setShowRules(true)}
      >
        📜 Regras
      </button>


      <div className="lobby-content">
        <div className="lobby-header">
          <h1>CATAN</h1>
          <p className="subtitle">Multijogador Online</p>
        </div>

        {mode === null ? (
          <div className="lobby-menu fade-in">
            <button 
              className="menu-btn create-btn"
              onClick={() => setMode('create')}
              disabled={!connected}
            >
              <span className="btn-icon">🏝️</span>
              {connected ? 'Criar Nova Partida' : 'Conectando...'}
            </button>
            
            <button 
              className="menu-btn join-btn"
              onClick={() => setMode('join')}
              disabled={!connected}
            >
              <span className="btn-icon">🚢</span>
              {connected ? 'Entrar na Partida' : 'Conectando...'}
            </button>

            <button 
              className="menu-btn settings-main-btn"
              onClick={() => {
                setTempUrl(serverUrl || '');
                setShowSettings(true);
              }}
            >
              <span className="btn-icon">⚙️</span>
              Configurações do Servidor
            </button>
          </div>
        ) : (
          <form className="lobby-form fade-in" onSubmit={handleSubmit}>
            <button 
              type="button" 
              className="back-btn"
              onClick={() => { setMode(null); setError(null); }}
            >
              ← Voltar
            </button>
            
            <h2>{mode === 'create' ? 'Criar Nova Partida' : 'Entrar na Partida'}</h2>
            
            <div className="form-group">
              <label htmlFor="playerName">Seu Nome</label>
              <input
                id="playerName"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Digite seu nome"
                maxLength={20}
                autoFocus
              />
            </div>
            
            {mode === 'create' && (
              <>
                <details className="create-mode-accordion">
                  <summary className="create-mode-summary">
                    <span>🎮 Modo de jogo</span>
                    <span className="create-mode-current">
                      {isSeafarers ? '⛵ Navegantes · 4 jogadores' :
                        isCitiesAndKnights ? '🏰 Cidades e Cavaleiros · 2–4 jogadores' :
                        isExtended ? '👥 Estendido · 5–8 jogadores' : '🎲 Clássico · 2–4 jogadores'}
                    </span>
                  </summary>
                  <div className="create-mode-content">
                    <p className="create-mode-help">Escolha uma modalidade. A quantidade máxima de participantes é ajustada automaticamente.</p>
                    <div className="create-mode-grid">
                      <button type="button" className={`create-mode-card ${!isExtended && !isCitiesAndKnights ? 'active' : ''}`}
                        aria-pressed={!isExtended && !isCitiesAndKnights}
                        onClick={() => {setIsExtended(false);setIsCitiesAndKnights(false);setIsSeafarers(false);}}>
                        <strong>🎲 Clássico</strong><small>2–4 jogadores</small>
                      </button>
                      <button type="button" className={`create-mode-card ${isExtended ? 'active' : ''}`}
                        aria-pressed={isExtended}
                        onClick={() => {setIsExtended(true);setIsCitiesAndKnights(false);setIsSeafarers(false);}}>
                        <strong>👥 Estendido</strong><small>5–8 jogadores</small>
                      </button>
                      <button type="button" className={`create-mode-card ${isCitiesAndKnights ? 'active' : ''}`}
                        aria-pressed={isCitiesAndKnights}
                        onClick={() => {setIsExtended(false);setIsCitiesAndKnights(true);setIsSeafarers(false);}}>
                        <strong>🏰 Cidades e Cavaleiros</strong><small>2–4 jogadores</small>
                      </button>
                      <button type="button" className={`create-mode-card ${isSeafarers ? 'active' : ''}`}
                        aria-pressed={isSeafarers}
                        onClick={() => {setIsExtended(false);setIsCitiesAndKnights(false);setIsSeafarers(true);}}>
                        <strong>⛵ Navegantes</strong><small>4 jogadores · Rumo a Novas Margens</small>
                      </button>
                    </div>
                  </div>
                </details>

                {/* Special Building Phase option - only for extended mode */}
                {isExtended && !isSeafarers && (
                  <div className="form-group special-build-option">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableSpecialBuild}
                        onChange={(e) => setEnableSpecialBuild(e.target.checked)}
                      />
                      <span className="checkbox-text">
                        <span className="checkbox-title">🏗️ Fase de Construção Especial</span>
                        <span className="checkbox-desc">Permite que todos os jogadores construam após cada turno</span>
                      </span>
                    </label>
                  </div>
                )}
                
                {/* Map Type Selection */}
                <div className="form-group game-mode-group">
                  <label>Tipo de Mapa</label>
                  <div className="game-mode-options">
                    <button
                      type="button"
                      className={`mode-option ${mapType === 'standard' ? 'active' : ''}`}
                      onClick={() => setMapType('standard')}
                    >
                      <span className="mode-icon">🗺️</span>
                      <span className="mode-label">Padrão</span>
                      <span className="mode-desc">Layout para Iniciantes</span>
                    </button>
                    <button
                      type="button"
                      className={`mode-option ${mapType === 'random' ? 'active' : ''}`}
                      onClick={() => setMapType('random')}
                    >
                      <span className="mode-icon">🎲</span>
                      <span className="mode-label">Aleatório</span>
                      <span className="mode-desc">Tabuleiro Variável</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="turnTimeLimit">⏱️ Tempo por turno</label>
                  <select id="turnTimeLimit" value={turnTimeLimit} onChange={e => setTurnTimeLimit(Number(e.target.value))}>
                    <option value={0}>Sem limite</option>
                    <option value={60}>1 minuto</option>
                    <option value={120}>2 minutos (padrão)</option>
                    <option value={180}>3 minutos</option>
                    <option value={300}>5 minutos</option>
                  </select>
                  <small>Ao esgotar, o servidor encerra o turno automaticamente quando possível.</small>
                </div>
                {/* Auto Setup Toggle */}
                <div className="form-group special-build-option" style={{ marginTop: '1rem' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoSetup}
                      disabled={isSeafarers}
                      onChange={(e) => setAutoSetup(e.target.checked)}
                    />
                    <span className="checkbox-text">
                      <span className="checkbox-title">⚡ Início Rápido (Preparação Automática)</span>
                      <span className="checkbox-desc">Posiciona as aldeias iniciais automaticamente</span>
                    </span>
                  </label>
                </div>


              </>
            )}
            
            {mode === 'join' && (
              <div className="form-group">
                <label htmlFor="gameCode">Código da Partida</label>
                <input
                  id="gameCode"
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Digite o código de 6 letras"
                  maxLength={6}
                  className="code-input"
                />
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" className="submit-btn">
              {mode === 'create' ? 'Criar Partida' : 'Entrar na Partida'}
            </button>
          </form>
        )}

        <div className="lobby-footer">
          <p>2-8 Jogadores • Vence quem chegar primeiro a 10 Pontos de Vitória</p>
          <p className="credits">Criado por <span className="creator-name">TaShUOP</span></p>
        </div>
      </div>
      
      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Settings Modal */}
      {showSettings && (
        <div className="rules-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="rules-modal settings-modal" onClick={e => e.stopPropagation()}>
            <button className="rules-close-btn" onClick={() => setShowSettings(false)}>×</button>
            
            <div className="rules-header settings-header">
              <h2 className="settings-title">
                <span className="settings-icon">⚡</span> Configuração do Servidor
              </h2>
            </div>
            
            <div className="rules-container settings-container">
              <div className="form-group settings-group">
                <label className="settings-label">Endereço Personalizado do Servidor</label>
                <div className="settings-input-wrapper">
                  <div className="settings-input-icon">🌐</div>
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    className="code-input settings-input"
                    placeholder="http://localhost:3001"
                  />
                </div>
                <p className="settings-hint">
                  Informe o endereço de um servidor personalizado para jogar em uma instância privada.
                </p>
              </div>


              <button className="submit-btn settings-save-btn" onClick={handleSaveSettings}>
                Salvar e Reconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;
