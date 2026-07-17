import app from './app.js';

const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT} [${isProd ? 'PRODUCTION' : 'development'}]`);
});
