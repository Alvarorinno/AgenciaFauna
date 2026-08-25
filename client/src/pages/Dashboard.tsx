import { useEffect, useState } from 'react';
import { getStats } from '../api';
import type { Stats, LineaNegocio } from '../types';
import StatCard from '../components/StatCard';
import BarList from '../components/BarList';
import ColumnChart from '../components/ColumnChart';
import PieChart from '../components/PieChart';
import { formatCLP, formatCLPCompact, capitalize, FEE_VARIABLE_COLORS } from '../utils';

const LINEA_LABELS: Record<LineaNegocio, string> = { fauna_rd: 'Fauna RD', agencia: 'Agencia' };

export default function Dashboard({ linea, onMonthClick }: { linea: LineaNegocio; onMonthClick?: (mes: string) => void }) {
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
        <StatCard label="Total Vendido" value={formatCLPCompact(stats.totalCotizado)} />
        <UtilidadCard totalUtilidad={stats.totalUtilidad} comisionAgencia={stats.totalComisionAgencia} />
        <StatCard label="% Utilidad Promedio" value={`${stats.pctUtilidadPromedio.toFixed(1)}%`} />
        <StatCard label="Saldo por Facturar" value={formatCLPCompact(stats.saldoPorFacturar)} color="#8a6a1f" />
        <StatCard label="Proyectos" value={String(stats.totalEventos)} />
        <StatCard label="Cotizaciones a Revisar" value={String(stats.totalCotizacionesARevisar)} color="#8a6a1f" />
      </div>

      <div className="mb-6">
        <ColumnChart
          title="Ventas por Mes"
          items={stats.ventasPorMes.map(m => ({
            label: capitalize(m.mes),
            value: m.mes,
            displayValue: formatCLP(m.ventas),
            segments: [
              { value: m.ventasFee, color: FEE_VARIABLE_COLORS.fee, displayValue: `F: ${formatCLP(m.ventasFee)}` },
              { value: m.ventasVariable, color: FEE_VARIABLE_COLORS.variable, displayValue: `V: ${formatCLP(m.ventasVariable)}` }
            ]
          }))}
          trackColor="#efe9df"
          legend={[
            { label: 'Fee', color: FEE_VARIABLE_COLORS.fee },
            { label: 'Variable', color: FEE_VARIABLE_COLORS.variable }
          ]}
          onItemClick={onMonthClick}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 0.7fr', gap: 16 }}>
        <PieChart
          title="Ventas por Cliente"
          items={stats.ventasPorCliente.map(c => ({ label: c.cliente, value: c.ventas, displayValue: formatCLP(c.ventas) }))}
        />
        <BarList
          title="Utilidad por Cliente"
          items={stats.utilidadPorCliente.map(c => ({ label: c.cliente, value: c.utilidad, displayValue: formatCLP(c.utilidad) }))}
          trackColor="#eaf3ec"
          fillColor="#1f7a4d"
          valueColor="#1f7a4d"
        />

        <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '16px 18px' }}>
          <h3 className="title-serif font-semibold mb-3" style={{ fontSize: 14.5, color: '#12192b' }}>Facturación por Estado</h3>
          <div className="space-y-2.5">
            <EstadoRow dot="#1f7a4d" label="Pagado" count={estados.pagado?.count ?? 0} monto={estados.pagado?.monto ?? 0} />
            <EstadoRow dot="#c8a24a" label="Saldo x Facturar" count={estados.saldo?.count ?? 0} monto={estados.saldo?.monto ?? 0} />
            <EstadoRow dot="#c3c7c2" label="Sin aplicar" count={estados.na?.count ?? 0} monto={estados.na?.monto ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid mt-6" style={{ gridTemplateColumns: '1fr 1fr 0.7fr', gap: 16 }}>
        <PieChart
          title="Clientes sin Facturar"
          items={stats.clientesSinFacturar.map(c => ({ label: c.cliente, value: c.monto, displayValue: formatCLP(c.monto) }))}
        />
      </div>
    </div>
  );
}

function UtilidadCard({ totalUtilidad, comisionAgencia }: { totalUtilidad: number; comisionAgencia: number }) {
  const utilidadNegocio = totalUtilidad - comisionAgencia;
  return (
    <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
      <p style={{ fontSize: 12.5, color: '#5b5f6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        Total Utilidad
      </p>
      <p className="mt-2 font-bold" style={{ fontSize: 26, color: '#1f7a4d' }}>
        {formatCLPCompact(totalUtilidad)}
      </p>
      <div className="mt-2 space-y-1" style={{ paddingTop: 8, borderTop: '1px solid #efe9df' }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: '#5b5f6b' }}>Markup</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1f7a4d' }}>{formatCLPCompact(utilidadNegocio)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: '#5b5f6b' }}>Comisión Agencia</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8a6a1f' }}>{formatCLPCompact(comisionAgencia)}</span>
        </div>
      </div>
    </div>
  );
}

function EstadoRow({ dot, label, count, monto }: { dot: string; label: string; count: number; monto: number }) {
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
        <span className="truncate" style={{ fontSize: 12.5, color: '#12192b', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, color: '#5b5f6b', paddingLeft: 16 }}>
        {count} · {formatCLP(monto)}
      </span>
    </div>
  );
}
