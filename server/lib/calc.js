import { sql } from '../db.js';

// Cálculos derivados compartidos entre routes/cotizaciones.js y routes/detalle.js.
// Se calculan siempre en el servidor (nunca se confía en lo que mande el cliente).

export function withDerived(row) {
  const costoCliente = Number(row.costo_cliente) || 0;
  const costoReal = Number(row.costo_real) || 0;
  const utilidad = costoCliente - costoReal;
  const pctUtilidad = costoCliente === 0 ? 0 : Math.round((utilidad / costoCliente) * 1000) / 10;
  return { ...row, costo_cliente: costoCliente, costo_real: costoReal, utilidad, pct_utilidad: pctUtilidad };
}

export function withItemDerived(it) {
  const cantidad = Number(it.cantidad) || 0;
  const unitarioCliente = Number(it.unitario_cliente) || 0;
  const unitarioCosto = Number(it.unitario_costo) || 0;
  const subtotalCliente = cantidad * unitarioCliente;
  const subtotalCosto = cantidad * unitarioCosto;
  const utilidad = subtotalCliente - subtotalCosto;
  const pctUtilidad = subtotalCliente === 0 ? 0 : Math.round((utilidad / subtotalCliente) * 1000) / 10;
  return {
    ...it,
    cantidad,
    unitario_cliente: unitarioCliente,
    unitario_costo: unitarioCosto,
    subtotal_cliente: subtotalCliente,
    subtotal_costo: subtotalCosto,
    utilidad,
    pct_utilidad: pctUtilidad
  };
}

export function withGrupoDerived(g, items) {
  const subtotalCliente = items.reduce((s, i) => s + i.subtotal_cliente, 0);
  const subtotalCosto = items.reduce((s, i) => s + i.subtotal_costo, 0);
  const utilidad = subtotalCliente - subtotalCosto;
  const pctUtilidad = subtotalCliente === 0 ? 0 : Math.round((utilidad / subtotalCliente) * 1000) / 10;
  return {
    ...g,
    items,
    subtotal_cliente: subtotalCliente,
    subtotal_costo: subtotalCosto,
    utilidad,
    pct_utilidad: pctUtilidad,
    // Gestión de Proveedores: factura del proveedor y sus abonos/pagos son a nivel
    // de grupo (una factura + abonos cubren todo el itemizado de este proveedor),
    // no por ítem — solo relevante una vez que la cotización pasa a evento/aprobada.
    factura_proveedor: g.factura_proveedor ?? '',
    abono1: Number(g.abono1) || 0,
    abono2: Number(g.abono2) || 0
  };
}

// Dado lo que ya suman los ítems al cliente (subtotal, antes de comisión),
// calcula el monto de "Comisión Agencia" a sumar.
//
// Para línea "agencia": la comisión se suma como un costo plano sobre el
// subtotal (comisión = subtotal * pct), igual que cualquier otro ítem de
// costo — no se "engorda" el precio para que la comisión termine siendo el
// pct% del total final.
//   Ej: subtotal 20.000.010, comisionPct 10 → comisión = 2.000.001
//
// Para línea "fauna_rd" (y cualquier otra): se mantiene el cálculo histórico,
// donde comisionPct representa el % de utilidad del negocio deseado sobre el
// total final (subtotal + comisión) — no sobre el costo real de los
// proveedores.
//   Ej: subtotal 10.000, comisionPct 10
//     → precio objetivo = 10.000 / (1 - 0.10) = 11.111
//     → comisión = 11.111 - 10.000 = 1.111
// Con pct entre 0 y 100 (exclusivo) el resultado siempre es >= 0: nunca se
// resta lo que el encargado ya cotizó, solo se suma la comisión adicional.
export function calcComisionMonto(costoClienteBase, comisionPct, lineaNegocio) {
  const pct = Number(comisionPct) || 0;
  if (pct <= 0 || pct >= 100) return 0;

  if (lineaNegocio === 'agencia') {
    const monto = costoClienteBase * (pct / 100);
    return Math.round(monto * 100) / 100;
  }

  const precioObjetivo = costoClienteBase / (1 - pct / 100);
  const monto = Math.max(0, precioObjetivo - costoClienteBase);
  return Math.round(monto * 100) / 100;
}

// Recalcula costo_cliente (suma de lo verde/cliente + comisión de agencia) y
// costo_real (suma de lo celeste/costo) de una cotización a partir de todos
// los ítems de todos sus grupos de proveedores.
// Si la cotización no tiene ningún grupo (sin detalle cargado), no toca los
// totales: siguen siendo editables a mano como antes de este upgrade.
export async function recomputeTotales(cotizacionId) {
  const items = await sql`
    SELECT i.cantidad, i.unitario_cliente, i.unitario_costo
    FROM cotizacion_items i
    JOIN cotizacion_grupos g ON g.id = i.grupo_id
    WHERE g.cotizacion_id = ${cotizacionId}
  `;
  if (items.length === 0) return;

  let costoClienteBase = 0;
  let costoReal = 0;
  for (const it of items) {
    const cantidad = Number(it.cantidad) || 0;
    costoClienteBase += cantidad * (Number(it.unitario_cliente) || 0);
    costoReal += cantidad * (Number(it.unitario_costo) || 0);
  }

  const [{ comision_pct: comisionPctRaw, linea_negocio: lineaNegocio }] = await sql`SELECT comision_pct, linea_negocio FROM cotizaciones WHERE id = ${cotizacionId}`;
  const comisionMonto = calcComisionMonto(costoClienteBase, comisionPctRaw, lineaNegocio);
  const costoCliente = costoClienteBase + comisionMonto;

  await sql`
    UPDATE cotizaciones
    SET costo_cliente = ${costoCliente}, costo_real = ${costoReal}, comision_monto = ${comisionMonto}, updated_at = now()
    WHERE id = ${cotizacionId}
  `;
}
