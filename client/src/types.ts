export type Role = 'encargado' | 'finanzas' | 'todos';

export type EstadoPago = 'pagado' | 'saldo' | 'na';

export interface Cotizacion {
  id: number;
  n_cot: number;
  mes: string;
  a_cargo: string;
  cliente: string;
  proyecto: string;
  descripcion: string;
  costo_cliente: number;
  costo_real: number;
  utilidad: number;
  pct_utilidad: number;
  factura: string | null;
  fecha_factura: string | null;
  mes_factura: string | null;
  estado_pago: EstadoPago;
  created_at: string;
  updated_at: string;
  editing?: boolean;
}

export interface User {
  id: number;
  username: string;
  role: Role;
  nombre: string;
}

export interface MesVentas {
  mes: string;
  ventas: number;
}

export interface ClienteAgg {
  cliente: string;
  ventas: number;
  utilidad: number;
}

export interface Stats {
  totalCotizado: number;
  totalUtilidad: number;
  pctUtilidadPromedio: number;
  saldoPorFacturar: number;
  ventasPorMes: MesVentas[];
  ventasPorCliente: ClienteAgg[];
  utilidadPorCliente: ClienteAgg[];
  facturacionPorEstado: Record<EstadoPago, { count: number; monto: number }>;
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
