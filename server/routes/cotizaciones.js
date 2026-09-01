import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';
import { withDerived, withItemDerived, withGrupoDerived, recomputeTotales } from '../lib/calc.js';

const router = Router();
router.use(authMiddleware);

// Campos editables por rol (server-side, no confiar solo en el gating de la UI)
const ENCARGADO_FIELDS = ['n_cot', 'mes', 'cliente', 'proyecto', 'descripcion', 'costo_cliente', 'costo_real', 'estado_cotizacion', 'tipo_ingreso'];
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

  // Clasificación Fee / Variable: ante la duda (valor ausente o no reconocido) se
  // clasifica como 'fee' para que se revise manualmente más adelante.
  const tipoIngreso = ['fee', 'variable'].includes(req.body.tipo_ingreso) ? req.body.tipo_ingreso : 'fee';

  // La línea de negocio se deriva SIEMPRE del usuario autenticado, nunca del body
  // (evita que un 'encargado' cree cotizaciones en la línea de otro).
  const lineaNegocio = req.user.linea_negocio || 'fauna_rd';

  const rows = await sql`
    INSERT INTO cotizaciones (n_cot, mes, cliente, proyecto, descripcion, costo_cliente, costo_real, estado_pago, estado_cotizacion, linea_negocio, tipo_ingreso)
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
      ${lineaNegocio},
      ${tipoIngreso}
    )
    RETURNING *
  `;

  res.status(201).json(withDerived({ ...rows[0], grupos: [], tiene_detalle: false }));
});

// Duplica una cotización (o proyecto ya aprobado) junto con TODO su detalle
// de proveedores (grupos + ítems, con las mismas cantidades y precios), para
// reutilizarla como base de una nueva sin tener que volver a tipear todo.
// La copia SIEMPRE queda 'pendiente', sin importar el estado del original:
// duplicar un proyecto/evento ya aprobado no debe generar otro evento directo,
// tiene que pasar de nuevo por el pipeline de Cotizaciones para su revisión.
// No se copian factura_proveedor/abonos ni datos de facturación del cliente:
// son propios de la ejecución de ESA cotización, no del "molde" reutilizado.
router.post('/:id/duplicate', async (req, res) => {
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso para duplicar cotizaciones' });
  }

  const id = Number(req.params.id);
  const existing = await sql`SELECT * FROM cotizaciones WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
  const original = existing[0];

  if (original.linea_negocio !== req.user.linea_negocio) {
    return res.status(403).json({ error: 'Sin permiso para duplicar cotizaciones de otra línea de negocio' });
  }

  const [{ m }] = await sql`SELECT MAX(n_cot) as m FROM cotizaciones`;
  const nCot = (m || 0) + 1;

  // costo_cliente/costo_real del original se copian como valores iniciales: si el
  // original tiene grupos con ítems de precio real, recomputeTotales() los pisa más
  // abajo con la suma de los ítems recién copiados (comportamiento sin cambios). Si
  // el original NO tiene ningún grupo cargado, no hay ítems de los que recomputar
  // nada — esos costos son un valor referencial puesto a mano por el encargado (ver
  // recomputeTotales) y deben viajar con la copia, si no la duplicación los resetea
  // a $0 sin forma de recuperarlos.
  const [nueva] = await sql`
    INSERT INTO cotizaciones (
      n_cot, mes, cliente, proyecto, descripcion, costo_cliente, costo_real,
      comision_pct, comision_monto, estado_pago, estado_cotizacion, linea_negocio, tipo_ingreso
    )
    VALUES (
      ${nCot}, ${original.mes}, ${original.cliente}, ${original.proyecto}, ${original.descripcion},
      ${original.costo_cliente || 0}, ${original.costo_real || 0}, ${original.comision_pct || 0}, 0, 'na', 'pendiente', ${original.linea_negocio}, ${original.tipo_ingreso}
    )
    RETURNING *
  `;

  const gruposOriginales = await sql`SELECT * FROM cotizacion_grupos WHERE cotizacion_id = ${id} ORDER BY orden, id`;
  for (const g of gruposOriginales) {
    const [nuevoGrupo] = await sql`
      INSERT INTO cotizacion_grupos (cotizacion_id, nombre, proveedor, rut_proveedor, orden)
      VALUES (${nueva.id}, ${g.nombre}, ${g.proveedor}, ${g.rut_proveedor}, ${g.orden})
      RETURNING *
    `;
    const itemsOriginales = await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ${g.id} ORDER BY orden, id`;
    for (const it of itemsOriginales) {
      await sql`
        INSERT INTO cotizacion_items (grupo_id, nombre, cantidad, unidad, dias, unitario_cliente, unitario_costo, orden)
        VALUES (${nuevoGrupo.id}, ${it.nombre}, ${it.cantidad}, ${it.unidad}, ${it.dias}, ${it.unitario_cliente}, ${it.unitario_costo}, ${it.orden})
      `;
    }
  }

  if (gruposOriginales.length > 0) await recomputeTotales(nueva.id);

  const grupos = await fetchGrupos(nueva.id);
  const [final] = await sql`SELECT * FROM cotizaciones WHERE id = ${nueva.id}`;
  res.status(201).json(withDerived({ ...final, grupos, tiene_detalle: grupos.length > 0 }));
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
  //
  // Excepción: si los ítems todavía NO suman nada a costo_cliente (hay costo de
  // proveedor cargado pero aún no se definió el valor de venta ítem por ítem),
  // se deja editable a mano para que el ejecutivo ponga un valor referencial
  // mientras tanto — SOLO mientras los ítems sigan sin sumar (ver recomputeTotales,
  // que no pisa un valor puesto a mano hasta que haya un precio real en algún
  // ítem). Importante: el chequeo es sobre la SUMA DE LOS ÍTEMS, no sobre el
  // costo_cliente ya guardado — si no fuera así, apenas el ejecutivo pusiera un
  // valor referencial (costo_cliente > 0) el campo se bloquearía de nuevo aunque
  // los proveedores sigan sin definir precio de venta. costo_real nunca se
  // habilita por esta vía: siempre refleja el costo real ya conocido.
  const [{ n: gruposCount }] = await sql`SELECT COUNT(*)::int as n FROM cotizacion_grupos WHERE cotizacion_id = ${id}`;
  const [{ base: itemsBaseRaw }] = await sql`
    SELECT COALESCE(SUM(i.cantidad * i.unitario_cliente), 0) as base
    FROM cotizacion_items i
    JOIN cotizacion_grupos g ON g.id = i.grupo_id
    WHERE g.cotizacion_id = ${id}
  `;
  const itemsBase = Number(itemsBaseRaw) || 0;
  const lockedFields = gruposCount > 0
    ? (itemsBase === 0 ? ['costo_real'] : ['costo_cliente', 'costo_real'])
    : [];

  const updates = {};
  for (const field of allowedFields) {
    if (lockedFields.includes(field)) continue;
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  // Clasificación Fee / Variable: ante cualquier valor no reconocido, se guarda como
  // 'fee' para revisión manual posterior (mismo criterio usado al crear una cotización).
  if (updates.tipo_ingreso !== undefined && !['fee', 'variable'].includes(updates.tipo_ingreso)) {
    updates.tipo_ingreso = 'fee';
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
