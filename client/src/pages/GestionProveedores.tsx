import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCotizaciones, updateItem } from '../api';
import type { LineaNegocio } from '../types';
import { formatCLP, formatNCot } from '../utils';

const LINEA_LABELS: Record<LineaNegocio, string> = { fauna_rd: 'Fauna RD', agencia: 'Agencia' };

// Una fila = un ítem de un grupo/proveedor, de una cotización que ya es Evento
// (estado_cotizacion === 'aprobado'). No es una copia de datos: se lee directo
// desde el detalle de proveedores ya cargado en la cotización (cotizacion_grupos +
// cotizacion_items) — apenas una cotización pasa a evento, su detalle aparece acá.
interface ProveedorRow {
  itemId: number;
  cotizacionId: number;
  nCotLabel: string;
  proveedor: string;
  itemNombre: string;
  cantidad: number;
  unitarioCosto: number;
  costoTotal: number;
  facturaProveedor: string;
  abono1: number;
  abono2: number;
  editing?: boolean;
}

export default function GestionProveedores({ linea }: { linea: LineaNegocio }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Mismo criterio de permisos que el detalle de proveedores dentro de la cotización:
  // solo el 'encargado' de esta línea puede editar factura/abonos.
  const canEdit = user?.role === 'encargado' && user.linea_negocio === linea;

  useEffect(() => {
    setLoading(true);
    getCotizaciones()
      .then(data => {
        const eventos = data.filter(c => c.estado_cotizacion === 'aprobado' && c.linea_negocio === linea);
        const flat: ProveedorRow[] = [];
        for (const cot of eventos) {
          for (const grupo of cot.grupos) {
            for (const item of grupo.items) {
              flat.push({
                itemId: item.id,
                cotizacionId: cot.id,
                nCotLabel: formatNCot(cot.n_cot, cot.linea_negocio),
                proveedor: grupo.proveedor || '—',
                itemNombre: item.nombre,
                cantidad: item.cantidad,
                unitarioCosto: item.unitario_costo,
                costoTotal: item.subtotal_costo,
                facturaProveedor: item.factura_proveedor ?? '',
                abono1: item.abono1 ?? 0,
                abono2: item.abono2 ?? 0
              });
            }
          }
        }
        setRows(flat);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [linea]);

  function patchRow(itemId: number, patch: Partial<ProveedorRow>) {
    setRows(prev => prev.map(r => r.itemId === itemId ? { ...r, ...patch } : r));
  }

  async function saveRow(row: ProveedorRow) {
    setBusyId(row.itemId);
    try {
      await updateItem(row.itemId, {
        factura_proveedor: row.facturaProveedor,
        abono1: row.abono1,
        abono2: row.abono2
      });
      patchRow(row.itemId, { editing: false });
    } catch {
      alert('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #dfd8c8', borderRadius: 6, fontSize: 13 };

  const saldoPendiente = (row: ProveedorRow) => row.costoTotal - row.abono1 - row.abono2;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <h1 className="title-serif font-semibold shrink-0" style={{ fontSize: 24, color: '#12192b' }}>
        Gestión de Proveedores — {LINEA_LABELS[linea]}
      </h1>
      <p className="mb-5 shrink-0" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Se alimenta solo de Eventos (cotizaciones aprobadas): apenas una cotización pasa a evento, su detalle de
        proveedores aparece acá automáticamente. {canEdit && 'Puedes editar factura, abono 1 y abono 2.'}
        {!canEdit && ' Acceso de solo lectura.'}
      </p>

      <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ minWidth: 1100, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nº Cot. / Evento', 'Proveedor', 'Cantidad', 'Costo Unitario', 'Costo Total', 'Factura Proveedor', 'Abono 1', 'Abono 2', 'Saldo'].map(h => (
                <th key={h} style={colHeaderStyle}>{h}</th>
              ))}
              {canEdit && <th style={colHeaderStyle}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={canEdit ? 10 : 9} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>Cargando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={canEdit ? 10 : 9} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>
                Todavía no hay eventos con detalle de proveedores cargado.
              </td></tr>
            )}
            {rows.map(row => {
              const isEditing = !!row.editing;
              const busy = busyId === row.itemId;
              return (
                <tr key={row.itemId} style={{ borderTop: '1px solid #efe9df' }}>
                  <td style={cellStyle}>{row.nCotLabel}</td>
                  <td style={cellStyle}>
                    <div>{row.proveedor}</div>
                    <div style={{ fontSize: 11.5, color: '#9aa0ad' }}>{row.itemNombre}</div>
                  </td>
                  <td style={cellStyle}>{row.cantidad}</td>
                  <td style={cellStyle}>{formatCLP(row.unitarioCosto)}</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{formatCLP(row.costoTotal)}</td>
                  <td style={cellStyle}>
                    {isEditing && canEdit ? (
                      <input style={inputStyle} value={row.facturaProveedor} onChange={e => patchRow(row.itemId, { facturaProveedor: e.target.value })} />
                    ) : (row.facturaProveedor || '—')}
                  </td>
                  <td style={cellStyle}>
                    {isEditing && canEdit ? (
                      <input type="number" style={inputStyle} value={row.abono1} onChange={e => patchRow(row.itemId, { abono1: Number(e.target.value) })} />
                    ) : formatCLP(row.abono1)}
                  </td>
                  <td style={cellStyle}>
                    {isEditing && canEdit ? (
                      <input type="number" style={inputStyle} value={row.abono2} onChange={e => patchRow(row.itemId, { abono2: Number(e.target.value) })} />
                    ) : formatCLP(row.abono2)}
                  </td>
                  <td style={{ ...cellStyle, color: saldoPendiente(row) > 0 ? '#8a6a1f' : '#1f7a4d', fontWeight: 600 }}>
                    {formatCLP(saldoPendiente(row))}
                  </td>
                  {canEdit && (
                    <td style={cellStyle}>
                      {isEditing ? (
                        <button onClick={() => saveRow(row)} disabled={busy} title="Guardar"
                          style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcecdf', color: '#1f7a4d' }}>✓</button>
                      ) : (
                        <button onClick={() => patchRow(row.itemId, { editing: true })} title="Editar"
                          style={{ width: 30, height: 30, borderRadius: '50%', background: '#e2e9f5', color: '#2c4a7c' }}>✎</button>
                      )}
                    </td>
                  )}
                </tr>
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
