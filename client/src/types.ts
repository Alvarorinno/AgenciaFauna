export type Role = 'encargado' | 'finanzas' | 'todos';

export type LineaNegocio = 'fauna_rd' | 'agencia';

export type EstadoPago = 'pagado' | 'saldo' | 'na';

export type EstadoCotizacion = 'pendiente' | 'aprobado' | 'rechazado';

export type TipoIngreso = 'fee' | 'variable';

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
  // Gestión de Proveedores: factura del proveedor y sus abonos/pagos, a nivel de
  // grupo (una factura + abonos cubren todo el itemizado de este proveedor) —
  // solo relevante una vez que la cotización pasa a evento/aprobada.
  factura_proveedor: string;
  abono1: number;
  abono2: number;
  editing?: boolean;
}

export interface Cotizacion {
  id: number;
  n_cot: number;
  mes: string;
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
  tipo_ingreso: TipoIngreso;
  created_at: string;
  updated_at: string;
  editing?: boolean;
  grupos: CotizacionGrupo[];
  tiene_detalle: boolean;
  linea_negocio: LineaNegocio;
}

// Directorio maestro de proveedores del negocio (transversal a ambas líneas de
// negocio, no ligado a una cotización puntual — ver server/routes/proveedores.js).
// datos_empresa y cuenta son texto libre porque la fuente histórica mezcla
// razón social/RUT/giro/dirección o banco/cuenta/RUT en un solo bloque.
export interface Proveedor {
  id: number;
  nombre: string;
  nombre_contacto: string;
  datos_empresa: string;
  cuenta: string;
  servicios: string;
  created_at: string;
  updated_at: string;
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
  ventasFee: number;
  ventasVariable: number;
}

export interface ClienteAgg {
  cliente: string;
  ventas: number;
  utilidad: number;
}

export interface ClienteMonto {
  cliente: string;
  monto: number;
}

export interface LineaStats {
  totalCotizado: number;
  totalUtilidad: number;
  comisionAgencia: number;
  saldoPorFacturar: number;
  eventos: number;
  cotizacionesARevisar: number;
}

export interface Stats {
  totalCotizado: number;
  totalUtilidad: number;
  totalComisionAgencia: number;
  pctUtilidadPromedio: number;
  saldoPorFacturar: number;
  totalEventos: number;
  totalCotizacionesARevisar: number;
  ventasPorMes: MesVentas[];
  ventasPorCliente: ClienteAgg[];
  utilidadPorCliente: ClienteAgg[];
  clientesSinFacturar: ClienteMonto[];
  facturacionPorEstado: Record<EstadoPago, { count: number; monto: number }>;
  cotizacionesPorTipoIngreso: Record<TipoIngreso, { count: number; monto: number }>;
  porLinea: Record<LineaNegocio, LineaStats>;
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
