// Base visual compartida por los PDFs de marca (Orden de Compra y Cotización):
// colores, tipografías, encabezado de marca (logo, lema, datos de la empresa),
// pie de página y pastillas. Cada documento (ocPdf.js, cotPdf.js) pone encima
// su propio contenido.
//
// Los documentos se crean con margen 0 y todo se posiciona en coordenadas
// absolutas: con márgenes normales PDFKit salta de página solo al dibujar texto
// cerca del borde inferior, y el pie de página (Página X de Y) vive justo ahí.
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
// Tipografía de marca (Geomanist). Hoy solo tenemos el peso Regular: la negrita
// se simula con un trazo fino (ver setupBrandFonts). Cuando llegue la versión
// Medium/Bold basta registrarla en lugar del trazo. El archivo vive en
// server/assets/fonts/ (ignorado por git, ver .gitignore).
const FONT_PATH = path.join(ASSETS, 'fonts/Geomanist-Regular.otf');

export const DOC_OPTIONS = { size: 'A4', margin: 0, bufferPages: true };

export const B = {
  X0: 34,
  X1: 561,
  W: 527,
  lime: '#B4FB00',
  tint: '#F3FCE9',
  head: '#F1F1F3',
  line: '#C6C6C6',
  ink: '#0d0d0d',
  sub: '#444444',
  // Nombres de las tipografías registradas en setupBrandFonts().
  font: 'Brand',
  bold: 'BrandBold',
  contentTop: 130, // inicio del contenido en páginas de continuación
  bottom: 750 // límite inferior del contenido (el pie ocupa desde ~775)
};

// Y del texto para que las mayúsculas queden centradas verticalmente en una caja
// de alto h que empieza en `top` (la línea base de Helvetica queda a 0.718·size).
export const capY = (top, h, size) => top + (h - 0.718 * size) / 2;

export function pill(doc, x, y, w, h, { fill, stroke } = {}) {
  doc.roundedRect(x, y, w, h, h / 2);
  if (fill && stroke) doc.fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else if (stroke) doc.lineWidth(1).stroke(stroke);
}

// Línea con un círculo hueco al final (motivo decorativo del diseño).
function lineWithDot(doc, x1, x2, y) {
  doc.lineWidth(0.7).strokeColor(B.ink).moveTo(x1, y).lineTo(x2, y).stroke();
  doc.lineWidth(0.7).circle(x2 + 3.5, y, 3.5).fillAndStroke('#ffffff', B.ink);
}

/**
 * Registra la tipografía de marca en el documento. Llamar una vez, antes de dibujar.
 *
 * Negrita simulada: la fuente solo viene en Regular, así que cuando la fuente activa
 * es B.bold el texto se dibuja con relleno + un trazo fino del mismo color (el grosor
 * crece con el tamaño). Para eso se envuelven doc.font / doc.fillColor / doc.text.
 */
export function setupBrandFonts(doc) {
  // Sin el archivo de la fuente (no está en el repositorio mientras éste sea
  // público: es una fuente comercial) se usa Helvetica con su negrita real.
  if (!existsSync(FONT_PATH)) {
    doc.registerFont(B.font, 'Helvetica');
    doc.registerFont(B.bold, 'Helvetica-Bold');
    return;
  }
  doc.registerFont(B.font, FONT_PATH);
  doc.registerFont(B.bold, FONT_PATH);

  const font = doc.font.bind(doc);
  const fillColor = doc.fillColor.bind(doc);
  const text = doc.text.bind(doc);
  let faux = false;
  let fill = '#000000';

  doc.font = (name, ...rest) => {
    faux = name === B.bold;
    return font(name, ...rest);
  };
  doc.fillColor = (color, ...rest) => {
    fill = color;
    return fillColor(color, ...rest);
  };
  doc.text = (str, x, y, opts) => {
    if (!faux) return text(str, x, y, opts);
    doc.strokeColor(fill).lineWidth(Math.max(0.08, doc._fontSize * 0.026));
    return text(str, x, y, { ...(opts || {}), fill: true, stroke: true });
  };
}

/**
 * Elementos fijos de cada página: gráficos, encabezado de marca y pie. Se dibujan
 * al crear la página (quedan debajo del contenido); el "Página X de Y" se agrega
 * al final con numberPages(), cuando ya se sabe el total de páginas.
 *
 * @param band { lines: string[], size?: number, step?: number } — texto a la
 *   derecha del divisor vertical; la primera línea va en negrita.
 */
export function drawChrome(doc, band) {
  const pw = doc.page.width;
  const ph = doc.page.height;

  // Las moléculas sangran: se ubican parcialmente fuera de la hoja y PDFKit recorta
  // lo que queda fuera de la página.
  if (existsSync(DECOR_TOP_RIGHT)) {
    doc.image(DECOR_TOP_RIGHT, pw - 128, -26, { width: 150 });
  }
  if (existsSync(DECOR_BOTTOM_LEFT)) {
    doc.image(DECOR_BOTTOM_LEFT, -40, ph - 188, { width: 176 });
  }

  // --- Encabezado de marca ---
  const logoW = 170;
  const logo = doc.openImage(LOGO_PATH);
  const logoH = logoW * (logo.height / logo.width);
  doc.image(LOGO_PATH, B.X0, 38, { width: logoW });
  const lema = 'IDEAS  QUE  VIVEN';
  const lemaY = 38 + logoH + 9;
  doc.font(B.font).fontSize(5.5).fillColor(B.ink);
  doc.text(lema, B.X0 + 12, lemaY, { characterSpacing: 3.2, lineBreak: false });
  const lemaW = doc.widthOfString(lema, { characterSpacing: 3.2 });
  doc.circle(B.X0 + 12 + lemaW + 10, lemaY + 2.6, 2).fill(B.lime);

  doc.font(B.font).fontSize(5.2).fillColor(B.ink);
  ['CREATIVIDAD', 'CIENCIA', 'NATURALEZA', 'MARCAS'].forEach((t, i) => {
    doc.text(t, 245, 66 + i * 8.2, { characterSpacing: 2.6, lineBreak: false });
  });
  lineWithDot(doc, 245, 338, 103);

  doc.lineWidth(0.8).strokeColor(B.ink).moveTo(362, 58).lineTo(362, 114).stroke();

  const size = band.size ?? 8.5;
  const step = band.step ?? 11.5;
  band.lines.forEach((t, i) => {
    doc.font(i === 0 ? B.bold : B.font).fontSize(size).fillColor(B.ink);
    doc.text(t, 374, (band.top ?? 64) + step * i, { lineBreak: false });
  });

  // --- Pie de página ---
  doc.font(B.font).fontSize(5.2).fillColor(B.ink);
  ['SISTEMAS VIVOS', 'PARA MARCAS', 'QUE CRECEN'].forEach((t, i) => {
    doc.text(t, 151, 779 + i * 8.2, { characterSpacing: 2.4, lineBreak: false });
  });
  lineWithDot(doc, 151, 246, 806);
  doc.lineWidth(0.7).strokeColor(B.ink).moveTo(276, 805).lineTo(430, 805).stroke();
}

function drawPageNumber(doc, n, total) {
  doc.font(B.font).fontSize(8.5).fillColor(B.sub);
  doc.text(`Página ${n} de ${total}`, 440, 799, { width: 103, align: 'right', lineBreak: false });
  // círculo con flecha ">" (motivo del diseño)
  const cx = 559;
  const cy = 803;
  doc.lineWidth(1.2).circle(cx, cy, 10).stroke(B.lime);
  doc.lineWidth(1.2).strokeColor(B.lime).moveTo(cx - 2, cy - 4).lineTo(cx + 2.5, cy).lineTo(cx - 2, cy + 4).stroke();
}

// Agrega "Página X de Y" a todas las páginas (requiere bufferPages) y cierra el
// documento.
export function numberPagesAndEnd(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    drawPageNumber(doc, i + 1, count);
  }
  doc.end();
}
