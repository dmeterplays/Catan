import { useState } from 'react';
import './RulesModal.css';

function RulesModal({ onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = {
    overview: {
      title: '🎯 Visão Geral',
      content: `
**Objetivo:** Seja o primeiro jogador a chegar a **10 Pontos de Vitória** construindo aldeias, cidades e conquistando bônus especiais.

**Jogadores:** 2-8 jogadores (o modo de 5-8 jogadores usa as regras da extensão)

**Pontos de Vitória (PV) são ganhos com:**
• Aldeias: 1 PV cada
• Cidades: 2 PV cada
• Maior Estrada (5 ou mais trechos): 2 PV
• Maior Exército (3 ou mais cavaleiros): 2 PV
• Cartas de desenvolvimento de Ponto de Vitória: 1 PV cada (ocultas até a vitória)
      `
    },
    setup: {
      title: '🏗️ Preparação',
      content: `
**Posicionamento Inicial (na ordem dos turnos):**

**Rodada 1:** Cada jogador posiciona 1 aldeia + 1 estrada
**Rodada 2:** Cada jogador posiciona 1 aldeia + 1 estrada (em ordem inversa)

**Regras de Posicionamento:**
• As aldeias devem ficar em cruzamentos (onde 3 hexágonos se encontram)
• As estradas devem se ligar à aldeia que você acabou de posicionar
• **Regra da Distância:** duas aldeias nunca podem ficar em cruzamentos vizinhos
• Depois da Rodada 2, você recebe recursos iniciais dos hexágonos vizinhos da sua segunda aldeia
      `
    },
    turn: {
      title: '🎲 Estrutura do Turno',
      content: `
**1. Rolar os Dados**
• A soma dos dois dados define quais hexágonos produzem recursos
• Todos os jogadores com aldeias/cidades ao lado desses hexágonos recebem recursos
• Aldeias: 1 recurso por hexágono
• Cidades: 2 recursos por hexágono

**2. Trocar (opcional)**
• Troque com outros jogadores (negocie qualquer acordo)
• Troque com o banco na proporção de 4:1
• Troque nos portos a 3:1 (genérico) ou 2:1 (recurso específico)

**3. Construir (opcional)**
• Construa estradas, aldeias e cidades
• Compre cartas de desenvolvimento
• Jogue UMA carta de desenvolvimento por turno

**4. Encerrar o Turno**
• Clique em "Encerrar Turno" para passar a vez ao próximo jogador
      `
    },
    building: {
      title: '🏠 Custos de Construção',
      content: `
**Estrada** (vale 0 PV)
🧱 1 Tijolo + 🪵 1 Madeira
• Deve se ligar às suas estradas, aldeias ou cidades
• Máximo de 15 estradas por jogador

**Aldeia** (vale 1 PV)
🧱 1 Tijolo + 🪵 1 Madeira + 🐑 1 Lã + 🌾 1 Trigo
• Deve ser construída em cruzamentos vazios
• Deve se ligar a uma de suas estradas
• Não pode ficar ao lado de outra aldeia/cidade
• Máximo de 5 aldeias por jogador

**Cidade** (vale 2 PV)
🪨 3 Minérios + 🌾 2 Trigos
• Melhora uma aldeia que você já tenha
• Produz o dobro de recursos (2 em vez de 1)
• Máximo de 4 cidades por jogador

**Carta de Desenvolvimento**
🐑 1 Lã + 🌾 1 Trigo + 🪨 1 Minério
• Compre do baralho (as cartas ficam ocultas)
• Não é possível jogar uma carta no mesmo turno em que ela foi comprada
      `
    },
    devCards: {
      title: '🃏 Cartas de Desenvolvimento',
      content: `
**Cavaleiro (14 cartas)**
• Mova o ladrão para qualquer hexágono
• Roube 1 recurso aleatório de um jogador vizinho ao ladrão
• Conta para o Maior Exército

**Ponto de Vitória (5 cartas)**
• Vale 1 PV em segredo
• Fica oculta dos outros jogadores até você vencer
• Capela, Biblioteca, Mercado, Palácio, Universidade

**Construção de Estradas (2 cartas)**
• Construa 2 estradas de graça imediatamente

**Ano da Abundância (2 cartas)**
• Pegue 2 recursos quaisquer do banco

**Monopólio (2 cartas)**
• Escolha 1 tipo de recurso
• Todos os outros jogadores devem entregar a você todas as cartas desse recurso
      `
    },
    robber: {
      title: '🥷 O Ladrão',
      content: `
**Quando sai um 7:**
1. Todos os jogadores com mais de 7 cartas devem descartar metade (arredondando para baixo)
2. Quem rolou move o ladrão para qualquer hexágono (exceto o atual)
3. Essa pessoa rouba 1 carta aleatória de qualquer jogador com aldeia/cidade ao lado do novo hexágono do ladrão

**O Ladrão bloqueia a produção:**
• Hexágonos com o ladrão NÃO produzem recursos quando o número deles sai

**Cartas de Cavaleiro:**
• Jogar um cavaleiro permite mover o ladrão (igual a tirar 7, mas sem descarte)
      `
    },
    ports: {
      title: '⚓ Trocas e Portos',
      content: `
**Troca com o Banco:**
• Padrão: 4 cartas iguais → 1 de qualquer outro recurso

**Troca nos Portos:**
• Construa uma aldeia/cidade em um cruzamento de porto para usá-lo
• **Porto Genérico (3:1):** 3 cartas iguais de qualquer recurso → 1 de qualquer outro
• **Portos Específicos (2:1):** 2 cartas daquele recurso → 1 de qualquer outro

**Tipos de Porto:**
• 🧱 Porto de Tijolo (2:1)
• 🪵 Porto de Madeira (2:1)
• 🐑 Porto de Lã (2:1)
• 🌾 Porto de Trigo (2:1)
• 🪨 Porto de Minério (2:1)
• ⚓ Porto Genérico (3:1)

**Troca entre Jogadores:**
• No seu turno, proponha trocas aos outros jogadores
• Quaisquer recursos podem ser trocados
• Os outros jogadores podem aceitar ou recusar
      `
    },
    special: {
      title: '🏆 Conquistas Especiais',
      content: `
**Maior Estrada (2 PV)**
• O primeiro jogador a construir uma estrada contínua de 5 ou mais trechos
• Se outro jogador construir uma estrada maior, ele toma a conquista
• As estradas precisam estar ligadas (aldeias/cidades não quebram a sequência)
• Ramificações contam - só importa o maior caminho único

**Maior Exército (2 PV)**
• O primeiro jogador a jogar 3 ou mais cartas de Cavaleiro
• Se outro jogador jogar mais cavaleiros, ele toma a conquista
• Só contam os cavaleiros jogados, não as cartas na mão
      `
    },
    extension: {
      title: '👥 Extensão de 5-8 Jogadores',
      content: `
**O Que Muda:**
• Tabuleiro maior, com mais hexágonos e portos
• 4 cores de jogador adicionais: Verde, Roxo, Coral e Azul-aço
• Mais cartas de recurso
• Cartas de desenvolvimento adicionais

**Fase de Construção Especial:**
Depois do fim do turno de cada jogador, acontece uma Fase de Construção Especial em que TODOS os outros jogadores podem:
• Construir estradas, aldeias ou cidades
• Comprar cartas de desenvolvimento (mas não jogá-las)
• **Não podem trocar** durante esta fase

Isso evita que os jogadores acumulem cartas demais entre os turnos.

**Dica de Estratégia:**
Com mais jogadores, os recursos ficam mais escassos. Concentre-se em construir com eficiência e em conseguir bons portos logo no início!
      `
    },
    seafarers: {
      title: '⛵ Navegantes — Rumo a Novas Margens',
      content: `
**Cenário 1 — para 4 jogadores (14 PV)**
• As duas aldeias iniciais devem ficar na ilha principal
• Ao colocar uma aldeia costeira na preparação, você pode construir uma estrada ou um barco
• Sua primeira aldeia numa das ilhotas vale +2 PV especiais

**Barcos e rotas marítimas**
• Um barco custa 1 madeira + 1 lã (máximo: 15 barcos por pessoa)
• Barcos só podem ocupar as bordas marítimas e costeiras
• Uma estrada só se liga a um barco através de uma aldeia ou cidade própria
• Um barco da extremidade livre pode ser movido uma vez por turno, mas nunca no turno em que foi construído
• Barcos também contam para a Maior Estrada Comercial

**Pirata e filões de ouro**
• Ao sair 7 ou jogar Cavaleiro, escolha mover o ladrão na terra ou o pirata no mar
• O pirata impede a construção e movimentação de barcos nos seis lados do hexágono ocupado
• O pirata permite roubar uma carta de um jogador com barco adjacente
• Quando um filão de ouro produz, você escolhe uma carta de recurso disponível no banco por aldeia, ou duas por cidade
• A partida termina quando alguém alcança 14 PV no próprio turno

**Observação**
Este tabuleiro utiliza uma disposição digital adaptada, mantendo os componentes do cenário de quatro jogadores.
      `
    },
    citiesAndKnights: {
      title: '⚔️ Cidades e Cavaleiros',
      content: `
**Mercadorias**
• Florestas produzem 1 Madeira + 1 Papel para Cidades
• Montanhas produzem 1 Minério + 1 Moeda para Cidades
• Pastos produzem 1 Lã + 1 Tecido para Cidades

**Melhorias da Cidade e Cartas de Progresso**
• Use mercadorias para construir Melhorias da Cidade (Ciência 📗, Política 📘, Comércio 📒)
• Quando o Dado de Evento combina com o nível da sua melhoria ou menor (no Dado Vermelho), você saca uma Carta de Progresso!
• As cartas de progresso substituem as Cartas de Desenvolvimento comuns

**Os Bárbaros**
• O Dado de Evento pode avançar o navio dos Bárbaros
• Quando ele chega a 7, os Bárbaros atacam!
• Se os jogadores tiverem cavaleiros ativos suficientes para defender, quem mais contribuiu ganha 1 PV de Defensor de Catan
• Se os jogadores falharem, a cidade de quem menos contribuiu é saqueada e rebaixada a aldeia!

**Cavaleiros**
• Recrute Cavaleiros com Minério + Lã
• Ative-os com Trigo (necessário para defender Catan!)
• Promova-os a cavaleiros Fortes ou Poderosos para ter mais defesa
      `
    }
  };

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>
        <button className="rules-close-btn" onClick={onClose}>×</button>
        
        <div className="rules-header">
          <h2>📜 Regras de Catan</h2>
        </div>
        
        <div className="rules-container">
          <nav className="rules-nav">
            {Object.entries(sections).map(([key, { title }]) => (
              <button
                key={key}
                className={`rules-nav-btn ${activeSection === key ? 'active' : ''}`}
                onClick={() => setActiveSection(key)}
              >
                {title}
              </button>
            ))}
          </nav>
          
          <div className="rules-content">
            <h3>{sections[activeSection].title}</h3>
            <div className="rules-text">
              {sections[activeSection].content.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <h4 key={i}>{line.replace(/\*\*/g, '')}</h4>;
                }
                if (line.startsWith('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={i}>
                      <strong>{parts[1]}</strong>{parts[2]}
                    </p>
                  );
                }
                if (line.startsWith('•')) {
                  return <li key={i}>{line.substring(1).trim()}</li>;
                }
                if (line.trim() === '') {
                  return <br key={i} />;
                }
                return <p key={i}>{line}</p>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RulesModal;

