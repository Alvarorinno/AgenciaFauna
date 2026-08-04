interface PieItem {
  label: string;
  value: number;
  displayValue: string;
}

interface Props {
  title: string;
  items: PieItem[];
  colors?: string[];
}

// Paleta consistente con los colores de marca ya usados en badges/gráficos del resto de la app.
const DEFAULT_COLORS = ['#c8a24a', '#2c4a7c', '#1f7a4d', '#8a6a1f', '#6d2632', '#7d8fa3'];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
}

export default function PieChart({ title, items, colors = DEFAULT_COLORS }: Props) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const nonZero = items.filter(i => i.value > 0);

  const size = 150;
  const r = size / 2;

  let cumulative = 0;
  const wedges = nonZero.map((item, i) => {
    const startAngle = cumulative;
    const angle = (item.value / total) * 360;
    cumulative += angle;
    return { path: describeArc(r, r, r, startAngle, cumulative), color: colors[i % colors.length] };
  });

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <h3 className="title-serif font-semibold mb-4" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
      {items.length === 0 && <p style={{ fontSize: 13, color: '#9aa0ad' }}>Sin datos.</p>}
      {items.length > 0 && (
        <div className="flex items-center" style={{ gap: 22 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
            {nonZero.length === 1 ? (
              <circle cx={r} cy={r} r={r} fill={colors[0]} />
            ) : (
              wedges.map((w, i) => <path key={i} d={w.path} fill={w.color} />)
            )}
          </svg>
          <div className="flex-1 space-y-2" style={{ minWidth: 0 }}>
            {items.map((item, i) => {
              const pct = total === 0 ? 0 : (item.value / total) * 100;
              return (
                <div key={item.label} className="flex items-center" style={{ gap: 10 }}>
                  <span className="flex items-center truncate" style={{ gap: 8, fontSize: 12.5, color: '#5b5f6b', minWidth: 0, flex: 1 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: colors[i % colors.length], display: 'inline-block', flexShrink: 0 }} />
                    <span className="truncate" title={item.label}>{item.label}</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: '#9aa0ad', whiteSpace: 'nowrap' }}>
                    {pct.toFixed(1)}%
                  </span>
                  <span className="font-semibold" style={{ fontSize: 12.5, color: '#12192b', whiteSpace: 'nowrap' }}>
                    {item.displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
