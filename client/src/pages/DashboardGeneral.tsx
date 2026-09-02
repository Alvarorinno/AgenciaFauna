import { useEffect, useState } from 'react';
import { getStats } from '../api';
import type { Stats } from '../types';
import StatCard from '../components/StatCard';
import BarList from '../components/BarList';
import ColumnChart from '../components/ColumnChart';
import PieChart from '../components/PieChart';
import BarLineChart from '../components/BarLineChart';
import { formatCLP, formatCLPCompact, capitalize, FEE_VARIABLE_COLORS } from '../utils';

const LINEA_LABELS = { fauna_rd: 'Fauna RD', agencia: 'Agencia' } as const;

export default function DashboardGeneral() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setStats(null);
    getStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) {
    return <p style={{ color: '#5b5f6b' }}>Cargando dashboard…</p>;
  }

  const estados = stats.facturacionPorEstado;
  const lineas = (Object.keys(LINEA_LABELS) as (keyof typeof LINEA_LABELS)[]);

  // % utilidad promedio por línea (misma fórmula que el backend usa para el
  // consolidado: utilidad / vendido), para el cuadro que las desglosa.
  const pctPorLinea = (l: keyof typeof LINEA_LABELS) => {
    const d = stats.porLinea[l];
    if (!d || !d.totalCotizado) return 0;
    return (d.totalUtilidad / d.totalCotizado) * 100;
  };

  // Los datos del dashboard no están acotados por año en la base (el campo `mes`
  // es solo el nombre del mes) — se muestra el año en curso en cada título para
  // dejar explícito el período que se está viendo (igual que en el Dashboard por línea).
  const anio = new Date().getFullYear();
  const conAnio = (titulo: string) => `${titulo} Año ${anio}`;

  return (
    <div>
      <h1 className="title-serif font-semibold" style={{ fontSize: 24, color: '#12192b' }}>Dashboard General</h1>
      <p className="mb-6" style={{ fontSize: 13.5, color: '#5b5f6b' }}>
        Resumen consolidado de Fauna RD y Agencia · Solo lectura
      </p>

      <div
        className="grid mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}
      >
        <StatCard compact label="Total Vendido" value={formatCLPCompact(stats.totalCotizado)} />
        <StatCard compact label="Total Utilidad" value={formatCLPCompact(stats.totalUtilidad)} color="#1f7a4d" />
        <StatCard compact label="% Utilidad Promedio" value={`${stats.pctUtilidadPromedio.toFixed(1)}%`} />
        <StatCard
          compact
          label="% Utilidad Promedio"
          value={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 15 }}>
              <span>RD: {pctPorLinea('fauna_rd').toFixed(1)}%</span>
              <span>Agencia: {pctPorLinea('agencia').toFixed(1)}%</span>
            </div>
          }
        />
        <StatCard compact label="Saldo por Facturar" value={formatCLPCompact(stats.saldoPorFacturar)} color="#8a6a1f" />
        <StatCard compact label="Proyectos" value={String(stats.totalEventos)} />
        <StatCard compact label="Cotizaciones a Revisar" value={String(stats.totalCotizacionesARevisar)} color="#8a6a1f" />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BarList
          title={conAnio('Ventas por Línea de Negocio')}
          items={lineas.map(l => ({
            label: LINEA_LABELS[l],
            value: stats.porLinea[l]?.totalCotizado ?? 0,
            displayValue: formatCLP(stats.porLinea[l]?.totalCotizado ?? 0)
          }))}
          trackColor="#efe9df"
          fillColor="#c8a24a"
        />
        <BarList
          title={conAnio('Utilidad por Línea de Negocio')}
          items={lineas.map(l => ({
            label: LINEA_LABELS[l],
            value: stats.porLinea[l]?.totalUtilidad ?? 0,
            displayValue: formatCLP(stats.porLinea[l]?.totalUtilidad ?? 0)
          }))}
          trackColor="#eaf3ec"
          fillColor="#1f7a4d"
          valueColor="#1f7a4d"
        />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ColumnChart
          title={conAnio('Ventas por Mes')}
          items={stats.ventasPorMes.map(m => ({
            label: capitalize(m.mes),
            displayValue: formatCLP(m.ventas),
            segments: [
              { value: m.ventasFee, color: FEE_VARIABLE_COLORS.fee },
              { value: m.ventasVariable, color: FEE_VARIABLE_COLORS.variable }
            ]
          }))}
          trackColor="#efe9df"
          legend={[
            { label: 'Fee', color: FEE_VARIABLE_COLORS.fee },
            { label: 'Variable', color: FEE_VARIABLE_COLORS.variable }
          ]}
        />
        <BarList
          title={conAnio('Ventas por Cliente')}
          items={stats.ventasPorCliente.map(c => ({ label: c.cliente, value: c.ventas, displayValue: formatCLP(c.ventas) }))}
          trackColor="#efe9df"
          fillColor="#c8a24a"
        />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BarList
          title={conAnio('Utilidad por Cliente')}
          items={stats.utilidadPorCliente.map(c => ({ label: c.cliente, value: c.utilidad, displayValue: formatCLP(c.utilidad) }))}
          trackColor="#eaf3ec"
          fillColor="#1f7a4d"
          valueColor="#1f7a4d"
        />

        <div className="bg-white" style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}>
          <h3 className="title-serif font-semibold mb-4" style={{ fontSize: 16, color: '#12192b' }}>{conAnio('Facturación por Estado')}</h3>
          <div className="space-y-3">
            <EstadoRow dot="#1f7a4d" label="Pagado" count={estados.pagado?.count ?? 0} monto={estados.pagado?.monto ?? 0} />
            <EstadoRow dot="#c8a24a" label="Saldo x Facturar" count={estados.saldo?.count ?? 0} monto={estados.saldo?.monto ?? 0} />
            <EstadoRow dot="#c3c7c2" label="Sin aplicar" count={estados.na?.count ?? 0} monto={estados.na?.monto ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid mt-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <BarLineChart
          title={conAnio('Presupuesto vs Costos por Mes')}
          items={stats.ventasPorMes.map(m => ({
            label: capitalize(m.mes).slice(0, 3),
            bars: [
              { value: m.ventas, color: '#c8a24a' },
              { value: m.costoReal, color: '#6d2632' }
            ],
            lineValue: m.ventas === 0 ? 0 : Math.round(((m.ventas - m.costoReal) / m.ventas) * 1000) / 10
          }))}
          legend={[
            { label: 'Presupuesto', color: '#c8a24a' },
            { label: 'Costos', color: '#6d2632' },
            { label: 'Margen Bruto', color: '#1f7a4d', dashed: true }
          ]}
          formatBarValue={formatCLP}
          formatLineValue={v => `${v.toFixed(1)}%`}
        />
        <PieChart
          title={conAnio('Clientes sin Facturar')}
          items={stats.clientesSinFacturar.map(c => ({ label: c.cliente, value: c.monto, displayValue: formatCLP(c.monto) }))}
        />
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
