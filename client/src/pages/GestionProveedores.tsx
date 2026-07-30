import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCotizaciones, updateGrupo } from '../api';
import type { LineaNegocio } from '../types';
import { formatCLP, formatNCot, formatOc } from '../utils';

const LINEA_LABELS: Record<LineaNegocio, string> = { fauna_rd: 'Fauna RD', agencia: 'Agencia' };

// Una fila de proveedor = un grupo (partida de proveedor) de una cotización que ya
// es Evento (estado_cotizacion === 'aprobado'). No es una copia de datos: se lee
// directo desde el detalle de proveedores ya cargado en la cotización
// (cotizacion_grupos + cotizacion_items) — apenas una cotización pasa a evento, su
// detalle aparece acá. Factura y abonos son a nivel de proveedor/grupo (una
// factura + abonos cubren todo el itemizado de ese proveedor), el itemizado
// (cantidad/costo unitario/costo total línea por línea) se muestra debajo, de solo lectura.
interface ProveedorRow {
  grupoId: number;
  nCotLabel: string;
  oc: string;
  proveedor: string;
  costoTotal: number;
  facturaProveedor: string;
  abono1: number;
  abono2: number;
  items: { id: number; nombre: string; cantidad: number; unitarioCosto: number; costoTotal: number }[];
  editing?: boolean;
}

export default function GestionProveedores({ linea }: { linea: LineaNegocio }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [proveedorFiltro, setProveedorFiltro] = useState('todos');

  // Mismo criterio de permisos que el detalle de proveedores dentro de la cotización:
  // solo el 'encargado' de esta línea puede editar factura/abonos.
  const canEdit = user?.role === 'encargado' && user.linea_negocio === linea;

  useEffect(() => {
    setLoading(true);
    setProveedorFiltro('todos');
    getCotizaciones()
      .then(data => {
        const eventos = data.filter(c => c.estado_cotizacion === 'aprobado' && c.linea_negocio === linea);
        const flat: ProveedorRow[] = [];
        for (const cot of eventos) {
          for (const grupo of cot.grupos) {
            if (grupo.items.length === 0) continue;
            flat.push({
              grupoId: grupo.id,
              nCotLabel: formatNCot(cot.n_cot, cot.linea_negocio),
              oc: formatOc(cot.n_cot, cot.linea_negocio, grupo.orden),
              proveedor: grupo.proveedor || '—',
              costoTotal: grupo.subtotal_costo,
              facturaProveedor: grupo.factura_proveedor ?? '',
              abono1: grupo.abono1 ?? 0,
              abono2: grupo.abono2 ?? 0,
              items: grupo.items.map(it => ({
                id: it.id,
                nombre: it.nombre,
                cantidad: it.cantidad,
                unitarioCosto: it.unitario_costo,
                costoTotal: it.subtotal_costo
              }))
            });
          }
        }
        setRows(flat);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [linea]);

  const proveedores = useMemo(() => Array.from(new Set(rows.map(r => r.proveedor))).sort(), [rows]);
  const filteredRows = useMemo(
    () => proveedorFiltro === 'todos' ? rows : rows.filter(r => r.proveedor === proveedorFiltro),
    [rows, proveedorFiltro]
  );

  function patchRow(grupoId: number, patch: Partial<ProveedorRow>) {
    setRows(prev => prev.map(r => r.grupoId === grupoId ? { ...r, ...patch } : r));
  }

  async function saveRow(row: ProveedorRow) {
    setBusyId(row.grupoId);
    try {
      await updateGrupo(row.grupoId, {
        factura_proveedor: row.facturaProveedor,
        abono1: row.abono1,
        abono2: row.abono2
      });
      patchRow(row.grupoId, { editing: false });
    } catch {
      alert('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #dfd8c8', borderRadius: 6, fontSize: 13 };
  const COL_COUNT = 10; // sin contar Acciones

  const saldoPendiente = (row: ProveedorRow) => row.costoTotal - row.abono1 - row.abono2;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <h1 className="title-serif font-semibold shrink-0" style={{ fontSize: 24, color: '#12192b' }}>
        Gestión de Proveedores — {LINEA_LABELS[linea]}
      </h1>
      <p className="mb-5 shrink-0" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Se alimenta solo de Eventos (cotizaciones aprobadas): apenas una cotización pasa a evento, su detalle de
        proveedores aparece acá automáticamente. Factura y abonos son por proveedor (cubren todo su itemizado).{' '}
        {canEdit ? 'Puedes editar factura y abonos.' : 'Acceso de solo lectura.'}
      </p>

      <div className="flex flex-wrap items-end mb-5 shrink-0" style={{ gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#5b5f6b', fontWeight: 600, marginBottom: 4, letterSpacing: 0.3 }}>
            Proveedor
          </label>
          <select
            value={proveedorFiltro}
            onChange={e => setProveedorFiltro(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #dfd8c8', borderRadius: 7, fontSize: 13 }}
          >
            <option value="todos">Todos</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ minWidth: 1200, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nº Cot. / Evento', 'OC', 'Proveedor', 'Cantidad', 'Costo Unitario', 'Costo Total', 'Factura Proveedor', 'Abono 1', 'Abono 2', 'Saldo'].map(h => (
                <th key={h} style={colHeaderStyle}>{h}</th>
              ))}
              {canEdit && <th style={colHeaderStyle}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={canEdit ? COL_COUNT + 1 : COL_COUNT} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>Cargando…</td></tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr><td colSpan={canEdit ? COL_COUNT + 1 : COL_COUNT} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>
                {rows.length === 0 ? 'Todavía no hay eventos con detalle de proveedores cargado.' : 'No hay resultados para este proveedor.'}
              </td></tr>
            )}
            {filteredRows.map(row => {
              const isEditing = !!row.editing;
              const busy = busyId === row.grupoId;
              return (
                <Fragment key={row.grupoId}>
                  {/* Fila de proveedor (bold, editable) */}
                  <tr style={{ borderTop: '2px solid #dfd8c8', fontWeight: 700, background: '#fbfaf7' }}>
                    <td style={cellStyle}>{row.nCotLabel}</td>
                    <td style={{ ...cellStyle, fontSize: 11.5, whiteSpace: 'nowrap' }}>{row.oc}</td>
                    <td style={cellStyle}>{row.proveedor}</td>
                    <td style={cellStyle}></td>
                    <td style={cellStyle}></td>
                    <td style={cellStyle}>{formatCLP(row.costoTotal)}</td>
                    <td style={cellStyle}>
                      {isEditing && canEdit ? (
                        <input style={{ ...inputStyle, fontWeight: 400 }} value={row.facturaProveedor} onChange={e => patchRow(row.grupoId, { facturaProveedor: e.target.value })} />
                      ) : (row.facturaProveedor || '—')}
                    </td>
                    <td style={cellStyle}>
                      {isEditing && canEdit ? (
                        <input type="number" style={{ ...inputStyle, fontWeight: 400 }} value={row.abono1} onChange={e => patchRow(row.grupoId, { abono1: Number(e.target.value) })} />
                      ) : formatCLP(row.abono1)}
                    </td>
                    <td style={cellStyle}>
                      {isEditing && canEdit ? (
                        <input type="number" style={{ ...inputStyle, fontWeight: 400 }} value={row.abono2} onChange={e => patchRow(row.grupoId, { abono2: Number(e.target.value) })} />
                      ) : formatCLP(row.abono2)}
                    </td>
                    <td style={{ ...cellStyle, color: saldoPendiente(row) > 0 ? '#8a6a1f' : '#1f7a4d' }}>
                      {formatCLP(saldoPendiente(row))}
                    </td>
                    {canEdit && (
                      <td style={cellStyle}>
                        {isEditing ? (
                          <button onClick={() => saveRow(row)} disabled={busy} title="Guardar"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcecdf', color: '#1f7a4d' }}>✓</button>
                        ) : (
                          <button onClick={() => patchRow(row.grupoId, { editing: true })} title="Editar"
                            style={{ width: 30, height: 30, borderRadius: '50%', background: '#e2e9f5', color: '#2c4a7c' }}>✎</button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Itemizado del proveedor (línea por línea, solo lectura) */}
                  {row.items.map(it => (
                    <tr key={it.id} style={{ borderTop: '1px solid #efe9df' }}>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={{ ...cellStyle, paddingLeft: 24, color: '#5b5f6b' }}>{it.nombre}</td>
                      <td style={cellStyle}>{it.cantidad}</td>
                      <td style={cellStyle}>{formatCLP(it.unitarioCosto)}</td>
                      <td style={cellStyle}>{formatCLP(it.costoTotal)}</td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      {canEdit && <td style={cellStyle}></td>}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const colHeaderStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: '#5b5f6b', padding: '8px 12px', textAlign: 'left',
  borderBottom: '1px solid #efe9df', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1, background: '#fff'
};

const cellStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13.5, color: '#12192b', verticalAlign: 'middle'
};
