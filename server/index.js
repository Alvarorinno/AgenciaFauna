import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './routes/auth.js';
import cotizacionesRouter from './routes/cotizaciones.js';
import statsRouter from './routes/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// CORS solo en desarrollo (en prod el frontend lo sirve el mismo Express)
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
app.get('/api/health', (_, res) => res.json({ ok: true, env: isProd ? 'production' : 'development' }));

// En producción: servir el frontend compilado
if (isProd) {
  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  // SPA fallback — cualquier ruta no-API devuelve index.html
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT} [${isProd ? 'PRODUCTION' : 'development'}]`);
});
