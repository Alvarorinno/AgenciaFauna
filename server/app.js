import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb } from './db.js';
import authRouter from './routes/auth.js';
import cotizacionesRouter from './routes/cotizaciones.js';
import statsRouter from './routes/stats.js';
import detalleRouter from './routes/detalle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Se ejecuta una vez por instancia/cold start; las requests posteriores reutilizan la conexión.
await initDb();

const app = express();

// CORS solo en desarrollo (en prod el frontend lo sirve el mismo Express, o Vercel en el mismo dominio)
if (!isProd) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
}

app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/cotizaciones', cotizacionesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/detalle', detalleRouter);
app.get('/api/health', (_, res) => res.json({ ok: true, env: isProd ? 'production' : 'development' }));

// En producción standalone (no-Vercel): servir el frontend compilado desde el mismo Express.
// En Vercel, los estáticos de client/dist se sirven directo por la plataforma (ver vercel.json),
// así que este bloque es un no-op ahí (no hay client/dist junto al bundle de la función).
if (isProd) {
  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

export default app;
