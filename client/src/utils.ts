import type { LineaNegocio } from './types';

export function formatCLP(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
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
