import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

// Campos editables por rol (server-side, no confiar solo en el gating de la UI)
const ENCARGADO_FIELDS = ['n_cot', 'mes', 'a_cargo', 'cliente', 'proyecto', 'descripcion', 'costo_cliente', 'costo_real'];
const FINANCE_FIELDS = ['factura', 'fecha_factura', 'mes_factura', 'estado_pago'];

function withDerived(row) {
  const costoCliente = Number(row.costo_cliente) || 0;
  const costoReal = Number(row.costo_real) || 0;
  const utilidad = costoCliente - costoReal;
  const pctUtilidad = costoCliente === 0 ? 0 : Math.round((utilidad / costoCliente) * 1000) / 10;
  return { ...row, costo_cliente: costoCliente, costo_real: costoReal, utilidad, pct_utilidad: pctUtilidad };
}

router.get('/', async (req, res) => {
  const rows = await sql`SELECT * FROM cotizaciones ORDER BY n_cot, id`;
  res.json(rows.map(withDerived));
});

router.post('/', async (req, res) => {
  if (!['encargado', 'todos'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sin permiso para crear cotizaciones' });
  }

  let nCot = req.body.n_cot;
  if (nCot === undefined || nCot === null || nCot === '') {
    const [{ m }] = await sql`SELECT MAX(n_cot) as m FROM cotizaciones`;
    nCot = (m || 0) + 1;
  }

  const rows = await sql`
    INSERT INTO cotizaciones (n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real, estado_pago)
    VALUES (
      ${nCot},
      ${req.body.mes ?? 'enero'},
      ${req.body.a_cargo ?? ''},
      ${req.body.cliente ?? ''},
      ${req.body.proyecto ?? ''},
      ${req.body.descripcion ?? ''},
      ${req.body.costo_cliente || 0},
      ${req.body.costo_real || 0},
      'na'
    )
    RETURNING *
  `;

  res.status(201).json(withDerived(rows[0]));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`SELECT * FROM cotizaciones WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Cotización no encontrada' });

  const allowedFields =
    req.user.role === 'todos' ? [...ENCARGADO_FIELDS, ...FINANCE_FIELDS] :
    req.user.role === 'encargado' ? ENCARGADO_FIELDS :
    req.user.role === 'finanzas' ? FINANCE_FIELDS : [];

  const updates = {};
  for (const field of allowedFields) {
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

  res.json(withDerived(updated[0]));
});

router.delete('/:id', async (req, res) => {
  if (!['encargado', 'todos'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sin permiso para eliminar cotizaciones' });
  }
  await sql`DELETE FROM cotizaciones WHERE id = ${Number(req.params.id)}`;
  res.json({ ok: true });
});

export default router;
