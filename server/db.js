import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// En producción (Railway) usa /data/database.db (volumen persistente)
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS cotizaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    n_cot INTEGER,
    mes TEXT,
    a_cargo TEXT,
    cliente TEXT,
    proyecto TEXT,
    descripcion TEXT,
    costo_cliente REAL DEFAULT 0,
    costo_real REAL DEFAULT 0,
    factura TEXT,
    fecha_factura TEXT,
    mes_factura TEXT,
    estado_pago TEXT DEFAULT 'na',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nombre TEXT
  );
`);

// Usuarios demo (reemplazar por auth real en producción)
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (username, password, role, nombre) VALUES (?, ?, ?, ?)`);
insertUser.run('encargado', process.env.ENCARGADO_PASS || 'fauna2026', 'encargado', 'Javiera Soto');
insertUser.run('finanzas', process.env.FINANZAS_PASS || 'fauna2026', 'finanzas', 'Jefe de Finanzas');
insertUser.run('director', process.env.DIRECTOR_PASS || 'fauna2026', 'todos', 'Dirección');

// Auto-seed en primer arranque si la BD está vacía
const count = db.prepare('SELECT COUNT(*) as n FROM cotizaciones').get();
if (count.n === 0) {
  const seedFile = join(__dirname, '../scripts/fauna_seed.json');
  if (existsSync(seedFile)) {
    const data = JSON.parse(readFileSync(seedFile, 'utf-8'));
    const insert = db.prepare(`
      INSERT INTO cotizaciones (n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real, factura, fecha_factura, mes_factura, estado_pago)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.exec('BEGIN');
    for (const r of data) {
      insert.run(
        r.n_cot ?? null,
        r.mes ?? null,
        r.a_cargo ?? null,
        r.cliente ?? null,
        r.proyecto ?? null,
        r.descripcion ?? null,
        r.costo_cliente || 0,
        r.costo_real || 0,
        r.factura ?? null,
        r.fecha_factura ?? null,
        r.mes_factura ?? null,
        r.estado_pago ?? 'na'
      );
    }
    db.exec('COMMIT');
    console.log(`✓ Auto-seed: ${data.length} cotizaciones cargadas desde fauna_seed.json`);
  }
}

export function dbTransaction(fn) {
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export default db;
