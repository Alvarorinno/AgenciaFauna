import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';
import { withDerived, withItemDerived, withGrupoDerived } from '../lib/calc.js';

const router = Router();
router.use(authMiddleware);

// Campos editables por rol (server-side, no confiar solo en el gating de la UI)
const ENCARGADO_FIELDS = ['n_cot', 'mes', 'cliente', 'proyecto', 'descripcion', 'costo_cliente', 'costo_real', 'estado_cotizacion'];
const FINANCE_FIELDS = ['factura', 'fecha_factura', 'mes_factura', 'estado_pago'];

// Trae los grupos+ítems de UNA cotización (usado para que las respuestas de
// POST/PUT incluyan grupos/tiene_detalle igual que el GET de la lista completa;
// si no, el reemplazo de fila en el cliente borraría el detalle ya cargado).
async function fetchGrupos(cotizacionId) {
  const grupos = await sql`SELECT * FROM cotizacion_grupos WHERE cotizacion_id = ${cotizacionId} ORDER BY orden, id`;
  const items = grupos.length
    ? await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ANY(${grupos.map(g => g.id)}) ORDER BY orden, id`
    : [];
  const itemsByGrupo = {};
  for (const it of items) (itemsByGrupo[it.grupo_id] ??= []).push(withItemDerived(it));
  return grupos.map(g => withGrupoDerived(g, itemsByGrupo[g.id] || []));
}

router.get('/', async (req, res) => {
  const rows = await sql`SELECT * FROM cotizaciones ORDER BY n_cot, id`;
  const grupos = await sql`SELECT * FROM cotizacion_grupos ORDER BY orden, id`;
  const items = await sql`SELECT * FROM cotizacion_items ORDER BY orden, id`;

  const itemsByGrupo = {};
  for (const it of items) {
    (itemsByGrupo[it.grupo_id] ??= []).push(withItemDerived(it));
  }

  const gruposByCot = {};
  for (const g of grupos) {
    const gItems = itemsByGrupo[g.id] || [];
    (gruposByCot[g.cotizacion_id] ??= []).push(withGrupoDerived(g, gItems));
  }

  res.json(rows.map(r => {
    const rGrupos = gruposByCot[r.id] || [];
    return withDerived({ ...r, grupos: rGrupos, tiene_detalle: rGrupos.length > 0 });
  }));
});

router.post('/', async (req, res) => {
  // 'todos' (Dirección) es un rol de solo lectura: puede ver todo pero no crear/editar/eliminar.
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso para crear cotizaciones' });
  }

  let nCot = req.body.n_cot;
  if (nCot === undefined || nCot === null || nCot === '') {
    const [{ m }] = await sql`SELECT MAX(n_cot) as m FROM cotizaciones`;
    nCot = (m || 0) + 1;
  }

  const estadoCotizacion = ['pendiente', 'aprobado', 'rechazado'].includes(req.body.estado_cotizacion)
    ? req.body.estado_cotizacion
    : 'pendiente';

  // La línea de negocio se deriva SIEMPRE del usuario autenticado, nunca del body
  // (evita que un 'encargado' cree cotizaciones en la línea de otro).
  const lineaNegocio = req.user.linea_negocio || 'fauna_rd';

  const rows = await sql`
    INSERT INTO cotizaciones (n_cot, mes, cliente, proyecto, descripcion, costo_cliente, costo_real, estado_pago, estado_cotizacion, linea_negocio)
    VALUES (
      ${nCot},
      ${req.body.mes ?? 'enero'},
      ${req.body.cliente ?? ''},
      ${req.body.proyecto ?? ''},
      ${req.body.descripcion ?? ''},
      ${req.body.costo_cliente || 0},
      ${req.body.costo_real || 0},
      'na',
      ${estadoCotizacion},
      ${lineaNegocio}
    )
    RETURNING *
  `;

  res.status(201).json(withDerived({ ...rows[0], grupos: [], tiene_detalle: false }));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`SELECT * FROM cotizaciones WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Cotización no encontrada' });

  // Un 'encargado' solo puede editar cotizaciones de su propia línea de negocio
  // (finanzas edita campos financieros en ambas líneas por diseño).
  if (req.user.role === 'encargado' && existing[0].linea_negocio !== req.user.linea_negocio) {
    return res.status(403).json({ error: 'Sin permiso para editar cotizaciones de otra línea de negocio' });
  }

  // 'todos' (Dirección) es un rol de solo lectura: no tiene campos editables.
  const allowedFields =
    req.user.role === 'encargado' ? ENCARGADO_FIELDS :
    req.user.role === 'finanzas' ? FINANCE_FIELDS : [];

  // Si la cotización ya tiene detalle de proveedores cargado (cotizacion_grupos),
  // costo_cliente y costo_real se calculan automáticamente desde los ítems
  // (ver recomputeTotales en lib/calc.js, disparado desde routes/detalle.js)
  // y dejan de ser editables a mano, incluso si vienen en el payload.
  const [{ n: gruposCount }] = await sql`SELECT COUNT(*)::int as n FROM cotizacion_grupos WHERE cotizacion_id = ${id}`;
  const lockedFields = gruposCount > 0 ? ['costo_cliente', 'costo_real'] : [];

  const updates = {};
  for (const field of allowedFields) {
    if (lockedFields.includes(field)) continue;
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const idParamIndex = values.length + 1;

  const updated = await sql.query(
    `UPDATE cotizaciones SET ${setClause}, updated_at = now() WHERE id = $${idParamIndex} RETURNING *`,
    [...values, id]
  );

  const grupos = await fetchGrupos(id);
  res.json(withDerived({ ...updated[0], grupos, tiene_detalle: grupos.length > 0 }));
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso para eliminar cotizaciones' });
  }
  const id = Number(req.params.id);
  const existing = await sql`SELECT linea_negocio FROM cotizaciones WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
  if (existing[0].linea_negocio !== req.user.linea_negocio) {
    return res.status(403).json({ error: 'Sin permiso para eliminar cotizaciones de otra línea de negocio' });
  }
  await sql`DELETE FROM cotizaciones WHERE id = ${id}`;
  res.json({ ok: true });
});

export default router;
