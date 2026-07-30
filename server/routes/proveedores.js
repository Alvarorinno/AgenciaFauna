import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

// Directorio maestro de proveedores: transversal a ambas líneas de negocio
// (Fauna RD y Agencia), no acotado a una sola — por eso no se filtra por
// req.user.linea_negocio como el resto de las rutas per-línea.

router.get('/', async (_req, res) => {
  const rows = await sql`SELECT * FROM proveedores ORDER BY nombre`;
  res.json(rows);
});

router.post('/', async (req, res) => {
  // Mismo criterio que cotizaciones: 'todos' (Dirección) es de solo lectura;
  // 'encargado' de cualquiera de las dos líneas puede agregar proveedores nuevos
  // porque el directorio es compartido.
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso para agregar proveedores' });
  }

  const rows = await sql`
    INSERT INTO proveedores (nombre, nombre_contacto, datos_empresa, cuenta, servicios)
    VALUES (
      ${req.body.nombre ?? ''},
      ${req.body.nombre_contacto ?? ''},
      ${req.body.datos_empresa ?? ''},
      ${req.body.cuenta ?? ''},
      ${req.body.servicios ?? ''}
    )
    RETURNING *
  `;
  res.status(201).json(rows[0]);
});

// TEMP: usado una sola vez para limpiar un registro de prueba creado durante la
// verificación en producción de este endpoint. Se retira en el commit siguiente.
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'encargado') {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  await sql`DELETE FROM proveedores WHERE id = ${req.params.id}`;
  res.status(204).end();
});

export default router;
