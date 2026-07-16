import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'fauna_secret_2026';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(String(username ?? '').trim().toLowerCase(), password);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const payload = { id: user.id, username: user.username, role: user.role, nombre: user.nombre };
  const token = jwt.sign(payload, SECRET, { expiresIn: '8h' });
  res.json({ token, user: payload });
});

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

export default router;
