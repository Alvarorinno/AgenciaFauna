// Diseño de la Orden de Compra (PDF) — versión con acentos verde lima.
//
// Módulo puro: recibe un PDFDocument ya creado con OC_DOC_OPTIONS y los datos ya
// formateados (montos como texto), sin tocar la base de datos. Así se puede
// probar localmente con datos de ejemplo. La base visual (encabezado de marca,
// pie, pastillas) está en pdfBrand.js y la comparte con la cotización.
import { DOC_OPTIONS, B as OC, capY, pill, drawChrome, numberPagesAndEnd } from './pdfBrand.js';

export const OC_DOC_OPTIONS = DOC_OPTIONS;

// Texto a la derecha del divisor del encabezado de marca.
const bandOf = d => ({ lines: ['Agencia Fauna SpA', `RUT: ${d.empresa.rut}`, d.empresa.direccion, d.email] });

// Primera página: título, pastillas, datos del proyecto/proveedor y encabezado de
// la sección. Devuelve la Y donde empieza la tabla.
function drawFirstPageHead(doc, d) {
  const { X0, X1, W } = OC;

  // Título gigante + punto verde
  const titulo = 'ORDEN DE COMPRA';
  let size = 46;
  doc.font(OC.font).fontSize(size);
  const maxW = 470;
  const w0 = doc.widthOfString(titulo);
  if (w0 > maxW) size = (size * maxW) / w0;
  doc.fontSize(size).fillColor(OC.ink);
  const titleTop = 140;
  doc.text(titulo, X0, titleTop, { lineBreak: false });
  const titleW = doc.widthOfString(titulo);
  const base = titleTop + 0.718 * size;
  doc.circle(X0 + titleW + 14, base - 6, 7).fill(OC.lime);

  // Pastillas: N° OC | N° Cotización asociada (relleno lima) | Fecha
  const pills = [
    { t: `N° OC: ${d.numeroOc}`, fill: false },
    { t: `N° Cotización asociada: ${d.nCot}`, fill: true },
    { t: `Fecha: ${d.fecha}`, fill: false }
  ];
  const pad = 24;
  const gap = 8;
  let pSize = 9.5;
  const widthsAt = s => pills.map(p => doc.fontSize(s).font(OC.font).widthOfString(p.t) + pad * 2);
  let widths = widthsAt(pSize);
  const totalW = () => widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  if (totalW() > W) {
    pSize = (pSize * (W - gap * (pills.length - 1))) / widths.reduce((a, b) => a + b, 0) * 0.98;
    widths = widthsAt(pSize);
  }
  const pillH = 25;
  const pillY = base + 24;
  let px = X0;
  pills.forEach((p, i) => {
    pill(doc, px, pillY, widths[i], pillH, p.fill ? { fill: OC.lime } : { stroke: OC.line });
    doc.font(OC.font).fontSize(pSize).fillColor(OC.ink);
    doc.text(p.t, px, capY(pillY, pillH, pSize), { width: widths[i], align: 'center', lineBreak: false });
    px += widths[i] + gap;
  });

  let y = pillY + pillH + 17;
  doc.lineWidth(0.7).strokeColor(OC.line).moveTo(X0, y).lineTo(X1, y).stroke();

  // Proyecto | Proveedor | RUT Proveedor
  const cols = [
    { x: X0, w: 160, label: 'Proyecto:', value: d.proyecto },
    { x: 220, w: 160, label: 'Proveedor:', value: d.proveedor },
    { x: 412, w: X1 - 412, label: 'RUT Proveedor:', value: d.rutProveedor }
  ];
  const top = y + 13;
  doc.font(OC.bold).fontSize(10.5);
  const valH = Math.max(...cols.map(c => doc.heightOfString(c.value, { width: c.w })));
  cols.forEach(c => {
    doc.font(OC.font).fontSize(8.5).fillColor(OC.sub).text(c.label, c.x, top, { width: c.w, lineBreak: false });
    doc.font(OC.bold).fontSize(10.5).fillColor(OC.ink).text(c.value, c.x, top + 14, { width: c.w });
  });
  const rowH = 14 + valH;
  [205, 396].forEach(x => {
    doc.lineWidth(0.7).strokeColor(OC.line).moveTo(x, top - 3).lineTo(x, top + rowH + 3).stroke();
  });
  y = top + rowH + 13;
  doc.lineWidth(0.7).strokeColor(OC.line).moveTo(X0, y).lineTo(X1, y).stroke();

  // Sección: círculo "01" + DETALLE DE COMPRA + subtítulo (nombre del grupo)
  const sTop = y + 24;
  doc.circle(X0 + 13, sTop + 13, 13).fill(OC.lime);
  doc.font(OC.bold).fontSize(9.5).fillColor(OC.ink);
  doc.text('01', X0, capY(sTop, 26, 9.5), { width: 26, align: 'center', lineBreak: false });
  doc.font(OC.font).fontSize(17).fillColor(OC.ink);
  doc.text('DETALLE DE COMPRA', X0 + 42, sTop, { characterSpacing: 1.6, lineBreak: false });
  let sy = sTop + 24;
  if (d.subtitulo) {
    doc.font(OC.font).fontSize(7.5).fillColor(OC.sub);
    const opts = { width: 440, characterSpacing: 2.6 };
    doc.text(d.subtitulo.toUpperCase(), X0 + 42, sy, opts);
    sy += doc.heightOfString(d.subtitulo.toUpperCase(), opts);
  }
  sy += 8;
  doc.lineWidth(2).strokeColor(OC.lime).moveTo(X0, sy).lineTo(X0 + 30, sy).stroke();
  return sy + 20;
}

// Los montos van alineados a la derecha y terminan en el mismo borde (NUM_RIGHT)
// que usan los totales de abajo, para que toda la columna de números quede
// pareja de la tabla a la pastilla "TOTAL A PAGAR".
const NUM_RIGHT = 545;
const COLS = [
  { key: 'desc', x: 50, w: 236, align: 'left', label: 'Descripción' },
  { key: 'cant', x: 291, w: 40, align: 'center', label: 'Cant.' },
  { key: 'unit', x: 340, w: 105, align: 'right', label: 'Costo Unit.' },
  { key: 'sub', x: NUM_RIGHT - 90, w: 90, align: 'right', label: 'Subtotal' }
];

function drawTableHeader(doc, y) {
  const h = 27;
  doc.roundedRect(OC.X0, y, OC.W, h, 6).fill(OC.head);
  doc.font(OC.bold).fontSize(8.5).fillColor(OC.ink);
  COLS.forEach(c => {
    doc.text(c.label, c.x, capY(y, h, 8.5), { width: c.w, align: c.align, lineBreak: false });
  });
  return y + h + 8;
}

function rowHeight(doc, row) {
  doc.font(OC.font).fontSize(9.5);
  const textH = Math.max(...COLS.map(c => doc.heightOfString(String(row[c.key] ?? ''), { width: c.w })));
  return Math.max(30, textH + 14);
}

// Fila de ítem: las impares (1ª, 3ª…) con fondo verde claro redondeado; las pares
// con una línea fina debajo. Cada celda se centra verticalmente en la fila.
function drawRow(doc, row, y, idx, h) {
  if (idx % 2 === 0) {
    doc.roundedRect(OC.X0, y, OC.W, h, 6).fill(OC.tint);
  }
  doc.font(OC.font).fontSize(9.5).fillColor(OC.ink);
  COLS.forEach(c => {
    const txt = String(row[c.key] ?? '');
    const th = doc.heightOfString(txt, { width: c.w });
    doc.text(txt, c.x, y + (h - th) / 2, { width: c.w, align: c.align });
  });
  if (idx % 2 === 1) {
    doc.lineWidth(0.6).strokeColor('#e2e2e2').moveTo(OC.X0, y + h).lineTo(OC.X1, y + h).stroke();
  }
}

// Totales: tres pastillas apiladas con el mismo ancho — TOTAL NETO y IVA (19%)
// con borde, y "TOTAL A PAGAR" con el extremo lima. Todos los montos terminan en
// NUM_RIGHT, igual que la columna Subtotal de la tabla.
function drawTotals(doc, y, d) {
  const smallH = 28;
  const bigH = 42;
  const gap = 8;
  if (y + smallH * 2 + gap * 2 + bigH > OC.bottom) {
    doc.addPage();
    y = OC.contentTop;
  }

  doc.font(OC.font).fontSize(8.5);
  const labW = l => doc.widthOfString(l, { characterSpacing: 2.5 });
  const lw = labW('TOTAL A PAGAR:');
  doc.font(OC.bold).fontSize(17);
  const vw = doc.widthOfString(d.total);
  const limeW = Math.max(150, vw + 44);
  const limeX = OC.X1 - limeW;
  const outlineX = limeX - lw - 30;

  [['TOTAL NETO', d.neto], ['IVA (19%)', d.iva]].forEach(([label, value]) => {
    pill(doc, outlineX, y, OC.X1 - outlineX, smallH, { stroke: OC.line });
    doc.font(OC.font).fontSize(8.5).fillColor(OC.ink);
    doc.text(label, outlineX + 22, capY(y, smallH, 8.5), { characterSpacing: 2.5, lineBreak: false });
    doc.font(OC.font).fontSize(10.5).fillColor(OC.ink);
    doc.text(value, NUM_RIGHT - 120, capY(y, smallH, 10.5), { width: 120, align: 'right', lineBreak: false });
    y += smallH + gap;
  });
  y += 2;

  pill(doc, outlineX, y, limeX + limeW / 2 - outlineX, bigH, { stroke: OC.line });
  doc.font(OC.font).fontSize(8.5).fillColor(OC.ink);
  doc.text('TOTAL A PAGAR:', outlineX + 22, capY(y, bigH, 8.5), { characterSpacing: 2.5, lineBreak: false });
  pill(doc, limeX, y, limeW, bigH, { fill: OC.lime });
  doc.font(OC.bold).fontSize(17).fillColor(OC.ink);
  doc.text(d.total, NUM_RIGHT - 140, capY(y, bigH, 17), { width: 140, align: 'right', lineBreak: false });
  return y + bigH;
}

/**
 * @param doc PDFDocument creado con OC_DOC_OPTIONS (ya conectado a su destino)
 * @param d { empresa: {rut, direccion}, email, numeroOc, nCot, fecha, proyecto, proveedor, rutProveedor,
 *            subtitulo, rows: [{desc, cant, unit, sub}], neto, iva, total }
 *            (montos ya formateados como texto)
 */
export function renderOrdenCompra(doc, d) {
  drawChrome(doc, bandOf(d));
  doc.on('pageAdded', () => drawChrome(doc, bandOf(d)));

  let y = drawFirstPageHead(doc, d);
  y = drawTableHeader(doc, y);

  d.rows.forEach((row, idx) => {
    const h = rowHeight(doc, row);
    if (y + h > OC.bottom) {
      doc.addPage();
      y = drawTableHeader(doc, OC.contentTop);
    }
    drawRow(doc, row, y, idx, h);
    y += h;
  });
  // La tabla siempre cierra con una línea fina, caiga la última fila en posición par o impar.
  if (d.rows.length % 2 === 1) {
    doc.lineWidth(0.6).strokeColor('#e2e2e2').moveTo(OC.X0, y).lineTo(OC.X1, y).stroke();
  }

  drawTotals(doc, y + 20, d);

  numberPagesAndEnd(doc);
}
