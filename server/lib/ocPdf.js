// Diseño de la Orden de Compra (PDF) — versión con acentos verde lima.
//
// Módulo puro: recibe un PDFDocument ya creado con OC_DOC_OPTIONS y los datos ya
// formateados (montos como texto), sin tocar la base de datos. Así se puede
// probar localmente con datos de ejemplo. La cotización cliente NO usa este
// diseño (sigue en routes/detalle.js).
//
// El documento se crea con margen 0 y todo se posiciona en coordenadas absolutas:
// con márgenes normales PDFKit salta de página sola al dibujar texto cerca del
// borde inferior, y el pie de página (Página X de Y) vive justo ahí.
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets');
const LOGO_PATH = path.join(ASSETS, 'logo-fauna.png');
// Gráficos decorativos (burbujas/moléculas) — opcionales: mientras los archivos
// no existan esas esquinas quedan en blanco. Basta con dejar los PNG (fondo
// transparente) con estos nombres en server/assets/ para que aparezcan.
const DECOR_TOP_RIGHT = path.join(ASSETS, 'oc-decor-top-right.png');
const DECOR_BOTTOM_LEFT = path.join(ASSETS, 'oc-decor-bottom-left.png');

export const OC_DOC_OPTIONS = { size: 'A4', margin: 0, bufferPages: true };

const OC = {
  X0: 34,
  X1: 561,
  W: 527,
  lime: '#B4FB00',
  tint: '#F3FCE9',
  head: '#F1F1F3',
  line: '#C6C6C6',
  ink: '#0d0d0d',
  sub: '#444444',
  // Tipografías: cuando lleguen las fuentes de marca, basta cambiarlas acá
  // (doc.registerFont + estos nombres).
  font: 'Helvetica',
  bold: 'Helvetica-Bold',
  contentTop: 130, // inicio del contenido en páginas de continuación
  bottom: 750 // límite inferior del contenido (el pie ocupa desde ~775)
};

// Y del texto para que las mayúsculas queden centradas verticalmente en una caja
// de alto h que empieza en `top` (la línea base de Helvetica queda a 0.718·size).
const capY = (top, h, size) => top + (h - 0.718 * size) / 2;

function pill(doc, x, y, w, h, { fill, stroke } = {}) {
  doc.roundedRect(x, y, w, h, h / 2);
  if (fill && stroke) doc.fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else if (stroke) doc.lineWidth(1).stroke(stroke);
}

// Línea con un círculo hueco al final (motivo decorativo del diseño).
function lineWithDot(doc, x1, x2, y) {
  doc.lineWidth(0.7).strokeColor(OC.ink).moveTo(x1, y).lineTo(x2, y).stroke();
  doc.lineWidth(0.7).circle(x2 + 3.5, y, 3.5).fillAndStroke('#ffffff', OC.ink);
}

// Elementos fijos de cada página: gráficos, encabezado de marca y pie. Se dibujan
// al crear la página (quedan debajo del contenido); el "Página X de Y" se agrega
// al final, cuando ya se sabe el total de páginas.
function drawChrome(doc, d) {
  const pw = doc.page.width;
  const ph = doc.page.height;

  if (existsSync(DECOR_TOP_RIGHT)) {
    doc.image(DECOR_TOP_RIGHT, pw - 100, 0, { fit: [100, 110], align: 'right', valign: 'top' });
  }
  if (existsSync(DECOR_BOTTOM_LEFT)) {
    doc.image(DECOR_BOTTOM_LEFT, 0, ph - 190, { fit: [130, 190], align: 'left', valign: 'bottom' });
  }

  // --- Encabezado de marca ---
  const logoW = 170;
  const logo = doc.openImage(LOGO_PATH);
  const logoH = logoW * (logo.height / logo.width);
  doc.image(LOGO_PATH, OC.X0, 38, { width: logoW });
  const lema = 'IDEAS  QUE  VIVEN';
  const lemaY = 38 + logoH + 9;
  doc.font(OC.font).fontSize(5.5).fillColor(OC.ink);
  doc.text(lema, OC.X0 + 12, lemaY, { characterSpacing: 3.2, lineBreak: false });
  const lemaW = doc.widthOfString(lema, { characterSpacing: 3.2 });
  doc.circle(OC.X0 + 12 + lemaW + 10, lemaY + 2.6, 2).fill(OC.lime);

  doc.font(OC.font).fontSize(5.2).fillColor(OC.ink);
  ['CREATIVIDAD', 'CIENCIA', 'NATURALEZA', 'MARCAS'].forEach((t, i) => {
    doc.text(t, 245, 66 + i * 8.2, { characterSpacing: 2.6, lineBreak: false });
  });
  lineWithDot(doc, 245, 338, 103);

  doc.lineWidth(0.8).strokeColor(OC.ink).moveTo(362, 58).lineTo(362, 114).stroke();

  doc.font(OC.bold).fontSize(8.5).fillColor(OC.ink).text('Agencia Fauna SpA', 374, 64, { lineBreak: false });
  doc.font(OC.font).fontSize(8.5);
  [`RUT: ${d.empresa.rut}`, d.empresa.direccion, d.email].forEach((t, i) => {
    doc.text(t, 374, 64 + 11.5 * (i + 1), { lineBreak: false });
  });

  // --- Pie de página ---
  doc.font(OC.font).fontSize(5.2).fillColor(OC.ink);
  ['SISTEMAS VIVOS', 'PARA MARCAS', 'QUE CRECEN'].forEach((t, i) => {
    doc.text(t, 151, 779 + i * 8.2, { characterSpacing: 2.4, lineBreak: false });
  });
  lineWithDot(doc, 151, 246, 806);
  doc.lineWidth(0.7).strokeColor(OC.ink).moveTo(276, 805).lineTo(430, 805).stroke();
}

function drawPageNumber(doc, n, total) {
  doc.font(OC.font).fontSize(8.5).fillColor(OC.sub);
  doc.text(`Página ${n} de ${total}`, 440, 799, { width: 103, align: 'right', lineBreak: false });
  // círculo con flecha ">" (motivo del diseño)
  const cx = 559;
  const cy = 803;
  doc.lineWidth(1.2).circle(cx, cy, 10).stroke(OC.lime);
  doc.lineWidth(1.2).strokeColor(OC.lime).moveTo(cx - 2, cy - 4).lineTo(cx + 2.5, cy).lineTo(cx - 2, cy + 4).stroke();
}

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

const COLS = [
  { key: 'desc', x: 50, w: 236, align: 'left', label: 'Descripción' },
  { key: 'cant', x: 291, w: 40, align: 'center', label: 'Cant.' },
  { key: 'unit', x: 369, w: 105, align: 'left', label: 'Costo Unit.' },
  { key: 'sub', x: 487, w: 72, align: 'left', label: 'Subtotal' }
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

// Totales: Total neto → IVA (19%) → pastilla "TOTAL A PAGAR".
function drawTotals(doc, y, d) {
  const need = 100;
  if (y + need > OC.bottom) {
    doc.addPage();
    y = OC.contentTop;
  }
  y += 4;
  [['Total neto', d.neto], ['IVA (19%)', d.iva]].forEach(([label, value]) => {
    doc.font(OC.font).fontSize(9.5).fillColor(OC.sub).text(label, 330, y, { width: 120, align: 'right', lineBreak: false });
    doc.font(OC.font).fontSize(10).fillColor(OC.ink).text(value, 455, y, { width: 106, align: 'right', lineBreak: false });
    y += 16;
  });
  y += 8;

  const h = 42;
  doc.font(OC.font).fontSize(8.5);
  const label = 'TOTAL A PAGAR:';
  const lw = doc.widthOfString(label, { characterSpacing: 2.5 });
  doc.font(OC.bold).fontSize(17);
  const vw = doc.widthOfString(d.total);
  const limeW = Math.max(150, vw + 44);
  const limeX = OC.X1 - limeW;
  const outlineX = limeX - lw - 30;
  pill(doc, outlineX, y, limeX + limeW / 2 - outlineX, h, { stroke: OC.line });
  doc.font(OC.font).fontSize(8.5).fillColor(OC.ink);
  doc.text(label, outlineX + 22, capY(y, h, 8.5), { characterSpacing: 2.5, lineBreak: false });
  pill(doc, limeX, y, limeW, h, { fill: OC.lime });
  doc.font(OC.bold).fontSize(17).fillColor(OC.ink);
  doc.text(d.total, limeX, capY(y, h, 17), { width: limeW, align: 'center', lineBreak: false });
  return y + h;
}

/**
 * @param doc PDFDocument creado con OC_DOC_OPTIONS (ya conectado a su destino)
 * @param d { empresa: {rut, direccion}, email, numeroOc, nCot, fecha, proyecto, proveedor, rutProveedor,
 *            subtitulo, rows: [{desc, cant, unit, sub}], neto, iva, total }
 *            (montos ya formateados como texto)
 */
export function renderOrdenCompra(doc, d) {
  drawChrome(doc, d);
  doc.on('pageAdded', () => drawChrome(doc, d));

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

  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    drawPageNumber(doc, i + 1, count);
  }
  doc.end();
}
