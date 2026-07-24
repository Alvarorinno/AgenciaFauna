import { useEffect, useState } from 'react';
import { getStats } from '../api';
import type { Stats, LineaNegocio } from '../types';
import StatCard from '../components/StatCard';
import BarList from '../components/BarList';
import ColumnChart from '../components/ColumnChart';
import { formatCLP, capitalize } from '../utils';

const LINEA_LABELS: Record<LineaNegocio, string> = { fauna_rd: 'Fauna RD', agencia: 'Agencia' };

export default function Dashboard({ linea }: { linea: LineaNegocio }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setStats(null);
    getStats(linea).then(setStats).catch(() => setStats(null));
  }, [linea]);

  if (!stats) {
    return <p style={{ color: '#5b5f6b' }}>Cargando dashboard…</p>;
  }

  const estados = stats.facturacionPorEstado;

  return (
    <div>
      <h1 className="title-serif font-semibold" style={{ fontSize: 24, color: '#12192b' }}>Dashboard — {LINEA_LABELS[linea]}</h1>
      <p className="mb-6" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Resumen general de cotizaciones y facturación
      </p>

      <div
        className="grid mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}
      >
        <StatCard label="Total Cotizado" value={formatCLP(stats.totalCotizado)} />
        <StatCard label="Total Utilidad" value={formatCLP(stats.totalUtilidad)} color="#1f7a4d" />
        <StatCard label="% Utilidad Promedio" value={`${stats.pctUtilidadPromedio.toFixed(1)}%`} />
        <StatCard label="Saldo por Facturar" value={formatCLP(stats.saldoPorFacturar)} color="#8a6a1f" />
        <StatCard label="Proyectos" value={String(stats.totalEventos)} />
        <StatCard label="Cotizaciones a Revisar" value={String(stats.totalCotizacionesARevisar)} color="#8a6a1f" />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ColumnChart
          title="Ventas por Mes"
          items={stats.ventasPorMes.map(m => ({ label: capitalize(m.mes), value: m.ventas, displayValue: formatCLP(m.ventas) }))}
          trackColor="#efe9df"
          barColor="#c8a24a"
        />
        <BarList
          title="Ventas por Cliente"
          items={stats.ventasPorCliente.map(c => ({ label: c.cliente, value: c.ventas, displayValue: formatCLP(c.ventas) }))}
          trackColor="#efe9df"
          fillColor="#c8a24a"
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BarList
          title="Utilidad por Cliente"
          items={stats.utilidadPorCliente.map(c => ({ label: c.cliente, value: c.utilidad, displayValue: formatCLP(c.utilidad) }))}
          trackColor="#eaf3ec"
          fillColor="#1f7a4d"
          valueColor="#1f7a4d"
        />

        <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
          <h3 className="title-serif font-semibold mb-4" style={{ fontSize: 16, color: '#12192b' }}>Facturación por Estado</h3>
          <div className="space-y-3">
            <EstadoRow dot="#1f7a4d" label="Pagado" count={estados.pagado?.count ?? 0} monto={estados.pagado?.monto ?? 0} />
            <EstadoRow dot="#c8a24a" label="Saldo x Facturar" count={estados.saldo?.count ?? 0} monto={estados.saldo?.monto ?? 0} />
            <EstadoRow dot="#c3c7c2" label="Sin aplicar" count={estados.na?.count ?? 0} monto={estados.na?.monto ?? 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EstadoRow({ dot, label, count, monto }: { dot: string; label: string; count: number; monto: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block' }} />
        <span style={{ fontSize: 14, color: '#12192b', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, color: '#5b5f6b' }}>
        {count} · {formatCLP(monto)}
      </span>
    </div>
  );
}
