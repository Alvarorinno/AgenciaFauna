import { useEffect, useRef, useState } from 'react';
import { formatCLPCompact } from '../utils';

interface BarSeg {
  value: number;
  color: string;
}

interface BarLineItem {
  label: string;
  bars: BarSeg[];
  lineValue: number;
}

interface LegendItem {
  label: string;
  color: string;
  // Si es true, el swatch de la leyenda se dibuja como línea punteada en vez
  // de punto sólido (para distinguir la serie de línea de las de barras). El
  // color de la línea/puntos del gráfico se toma de este ítem.
  dashed?: boolean;
}

interface Props {
  title: string;
  items: BarLineItem[];
  legend: LegendItem[];
  formatBarValue: (v: number) => string;
  formatLineValue: (v: number) => string;
}

// Gráfico combinado (barras agrupadas + línea punteada sobre eje secundario
// independiente) para comparar dos series monetarias por mes (ej. Presupuesto
// vs Costos) junto con un indicador porcentual (ej. Margen Bruto) que se
// mueve en una escala propia para aprovechar todo el alto disponible.
//
// El SVG se dibuja a escala 1:1 (viewBox = ancho real del contenedor medido
// con ResizeObserver) en vez de usar un viewBox fijo con preserveAspectRatio
// "none": así el texto no se estira de forma no-uniforme al variar el ancho
// disponible, evitando que se vea borroso/deformado.
const H = 240;
const MARGIN_BOTTOM = 26;
const MARGIN_LEFT = 56;
const MARGIN_RIGHT = 46;
const PLOT_H = H - MARGIN_BOTTOM;
const DEFAULT_W = 800;
const TICKS = 4;

// Redondea hacia arriba a un número "lindo" (1/2/5 × 10^n) para que las
// referencias del eje izquierdo ($) no queden en cifras arbitrarias como
// $837.492, sino en cortes legibles como $800.000 o $1.000.000.
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const norm = v / base;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * base;
}

export default function BarLineChart({ title, items, legend, formatBarValue, formatLineValue }: Props) {
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
  const rawBarMax = Math.max(1, ...items.flatMap(i => i.bars.map(b => b.value)));
  const barMax = niceMax(rawBarMax);

  const lineValues = items.map(i => i.lineValue);
  const rawMax = Math.max(0, ...lineValues);
  const rawMin = Math.min(0, ...lineValues);
  const pad = (rawMax - rawMin) * 0.15 || 10;
  const lineMax = rawMax + pad;
  const lineMin = rawMin - pad;
  const lineRange = lineMax - lineMin || 1;

  const plotW = Math.max(0, W - MARGIN_LEFT - MARGIN_RIGHT);
  const slotW = n > 0 ? plotW / n : plotW;
  const barsPerGroup = items[0]?.bars.length ?? 0;
  const groupW = slotW * 0.55;
  const gap = 3;
  const barW = barsPerGroup > 0 ? (groupW - gap * (barsPerGroup - 1)) / barsPerGroup : 0;

  const lineColor = legend.find(l => l.dashed)?.color ?? '#1f7a4d';

  const linePoints = items.map((item, i) => ({
    x: MARGIN_LEFT + i * slotW + slotW / 2,
    y: PLOT_H - ((item.lineValue - lineMin) / lineRange) * PLOT_H,
    value: item.lineValue
  }));

  // Líneas de referencia horizontales compartidas por ambos ejes: a cada
  // altura le corresponde un valor $ (eje izquierdo, escala de las barras) y
  // un valor % (eje derecho, escala de la línea de Margen Bruto).
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const frac = i / TICKS;
    return {
      y: PLOT_H - frac * PLOT_H,
      barValue: frac * barMax,
      lineValue: lineMin + frac * lineRange
    };
  });

  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="title-serif font-semibold" style={{ fontSize: 16, color: '#12192b' }}>{title}</h3>
        <div className="flex items-center" style={{ gap: 14 }}>
          {legend.map(l => (
            <span key={l.label} className="flex items-center" style={{ gap: 6, fontSize: 12, color: '#5b5f6b' }}>
              {l.dashed ? (
                <svg width="14" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="14" y2="4" stroke={l.color} strokeWidth={2} strokeDasharray="3 2" />
                </svg>
              ) : (
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
              )}
              {l.label}
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
                  stroke="#efe9df"
                  strokeWidth={i === 0 ? 1.5 : 1}
                />
                <text x={MARGIN_LEFT - 8} y={t.y + 3.5} textAnchor="end" fontSize={10} fill="#9aa0ad">
                  {formatCLPCompact(t.barValue)}
                </text>
                <text x={W - MARGIN_RIGHT + 8} y={t.y + 3.5} textAnchor="start" fontSize={10} fill="#9aa0ad">
                  {formatLineValue(t.lineValue)}
                </text>
              </g>
            ))}
            {items.map((item, i) => {
              const groupX = MARGIN_LEFT + i * slotW + (slotW - groupW) / 2;
              return (
                <g key={item.label}>
                  {item.bars.map((b, j) => {
                    const h = (b.value / barMax) * PLOT_H;
                    const x = groupX + j * (barW + gap);
                    const y = PLOT_H - h;
                    return (
                      <rect key={j} x={x} y={y} width={Math.max(0, barW)} height={Math.max(0, h)} fill={b.color} rx={2}>
                        <title>{`${item.label}: ${formatBarValue(b.value)}`}</title>
                      </rect>
                    );
                  })}
                  <text x={MARGIN_LEFT + i * slotW + slotW / 2} y={PLOT_H + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#5b5f6b">
                    {item.label}
                  </text>
                </g>
              );
            })}
            <polyline
              points={linePoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            {linePoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={lineColor}>
                <title>{`${items[i].label}: ${formatLineValue(p.value)}`}</title>
              </circle>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
