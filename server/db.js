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

  // Usuarios demo (reemplazar por auth real en producción)
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'encargado'}, ${process.env.ENCARGADO_PASS || 'fauna2026'}, ${'encargado'}, ${'Javiera Soto'})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'finanzas'}, ${process.env.FINANZAS_PASS || 'fauna2026'}, ${'finanzas'}, ${'Jefe de Finanzas'})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre)
    VALUES (${'director'}, ${process.env.DIRECTOR_PASS || 'fauna2026'}, ${'todos'}, ${'Dirección'})
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
            (n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real, factura, fecha_factura, mes_factura, estado_pago)
          VALUES
            (${r.n_cot ?? null}, ${r.mes ?? null}, ${r.a_cargo ?? null}, ${r.cliente ?? null}, ${r.proyecto ?? null}, ${r.descripcion ?? null},
             ${r.costo_cliente || 0}, ${r.costo_real || 0}, ${r.factura ?? null}, ${r.fecha_factura ?? null}, ${r.mes_factura ?? null}, ${r.estado_pago ?? 'na'})
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
