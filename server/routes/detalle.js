import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';
import { withItemDerived, withGrupoDerived, recomputeTotales } from '../lib/calc.js';

const router = Router();
router.use(authMiddleware);

// Solo 'encargado' puede crear/editar/eliminar el detalle de proveedores
// (mismo criterio que ENCARGADO_FIELDS en routes/cotizaciones.js).
function requireEncargado(req, res, next) {
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso para editar el detalle de proveedores' });
  }
  next();
}

// Además de ser 'encargado', solo puede tocar detalle de cotizaciones de su
// propia línea de negocio. Devuelve la línea de la cotización dueña, o null
// (y ya respondió el error) si no está permitido.
async function checkLineaCotizacion(req, res, cotizacionId) {
  const rows = await sql`SELECT linea_negocio FROM cotizaciones WHERE id = ${cotizacionId}`;
  if (!rows[0]) {
    res.status(404).json({ error: 'Cotización no encontrada' });
    return null;
  }
  if (rows[0].linea_negocio !== req.user.linea_negocio) {
    res.status(403).json({ error: 'Sin permiso para editar el detalle de otra línea de negocio' });
    return null;
  }
  return rows[0].linea_negocio;
}

const COMPANY = {
  razonSocial: 'Agencia Fauna SpA',
  rut: '77.897.540-1',
  direccion: 'Sebastian Piñera 548, Las Condes',
  email: 'francisca.sierralta@agenciafauna.com'
};

const COLORS = { tinta: '#12192b', papel: '#f7f4ee', laton: '#c8a24a', burdeos: '#6d2632' };

function fmtCLP(n) {
  return '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CL');
}

// Prefijo de línea de negocio para el número de cotización (RD = Fauna RD,
// AF = Agencia), puramente visual para no confundir de un vistazo a qué línea
// pertenece cada cotización/OC — ambas comparten la misma numeración global,
// la información de la empresa emisora (Agencia Fauna SpA) es la misma en
// ambos casos y no se discrimina por línea de negocio.
function lineaPrefix(linea) {
  return linea === 'agencia' ? 'AF' : 'RD';
}

function formatNCot(nCot, linea) {
  return `${lineaPrefix(linea)}-${nCot}`;
}

// ================= GRUPOS =================

router.post('/grupos', requireEncargado, async (req, res) => {
  const cotizacionId = Number(req.body.cotizacion_id);
  if (!cotizacionId) return res.status(400).json({ error: 'Falta cotizacion_id' });

  const linea = await checkLineaCotizacion(req, res, cotizacionId);
  if (linea === null) return;

  const [{ m }] = await sql`SELECT MAX(orden) as m FROM cotizacion_grupos WHERE cotizacion_id = ${cotizacionId}`;
  const orden = (m ?? -1) + 1;

  const rows = await sql`
    INSERT INTO cotizacion_grupos (cotizacion_id, nombre, proveedor, rut_proveedor, orden)
    VALUES (${cotizacionId}, ${req.body.nombre ?? ''}, ${req.body.proveedor ?? ''}, ${req.body.rut_proveedor ?? ''}, ${orden})
    RETURNING *
  `;
  res.status(201).json(withGrupoDerived(rows[0], []));
});

router.put('/grupos/:id', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`SELECT * FROM cotizacion_grupos WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Grupo no encontrado' });

  const linea = await checkLineaCotizacion(req, res, existing[0].cotizacion_id);
  if (linea === null) return;

  const fields = ['nombre', 'proveedor', 'rut_proveedor'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const updated = await sql.query(
    `UPDATE cotizacion_grupos SET ${setClause}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id]
  );

  const items = await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ${id} ORDER BY orden, id`;
  res.json(withGrupoDerived(updated[0], items.map(withItemDerived)));
});

router.delete('/grupos/:id', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`SELECT cotizacion_id FROM cotizacion_grupos WHERE id = ${id}`;
  if (!existing[0]) return res.status(404).json({ error: 'Grupo no encontrado' });

  const cotizacionId = existing[0].cotizacion_id;
  const linea = await checkLineaCotizacion(req, res, cotizacionId);
  if (linea === null) return;

  await sql`DELETE FROM cotizacion_grupos WHERE id = ${id}`; // ON DELETE CASCADE se lleva sus ítems
  await recomputeTotales(cotizacionId);
  res.json({ ok: true });
});

// ================= ITEMS =================

router.post('/grupos/:id/items', requireEncargado, async (req, res) => {
  const grupoId = Number(req.params.id);
  const grupo = await sql`SELECT * FROM cotizacion_grupos WHERE id = ${grupoId}`;
  if (!grupo[0]) return res.status(404).json({ error: 'Grupo no encontrado' });

  const linea = await checkLineaCotizacion(req, res, grupo[0].cotizacion_id);
  if (linea === null) return;

  const [{ m }] = await sql`SELECT MAX(orden) as m FROM cotizacion_items WHERE grupo_id = ${grupoId}`;
  const orden = (m ?? -1) + 1;

  const rows = await sql`
    INSERT INTO cotizacion_items (grupo_id, nombre, cantidad, unitario_cliente, unitario_costo, orden)
    VALUES (
      ${grupoId}, ${req.body.nombre ?? ''}, ${req.body.cantidad ?? 1},
      ${req.body.unitario_cliente || 0}, ${req.body.unitario_costo || 0}, ${orden}
    )
    RETURNING *
  `;
  await recomputeTotales(grupo[0].cotizacion_id);
  res.status(201).json(withItemDerived(rows[0]));
});

router.put('/items/:id', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`
    SELECT i.*, g.cotizacion_id
    FROM cotizacion_items i
    JOIN cotizacion_grupos g ON g.id = i.grupo_id
    WHERE i.id = ${id}
  `;
  if (!existing[0]) return res.status(404).json({ error: 'Ítem no encontrado' });

  const linea = await checkLineaCotizacion(req, res, existing[0].cotizacion_id);
  if (linea === null) return;

  const fields = ['nombre', 'cantidad', 'unitario_cliente', 'unitario_costo'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const updated = await sql.query(
    `UPDATE cotizacion_items SET ${setClause}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id]
  );

  await recomputeTotales(existing[0].cotizacion_id);
  res.json(withItemDerived(updated[0]));
});

router.delete('/items/:id', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await sql`
    SELECT i.id, g.cotizacion_id
    FROM cotizacion_items i
    JOIN cotizacion_grupos g ON g.id = i.grupo_id
    WHERE i.id = ${id}
  `;
  if (!existing[0]) return res.status(404).json({ error: 'Ítem no encontrado' });

  const linea = await checkLineaCotizacion(req, res, existing[0].cotizacion_id);
  if (linea === null) return;

  await sql`DELETE FROM cotizacion_items WHERE id = ${id}`;
  await recomputeTotales(existing[0].cotizacion_id);
  res.json({ ok: true });
});

// ================= PDFs =================
// Ambos PDFs son de solo lectura para cualquier rol autenticado (mismo criterio
// que el GET de cotizaciones: todos los roles pueden ver/descargar, solo 'encargado' edita).

// Cotización para el cliente: resumen + detalle línea por línea, SOLO precios de venta
// (verde). Nunca debe exponer costo, utilidad ni el nombre del proveedor.
router.get('/cotizaciones/:id/pdf-cliente', async (req, res) => {
  const id = Number(req.params.id);
  const cotRows = await sql`SELECT * FROM cotizaciones WHERE id = ${id}`;
  const cot = cotRows[0];
  if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });

  const grupos = await sql`SELECT * FROM cotizacion_grupos WHERE cotizacion_id = ${id} ORDER BY orden, id`;
  const grupoIds = grupos.map(g => g.id);
  const items = grupoIds.length
    ? await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ANY(${grupoIds}) ORDER BY grupo_id, orden, id`
    : [];

  const itemsByGrupo = {};
  for (const it of items) (itemsByGrupo[it.grupo_id] ??= []).push(withItemDerived(it));

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cotizacion-${formatNCot(cot.n_cot || cot.id, cot.linea_negocio)}.pdf"`);
  doc.pipe(res);

  drawHeader(doc, 'COTIZACIÓN');

  doc.fontSize(10).fillColor(COLORS.tinta);
  doc.text(`N° Cotización: ${formatNCot(cot.n_cot ?? cot.id, cot.linea_negocio)}`, 40, doc.y + 6);
  doc.text(`Cliente: ${cot.cliente || '—'}`);
  doc.text(`Proyecto: ${cot.proyecto || '—'}`);
  if (cot.descripcion) doc.text(`Descripción: ${cot.descripcion}`);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`);
  doc.moveDown(1);

  let granTotal = 0;
  for (const g of grupos) {
    const gItems = itemsByGrupo[g.id] || [];
    if (gItems.length === 0) continue;

    ensureSpace(doc, 60);
    doc.rect(40, doc.y, 515, 20).fill(COLORS.tinta);
    doc.fillColor('#fff').fontSize(10.5).text(g.nombre || 'Sin nombre', 46, doc.y - 15.5, { width: 500 });
    doc.moveDown(0.6);

    tableHeader(doc, ['Descripción', 'Cant.', 'Unitario', 'Subtotal'], [260, 60, 95, 100]);

    let gTotal = 0;
    for (const it of gItems) {
      ensureSpace(doc, 20);
      const y = doc.y;
      doc.fontSize(9).fillColor(COLORS.tinta);
      const cols = [260, 60, 95, 100];
      const vals = [it.nombre || '', String(it.cantidad), fmtCLP(it.unitario_cliente), fmtCLP(it.subtotal_cliente)];
      let x = 40;
      vals.forEach((v, i) => {
        doc.text(v, x, y, { width: cols[i] - 4 });
        x += cols[i];
      });
      doc.moveDown(0.9);
      gTotal += it.subtotal_cliente;
    }
    granTotal += gTotal;

    ensureSpace(doc, 20);
    doc.fontSize(9.5).fillColor(COLORS.tinta).text(`Subtotal: ${fmtCLP(gTotal)}`, 40, doc.y, { width: 515, align: 'right' });
    doc.moveDown(1);
  }

  ensureSpace(doc, 40);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(COLORS.laton).lineWidth(1.5).stroke();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(COLORS.tinta).text(`TOTAL COTIZACIÓN: ${fmtCLP(granTotal || cot.costo_cliente)}`, 40, doc.y, { width: 515, align: 'right' });

  doc.end();
});

// Orden de compra para un proveedor específico: SOLO ese grupo, con los precios de
// costo (celeste). Nunca debe exponer el precio al cliente ni la utilidad.
router.get('/grupos/:id/pdf-oc', async (req, res) => {
  const id = Number(req.params.id);
  const grupoRows = await sql`SELECT * FROM cotizacion_grupos WHERE id = ${id}`;
  const grupo = grupoRows[0];
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

  const cotRows = await sql`SELECT * FROM cotizaciones WHERE id = ${grupo.cotizacion_id}`;
  const cot = cotRows[0];

  const itemsRaw = await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ${id} ORDER BY orden, id`;
  const items = itemsRaw.map(withItemDerived);

  // N° de OC = N° de cotización + correlativo por orden de proveedor dentro de esa
  // cotización (1er grupo agregado = 001, 2do = 002, etc., según columna `orden`).
  const correlativo = String((Number(grupo.orden) || 0) + 1).padStart(3, '0');
  const numeroOc = `${formatNCot(cot?.n_cot ?? cot?.id ?? '000', cot?.linea_negocio)}-${correlativo}`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="oc-${numeroOc}-${(grupo.proveedor || 'proveedor').replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
  doc.pipe(res);

  drawHeader(doc, 'ORDEN DE COMPRA', `N° OC: ${numeroOc}`);

  doc.fontSize(10).fillColor(COLORS.tinta);
  doc.text(`N° Cotización asociada: ${cot ? formatNCot(cot.n_cot ?? cot.id, cot.linea_negocio) : '—'}`, 40, doc.y + 6);
  doc.text(`Proyecto: ${cot?.proyecto || '—'}`);
  doc.text(`Proveedor: ${grupo.proveedor || '—'}`);
  doc.text(`RUT Proveedor: ${grupo.rut_proveedor || '—'}`);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`);
  doc.moveDown(1);

  ensureSpace(doc, 60);
  doc.rect(40, doc.y, 515, 20).fill(COLORS.tinta);
  doc.fillColor('#fff').fontSize(10.5).text(grupo.nombre || 'Detalle', 46, doc.y - 15.5, { width: 500 });
  doc.moveDown(0.6);

  tableHeader(doc, ['Descripción', 'Cant.', 'Costo Unit.', 'Subtotal'], [260, 60, 95, 100]);

  let total = 0;
  for (const it of items) {
    ensureSpace(doc, 20);
    const y = doc.y;
    doc.fontSize(9).fillColor(COLORS.tinta);
    const cols = [260, 60, 95, 100];
    const vals = [it.nombre || '', String(it.cantidad), fmtCLP(it.unitario_costo), fmtCLP(it.subtotal_costo)];
    let x = 40;
    vals.forEach((v, i) => {
      doc.text(v, x, y, { width: cols[i] - 4 });
      x += cols[i];
    });
    doc.moveDown(0.9);
    total += it.subtotal_costo;
  }

  ensureSpace(doc, 40);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(COLORS.laton).lineWidth(1.5).stroke();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(COLORS.tinta).text(`TOTAL A PAGAR: ${fmtCLP(total)}`, 40, doc.y, { width: 515, align: 'right' });

  doc.end();
});

function drawHeader(doc, title, subtitle) {
  doc.fontSize(16).fillColor(COLORS.tinta).font('Helvetica-BoldOblique').text('Agencia Fauna', 40, 40);
  doc.font('Helvetica').fontSize(8.5).fillColor('#5b5f6b');
  doc.text(COMPANY.razonSocial);
  doc.text(`RUT: ${COMPANY.rut}`);
  doc.text(COMPANY.direccion);
  doc.text(COMPANY.email);
  const leftBottomY = doc.y; // fin del bloque de datos de la empresa (columna izquierda)

  doc.fontSize(18).fillColor(COLORS.laton).font('Helvetica-Bold').text(title, 40, 40, { width: 515, align: 'right' });
  if (subtitle) {
    doc.fontSize(10).fillColor(COLORS.tinta).font('Helvetica-Bold').text(subtitle, 40, doc.y + 2, { width: 515, align: 'right' });
  }
  doc.font('Helvetica');

  // doc.text(..., 40, 40, ...) reposiciona el cursor en base a SU propia altura, que puede
  // quedar más arriba que el bloque de la izquierda (5 líneas). Sin este máximo la línea
  // separadora se dibuja encima del último renglón (el email) en vez de debajo de todo.
  doc.y = Math.max(doc.y, leftBottomY);
  doc.moveDown(1.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dfd8c8').lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function tableHeader(doc, labels, widths) {
  const y = doc.y;
  doc.fontSize(8.5).fillColor('#5b5f6b').font('Helvetica-Bold');
  let x = 40;
  labels.forEach((l, i) => {
    doc.text(l, x, y, { width: widths[i] - 4 });
    x += widths[i];
  });
  doc.font('Helvetica');
  doc.moveDown(0.7);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#efe9df').lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

export default router;
