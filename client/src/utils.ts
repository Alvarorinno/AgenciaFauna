export function formatCLP(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
