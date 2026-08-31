import type { LineaNegocio } from './types';

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
