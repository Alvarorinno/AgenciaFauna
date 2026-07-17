import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCotizaciones, createCotizacion, updateCotizacion, deleteCotizacion } from '../api';
import type { Cotizacion, EstadoCotizacion, LineaNegocio } from '../types';
import { MESES } from '../types';
import { formatCLP, capitalize, formatNCot } from '../utils';
import CotizacionDetalle from '../components/CotizacionDetalle';

const ENCARGADO_FIELDS = ['n_cot', 'mes', 'a_cargo', 'cliente', 'proyecto', 'descripcion', 'costo_cliente', 'costo_real'] as const;

const LINEA_LABELS: Record<LineaNegocio, string> = { fauna_rd: 'Fauna RD', agencia: 'Agencia' };

const ESTADO_COT_BADGE: Record<EstadoCotizacion, { label: string; bg: string; text: string }> = {
  pendiente: { label: 'Pendiente', bg: '#faf0d7', text: '#8a6a1f' },
  aprobado: { label: 'Aprobado', bg: '#e3ecdf', text: '#1f7a4d' },
  rechazado: { label: 'Rechazado', bg: '#f6e4e6', text: '#6d2632' }
};

export default function Cotizaciones({ linea }: { linea: LineaNegocio }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ mes: 'todos', cliente: 'todos', aCargo: 'todos', estado: 'todos' });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // El rol 'todos' (Dirección) es de solo lectura: ve el pipeline pero no lo edita.
  // Un 'encargado' solo puede editar la línea de negocio a la que está asociado;
  // puede ver la otra línea pero no gestionarla.
  const canEdit = user?.role === 'encargado' && user.linea_negocio === linea;

  useEffect(() => {
    setLoading(true);
    getCotizaciones()
      .then(data => {
        setRows(data.filter(r => r.estado_cotizacion !== 'aprobado' && r.linea_negocio === linea));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [linea]);

  const clientes = useMemo(() => Array.from(new Set(rows.map(r => r.cliente).filter(Boolean))).sort(), [rows]);
  const aCargos = useMemo(() => Array.from(new Set(rows.map(r => r.a_cargo).filter(Boolean))).sort(), [rows]);

  const filteredRows = rows.filter(r =>
    (filters.mes === 'todos' || r.mes === filters.mes) &&
    (filters.cliente === 'todos' || r.cliente === filters.cliente) &&
    (filters.aCargo === 'todos' || r.a_cargo === filters.aCargo) &&
    (filters.estado === 'todos' || r.estado_cotizacion === filters.estado)
  );

  function patchRow(id: number, patch: Partial<Cotizacion>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function toggleEdit(row: Cotizacion) {
    patchRow(row.id, { editing: !row.editing });
  }

  async function saveRow(row: Cotizacion) {
    const payload: Record<string, unknown> = {};
    for (const f of ENCARGADO_FIELDS) payload[f] = (row as unknown as Record<string, unknown>)[f];

    try {
      const updated = await updateCotizacion(row.id, payload);
      setRows(prev => prev.map(r => r.id === row.id ? { ...updated, editing: false } : r));
    } catch {
      alert('No se pudo guardar la cotización.');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    await deleteCotizacion(id);
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleAdd() {
    const created = await createCotizacion({ mes: 'enero', estado_cotizacion: 'pendiente' });
    setRows(prev => [...prev, { ...created, editing: true }]);
  }

  async function handleAprobar(id: number) {
    if (!window.confirm('¿Aprobar esta cotización? Pasará directamente a Eventos / Proyectos y saldrá de esta lista.')) return;
    try {
      await updateCotizacion(id, { estado_cotizacion: 'aprobado' });
      setRows(prev => prev.filter(r => r.id !== id));
    } catch {
      alert('No se pudo aprobar la cotización.');
    }
  }

  async function handleRechazar(id: number) {
    try {
      const updated = await updateCotizacion(id, { estado_cotizacion: 'rechazado' });
      setRows(prev => prev.map(r => r.id === id ? { ...updated, editing: false } : r));
    } catch {
      alert('No se pudo rechazar la cotización.');
    }
  }

  async function handleReactivar(id: number) {
    try {
      const updated = await updateCotizacion(id, { estado_cotizacion: 'pendiente' });
      setRows(prev => prev.map(r => r.id === id ? { ...updated, editing: false } : r));
    } catch {
      alert('No se pudo reactivar la cotización.');
    }
  }

  const dimStyle = (allowed: boolean): React.CSSProperties =>
    allowed ? {} : { opacity: 0.4, pointerEvents: 'none' };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #dfd8c8', borderRadius: 6, fontSize: 13 };

  return (
    <div>
      <h1 className="title-serif font-semibold" style={{ fontSize: 24, color: '#12192b' }}>Cotizaciones — {LINEA_LABELS[linea]}</h1>
      <p className="mb-5" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Pipeline de cotizaciones en revisión. Al aprobar una cotización, se mueve directamente a Eventos / Proyectos y sale de esta lista.
        Las rechazadas quedan aquí y pueden reactivarse en cualquier momento.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end mb-5" style={{ gap: 14 }}>
        <FilterSelect label="Mes" value={filters.mes} onChange={v => setFilters(f => ({ ...f, mes: v }))}
          options={['todos', ...MESES]} display={v => v === 'todos' ? 'Todos' : capitalize(v)} />
        <FilterSelect label="Cliente" value={filters.cliente} onChange={v => setFilters(f => ({ ...f, cliente: v }))}
          options={['todos', ...clientes]} display={v => v === 'todos' ? 'Todos' : v} />
        <FilterSelect label="A Cargo" value={filters.aCargo} onChange={v => setFilters(f => ({ ...f, aCargo: v }))}
          options={['todos', ...aCargos]} display={v => v === 'todos' ? 'Todos' : v} />
        <FilterSelect label="Estado" value={filters.estado} onChange={v => setFilters(f => ({ ...f, estado: v }))}
          options={['todos', 'pendiente', 'rechazado']} display={v => v === 'todos' ? 'Todos' : ESTADO_COT_BADGE[v as EstadoCotizacion].label} />

        {canEdit && (
          <button
            onClick={handleAdd}
            className="ml-auto font-bold"
            style={{ background: '#c8a24a', color: '#12192b', padding: '9px 16px', borderRadius: 8, fontSize: 13.5 }}
          >
            + Agregar cotización
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white overflow-x-auto" style={{ border: '1px solid #dfd8c8', borderRadius: 12 }}>
        <table style={{ minWidth: 1300, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={groupHeaderStyle('#f7f4ee', '#12192b')}></th>
              <th colSpan={8} style={groupHeaderStyle('#f7f4ee', '#12192b')}>Encargado de Cuenta</th>
              <th colSpan={2} style={groupHeaderStyle('#efe9df', '#12192b')}>Calculado</th>
              <th style={groupHeaderStyle('#f7f4ee', '#12192b')}></th>
              <th style={groupHeaderStyle('#f7f4ee', '#12192b')}></th>
            </tr>
            <tr>
              <th style={colHeaderStyle}></th>
              {['Nº Cot.', 'Mes', 'A Cargo', 'Cliente', 'Proyecto', 'Descripción', 'Costo Cliente', 'Costo Real'].map(h => (
                <th key={h} style={colHeaderStyle}>{h}</th>
              ))}
              <th style={colHeaderStyle}>Utilidad Total</th>
              <th style={colHeaderStyle}>% Utilidad</th>
              <th style={colHeaderStyle}>Estado</th>
              <th style={colHeaderStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>Cargando…</td></tr>}
            {!loading && filteredRows.length === 0 && (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>No hay cotizaciones con estos filtros.</td></tr>
            )}
            {filteredRows.map(row => {
              const badge = ESTADO_COT_BADGE[row.estado_cotizacion ?? 'pendiente'];
              const isExpanded = expanded.has(row.id);
              return (
                <Fragment key={row.id}>
                <tr style={{ borderTop: '1px solid #efe9df' }}>
                  <td style={cellStyle}>
                    <button onClick={() => toggleExpanded(row.id)} title="Ver detalle de proveedores"
                      style={{ width: 22, height: 22, color: '#5b5f6b', fontSize: 11 }}>
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }}>
                    {row.editing && canEdit ? (
                      <input type="number" style={inputStyle} value={row.n_cot} onChange={e => patchRow(row.id, { n_cot: Number(e.target.value) })} />
                    ) : formatNCot(row.n_cot, row.linea_negocio)}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }}>
                    {row.editing && canEdit ? (
                      <select style={inputStyle} value={row.mes} onChange={e => patchRow(row.id, { mes: e.target.value })}>
                        {MESES.map(m => <option key={m} value={m}>{capitalize(m)}</option>)}
                      </select>
                    ) : capitalize(row.mes)}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }}>
                    {row.editing && canEdit ? (
                      <input style={inputStyle} value={row.a_cargo} onChange={e => patchRow(row.id, { a_cargo: e.target.value })} />
                    ) : row.a_cargo}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }}>
                    {row.editing && canEdit ? (
                      <input style={inputStyle} value={row.cliente} onChange={e => patchRow(row.id, { cliente: e.target.value })} />
                    ) : row.cliente}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }}>
                    {row.editing && canEdit ? (
                      <input style={inputStyle} value={row.proyecto} onChange={e => patchRow(row.id, { proyecto: e.target.value })} />
                    ) : row.proyecto}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit), maxWidth: 220 }}>
                    {row.editing && canEdit ? (
                      <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={row.descripcion} onChange={e => patchRow(row.id, { descripcion: e.target.value })} />
                    ) : (
                      <span className="line-clamp-2 block" title={row.descripcion}>{row.descripcion}</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }} title={row.tiene_detalle ? 'Se calcula automáticamente desde el detalle de proveedores' : ''}>
                    {row.editing && canEdit && !row.tiene_detalle ? (
                      <input type="number" style={inputStyle} value={row.costo_cliente} onChange={e => patchRow(row.id, { costo_cliente: Number(e.target.value) })} />
                    ) : formatCLP(row.costo_cliente)}
                  </td>
                  <td style={{ ...cellStyle, ...dimStyle(canEdit) }} title={row.tiene_detalle ? 'Se calcula automáticamente desde el detalle de proveedores' : ''}>
                    {row.editing && canEdit && !row.tiene_detalle ? (
                      <input type="number" style={inputStyle} value={row.costo_real} onChange={e => patchRow(row.id, { costo_real: Number(e.target.value) })} />
                    ) : formatCLP(row.costo_real)}
                  </td>

                  {/* Calculado section — siempre solo lectura */}
                  <td style={{ ...cellStyle, background: '#f4f4f2', color: row.utilidad >= 0 ? '#1f7a4d' : '#6d2632', fontWeight: 600 }}>
                    {formatCLP(row.utilidad)}
                  </td>
                  <td style={{ ...cellStyle, background: '#f4f4f2', color: row.utilidad >= 0 ? '#1f7a4d' : '#6d2632', fontWeight: 600 }}>
                    {row.pct_utilidad.toFixed(1)}%
                  </td>

                  {/* Estado */}
                  <td style={cellStyle}>
                    <span style={{ background: badge.bg, color: badge.text, padding: '3px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
                      {badge.label}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td style={cellStyle}>
                    <div className="flex items-center gap-2">
                      {canEdit && row.estado_cotizacion === 'pendiente' && (
                        <>
                          <button onClick={() => handleAprobar(row.id)} title="Aprobar"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcecdf', color: '#1f7a4d' }}>✓</button>
                          <button onClick={() => handleRechazar(row.id)} title="Rechazar"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: '#f6e4e6', color: '#6d2632' }}>✕</button>
                        </>
                      )}
                      {canEdit && row.estado_cotizacion === 'rechazado' && (
                        <button onClick={() => handleReactivar(row.id)} title="Reactivar (volver a pendiente)"
                          style={{ width: 30, height: 30, borderRadius: '50%', background: '#faf0d7', color: '#8a6a1f' }}>↺</button>
                      )}
                      {row.editing ? (
                        <button onClick={() => saveRow(row)} title="Guardar"
                          style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcecdf', color: '#1f7a4d' }}>✓</button>
                      ) : (
                        canEdit && (
                          <button onClick={() => toggleEdit(row)} title="Editar"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: '#e2e9f5', color: '#2c4a7c' }}>✎</button>
                        )
                      )}
                      {canEdit && (
                        <button onClick={() => handleDelete(row.id)} title="Eliminar"
                          style={{ width: 30, height: 30, borderRadius: '50%', background: '#f6e4e6', color: '#6d2632' }}>🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={13} style={{ padding: 0, borderTop: '1px solid #dfd8c8' }}>
                      <CotizacionDetalle
                        cotizacion={row}
                        canEdit={canEdit}
                        onCotizacionUpdated={updated => patchRow(updated.id, updated)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, display }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; display: (v: string) => string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#5b5f6b', fontWeight: 600, marginBottom: 4, letterSpacing: 0.3 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '9px 12px', border: '1px solid #dfd8c8', borderRadius: 7, fontSize: 13 }}
      >
        {options.map(o => <option key={o} value={o}>{display(o)}</option>)}
      </select>
    </div>
  );
}

const groupHeaderStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
  padding: '8px 12px', textAlign: 'left', position: 'sticky', top: 0, zIndex: 2
});

const colHeaderStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: '#5b5f6b', padding: '8px 12px', textAlign: 'left',
  borderTop: '1px solid #efe9df', whiteSpace: 'nowrap', position: 'sticky', top: 33, zIndex: 1, background: '#fff'
};

const cellStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13.5, color: '#12192b', verticalAlign: 'middle'
};
