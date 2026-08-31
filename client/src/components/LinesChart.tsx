import { useEffect, useRef, useState } from 'react';

interface LineSeriesDef {
  key: string;
  label: string;
  color: string;
}

interface LinesChartItem {
  label: string;
  // Valor de cada serie para este punto del eje X, indexado por `key` de LineSeriesDef.
  values: Record<string, number>;
}

interface Props {
  title: string;
  items: LinesChartItem[];
  series: LineSeriesDef[];
  formatValue: (v: number) => string;
}

// Gráfico de líneas múltiples (una serie por cada `series[i].key`) sobre un
// eje $ compartido — pensado para comparar series acumuladas mes a mes (ej.
// Utilidad Acumulada por Fee vs Variable). Mismo criterio de escalado 1:1 vía
// ResizeObserver que BarLineChart, para que el texto no se vea borroso/deformado.
const H = 240;
const MARGIN_BOTTOM = 26;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 16;
const PLOT_H = H - MARGIN_BOTTOM;
const DEFAULT_W = 800;
const TICKS = 4;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const norm = v / base;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * base;
}

export default function LinesChart({ title, items, series, formatValue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.round(w) !== Math.round(W)) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = items.length;
  const allValues = items.flatMap(i => series.map(s => i.values[s.key] ?? 0));
  const rawMax = Math.max(0, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  // Redondea el techo hacia un número "lindo"; si hay valores negativos se deja
  // un piso simétrico simple (mismo criterio: redondear el |mínimo| hacia arriba).
  const max = niceMax(rawMax || 1);
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const range = max - min || 1;

  const plotW = Math.max(0, W - MARGIN_LEFT - MARGIN_RIGHT);
  const slotW = n > 1 ? plotW / (n - 1) : plotW;

  const xFor = (i: number) => (n > 1 ? MARGIN_LEFT + i * slotW : MARGIN_LEFT + plotW / 2);
  const yFor = (v: number) => PLOT_H - ((v - min) / range) * PLOT_H;

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const frac = i / TICKS;
    return { y: PLOT_H - frac * PLOT_H, value: min + frac * range };
  });

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="title-serif font-semibold" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
        <div className="flex items-center" style={{ gap: 14 }}>
          {series.map(s => (
            <span key={s.key} className="flex items-center" style={{ gap: 6, fontSize: 12, color: '#5b5f6b' }}>
              <svg width="14" height="8" style={{ flexShrink: 0 }}>
                <line x1="0" y1="4" x2="14" y2="4" stroke={s.color} strokeWidth={2.5} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      {items.length === 0 && <p style={{ fontSize: 13, color: '#9aa0ad' }}>Sin datos.</p>}
      {items.length > 0 && (
        <div ref={containerRef} style={{ width: '100%' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={MARGIN_LEFT}
                  y1={t.y}
                  x2={W - MARGIN_RIGHT}
                  y2={t.y}
                  stroke={Math.abs(t.value) < 1e-6 && min < 0 ? '#c3c7c2' : '#efe9df'}
                  strokeWidth={Math.abs(t.value) < 1e-6 && min < 0 ? 1.5 : 1}
                />
                <text x={MARGIN_LEFT - 8} y={t.y + 3.5} textAnchor="end" fontSize={10} fill="#9aa0ad">
                  {formatValue(t.value)}
                </text>
              </g>
            ))}
            {items.map((item, i) => (
              <text key={item.label} x={xFor(i)} y={PLOT_H + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#5b5f6b">
                {item.label}
              </text>
            ))}
            {series.map(s => {
              const points = items.map((item, i) => ({ x: xFor(i), y: yFor(item.values[s.key] ?? 0), value: item.values[s.key] ?? 0, label: item.label }));
              return (
                <g key={s.key}>
                  <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.25} />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3.25} fill={s.color}>
                      <title>{`${s.label} · ${p.label}: ${formatValue(p.value)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
