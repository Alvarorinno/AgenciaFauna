import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  color?: string;
  // Usado en el Dashboard General: con 7 cuadros en la fila (antes 6) se ven
  // recargados con el tamaño original — compact reduce padding y tipografía
  // sin tocar las demás vistas que usan StatCard (ej. Dashboard por línea).
  compact?: boolean;
}

export default function StatCard({ label, value, color = '#12192b', compact = false }: Props) {
  return (
    <div
      className="bg-white"
      style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: compact ? '14px 16px' : '20px 22px' }}
    >
      <p style={{ fontSize: compact ? 12 : 13.5, color: '#5b5f6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </p>
      <div className="mt-2 font-bold" style={{ fontSize: compact ? 22 : 32, color }}>
        {value}
      </div>
    </div>
  );
}
