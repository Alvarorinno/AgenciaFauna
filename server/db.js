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
      comision_pct NUMERIC DEFAULT 0,
      comision_monto NUMERIC DEFAULT 0,
      tipo_ingreso TEXT DEFAULT 'fee',
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

  // Línea de negocio: 'fauna_rd' (histórico) o 'agencia' (nueva). Todo lo cargado
  // hasta ahora pertenece a Fauna RD, así que el default y el backfill apuntan ahí.
  await sql`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS linea_negocio TEXT`;
  await sql`UPDATE cotizaciones SET linea_negocio = 'fauna_rd' WHERE linea_negocio IS NULL`;

  // Comisión de agencia: % de utilidad del negocio que se suma por encima del
  // costo real de los proveedores para llegar al margen deseado en la cotización
  // (ver recomputeTotales en lib/calc.js). comision_monto es el monto ya calculado,
  // guardado para no tener que recalcular en cada lectura.
  await sql`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS comision_pct NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS comision_monto NUMERIC DEFAULT 0`;

  // Clasificación Fee / Variable de cada cotización. Se agrega con DEFAULT 'fee' tanto
  // para filas nuevas como para las ya existentes (ADD COLUMN con DEFAULT rellena las
  // filas históricas con ese valor): ante la duda se clasifican como 'fee' para revisión
  // manual posterior, según lo pedido.
  await sql`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tipo_ingreso TEXT DEFAULT 'fee'`;
  await sql`UPDATE cotizaciones SET tipo_ingreso = 'fee' WHERE tipo_ingreso IS NULL`;

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
      factura_proveedor TEXT DEFAULT '',
      abono1 NUMERIC DEFAULT 0,
      abono2 NUMERIC DEFAULT 0,
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

  // Gestión de Proveedores: una vez que una cotización pasa a evento (aprobada),
  // su detalle de proveedores (grupos + ítems) se muestra en esa sección — no es
  // una copia, se lee directo desde estas mismas tablas filtrando por
  // estado_cotizacion = 'aprobado'. Factura del proveedor y sus abonos son A NIVEL
  // DE GRUPO/PROVEEDOR (una factura + abonos cubren todo el itemizado de ese
  // proveedor en la cotización), no por ítem.
  await sql`ALTER TABLE cotizacion_grupos ADD COLUMN IF NOT EXISTS factura_proveedor TEXT DEFAULT ''`;
  await sql`ALTER TABLE cotizacion_grupos ADD COLUMN IF NOT EXISTS abono1 NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE cotizacion_grupos ADD COLUMN IF NOT EXISTS abono2 NUMERIC DEFAULT 0`;

  // Revertido: estos 3 campos se probaron primero a nivel de ítem y se migraron a
  // nivel de grupo (arriba) antes de que hubiera datos reales cargados en producción.
  await sql`ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS factura_proveedor`;
  await sql`ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS abono1`;
  await sql`ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS abono2`;

  // Proveedores: directorio maestro de proveedores del negocio (transversal a
  // ambas líneas, Fauna RD y Agencia — no está acotado a una sola). Es distinto
  // del detalle de proveedores por cotización (cotizacion_grupos): esto es la
  // ficha de contacto/datos bancarios de cada proveedor, no ligada a una cotización
  // puntual. datos_empresa y cuenta quedan como texto libre porque la fuente
  // (planilla histórica) mezcla razón social/RUT/giro/dirección o banco/cuenta/RUT
  // en un solo bloque, sin una estructura consistente fila a fila.
  await sql`
    CREATE TABLE IF NOT EXISTS proveedores (
      id SERIAL PRIMARY KEY,
      nombre TEXT DEFAULT '',
      nombre_contacto TEXT DEFAULT '',
      datos_empresa TEXT DEFAULT '',
      cuenta TEXT DEFAULT '',
      servicios TEXT DEFAULT '',
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

  // Línea de negocio a cargo de un 'encargado' (null para roles globales como
  // 'finanzas'/'todos', que no están acotados a una sola línea).
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS linea_negocio TEXT`;

  // Migración: se retiran los usuarios demo genéricos (encargado/finanzas/director,
  // contraseña compartida fauna2026) en favor de cuentas nominales reales. Idempotente:
  // no-op en los arranques siguientes, una vez que ya fueron eliminados.
  await sql`DELETE FROM users WHERE username IN ('encargado', 'finanzas', 'director')`;

  // Usuarios reales. El rol 'todos' (Dirección) es de solo lectura en toda la app
  // (UI y servidor) — ver ENCARGADO_FIELDS/FINANCE_FIELDS en routes/cotizaciones.js.
  await sql`
    INSERT INTO users (username, password, role, nombre, linea_negocio)
    VALUES (${'francisca'}, ${process.env.FRANCISCA_PASS || 'frans123'}, ${'encargado'}, ${'Francisca Sierralta'}, ${'fauna_rd'})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre, linea_negocio)
    VALUES (${'alvaro'}, ${process.env.ALVARO_PASS || 'fin123'}, ${'finanzas'}, ${'Álvaro'}, ${null})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre, linea_negocio)
    VALUES (${'ezequiel'}, ${process.env.EZEQUIEL_PASS || 'ezev123'}, ${'todos'}, ${'Ezequiel'}, ${null})
    ON CONFLICT (username) DO NOTHING
  `;
  await sql`
    INSERT INTO users (username, password, role, nombre, linea_negocio)
    VALUES (${'agustina'}, ${process.env.AGUSTINA_PASS || 'Guchi123'}, ${'encargado'}, ${'Agustina'}, ${'agencia'})
    ON CONFLICT (username) DO NOTHING
  `;

  // ON CONFLICT DO NOTHING no actualiza filas ya existentes: si francisca fue
  // creada antes de que existiera la columna linea_negocio, la backfilleamos aquí.
  await sql`UPDATE users SET linea_negocio = 'fauna_rd' WHERE username = 'francisca' AND linea_negocio IS NULL`;

  // Auto-seed en primer arranque si la tabla está vacía
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM cotizaciones`;
  if (n === 0) {
    const seedFile = join(__dirname, '../scripts/fauna_seed.json');
    if (existsSync(seedFile)) {
      const data = JSON.parse(readFileSync(seedFile, 'utf-8'));
      for (const r of data) {
        await sql`
          INSERT INTO cotizaciones
            (n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real, factura, fecha_factura, mes_factura, estado_pago, estado_cotizacion, linea_negocio)
          VALUES
            (${r.n_cot ?? null}, ${r.mes ?? null}, ${r.a_cargo ?? null}, ${r.cliente ?? null}, ${r.proyecto ?? null}, ${r.descripcion ?? null},
             ${r.costo_cliente || 0}, ${r.costo_real || 0}, ${r.factura ?? null}, ${r.fecha_factura ?? null}, ${r.mes_factura ?? null}, ${r.estado_pago ?? 'na'}, ${'aprobado'}, ${'fauna_rd'})
        `;
      }
      console.log(`✓ Auto-seed: ${data.length} cotizaciones cargadas desde fauna_seed.json`);
    }
  }

  // Auto-seed del directorio de proveedores en primer arranque si la tabla está vacía
  const [{ n: nProveedores }] = await sql`SELECT COUNT(*)::int as n FROM proveedores`;
  if (nProveedores === 0) {
    const proveedoresSeedFile = join(__dirname, '../scripts/proveedores_seed.json');
    if (existsSync(proveedoresSeedFile)) {
      const data = JSON.parse(readFileSync(proveedoresSeedFile, 'utf-8'));
      for (const r of data) {
        await sql`
          INSERT INTO proveedores (nombre, nombre_contacto, datos_empresa, cuenta, servicios)
          VALUES (${r.nombre ?? ''}, ${r.nombre_contacto ?? ''}, ${r.datos_empresa ?? ''}, ${r.cuenta ?? ''}, ${r.servicios ?? ''})
        `;
      }
      console.log(`✓ Auto-seed: ${data.length} proveedores cargados desde proveedores_seed.json`);
    }
  }
}

// Se asegura de correr una sola vez por instancia de función/proceso.
export function initDb() {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}

export default sql;
