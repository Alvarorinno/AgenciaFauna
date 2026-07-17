// Punto de entrada serverless de Vercel.
// Vercel invoca esta función para cualquier request bajo /api/* (ver rewrites en vercel.json).
// El runtime de Node de Vercel acepta una app de Express directamente como handler (req, res).
import app from '../server/app.js';

export default app;
