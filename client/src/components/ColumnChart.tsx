interface ColumnItem {
  label: string;
  value: number;
  displayValue: string;
}

interface Props {
  title: string;
  items: ColumnItem[];
  barColor?: string;
  trackColor?: string;
}

export default function ColumnChart({ title, items, barColor = '#c8a24a', trackColor = '#efe9df' }: Props) {
  const max = Math.max(1, ...items.map(i => i.value));

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <h3 className="title-serif font-semibold mb-4" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
      {items.length === 0 && <p style={{ fontSize: 13, color: '#9aa0ad' }}>Sin datos.</p>}
      {items.length > 0 && (
        <div className="flex items-end" style={{ gap: 10, height: 190 }}>
          {items.map(item => {
            const pct = Math.max(2, Math.round((item.value / max) * 100));
            return (
              <div key={item.label} className="flex flex-col items-center" style={{ flex: 1, height: '100%' }}>
                <span
                  className="font-semibold"
                  style={{ fontSize: 10.5, color: '#12192b', marginBottom: 4, whiteSpace: 'nowrap' }}
                >
                  {item.displayValue}
                </span>
                <div
                  className="flex items-end"
                  style={{ width: '100%', flex: 1, background: trackColor, borderRadius: '6px 6px 0 0', overflow: 'hidden' }}
                >
                  <div style={{ width: '100%', height: `${pct}%`, background: barColor, borderRadius: '4px 4px 0 0' }} />
                </div>
                <span
                  className="truncate"
                  style={{ fontSize: 11.5, color: '#5b5f6b', marginTop: 6, maxWidth: '100%' }}
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
