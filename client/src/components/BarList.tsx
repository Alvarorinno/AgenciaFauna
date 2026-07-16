interface BarItem {
  label: string;
  value: number;
  displayValue: string;
}

interface Props {
  title: string;
  items: BarItem[];
  trackColor: string;
  fillColor: string;
  valueColor?: string;
}

export default function BarList({ title, items, trackColor, fillColor, valueColor }: Props) {
  const max = Math.max(1, ...items.map(i => i.value));

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <h3 className="title-serif font-semibold mb-4" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
      {items.length === 0 && <p style={{ fontSize: 13, color: '#9aa0ad' }}>Sin datos.</p>}
      <div className="space-y-3">
        {items.map(item => {
          const pct = Math.max(4, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="grid items-center gap-3" style={{ gridTemplateColumns: '110px 1fr 100px' }}>
              <span className="truncate" style={{ fontSize: 13, color: '#5b5f6b' }} title={item.label}>
                {item.label}
              </span>
              <div style={{ background: trackColor, borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: fillColor, height: '100%', borderRadius: 6 }} />
              </div>
              <span
                className="text-right font-semibold"
                style={{ fontSize: 13, color: valueColor ?? '#12192b' }}
              >
                {item.displayValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
