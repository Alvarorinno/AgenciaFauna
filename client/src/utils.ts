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

// Un color distinto por mes para el gráfico "Ventas por Mes" (paleta acorde a la
// estética del sitio: dorados, verdes, azules, tierras). El monto de cada barra
// sigue siendo el total del mes (fee + variable sumados), no cambia por esto.
export const MES_COLORS: Record<string, string> = {
  enero: '#c8a24a',
  febrero: '#8a6a1f',
  marzo: '#1f7a4d',
  abril: '#2c6e7a',
  mayo: '#2c4a7c',
  junio: '#5b4a9c',
  julio: '#8a3f6c',
  agosto: '#a65d3f',
  septiembre: '#b0473f',
  octubre: '#6b8a3f',
  noviembre: '#4f7a5f',
  diciembre: '#8a8f3f'
};
