import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProveedores, createProveedor } from '../api';
import type { Proveedor } from '../types';

// Directorio maestro de proveedores del negocio: transversal a Fauna RD y
// Agencia (no está acotado a una línea), a diferencia de "Gestión de
// Proveedores" que sí vive dentro de cada línea y solo muestra el detalle de
// costos/facturas por evento. Acá es la ficha de contacto/datos bancarios de
// cada proveedor. Fase 1 (lo pedido): listado + botón para agregar uno nuevo,
// sin edición/eliminación todavía.
const EMPTY_FORM = { nombre: '', nombre_contacto: '', datos_empresa: '', cuenta: '', servicios: '' };

export default function Proveedores() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicioFiltro, setServicioFiltro] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Cualquier 'encargado' (de cualquiera de las dos líneas) puede agregar proveedores
  // nuevos al directorio compartido; 'todos' (Dirección) y 'finanzas' son de solo lectura.
  const canEdit = user?.role === 'encargado';

  useEffect(() => {
    setLoading(true);
    getProveedores()
      .then(data => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const servicios = useMemo(() => Array.from(new Set(rows.map(r => r.servicios).filter(Boolean))).sort(), [rows]);
  const filteredRows = useMemo(
    () => servicioFiltro === 'todos' ? rows : rows.filter(r => r.servicios === servicioFiltro),
    [rows, servicioFiltro]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const created = await createProveedor(form);
      setRows(prev => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      alert('No se pudo agregar el proveedor. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #dfd8c8', borderRadius: 7, fontSize: 13.5 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#5b5f6b', fontWeight: 600, marginBottom: 4, letterSpacing: 0.3 };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <h1 className="title-serif font-semibold shrink-0" style={{ fontSize: 24, color: '#12192b' }}>Proveedores</h1>
      <p className="mb-5 shrink-0" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Directorio maestro de proveedores del negocio, compartido entre Fauna RD y Agencia.{' '}
        {canEdit ? 'Puedes agregar proveedores nuevos.' : 'Acceso de solo lectura.'}
      </p>

      <div className="flex flex-wrap items-end mb-5 shrink-0" style={{ gap: 14 }}>
        <div>
          <label style={labelStyle}>Servicio</label>
          <select
            value={servicioFiltro}
            onChange={e => setServicioFiltro(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #dfd8c8', borderRadius: 7, fontSize: 13 }}
          >
            <option value="todos">Todos</option>
            {servicios.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="ml-auto font-bold"
            style={{ background: '#c8a24a', color: '#12192b', padding: '9px 16px', borderRadius: 8, fontSize: 13.5 }}
          >
            {showForm ? 'Cancelar' : '+ Agregar proveedor'}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form
          onSubmit={handleSubmit}
          className="bg-white shrink-0 mb-5"
          style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: 18 }}
        >
          <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Proveedor *</label>
              <input style={inputStyle} required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Nombre Contacto</label>
              <input style={inputStyle} value={form.nombre_contacto} onChange={e => setForm(f => ({ ...f, nombre_contacto: e.target.value }))} />
            </div>
          </div>
          <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Datos Empresa</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.datos_empresa} onChange={e => setForm(f => ({ ...f, datos_empresa: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Cuenta</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.cuenta} onChange={e => setForm(f => ({ ...f, cuenta: e.target.value }))} />
            </div>
          </div>
          <div className="mb-4" style={{ maxWidth: 320 }}>
            <label style={labelStyle}>Servicios</label>
            <input style={inputStyle} value={form.servicios} onChange={e => setForm(f => ({ ...f, servicios: e.target.value }))} />
          </div>
          <button
            type="submit"
            disabled={saving || !form.nombre.trim()}
            className="font-bold"
            style={{ background: '#1f7a4d', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 13.5, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </form>
      )}

      <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ minWidth: 1100, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Proveedor', 'Nombre Contacto', 'Datos Empresa', 'Cuenta', 'Servicios'].map(h => (
                <th key={h} style={colHeaderStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>Cargando…</td></tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9aa0ad' }}>
                {rows.length === 0 ? 'Todavía no hay proveedores cargados.' : 'No hay resultados para este servicio.'}
              </td></tr>
            )}
            {filteredRows.map(row => (
              <tr key={row.id} style={{ borderTop: '1px solid #efe9df' }}>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{row.nombre}</td>
                <td style={{ ...cellStyle, whiteSpace: 'pre-line' }}>{row.nombre_contacto || '—'}</td>
                <td style={{ ...cellStyle, whiteSpace: 'pre-line', maxWidth: 320 }}>{row.datos_empresa || '—'}</td>
                <td style={{ ...cellStyle, whiteSpace: 'pre-line', maxWidth: 320 }}>{row.cuenta || '—'}</td>
                <td style={cellStyle}>{row.servicios || '—'}</td>
              </tr>
            ))}
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
  padding: '8px 12px', fontSize: 13.5, color: '#12192b', verticalAlign: 'top'
};
