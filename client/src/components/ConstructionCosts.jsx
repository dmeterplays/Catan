import './ConstructionCosts.css';
const rows = [
  {icon:'🛤️',label:'Estrada',cost:'🧱 1 tijolo  ·  🪵 1 madeira'},
  {icon:'🏠',label:'Aldeia',cost:'🧱 1 tijolo  ·  🪵 1 madeira  ·  🐑 1 lã  ·  🌾 1 trigo'},
  {icon:'🏰',label:'Cidade',cost:'⛏️ 3 minérios  ·  🌾 2 trigos'},
  {icon:'📜',label:'Desenvolvimento',cost:'⛏️ 1 minério  ·  🐑 1 lã  ·  🌾 1 trigo'}
];
export default function ConstructionCosts({onClose}) {
  return (
    <aside className="construction-costs-sheet" aria-label="Tabela de custos de construção">
      <div className="costs-sheet-header"><strong>📖 Tabela de construção</strong><button type="button" onClick={onClose} aria-label="Fechar tabela">✕</button></div>
      {rows.map(row => (
        <div className="construction-cost-row" key={row.label}>
          <span className="cost-row-icon">{row.icon}</span>
          <span className="cost-row-text"><b>{row.label}</b><small>{row.cost}</small></span>
        </div>
      ))}
      <small className="costs-note">Na construção especial, não é permitido trocar recursos.</small>
    </aside>
  );
}