import type { LineaNegocio, Proveedor } from './types';

export function formatCLP(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}

// Formato compacto para KPIs: desde $1.000.000 se muestra en millones (ej.
// $221,2 MM) para que los resúmenes se lean de un vistazo; por debajo de esa
// cifra se mantiene el formato completo, donde "MM" resultaría confuso o
// perdería precisión (ej. $500.000 no se acorta a $0,5 MM).
export function formatCLPCompact(n: number): string {
  const v = Math.round(n || 0);
  if (Math.abs(v) < 1_000_000) return formatCLP(v);
  return '$' + (v / 1_000_000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MM';
}

// Normaliza texto para búsquedas "contains" insensibles a mayúsculas y tildes
// (ej. buscar "fauna" debe encontrar "FAUNA RD", y "gomez" debe encontrar "Gómez").
export function searchNormalize(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Prefijo visual para distinguir de un vistazo a qué línea de negocio pertenece
// una cotización (ambas comparten la misma numeración global de n_cot, así que
// esto es puramente de presentación, no cambia el número subyacente).
export function lineaPrefix(linea: LineaNegocio): string {
  return linea === 'agencia' ? 'AF' : 'RD';
}

export function formatNCot(nCot: number | string, linea: LineaNegocio): string {
  return `${lineaPrefix(linea)}-${nCot}`;
}

// Número de Orden de Compra de un grupo/proveedor dentro de una cotización:
// mismo criterio que el PDF de OC (ver routes/detalle.js pdf-oc) — el
// correlativo es la posición del proveedor dentro de la cotización (1er grupo
// agregado = 001, 2do = 002, etc., según su columna `orden`).
export function formatOc(nCot: number | string, linea: LineaNegocio, orden: number): string {
  const correlativo = String((Number(orden) || 0) + 1).padStart(3, '0');
  return `${formatNCot(nCot, linea)}-${correlativo}`;
}

// Colores para diferenciar Fee vs Variable en gráficos (ej. Ventas por Mes apilado).
export const FEE_VARIABLE_COLORS = { fee: '#2c4a7c', variable: '#c8a24a' } as const;

// El directorio maestro de Proveedores (ver server/db.js) NO tiene un campo RUT
// dedicado: datos_empresa/cuenta son texto libre (la planilla histórica mezcla
// razón social/RUT/giro/dirección en un solo bloque, sin estructura consistente).
// Para autocompletar el RUT al elegir un proveedor desde el detalle de una
// cotización, se extrae con una heurística: busca un patrón de RUT chileno
// (6 a 8 dígitos, puntos opcionales, guion, dígito verificador o "K") primero en
// datos_empresa y si no aparece ahí, en cuenta. Es best-effort — si el texto no
// sigue el patrón esperado, no encuentra nada y el campo queda vacío para que se
// complete a mano, igual que antes de tener este autocompletado.
const RUT_PATTERN = /(\d{1,2}\.?\d{3}\.?\d{3})\s*-\s*([\dkK])\b/;

function findRut(text: string): string {
  const match = (text || '').match(RUT_PATTERN);
  return match ? `${match[1]}-${match[2].toUpperCase()}` : '';
}

export function extractRut(proveedor: Proveedor): string {
  return findRut(proveedor.datos_empresa) || findRut(proveedor.cuenta);
}
