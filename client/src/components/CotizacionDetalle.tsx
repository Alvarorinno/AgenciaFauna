import { useState } from 'react';
import type { Cotizacion, CotizacionGrupo, CotizacionItem } from '../types';
import {
  createGrupo, updateGrupo, deleteGrupo,
  createItem, updateItem, deleteItem,
  getCotizaciones, downloadCotizacionClientePdf, downloadGrupoOcPdf
} from '../api';
import { formatCLP } from '../utils';

interface Props {
  cotizacion: Cotizacion;
  canEdit: boolean;
  onCotizacionUpdated: (updated: Cotizacion) => void;
}

const CLIENTE_BG = '#eaf3e6';
const CLIENTE_TEXT = '#1f7a4d';
const COSTO_BG = '#e6eef7';
const COSTO_TEXT = '#2c4a7c';

export default function CotizacionDetalle({ cotizacion, canEdit, onCotizacionUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [editingGrupoId, setEditingGrupoId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [draftGrupo, setDraftGrupo] = useState<Partial<CotizacionGrupo>>({});
  const [draftItem, setDraftItem] = useState<Partial<CotizacionItem>>({});

  async function refresh() {
    const all = await getCotizaciones();
    const fresh = all.find(c => c.id === cotizacion.id);
    if (fresh) onCotizacionUpdated(fresh);
  }

  async function handleAddGrupo() {
    setBusy(true);
    try {
      await createGrupo(cotizacion.id, { nombre: 'Nuevo grupo', proveedor: '', rut_proveedor: '' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function startEditGrupo(g: CotizacionGrupo) {
    setEditingGrupoId(g.id);
    setDraftGrupo({ nombre: g.nombre, proveedor: g.proveedor, rut_proveedor: g.rut_proveedor });
  }

  async function saveGrupo(id: number) {
    setBusy(true);
    try {
      await updateGrupo(id, draftGrupo);
      setEditingGrupoId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGrupo(id: number) {
    if (!window.confirm('¿Eliminar este grupo/proveedor y todos sus ítems?')) return;
    setBusy(true);
    try {
      await deleteGrupo(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem(grupoId: number) {
    setBusy(true);
    try {
      await createItem(grupoId, { nombre: 'Nuevo ítem', cantidad: 1, unitario_cliente: 0, unitario_costo: 0 });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function startEditItem(it: CotizacionItem) {
    setEditingItemId(it.id);
    setDraftItem({
      nombre: it.nombre, cantidad: it.cantidad,
      unitario_cliente: it.unitario_cliente, unitario_costo: it.unitario_costo
    });
  }

  async function saveItem(id: number) {
    setBusy(true);
    try {
      await updateItem(id, draftItem);
      setEditingItemId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(id: number) {
    if (!window.confirm('¿Eliminar este ítem?')) return;
    setBusy(true);
    try {
      await deleteItem(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 6px', border: '1px solid #dfd8c8', borderRadius: 5, fontSize: 12.5 };

  return (
    <div style={{ padding: '14px 18px', background: '#fbfaf7' }}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: 12, color: '#5b5f6b' }}>
          Detalle de proveedores. {cotizacion.tiene_detalle && 'Costo Cliente y Costo Real de la cotización se calculan automáticamente desde este detalle.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCotizacionClientePdf(cotizacion.id)}
            disabled={!cotizacion.tiene_detalle}
            title={cotizacion.tiene_detalle ? 'Descargar cotización para el cliente (PDF)' : 'Agrega al menos un ítem para poder descargar'}
            style={{ background: CLIENTE_BG, color: CLIENTE_TEXT, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, opacity: cotizacion.tiene_detalle ? 1 : 0.4 }}
          >
            📄 Cotización cliente (PDF)
          </button>
          {canEdit && (
            <button
              onClick={handleAddGrupo}
              disabled={busy}
              style={{ background: '#c8a24a', color: '#12192b', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700 }}
            >
              + Agregar proveedor
            </button>
          )}
        </div>
      </div>

      {cotizacion.grupos.length === 0 && (
        <p style={{ fontSize: 12.5, color: '#9aa0ad', padding: '10px 0' }}>Sin detalle de proveedores cargado todavía.</p>
      )}

      {cotizacion.grupos.map(g => (
        <div key={g.id} className="bg-white mb-3 overflow-x-auto" style={{ border: '1px solid #dfd8c8', borderRadius: 10 }}>
          <table style={{ minWidth: 950, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th colSpan={4} style={detHeaderStyle(CLIENTE_BG, CLIENTE_TEXT)}>Cliente</th>
                <th colSpan={4} style={detHeaderStyle(COSTO_BG, COSTO_TEXT)}>Costo</th>
                <th colSpan={2} style={detHeaderStyle(COSTO_BG, COSTO_TEXT)}>Proveedor</th>
                {canEdit && <th style={detHeaderStyle('#f7f4ee', '#12192b')}></th>}
              </tr>
              <tr>
                {['Nombre', 'Cant.', 'Unitario', 'Subtotal'].map(h => (
                  <th key={h} style={{ ...detColStyle, background: CLIENTE_BG }}>{h}</th>
                ))}
                {['Unitario', 'Subtotal', 'Utilidad $', 'Utilidad %'].map(h => (
                  <th key={h} style={{ ...detColStyle, background: COSTO_BG }}>{h}</th>
                ))}
                {['Proveedor', 'RUT'].map(h => (
                  <th key={h} style={{ ...detColStyle, background: COSTO_BG }}>{h}</th>
                ))}
                {canEdit && <th style={detColStyle}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {/* Fila de grupo (bold, totales) */}
              <tr style={{ borderTop: '2px solid #dfd8c8', fontWeight: 700 }}>
                <td colSpan={2} style={{ ...detCellStyle, background: CLIENTE_BG }}>
                  {editingGrupoId === g.id ? (
                    <input style={inputStyle} value={draftGrupo.nombre ?? ''} onChange={e => setDraftGrupo(d => ({ ...d, nombre: e.target.value }))} />
                  ) : g.nombre}
                </td>
                <td style={{ ...detCellStyle, background: CLIENTE_BG }}></td>
                <td style={{ ...detCellStyle, background: CLIENTE_BG, color: CLIENTE_TEXT }}>{formatCLP(g.subtotal_cliente)}</td>
                <td style={{ ...detCellStyle, background: COSTO_BG }}></td>
                <td style={{ ...detCellStyle, background: COSTO_BG, color: COSTO_TEXT }}>{formatCLP(g.subtotal_costo)}</td>
                <td style={{ ...detCellStyle, background: COSTO_BG, color: g.utilidad >= 0 ? CLIENTE_TEXT : '#6d2632' }}>{formatCLP(g.utilidad)}</td>
                <td style={{ ...detCellStyle, background: COSTO_BG, color: g.utilidad >= 0 ? CLIENTE_TEXT : '#6d2632' }}>{g.pct_utilidad.toFixed(1)}%</td>
                <td style={{ ...detCellStyle, background: COSTO_BG }}>
                  {editingGrupoId === g.id ? (
                    <input style={inputStyle} value={draftGrupo.proveedor ?? ''} onChange={e => setDraftGrupo(d => ({ ...d, proveedor: e.target.value }))} placeholder="Proveedor" />
                  ) : g.proveedor}
                </td>
                <td style={{ ...detCellStyle, background: COSTO_BG }}>
                  {editingGrupoId === g.id ? (
                    <input style={inputStyle} value={draftGrupo.rut_proveedor ?? ''} onChange={e => setDraftGrupo(d => ({ ...d, rut_proveedor: e.target.value }))} placeholder="RUT" />
                  ) : g.rut_proveedor}
                </td>
                {canEdit && (
                  <td style={detCellStyle}>
                    <div className="flex items-center gap-1.5">
                      {editingGrupoId === g.id ? (
                        <button onClick={() => saveGrupo(g.id)} title="Guardar" style={iconBtnStyle('#dcecdf', '#1f7a4d')}>✓</button>
                      ) : (
                        <button onClick={() => startEditGrupo(g)} title="Editar proveedor" style={iconBtnStyle('#e2e9f5', '#2c4a7c')}>✎</button>
                      )}
                      <button onClick={() => downloadGrupoOcPdf(g.id)} title="Descargar OC proveedor (PDF)" style={iconBtnStyle('#efe9df', '#12192b')}>📄</button>
                      <button onClick={() => handleDeleteGrupo(g.id)} title="Eliminar grupo" style={iconBtnStyle('#f6e4e6', '#6d2632')}>🗑</button>
                    </div>
                  </td>
                )}
              </tr>

              {/* Ítems */}
              {g.items.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid #efe9df' }}>
                  <td style={detCellStyle}>
                    {editingItemId === it.id ? (
                      <input style={inputStyle} value={draftItem.nombre ?? ''} onChange={e => setDraftItem(d => ({ ...d, nombre: e.target.value }))} />
                    ) : it.nombre}
                  </td>
                  <td style={detCellStyle}>
                    {editingItemId === it.id ? (
                      <input type="number" style={inputStyle} value={draftItem.cantidad ?? 0} onChange={e => setDraftItem(d => ({ ...d, cantidad: Number(e.target.value) }))} />
                    ) : it.cantidad}
                  </td>
                  <td style={{ ...detCellStyle, background: CLIENTE_BG }}>
                    {editingItemId === it.id ? (
                      <input type="number" style={inputStyle} value={draftItem.unitario_cliente ?? 0} onChange={e => setDraftItem(d => ({ ...d, unitario_cliente: Number(e.target.value) }))} />
                    ) : formatCLP(it.unitario_cliente)}
                  </td>
                  <td style={{ ...detCellStyle, background: CLIENTE_BG, color: CLIENTE_TEXT }}>{formatCLP(it.subtotal_cliente)}</td>
                  <td style={{ ...detCellStyle, background: COSTO_BG }}>
                    {editingItemId === it.id ? (
                      <input type="number" style={inputStyle} value={draftItem.unitario_costo ?? 0} onChange={e => setDraftItem(d => ({ ...d, unitario_costo: Number(e.target.value) }))} />
                    ) : formatCLP(it.unitario_costo)}
                  </td>
                  <td style={{ ...detCellStyle, background: COSTO_BG, color: COSTO_TEXT }}>{formatCLP(it.subtotal_costo)}</td>
                  <td style={{ ...detCellStyle, background: COSTO_BG, color: it.utilidad >= 0 ? CLIENTE_TEXT : '#6d2632' }}>{formatCLP(it.utilidad)}</td>
                  <td style={{ ...detCellStyle, background: COSTO_BG, color: it.utilidad >= 0 ? CLIENTE_TEXT : '#6d2632' }}>{it.pct_utilidad.toFixed(1)}%</td>
                  <td colSpan={2} style={{ ...detCellStyle, background: COSTO_BG }}></td>
                  {canEdit && (
                    <td style={detCellStyle}>
                      <div className="flex items-center gap-1.5">
                        {editingItemId === it.id ? (
                          <button onClick={() => saveItem(it.id)} title="Guardar" style={iconBtnStyle('#dcecdf', '#1f7a4d')}>✓</button>
                        ) : (
                          <button onClick={() => startEditItem(it)} title="Editar ítem" style={iconBtnStyle('#e2e9f5', '#2c4a7c')}>✎</button>
                        )}
                        <button onClick={() => handleDeleteItem(it.id)} title="Eliminar ítem" style={iconBtnStyle('#f6e4e6', '#6d2632')}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {canEdit && (
                <tr style={{ borderTop: '1px solid #efe9df' }}>
                  <td colSpan={11} style={{ padding: '6px 12px' }}>
                    <button onClick={() => handleAddItem(g.id)} disabled={busy} style={{ fontSize: 12, color: '#2c4a7c', fontWeight: 600 }}>+ Agregar ítem</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const detHeaderStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
  padding: '6px 10px', textAlign: 'left'
});

const detColStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: '#5b5f6b', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap'
};

const detCellStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12.5, color: '#12192b', verticalAlign: 'middle'
};

const iconBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  width: 26, height: 26, borderRadius: '50%', background: bg, color, fontSize: 12
});
