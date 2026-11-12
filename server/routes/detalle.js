import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';
import { withDerived, withItemDerived, withGrupoDerived, recomputeTotales } from '../lib/calc.js';
import { renderOrdenCompra, OC_DOC_OPTIONS } from '../lib/ocPdf.js';
import { renderCotizacion, COT_DOC_OPTIONS } from '../lib/cotPdf.js';

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
  rut: '77.897.540-8',
  giro: 'Otras actividades especializadas de diseño N.C.P',
  direccion: 'Sebastian Piñera 548, Las Condes', // versión corta (Orden de Compra)
  direccionCompleta: 'Av. Presidente Sebastián Piñera Echeñique #548, Las Condes' // Cotización
};

// Correo de contacto que se muestra tanto en la cotización como en la Orden de
// Compra: depende de la línea de negocio dueña de la cotización (cada línea la
// gestiona una encargada distinta) — RD usa el de Francisca, Agencia el de Agustina.
const EMAIL_POR_LINEA = {
  fauna_rd: 'francisca.sierralta@agenciafauna.com',
  agencia: 'agustina.garcia@agenciafauna.com'
};
function emailForLinea(linea) {
  return EMAIL_POR_LINEA[linea] || EMAIL_POR_LINEA.fauna_rd;
}

// Ejecutiva a cargo que se muestra en la cotización según la línea de negocio.
const EJECUTIVA_POR_LINEA = {
  fauna_rd: { nombre: 'Francisca Sierralta', cargo: 'Directora Omnicanal', email: EMAIL_POR_LINEA.fauna_rd },
  agencia: { nombre: 'Agustina García', cargo: 'Directora de Cuentas', email: EMAIL_POR_LINEA.agencia }
};

// Condiciones por defecto de la cotización (se puede reemplazar por cotización con
// el campo condiciones_pago: no a todos los clientes se les cobra igual).
const CONDICIONES_DEFAULT = 'Forma de pago: 50% del total anticipado, 50% contra entrega.';
const VALIDEZ_COTIZACION_DIAS = 30;

// Tipo de documento del proveedor. Factura: la OC suma IVA (19%). Boleta de
// honorarios: el monto del detalle es el bruto y se le descuenta la retención
// (15,25% → se paga el 84,75% = bruto × 0,8475).
const TIPOS_DOCUMENTO = ['factura', 'boleta_honorarios'];
const FACTOR_BOLETA_HONORARIOS = 0.8475;

// dd-mm-aaaa en hora de Chile (el servidor corre en UTC).
function fmtFecha(date) {
  return new Date(date).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
}

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

  const tipoDocumento = TIPOS_DOCUMENTO.includes(req.body.tipo_documento) ? req.body.tipo_documento : 'factura';
  const rows = await sql`
    INSERT INTO cotizacion_grupos (cotizacion_id, nombre, proveedor, rut_proveedor, orden, tipo_documento)
    VALUES (${cotizacionId}, ${req.body.nombre ?? ''}, ${req.body.proveedor ?? ''}, ${req.body.rut_proveedor ?? ''}, ${orden}, ${tipoDocumento})
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

  // factura_proveedor/abono1/abono2 son propios de Gestión de Proveedores: una
  // factura + abonos cubren todo el itemizado de este proveedor en la cotización
  // (no van por ítem). No afectan costo_cliente/costo_real, por eso no disparan
  // recomputeTotales.
  const fields = ['nombre', 'proveedor', 'rut_proveedor', 'factura_proveedor', 'abono1', 'abono2', 'tipo_documento'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.tipo_documento !== undefined && !TIPOS_DOCUMENTO.includes(updates.tipo_documento)) {
    return res.status(400).json({ error: 'Tipo de documento inválido (factura o boleta_honorarios)' });
  }
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

// ================= COMISIÓN DE AGENCIA =================

// % de utilidad del negocio a sumar por encima del subtotal que los ítems ya
// cobran al cliente (ver calcComisionMonto/recomputeTotales en lib/calc.js).
// Solo tiene efecto si la cotización ya tiene ítems cargados (si no,
// recomputeTotales no toca los totales).
router.put('/cotizaciones/:id/comision', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const linea = await checkLineaCotizacion(req, res, id);
  if (linea === null) return;

  const pct = Number(req.body.comision_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
    return res.status(400).json({ error: 'Porcentaje de comisión inválido (debe ser entre 0 y 99.9)' });
  }

  await sql`UPDATE cotizaciones SET comision_pct = ${pct}, updated_at = now() WHERE id = ${id}`;
  await recomputeTotales(id);

  res.json(await cotizacionCompleta(id));
});

// Condiciones de pago/proyecto que se imprimen en la cotización para el cliente.
// Texto vacío = vuelve al texto por defecto.
router.put('/cotizaciones/:id/condiciones', requireEncargado, async (req, res) => {
  const id = Number(req.params.id);
  const linea = await checkLineaCotizacion(req, res, id);
  if (linea === null) return;

  const texto = String(req.body.condiciones_pago ?? '').trim().slice(0, 2000);
  await sql`UPDATE cotizaciones SET condiciones_pago = ${texto || null}, updated_at = now() WHERE id = ${id}`;
  res.json(await cotizacionCompleta(id));
});

// Cotización con sus grupos e ítems, en el mismo formato que devuelve el GET.
async function cotizacionCompleta(id) {
  const cotRows = await sql`SELECT * FROM cotizaciones WHERE id = ${id}`;
  const grupos = await sql`SELECT * FROM cotizacion_grupos WHERE cotizacion_id = ${id} ORDER BY orden, id`;
  const items = grupos.length
    ? await sql`SELECT * FROM cotizacion_items WHERE grupo_id = ANY(${grupos.map(g => g.id)}) ORDER BY orden, id`
    : [];
  const itemsByGrupo = {};
  for (const it of items) (itemsByGrupo[it.grupo_id] ??= []).push(withItemDerived(it));
  const gruposOut = grupos.map(g => withGrupoDerived(g, itemsByGrupo[g.id] || []));
  return withDerived({ ...cotRows[0], grupos: gruposOut, tiene_detalle: gruposOut.length > 0 });
}

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

  const numero = formatNCot(cot.n_cot ?? cot.id, cot.linea_negocio);
  const doc = new PDFDocument(COT_DOC_OPTIONS);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cotizacion-${formatNCot(cot.n_cot || cot.id, cot.linea_negocio)}.pdf"`);
  doc.pipe(res);

  // Solo precios de venta: nunca costo, utilidad ni nombre del proveedor.
  let granTotal = 0;
  const gruposPdf = [];
  for (const g of grupos) {
    const gItems = itemsByGrupo[g.id] || [];
    if (gItems.length === 0) continue;
    const gTotal = gItems.reduce((acc, it) => acc + it.subtotal_cliente, 0);
    granTotal += gTotal;
    gruposPdf.push({
      nombre: g.nombre,
      subtotal: fmtCLP(gTotal),
      rows: gItems.map((it, i) => ({
        num: `${gruposPdf.length + 1}.${i + 1}`,
        desc: bulletize(it.nombre),
        cant: String(it.cantidad),
        unit: fmtCLP(it.unitario_cliente),
        sub: fmtCLP(it.subtotal_cliente)
      }))
    });
  }

  const comisionMonto = granTotal ? Number(cot.comision_monto) || 0 : 0;
  const subtotalNeto = granTotal || cot.costo_cliente;
  const totalNeto = subtotalNeto + comisionMonto;
  const iva = totalNeto * 0.19;

  // Fechas: emisión = cuando se creó la cotización; impresión = esta descarga
  // (así queda trazabilidad de qué versión se entregó y cuándo).
  const emision = new Date(cot.created_at);
  const vencimiento = new Date(emision.getTime() + VALIDEZ_COTIZACION_DIAS * 24 * 60 * 60 * 1000);

  renderCotizacion(doc, {
    empresa: { rut: COMPANY.rut, giro: COMPANY.giro, direccion: COMPANY.direccionCompleta },
    ejecutiva: EJECUTIVA_POR_LINEA[cot.linea_negocio] || EJECUTIVA_POR_LINEA.fauna_rd,
    numero,
    emision: fmtFecha(emision),
    vencimiento: fmtFecha(vencimiento),
    impresion: fmtFecha(new Date()),
    cliente: cot.cliente || '—',
    proyecto: cot.proyecto || '—',
    descripcion: cot.descripcion || '',
    grupos: gruposPdf,
    subtotalNeto: fmtCLP(subtotalNeto),
    comision: comisionMonto > 0 ? { label: `COMISIÓN AGENCIA ${Number(cot.comision_pct) || 0}%`, value: fmtCLP(comisionMonto) } : null,
    totalNeto: fmtCLP(totalNeto),
    iva: fmtCLP(iva),
    total: fmtCLP(totalNeto + iva),
    condiciones: (cot.condiciones_pago || '').trim() || CONDICIONES_DEFAULT,
    validezDias: VALIDEZ_COTIZACION_DIAS
  });
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

  const doc = new PDFDocument(OC_DOC_OPTIONS);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="oc-${numeroOc}-${(grupo.proveedor || 'proveedor').replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
  doc.pipe(res);

  // Los precios de la OC son el costo del proveedor. Según el documento con que cobra:
  // factura → se suma IVA (19%); boleta de honorarios → el monto es bruto y se paga
  // bruto × 0,8475 (se descuenta la retención). El diseño vive en lib/ocPdf.js;
  // acá solo se arman los datos.
  const bruto = items.reduce((acc, it) => acc + it.subtotal_costo, 0);
  const esBoleta = grupo.tipo_documento === 'boleta_honorarios';
  let filasTotales;
  let totalPagar;
  if (esBoleta) {
    totalPagar = Math.round(bruto * FACTOR_BOLETA_HONORARIOS);
    filasTotales = [
      ['TOTAL BRUTO', fmtCLP(bruto)],
      ['RETENCIÓN (15,25%)', `- ${fmtCLP(bruto - totalPagar)}`]
    ];
  } else {
    totalPagar = bruto * 1.19;
    filasTotales = [
      ['TOTAL NETO', fmtCLP(bruto)],
      ['IVA (19%)', fmtCLP(bruto * 0.19)]
    ];
  }
  renderOrdenCompra(doc, {
    empresa: { rut: COMPANY.rut, direccion: COMPANY.direccion },
    email: emailForLinea(cot?.linea_negocio),
    numeroOc,
    nCot: cot ? formatNCot(cot.n_cot ?? cot.id, cot.linea_negocio) : '—',
    fecha: new Date().toLocaleDateString('es-CL'),
    proyecto: cot?.proyecto || '—',
    proveedor: grupo.proveedor || '—',
    rutProveedor: grupo.rut_proveedor || '—',
    subtitulo: grupo.nombre || '',
    rows: items.map(it => ({
      desc: bulletize(it.nombre),
      cant: String(it.cantidad),
      unit: fmtCLP(it.unitario_costo),
      sub: fmtCLP(it.subtotal_costo)
    })),
    documento: esBoleta ? 'Boleta de honorarios' : 'Factura',
    totales: filasTotales,
    total: fmtCLP(totalPagar)
  });
});

// Si la descripción de un ítem tiene varias líneas (el encargado presionó
// Enter al escribirla), se muestra en el PDF como lista con viñetas — mucho
// más legible que el párrafo corrido de antes. Una descripción de una sola
// línea queda exactamente igual que antes (sin viñeta), para no cambiar el
// aspecto de todo el historial de ítems ya cargados sin saltos de línea.
function bulletize(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text || '';
  return lines.map(l => `•  ${l}`).join('\n');
}

export default router;
