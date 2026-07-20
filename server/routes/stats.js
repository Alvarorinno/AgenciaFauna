import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

router.get('/', async (req, res) => {
  const linea = typeof req.query.linea === 'string' ? req.query.linea : null;
  const rows = linea
    ? await sql`SELECT * FROM cotizaciones WHERE estado_cotizacion = 'aprobado' AND linea_negocio = ${linea}`
    : await sql`SELECT * FROM cotizaciones WHERE estado_cotizacion = 'aprobado'`;

  let totalCotizado = 0;
  let totalUtilidad = 0;
  let saldoPorFacturar = 0;
  const porMes = {};
  const porCliente = {};
  const porEstado = { pagado: { count: 0, monto: 0 }, saldo: { count: 0, monto: 0 }, na: { count: 0, monto: 0 } };
  const porLinea = {
    fauna_rd: { totalCotizado: 0, totalUtilidad: 0, saldoPorFacturar: 0 },
    agencia: { totalCotizado: 0, totalUtilidad: 0, saldoPorFacturar: 0 }
  };

  for (const r of rows) {
    const costoCliente = Number(r.costo_cliente) || 0;
    const costoReal = Number(r.costo_real) || 0;
    const utilidad = costoCliente - costoReal;

    totalCotizado += costoCliente;
    totalUtilidad += utilidad;
    if (r.estado_pago === 'saldo') saldoPorFacturar += costoCliente;

    if (porLinea[r.linea_negocio]) {
      porLinea[r.linea_negocio].totalCotizado += costoCliente;
      porLinea[r.linea_negocio].totalUtilidad += utilidad;
      if (r.estado_pago === 'saldo') porLinea[r.linea_negocio].saldoPorFacturar += costoCliente;
    }

    if (r.mes) {
      if (!porMes[r.mes]) porMes[r.mes] = { mes: r.mes, ventas: 0 };
      porMes[r.mes].ventas += costoCliente;
    }

    if (r.cliente) {
      if (!porCliente[r.cliente]) porCliente[r.cliente] = { cliente: r.cliente, ventas: 0, utilidad: 0 };
      porCliente[r.cliente].ventas += costoCliente;
      porCliente[r.cliente].utilidad += utilidad;
    }

    const estado = r.estado_pago || 'na';
    if (porEstado[estado]) {
      porEstado[estado].count += 1;
      porEstado[estado].monto += costoCliente;
    }
  }

  const pctUtilidadPromedio = totalCotizado === 0 ? 0 : Math.round((totalUtilidad / totalCotizado) * 1000) / 10;

  const ventasPorMes = MESES
    .filter(m => porMes[m])
    .map(m => porMes[m]);

  const clientesArr = Object.values(porCliente);
  const ventasPorCliente = [...clientesArr].sort((a, b) => b.ventas - a.ventas).slice(0, 6);
  const utilidadPorCliente = [...clientesArr].sort((a, b) => b.utilidad - a.utilidad).slice(0, 6);

  res.json({
    totalCotizado,
    totalUtilidad,
    pctUtilidadPromedio,
    saldoPorFacturar,
    ventasPorMes,
    ventasPorCliente,
    utilidadPorCliente,
    facturacionPorEstado: porEstado,
    porLinea
  });
});

export default router;
