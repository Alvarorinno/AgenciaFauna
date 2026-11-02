// Diseño de la Cotización para el cliente (PDF): misma base visual que la Orden
// de Compra (pdfBrand.js) pero con tipografías más chicas, porque una cotización
// cubre el proyecto completo (muchos ítems, varias páginas).
//
// Módulo puro: recibe un PDFDocument creado con COT_DOC_OPTIONS y los datos ya
// formateados (montos y fechas como texto), sin tocar la base de datos.
import { DOC_OPTIONS, B, capY, pill, drawChrome, numberPagesAndEnd } from './pdfBrand.js';

export const COT_DOC_OPTIONS = DOC_OPTIONS;

const NUM_RIGHT = 545; // borde derecho común de todos los montos (tabla y totales)
const BAND_COLOR = '#E8FAB8'; // banda de cada categoría (verde lima suave)

// Texto a la derecha del divisor del encabezado de marca: razón social, RUT, giro
// y dirección (la dirección larga se parte en dos líneas para no salirse de la hoja).
function bandOf(d) {
  const dir = d.empresa.direccion;
  const cut = dir.lastIndexOf(', ');
  const dirLines = cut > 0 ? [dir.slice(0, cut + 1), dir.slice(cut + 2)] : [dir];
  return {
    lines: ['Agencia Fauna SpA', `RUT: ${d.empresa.rut}`, d.empresa.giro, ...dirLines],
    size: 7.2,
    step: 9.6,
    top: 60
  };
}

// Primera página: título, pastillas (N° + fechas), datos del cliente/proyecto/
// ejecutiva y encabezado de la sección. Devuelve la Y donde empieza la tabla.
function drawFirstPageHead(doc, d) {
  const { X0, X1, W } = B;

  const titulo = 'COTIZACIÓN';
  const size = 30;
  const titleTop = 130;
  doc.font(B.font).fontSize(size).fillColor(B.ink);
  doc.text(titulo, X0, titleTop, { lineBreak: false });
  const titleW = doc.widthOfString(titulo);
  const base = titleTop + 0.718 * size;
  doc.circle(X0 + titleW + 9, base - 4, 4.5).fill(B.lime);

  const pills = [
    { t: `N° Cotización: ${d.numero}`, fill: true },
    { t: `Emisión: ${d.emision}`, fill: false },
    { t: `Vencimiento: ${d.vencimiento}`, fill: false },
    { t: `Impresión: ${d.impresion}`, fill: false }
  ];
  const pad = 13;
  const gap = 7;
  let pSize = 8.5;
  const widthsAt = s => pills.map(p => doc.font(B.font).fontSize(s).widthOfString(p.t) + pad * 2);
  let widths = widthsAt(pSize);
  const sum = () => widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  if (sum() > W) {
    pSize = pSize * ((W - gap * (pills.length - 1)) / widths.reduce((a, b) => a + b, 0)) * 0.98;
    widths = widthsAt(pSize);
  }
  const pillH = 22;
  const pillY = base + 15;
  let px = X0;
  pills.forEach((p, i) => {
    pill(doc, px, pillY, widths[i], pillH, p.fill ? { fill: B.lime } : { stroke: B.line });
    doc.font(B.font).fontSize(pSize).fillColor(B.ink);
    doc.text(p.t, px, capY(pillY, pillH, pSize), { width: widths[i], align: 'center', lineBreak: false });
    px += widths[i] + gap;
  });

  let y = pillY + pillH + 12;
  doc.lineWidth(0.7).strokeColor(B.line).moveTo(X0, y).lineTo(X1, y).stroke();

  // Cliente | Proyecto | Ejecutiva a cargo — los datos opcionales (RUT, contacto)
  // solo se dibujan si existen.
  const e = d.ejecutiva;
  const cols = [
    { x: X0, w: 160, label: 'Cliente:', value: d.cliente, extras: [d.rutCliente && `RUT: ${d.rutCliente}`, d.contactoCliente && `Att.: ${d.contactoCliente}`] },
    { x: 220, w: 160, label: 'Proyecto:', value: d.proyecto, extras: [] },
    { x: 412, w: X1 - 412, label: 'Ejecutiva a cargo:', value: e.nombre, extras: [e.cargo, e.email] }
  ];
  const top = y + 11;
  const measure = c => {
    doc.font(B.bold).fontSize(9.5);
    let h = 12 + doc.heightOfString(c.value, { width: c.w });
    doc.font(B.font).fontSize(7.5);
    for (const t of c.extras.filter(Boolean)) h += doc.heightOfString(t, { width: c.w }) + 1;
    return h;
  };
  const rowH = Math.max(...cols.map(measure));
  cols.forEach(c => {
    doc.font(B.font).fontSize(7.5).fillColor(B.sub).text(c.label, c.x, top, { width: c.w, lineBreak: false });
    doc.font(B.bold).fontSize(9.5).fillColor(B.ink).text(c.value, c.x, top + 11, { width: c.w });
    let ey = top + 11 + doc.heightOfString(c.value, { width: c.w }) + 1;
    doc.font(B.font).fontSize(7.5).fillColor(B.sub);
    for (const t of c.extras.filter(Boolean)) {
      doc.text(t, c.x, ey, { width: c.w });
      ey += doc.heightOfString(t, { width: c.w }) + 1;
    }
  });
  [205, 396].forEach(x => {
    doc.lineWidth(0.7).strokeColor(B.line).moveTo(x, top - 3).lineTo(x, top + rowH + 2).stroke();
  });
  y = top + rowH + 10;
  doc.lineWidth(0.7).strokeColor(B.line).moveTo(X0, y).lineTo(X1, y).stroke();

  // Sección: círculo "01" + DETALLE DE COTIZACIÓN + descripción del proyecto
  const sTop = y + 14;
  doc.circle(X0 + 11, sTop + 11, 11).fill(B.lime);
  doc.font(B.bold).fontSize(8.5).fillColor(B.ink);
  doc.text('01', X0, capY(sTop, 22, 8.5), { width: 22, align: 'center', lineBreak: false });
  doc.font(B.font).fontSize(13).fillColor(B.ink);
  doc.text('DETALLE DE COTIZACIÓN', X0 + 34, capY(sTop, 22, 13), { characterSpacing: 1.4, lineBreak: false });
  let sy = sTop + 22;
  if (d.descripcion) {
    doc.font(B.font).fontSize(7.5).fillColor(B.sub);
    const opts = { width: 480 };
    doc.text(d.descripcion, X0 + 34, sy, opts);
    sy += doc.heightOfString(d.descripcion, opts);
  }
  sy += 5;
  doc.lineWidth(2).strokeColor(B.lime).moveTo(X0, sy).lineTo(X0 + 26, sy).stroke();
  return sy + 12;
}

const COLS = [
  { key: 'num', x: 44, w: 28, align: 'left', label: 'ÍTEM' },
  { key: 'desc', x: 76, w: 230, align: 'left', label: 'DESCRIPCIÓN' },
  { key: 'cant', x: 310, w: 34, align: 'center', label: 'CANT.' },
  { key: 'unit', x: 350, w: 90, align: 'right', label: 'P.U. CLP' },
  { key: 'sub', x: NUM_RIGHT - 95, w: 95, align: 'right', label: 'SUBTOTAL CLP' }
];

function drawTableHeader(doc, y) {
  const h = 22;
  doc.roundedRect(B.X0, y, B.W, h, 5).fill(B.head);
  doc.font(B.bold).fontSize(7.5).fillColor(B.ink);
  COLS.forEach(c => {
    doc.text(c.label, c.x, capY(y, h, 7.5), { width: c.w, align: c.align, lineBreak: false });
  });
  return y + h + 5;
}

const BAND_H = 20;

// Banda de categoría ("1. PERSONAS") con el subtotal de la categoría a la derecha.
function drawBand(doc, y, label, subtotal) {
  doc.roundedRect(B.X0, y, B.W, BAND_H, 5).fill(BAND_COLOR);
  doc.font(B.bold).fontSize(8.5).fillColor(B.ink);
  doc.text(label.toUpperCase(), 44, capY(y, BAND_H, 8.5), { width: 380, lineBreak: false });
  if (subtotal) doc.text(subtotal, NUM_RIGHT - 120, capY(y, BAND_H, 8.5), { width: 120, align: 'right', lineBreak: false });
  return y + BAND_H + 3;
}

function rowHeight(doc, row) {
  doc.font(B.font).fontSize(8.5);
  const textH = Math.max(...COLS.map(c => doc.heightOfString(String(row[c.key] ?? ''), { width: c.w })));
  return Math.max(20, textH + 8);
}

function drawRow(doc, row, y, h) {
  COLS.forEach(c => {
    const txt = String(row[c.key] ?? '');
    doc.font(B.font).fontSize(8.5).fillColor(c.key === 'num' ? B.sub : B.ink);
    const th = doc.heightOfString(txt, { width: c.w });
    doc.text(txt, c.x, y + (h - th) / 2, { width: c.w, align: c.align });
  });
  doc.lineWidth(0.5).strokeColor('#e6e6e6').moveTo(B.X0, y + h).lineTo(B.X1, y + h).stroke();
}

// Cierre: a la izquierda las condiciones del proyecto (forma de pago, validez,
// fechas), a la derecha los totales en pastillas — iguales a las de la OC pero más
// compactas. Todos los montos terminan en NUM_RIGHT, como la columna Subtotal.
function drawClosing(doc, y, d) {
  const smallH = 20;
  const gap = 4;
  const bigH = 32;
  const rows = [
    ...(d.comision ? [['SUBTOTAL NETO', d.subtotalNeto], [d.comision.label, d.comision.value]] : []),
    ['TOTAL NETO', d.totalNeto],
    ['IVA (19%)', d.iva]
  ];
  const rightH = rows.length * (smallH + gap) + 2 + bigH;

  // Condiciones (columna izquierda)
  const boxX = B.X0;
  const boxW = 262;
  const textW = boxW - 24;
  const lines = [
    { t: d.condiciones },
    { t: `Validez de la cotización: ${d.validezDias} días.` },
    ...(d.fechaInicio ? [{ t: `Inicio del proyecto: ${d.fechaInicio}` }] : []),
    ...(d.fechaTermino ? [{ t: `Término del proyecto: ${d.fechaTermino}` }] : [])
  ].filter(l => l.t);
  doc.font(B.font).fontSize(8);
  const heights = lines.map(l => doc.heightOfString(l.t, { width: textW }));
  const leftH = 12 + 14 + heights.reduce((a, b) => a + b, 0) + (lines.length - 1) * 4 + 12;

  const need = Math.max(rightH, leftH);
  if (y + need > B.bottom + 14) {
    doc.addPage();
    y = B.contentTop;
  }

  doc.roundedRect(boxX, y, boxW, leftH, 8).fill(B.tint);
  doc.font(B.bold).fontSize(7.5).fillColor(B.ink);
  doc.text('CONDICIONES DEL PROYECTO', boxX + 12, y + 12, { characterSpacing: 1.6, lineBreak: false });
  let ty = y + 12 + 14;
  lines.forEach((l, i) => {
    doc.font(B.font).fontSize(8).fillColor(B.ink).text(l.t, boxX + 12, ty, { width: textW });
    ty += heights[i] + 4;
  });

  // Totales (columna derecha)
  const px = 318;
  let ry = y;
  rows.forEach(([label, value]) => {
    pill(doc, px, ry, B.X1 - px, smallH, { stroke: B.line });
    doc.font(B.font).fontSize(7.5).fillColor(B.ink);
    doc.text(label, px + 16, capY(ry, smallH, 7.5), { characterSpacing: 1.8, lineBreak: false });
    doc.font(B.font).fontSize(9.5).fillColor(B.ink);
    doc.text(value, NUM_RIGHT - 120, capY(ry, smallH, 9.5), { width: 120, align: 'right', lineBreak: false });
    ry += smallH + gap;
  });
  ry += 2;

  doc.font(B.bold).fontSize(13);
  const vw = doc.widthOfString(d.total);
  const limeW = Math.max(130, vw + 36);
  const limeX = B.X1 - limeW;
  doc.font(B.font).fontSize(7.5);
  pill(doc, px, ry, limeX + limeW / 2 - px, bigH, { stroke: B.line });
  doc.fillColor(B.ink).text('TOTAL CLP', px + 16, capY(ry, bigH, 7.5), { characterSpacing: 1.8, lineBreak: false });
  pill(doc, limeX, ry, limeW, bigH, { fill: B.lime });
  doc.font(B.bold).fontSize(13).fillColor(B.ink);
  doc.text(d.total, NUM_RIGHT - 140, capY(ry, bigH, 13), { width: 140, align: 'right', lineBreak: false });
}

/**
 * @param doc PDFDocument creado con COT_DOC_OPTIONS (ya conectado a su destino)
 * @param d {
 *   empresa: { rut, giro, direccion },
 *   ejecutiva: { nombre, cargo, email },
 *   numero, emision, vencimiento, impresion,
 *   cliente, rutCliente?, contactoCliente?, proyecto, descripcion?,
 *   grupos: [{ nombre, subtotal, rows: [{ num, desc, cant, unit, sub }] }],
 *   subtotalNeto, comision?: { label, value }, totalNeto, iva, total,
 *   condiciones, validezDias, fechaInicio?, fechaTermino?
 * } (montos y fechas ya formateados como texto)
 */
export function renderCotizacion(doc, d) {
  drawChrome(doc, bandOf(d));
  doc.on('pageAdded', () => drawChrome(doc, bandOf(d)));

  let y = drawFirstPageHead(doc, d);

  const grupos = d.grupos.filter(g => g.rows.length > 0);
  if (grupos.length) {
    y = drawTableHeader(doc, y);
    grupos.forEach((g, gi) => {
      const label = `${gi + 1}. ${g.nombre || 'Sin nombre'}`;
      const firstH = rowHeight(doc, g.rows[0]);
      // La banda nunca queda sola al final de una página: va con su primer ítem.
      if (y + BAND_H + 3 + firstH > B.bottom) {
        doc.addPage();
        y = drawTableHeader(doc, B.contentTop);
      }
      y = drawBand(doc, y, label, g.subtotal);
      g.rows.forEach(row => {
        const h = rowHeight(doc, row);
        if (y + h > B.bottom) {
          doc.addPage();
          y = drawTableHeader(doc, B.contentTop);
          y = drawBand(doc, y, `${label} (continuación)`, null);
        }
        drawRow(doc, row, y, h);
        y += h;
      });
      y += 5;
    });
  }

  drawClosing(doc, y + 10, d);
  numberPagesAndEnd(doc);
}
