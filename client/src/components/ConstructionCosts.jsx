import './ConstructionCosts.css';

const standard = [
  { icon:'🛤️', label:'Estrada', cost:'🧱 ×1  🪵 ×1' },
  { icon:'🏠', label:'Aldeia', cost:'🧱 ×1  🪵 ×1  🐑 ×1  🌾 ×1' },
  { icon:'🏰', label:'Cidade', cost:'⛏️ ×3  🌾 ×2' }
];
const development = { icon:'📜',label:'Carta de desenvolvimento',cost:'⛏️ ×1  🐑 ×1  🌾 ×1' };
const seafarers = [
  { icon:'⛵',label:'Navio',cost:'🪵 ×1  🐑 ×1' },
  { icon:'🔄',label:'Mover navio',cost:'Grátis · 1 navio permitido por turno, conforme as regras' }
];
const citiesKnights = [
  { icon:'🧱',label:'Muralha',cost:'🧱 ×2' },
  { icon:'🛡️',label:'Recrutar cavaleiro',cost:'🐑 ×1  ⛏️ ×1' },
  { icon:'⚡',label:'Ativar cavaleiro',cost:'🌾 ×1' },
  { icon:'⚔️',label:'Promover cavaleiro',cost:'🐑 ×1  ⛏️ ×1' },
  { icon:'📚',label:'Melhorar ciência',cost:'📖 Papel × nível seguinte' },
  { icon:'🏛️',label:'Melhorar política',cost:'🪙 Moeda × nível seguinte' },
  { icon:'🧵',label:'Melhorar comércio',cost:'🧵 Tecido × nível seguinte' }
];
export default function ConstructionCosts({onClose,isSeafarers=false,isCitiesAndKnights=false}) {
  const rows=[...standard,...(!isCitiesAndKnights?[development]:[]),...(isSeafarers?seafarers:[]),...(isCitiesAndKnights?citiesKnights:[])];
  return (
    <aside className="construction-costs-sheet" aria-label="Tabela de custos de construção">
      <div className="costs-sheet-header"><strong>📖 Custos de construção</strong><button type="button" onClick={onClose} aria-label="Fechar tabela">✕</button></div>
      {rows.map(row=>(
        <div className="construction-cost-row" key={row.label}>
          <span className="cost-row-icon">{row.icon}</span>
          <span className="cost-row-text"><b>{row.label}</b><small>{row.cost}</small></span>
        </div>
      ))}
      <small className="costs-note">Na construção especial, é permitido construir e trocar com o banco/portos.</small>
    </aside>
  );
}
