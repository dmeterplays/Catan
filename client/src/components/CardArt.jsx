import './CardArt.css';

const THEMES = {
  lumber: ['#256044','#6fba73','Madeira'],
  brick: ['#ad4830','#efa17a','Tijolo'],
  wool: ['#669345','#d2e6a6','Lã'],
  grain: ['#ba8928','#f9d66a','Trigo'],
  ore: ['#526a7c','#b5cad8','Minério'],
  development: ['#5f4a91','#baa4e5','Desenvolvimento'],
  hidden: ['#50647e','#bfd1df','Carta']
};

export function Illustration({ type }) {
  if (type === 'lumber') return <g><path d="M14 73 L42 19 70 73Z" fill="#174d39"/><path d="M42 19 29 49h12l-15 20h32L43 49h12Z" fill="#74ba74"/><rect x="37" y="72" width="10" height="17" rx="2" fill="#805333"/></g>;
  if (type === 'brick') return <g fill="#c25c40" stroke="#7e352a" strokeWidth="2"><rect x="10" y="43" width="30" height="17" rx="2"/><rect x="43" y="43" width="30" height="17" rx="2"/><rect x="25" y="62" width="37" height="17" rx="2"/><rect x="24" y="24" width="37" height="17" rx="2"/></g>;
  if (type === 'wool') return <g><ellipse cx="42" cy="56" rx="25" ry="18" fill="#f4f7ee"/><circle cx="27" cy="45" r="12" fill="#fff"/><circle cx="42" cy="40" r="13" fill="#fff"/><circle cx="55" cy="45" r="12" fill="#fff"/><ellipse cx="62" cy="57" rx="10" ry="12" fill="#d7d6bc"/><circle cx="67" cy="54" r="2" fill="#303d37"/><path d="M29 72v12M52 72v12" stroke="#34483b" strokeWidth="5"/></g>;
  if (type === 'grain') return <g fill="none" stroke="#f8eb9c" strokeWidth="4" strokeLinecap="round"><path d="M42 88V16"/><path d="M42 69 Q15 59 19 46 M42 57 Q67 48 62 35 M42 43 Q20 34 25 21 M42 30 Q60 22 57 15"/><path d="M42 74 Q65 70 63 55" /></g>;
  if (type === 'ore') return <g><path d="M7 77 21 35 44 18 58 53 77 76Z" fill="#7f98a6"/><path d="M21 35 44 18 58 53 37 64Z" fill="#d3e6ed"/><path d="M37 64 58 53 77 76H7Z" fill="#466378"/><path d="M20 78 30 55 44 69 56 45 69 78" fill="none" stroke="#e3f1f3" strokeWidth="3"/></g>;
  if (type === 'development') return <g><path d="M18 77 23 21 62 19 66 77Z" fill="#e8d6ae" stroke="#6b4f86" strokeWidth="4"/><path d="M31 31 52 31 M28 44 55 44 M30 56 51 56" stroke="#9678a2" strokeWidth="3"/><path d="M44 65 49 74 39 74Z" fill="#c3a23d"/></g>;
  return <g><path d="M18 23 63 23 63 80 18 80Z" fill="#a5bbcd" stroke="#e0ecf2" strokeWidth="3"/><path d="M42 34 54 52 42 71 29 52Z" fill="#4a6d8e"/></g>;
}

export default function CardArt({ type = 'hidden', count, className = '', title }) {
  const [dark, light, label] = THEMES[type] || THEMES.hidden;
  return (
    <span className={`catan-card-art ${className}`} title={title || label} role="img" aria-label={label}>
      <svg viewBox="0 0 84 114" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs><linearGradient id={`card-${type}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient></defs>
        <rect x="2" y="2" width="80" height="110" rx="6" fill="#f7ebd0" stroke="#694d32" strokeWidth="3"/>
        <rect x="6" y="6" width="72" height="101" rx="3" fill={`url(#card-${type})`} stroke="#fff3cd" strokeWidth="2"/>
        <g transform="translate(0 6)"><Illustration type={type}/></g>
        <rect x="7" y="91" width="70" height="15" rx="2" fill="#f7edd3" opacity=".95"/>
        <text x="42" y="102" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#302923">{label}</text>
      </svg>
      {count !== undefined && <strong className="catan-card-count">{count}</strong>}
    </span>
  );
}
