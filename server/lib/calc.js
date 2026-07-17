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
  const dias = Number(it.dias) || 0;
  const unitarioCliente = Number(it.unitario_cliente) || 0;
  const unitarioCosto = Number(it.unitario_costo) || 0;
  const subtotalCliente = cantidad * dias * unitarioCliente;
  const subtotalCosto = cantidad * dias * unitarioCosto;
  const utilidad = subtotalCliente - subtotalCosto;
  const pctUtilidad = subtotalCliente === 0 ? 0 : Math.round((utilidad / subtotalCliente) * 1000) / 10;
  return {
    ...it,
    cantidad, dias,
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
    pct_utilidad: pctUtilidad
  };
}

// Recalcula costo_cliente (suma de lo verde/cliente) y costo_real (suma de lo celeste/costo)
// de una cotización a partir de todos los ítems de todos sus grupos de proveedores.
// Si la cotización no tiene ningún grupo (sin detalle cargado), no toca los totales:
// siguen siendo editables a mano como antes de este upgrade.
export async function recomputeTotales(cotizacionId) {
  const items = await sql`
    SELECT i.cantidad, i.dias, i.unitario_cliente, i.unitario_costo
    FROM cotizacion_items i
    JOIN cotizacion_grupos g ON g.id = i.grupo_id
    WHERE g.cotizacion_id = ${cotizacionId}
  `;
  if (items.length === 0) return;

  let costoCliente = 0;
  let costoReal = 0;
  for (const it of items) {
    const cantidad = Number(it.cantidad) || 0;
    const dias = Number(it.dias) || 0;
    costoCliente += cantidad * dias * (Number(it.unitario_cliente) || 0);
    costoReal += cantidad * dias * (Number(it.unitario_costo) || 0);
  }

  await sql`
    UPDATE cotizaciones
    SET costo_cliente = ${costoCliente}, costo_real = ${costoReal}, updated_at = now()
    WHERE id = ${cotizacionId}
  `;
}
