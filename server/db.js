import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL (o POSTGRES_URL) para conectar a Neon/Vercel Postgres');
}

export const sql = neon(connectionString);

let initPromise = null;

async function runInit() {
  await sql`
    CREATE TABLE IF NOT EXISTS cotizaciones (
      id SERIAL PRIMARY KEY,
      n_cot INTEGER,
      mes TEXT,
      a_cargo TEXT,
      cliente TEXT,
      proyecto TEXT,
      descripcion TEXT,
      costo_cliente NUMERIC DEFAULT 0,
      costo_real NUMERIC DEFAULT 0,
      factura TEXT,
      fecha_factura TEXT,
      mes_factura TEXT,
      estado_pago TEXT DEFAULT 'na',
      estado_cotizacion TEXT DEFAULT 'pendiente',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Migración idempotente para bases ya existentes (sin default para no
  // marcar erróneamente filas históricas ya aprobadas como 'pendiente').
  await sql`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS estado_cotizacion TEXT`;
  await sql`UPDATE cotizaciones SET estado_cotizacion = 'aprobado' WHERE estado_cotizacion IS NULL`;

  // Detalle de proveedores por cotización: grupos (una partida por proveedor,
  // ej. "ADHESIVO SERVICIO TÉCNICO") con sus líneas de ítem (cantidad/unidad/días/precios).
  // costo_cliente y costo_real a nivel cotización se recalculan como la suma de estos ítems
  // en cuanto la cotización tiene al menos un grupo (ver recomputeTotales en lib/calc.js).
  await sql`
    CREATE TABLE IF NOT EXISTS cotizacion_grupos (
      id SERIAL PRIMARY KEY,
      cotizacion_id INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
      nombre TEXT DEFAULT '',
      proveedor TEXT DEFAULT '',
      rut_proveedor TEXT DEFAULT '',
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cotizacion_items (
      id SERIAL PRIMARY KEY,
      grupo_id INTEGER NOT NULL REFERENCES cotizacion_grupos(id) ON DELETE CASCADE,
      nombre TEXT DEFAULT '',
      cantidad NUMERIC DEFAULT 1,
      unidad TEXT DEFAULT 'Unidad',
      dias NUMERIC DEFAULT 1,
      unitario_cliente NUMERIC DEFAULT 0,
      unitario_costo NUMERIC DEFAULT 0,
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      nombre TEXT
    );
  `;

  // Migración: se retiran los usuarios demo genéricos (encargado/finanzas/director,
  // contraseña compartida fauna2026) en favor de cuentas nominales reales. Idempotente:
  // no-op en los arranques siguientes, una vez que ya fueron eliminados.
  await sql`DELETE FROM users WHERE username IN ('encargado', 'finanzas', 'director')`;

  // Usuarios reales. El rol 'todos' (Dirección) es de solo lectura en toda la app
  // (UI y servidor) — ver ENCARGADO_FIELDS/FINANCE_FIELDS en routes/cotizaciones.js.
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'francisca'}, ${process.env.FRANCISCA_PASS || 'frans123'}, ${'encargado'}, ${'Francisca Sierralta'})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'alvaro'}, ${process.env.ALVARO_PASS || 'fin123'}, ${'finanzas'}, ${'Álvaro'})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'ezequiel'}, ${process.env.EZEQUIEL_PASS || 'ezev123'}, ${'todos'}, ${'Ezequiel'})
    ON CONFLICT (username) DO NOTHING
  `;

  // Auto-seed en primer arranque si la tabla está vacía
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM cotizaciones`;
  if (n === 0) {
    const seedFile = join(__dirname, '../scripts/fauna_seed.json');
    if (existsSync(seedFile)) {
      const data = JSON.parse(readFileSync(seedFile, 'utf-8'));
      for (const r of data) {
        await sql`
          INSERT INTO cotizaciones
            (n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real, factura, fecha_factura, mes_factura, estado_pago, estado_cotizacion)
          VALUES
            (${r.n_cot ?? null}, ${r.mes ?? null}, ${r.a_cargo ?? null}, ${r.cliente ?? null}, ${r.proyecto ?? null}, ${r.descripcion ?? null},
             ${r.costo_cliente || 0}, ${r.costo_real || 0}, ${r.factura ?? null}, ${r.fecha_factura ?? null}, ${r.mes_factura ?? null}, ${r.estado_pago ?? 'na'}, ${'aprobado'})
        `;
      }
      console.log(`✓ Auto-seed: ${data.length} cotizaciones cargadas desde fauna_seed.json`);
    }
  }
}

// Se asegura de correr una sola vez por instancia de función/proceso.
export function initDb() {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}

export default sql;
