export type Role = 'encargado' | 'finanzas' | 'todos';

export type LineaNegocio = 'fauna_rd' | 'agencia';

export type EstadoPago = 'pagado' | 'saldo' | 'na';

export type EstadoCotizacion = 'pendiente' | 'aprobado' | 'rechazado';

// Ítem de detalle dentro de un grupo/proveedor (una línea: cantidad, unidad, días, precios).
export interface CotizacionItem {
  id: number;
  grupo_id: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  dias: number;
  unitario_cliente: number;
  unitario_costo: number;
  subtotal_cliente: number;
  subtotal_costo: number;
  utilidad: number;
  pct_utilidad: number;
  orden: number;
  editing?: boolean;
}

// Grupo/partida de proveedor (ej. "ADHESIVO SERVICIO TÉCNICO") con sus ítems.
export interface CotizacionGrupo {
  id: number;
  cotizacion_id: number;
  nombre: string;
  proveedor: string;
  rut_proveedor: string;
  orden: number;
  items: CotizacionItem[];
  subtotal_cliente: number;
  subtotal_costo: number;
  utilidad: number;
  pct_utilidad: number;
  editing?: boolean;
}

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
  comision_pct: number;
  comision_monto: number;
  utilidad: number;
  pct_utilidad: number;
  factura: string | null;
  fecha_factura: string | null;
  mes_factura: string | null;
  estado_pago: EstadoPago;
  estado_cotizacion: EstadoCotizacion;
  created_at: string;
  updated_at: string;
  editing?: boolean;
  grupos: CotizacionGrupo[];
  tiene_detalle: boolean;
  linea_negocio: LineaNegocio;
}

export interface User {
  id: number;
  username: string;
  role: Role;
  nombre: string;
  linea_negocio: LineaNegocio | null;
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

export interface LineaStats {
  totalCotizado: number;
  totalUtilidad: number;
  saldoPorFacturar: number;
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
  porLinea: Record<LineaNegocio, LineaStats>;
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
