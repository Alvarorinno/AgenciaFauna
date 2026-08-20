interface Segment {
  value: number;
  color: string;
  // Etiqueta opcional con el valor de este segmento en particular (ej. el total
  // de Fee dentro del mes), mostrada debajo del total de la columna.
  displayValue?: string;
}

interface ColumnItem {
  label: string;
  displayValue: string;
  segments: Segment[];
  // Identificador opcional para el callback de click (ej. el mes en minúscula
  // sin capitalizar, distinto del label mostrado). Si no se define, se usa label.
  value?: string;
}

interface LegendItem {
  label: string;
  color: string;
}

interface Props {
  title: string;
  items: ColumnItem[];
  trackColor?: string;
  legend?: LegendItem[];
  onItemClick?: (value: string) => void;
}

function itemTotal(item: ColumnItem): number {
  return item.segments.reduce((sum, s) => sum + s.value, 0);
}

export default function ColumnChart({ title, items, trackColor = '#efe9df', legend, onItemClick }: Props) {
  const max = Math.max(1, ...items.map(itemTotal));

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="title-serif font-semibold" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
        {legend && legend.length > 0 && (
          <div className="flex items-center" style={{ gap: 14 }}>
            {legend.map(l => (
              <span key={l.label} className="flex items-center" style={{ gap: 6, fontSize: 12, color: '#5b5f6b' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {items.length === 0 && <p style={{ fontSize: 13, color: '#9aa0ad' }}>Sin datos.</p>}
      {items.length > 0 && (
        <div className="flex items-end" style={{ gap: 10, height: 190 }}>
          {items.map(item => {
            const total = itemTotal(item);
            const pct = Math.max(2, Math.round((total / max) * 100));
            return (
              <div
                key={item.label}
                className="flex flex-col items-center"
                style={{ flex: 1, height: '100%', cursor: onItemClick ? 'pointer' : 'default' }}
                onClick={onItemClick ? () => onItemClick(item.value ?? item.label) : undefined}
                title={onItemClick ? `Ver eventos de ${item.label}` : undefined}
              >
                <div className="flex flex-col items-center" style={{ marginBottom: 4 }}>
                  <span
                    className="truncate"
                    style={{ fontSize: 11, fontWeight: 600, color: '#5b5f6b', maxWidth: '100%' }}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ fontSize: 11.5, color: '#12192b', whiteSpace: 'nowrap' }}
                  >
                    {item.displayValue}
                  </span>
                </div>
                <div
                  className="flex items-end"
                  style={{ width: '100%', flex: 1, background: trackColor, borderRadius: '6px 6px 0 0', overflow: 'hidden' }}
                >
                  <div
                    className="flex flex-col-reverse"
                    style={{ width: '100%', height: `${pct}%`, borderRadius: '4px 4px 0 0', overflow: 'hidden' }}
                  >
                    {total > 0 && item.segments.map((seg, i) => {
                      const segPct = Math.round((seg.value / total) * 100);
                      if (segPct <= 0) return null;
                      return <div key={i} style={{ width: '100%', height: `${segPct}%`, background: seg.color }} />;
                    })}
                  </div>
                </div>
                <div className="flex flex-col items-center" style={{ marginTop: 6 }}>
                  {/* Se invierte el orden respecto al de apilado de la barra (que va de
                      abajo hacia arriba) para mostrar las etiquetas en el orden natural
                      de lectura, ej. Variable antes que Fee. */}
                  {[...item.segments].reverse().filter(s => s.displayValue).map((s, i) => (
                    <span
                      key={i}
                      className="font-semibold"
                      style={{ fontSize: 9.5, color: s.color, whiteSpace: 'nowrap' }}
                    >
                      {s.displayValue}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
