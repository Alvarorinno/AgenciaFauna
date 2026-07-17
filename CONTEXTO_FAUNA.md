# Contexto del Proyecto — Fauna Cotizaciones (Agencia Fauna)

> Generado el 2026-07-16. Punto de partida para nuevas sesiones de Claude Code.

---

## 1. Descripción General

**Fauna Cotizaciones** es la app interna de Agencia Fauna (agencia de BTL/marketing) para gestionar cotizaciones/proyectos y su facturación. Reemplaza la planilla `PROYECTOS AGENCIA FAUNA.xlsx` (hoja "PARA CLAUDE"). Nace como hermana de **VíaCorp Budget App** (`~/Desktop/Claude/viacorp-budget`), reutilizando el mismo stack y patrones de arquitectura.

Diseño de referencia (handoff de Claude Design): `~/Desktop/EMPRESAS/AGENCIA FAUNA/Información Sistema/design_handoff_fauna_cotizaciones/` — contiene `README.md`, `field-reference.md` y `sample-data.json` con el spec completo (colores, tipografía, reglas de negocio). Ante cualquier duda de comportamiento/diseño, esos archivos son la fuente de verdad.

**Identidad visual (2026-07-17):** el isotipo y wordmark "MrTom" del login y del sidebar se reemplazaron por el nuevo isotipo de marca (monograma "T" en Newsreader itálico + trazo de firma, ver `~/Desktop/Claude/mrtom_brand/NUEVA IMAGEN/MrTom Brand Book.dc.html`) sobre fondo tinta (`#12192b`) con el ícono en latón (`#c8a24a`), y el wordmark pasó a decir "Agencia Fauna" (antes "MrTom") — ver `client/src/pages/Login.tsx` y `client/src/components/Layout.tsx`.

- **Repositorio GitHub:** https://github.com/Alvarorinno/AgenciaFauna
- **Stack:** Node 24 + Express + `@neondatabase/serverless` (Postgres/Neon, backend) · React 18 + TypeScript + Vite + Tailwind (frontend)
- **Deploy:** Vercel (serverless functions + estáticos), base de datos Postgres vía Vercel Postgres/Neon. Migrado desde Railway + `node:sqlite` — ver sección 7.
- **URL de producción:** https://agenciafauna.mrtom.cl (dominio propio, ver sección 7). También responde en el dominio autogenerado de Vercel `https://agencia-fauna.vercel.app`.
- **Puertos dev:** backend 3001, frontend 5173 (proxy `/api` → 3001 vía `vite.config.ts`)

---

## 2. Estructura del Proyecto

```
AgenciaFauna/
├── api/
│   └── index.js             # Entry point serverless de Vercel — re-exporta server/app.js
├── server/
│   ├── app.js                # Express app (routes, middleware, sin .listen) — usado por index.js y por api/index.js
│   ├── index.js              # Solo dev local: importa app.js y hace .listen(PORT)
│   ├── db.js                  # @neondatabase/serverless (Neon/Postgres) — schema, usuarios demo, auto-seed, initDb()
│   ├── lib/
│   │   └── calc.js           # Cálculos derivados compartidos (utilidad/% cotización, ítem y grupo) + recomputeTotales()
│   └── routes/
│       ├── auth.js          # /api/auth/login (JWT) + authMiddleware
│       ├── cotizaciones.js  # CRUD con permisos por rol (server-side)
│       ├── detalle.js       # CRUD de grupos/ítems de proveedores + generación de los 2 PDFs (pdfkit)
│       └── stats.js         # Agregados para el Dashboard
├── scripts/
│   └── fauna_seed.json      # 27 filas semilla reales (extraídas del Excel, ver sección 4)
├── client/
│   └── src/
│       ├── context/AuthContext.tsx
│       ├── components/{Layout,StatCard,BarList,CotizacionDetalle}.tsx  # CotizacionDetalle: panel desplegable de detalle de proveedores
│       └── pages/{Login,Dashboard,Cotizaciones,Eventos}.tsx   # nav: Dashboard → Cotizaciones → Eventos/Proyectos
├── vercel.json               # buildCommand/outputDirectory + rewrite de /api/:path* → /api/index
├── .env.example              # DATABASE_URL, JWT_SECRET, etc.
└── package.json             # scripts raíz (build/start/dev/seed)
```

---

## 3. Roles y Usuarios

Usuarios reales (2026-07-17, reemplazaron a los demo genéricos `encargado`/`finanzas`/`director` con password compartida `fauna2026`, que fueron eliminados de la tabla `users` vía migración idempotente en `server/db.js`). Passwords por defecto hardcodeadas, overrideables vía env vars `FRANCISCA_PASS` / `ALVARO_PASS` / `EZEQUIEL_PASS` (ver `.env.example`) — recomendado setearlas en producción.

| Usuario | Password default | role (interno) | Nombre mostrado | Puede editar |
|---|---|---|---|---|
| `francisca` | `frans123` | `encargado` | Francisca Sierralta | Columnas de cuenta (8 campos) + `estado_cotizacion` (aprobar/rechazar/reactivar) |
| `alvaro` | `fin123` | `finanzas` | Álvaro | Columnas de Finanzas (4 campos) |
| `ezequiel` | `ezev123` | `todos` | Ezequiel | **Nada — solo lectura.** Ve Dashboard, Cotizaciones y Eventos/Proyectos completos, pero no puede crear, editar, eliminar, aprobar ni rechazar nada. |

**El rol `todos` (Dirección) es de solo lectura**, a diferencia del diseño original donde tenía edición completa de ambas secciones. Esto se aplica en dos capas (igual patrón que el resto de los permisos):
- **Servidor** (`routes/cotizaciones.js`): `POST`/`DELETE` solo permiten `role === 'encargado'`; en `PUT`, `allowedFields` es un array vacío para `todos` (no tiene ningún campo editable, ni de Encargado ni de Finanzas).
- **Cliente** (`Eventos.tsx`, `Cotizaciones.tsx`): `canEditEncargado`/`canEditFinanzas`/`canDelete`/`canEdit` ya no incluyen `'todos'` — solo `'encargado'` y/o `'finanzas'` según la sección. El dimming (40% opacidad + `pointer-events:none`) y la ausencia de botones de acción (Agregar/Editar/Eliminar/Aprobar/Rechazar/Reactivar) para `todos` es consecuencia directa de eso, no un caso especial adicional.

El gating de permisos está **duplicado a propósito**: en la UI (dimming + `pointer-events:none` de la sección no editable) y en el servidor (filtra campos permitidos por `req.user.role` antes del UPDATE, y bloquea POST/DELETE por rol). No confiar solo en la UI.

---

## 4. Modelo de Datos (`cotizaciones`)

Columnas de **Encargado** (owner: `encargado`/`todos`): `n_cot, mes, a_cargo, cliente, proyecto, descripcion, costo_cliente, costo_real`.

Columnas **Calculado** (derivadas, nunca editables, no se persisten aparte — se calculan en cada request):
- `utilidad = costo_cliente - costo_real`
- `pct_utilidad = utilidad / costo_cliente * 100` (1 decimal, guard div-by-zero → 0.0)

Columnas de **Finanzas** (owner: `finanzas`/`todos`): `factura, fecha_factura, mes_factura, estado_pago` (`pagado` | `saldo` | `na`).

Meses: `['enero',...,'diciembre']` (minúsculas, sin tildes) — igual en selects, filtros y agregados del dashboard.

**Pipeline de cotizaciones** (`estado_cotizacion`, owner: `encargado`/`todos`, valores `pendiente` | `aprobado` | `rechazado`, default `pendiente` en creación):
- Una misma tabla `cotizaciones` alimenta dos vistas filtradas en el cliente — no hay duplicación de filas entre "cotización" y "evento":
  - **Cotizaciones** (`client/src/pages/Cotizaciones.tsx`): muestra solo `pendiente` + `rechazado`. Sin sección Finanzas (no aplica a algo que aún no se ejecuta). Botones Aprobar (✓) / Rechazar (✕) sobre filas `pendiente`; botón Reactivar (↺) sobre filas `rechazado` que vuelve a `pendiente`.
  - **Eventos / Proyectos** (`client/src/pages/Eventos.tsx`): muestra solo `aprobado` (incluye Finanzas, como antes).
  - El Dashboard (`server/routes/stats.js`) agrega solo filas `aprobado`.
- Transición totalmente reversible: aprobar mueve la fila a Eventos/Proyectos (deja de aparecer en Cotizaciones); rechazar la deja visible en Cotizaciones (no se borra) para que la ejecutiva decida si sigue insistiendo o la reactiva más adelante.
- El rol `finanzas` no ve el ítem de nav "Cotizaciones" (solo entra a Dashboard y Eventos/Proyectos, que son los que factura/cobra); el gating también es server-side vía `ENCARGADO_FIELDS` en `routes/cotizaciones.js` (igual patrón que el resto de los campos de encargado).
- `n_cot` en creación: ninguna de las dos páginas calcula el siguiente número en el cliente — ambas omiten `n_cot` en el POST y dejan que el backend calcule `MAX(n_cot)` sobre toda la tabla (evita colisiones entre las dos vistas filtradas).
- Migración de esquema (`server/db.js`, `initDb()`): `ADD COLUMN IF NOT EXISTS estado_cotizacion TEXT` (sin default) seguido de `UPDATE ... SET estado_cotizacion = 'aprobado' WHERE estado_cotizacion IS NULL` — así las filas ya existentes en producción (histórico real del Excel) quedan `aprobado` en vez de caer accidentalmente en `pendiente` por el fast-default de Postgres. El auto-seed (`fauna_seed.json`, tabla vacía) también inserta siempre con `estado_cotizacion = 'aprobado'`.

### 4.1 Detalle de proveedores por cotización (`cotizacion_grupos` / `cotizacion_items`) — 2026-07-17

Cada cotización puede desplegarse (▸ en la primera columna, tanto en Cotizaciones como en Eventos/Proyectos — es la misma fila subyacente) para mostrar el detalle por proveedor, inspirado en la planilla original:

- **`cotizacion_grupos`**: una partida por proveedor (ej. "ADHESIVO SERVICIO TÉCNICO"), con `nombre`, `proveedor`, `rut_proveedor`. `ON DELETE CASCADE` desde `cotizaciones`.
- **`cotizacion_items`**: líneas dentro de un grupo — `nombre, cantidad, unidad, dias, unitario_cliente, unitario_costo`. `ON DELETE CASCADE` desde `cotizacion_grupos`. Subtotal = `cantidad × dias × unitario`.
- Convención visual (pedida explícitamente por el usuario): **verde = de cara al cliente** (columnas Cliente: unitario/subtotal), **celeste = interno** (columnas Costo: unitario/subtotal/utilidad $/utilidad % + Proveedor/RUT). Mismos colores usados en `client/src/components/CotizacionDetalle.tsx` (`CLIENTE_BG/CLIENTE_TEXT` vs `COSTO_BG/COSTO_TEXT`).
- **`costo_cliente`** y **`costo_real`** a nivel cotización dejan de ser editables a mano en cuanto la cotización tiene al menos un grupo: se recalculan automáticamente como la suma de `subtotal_cliente` (verde) y `subtotal_costo` (celeste) de todos los ítems de todos sus grupos — ver `recomputeTotales()` en `server/lib/calc.js`, y el flag `tiene_detalle` que expone el GET/POST/PUT de `/api/cotizaciones` para que la UI bloquee esos dos inputs. Si una cotización no tiene ningún grupo (como las 27 históricas del seed), sigue funcionando exactamente igual que antes (edición manual).
- Igual patrón de permisos que el resto: solo `encargado` puede crear/editar/eliminar grupos e ítems (`requireEncargado` en `routes/detalle.js`, gateado también en el cliente vía la misma prop `canEdit`/`canEditEncargado` que ya usaban las páginas). Cualquier rol autenticado puede ver el detalle y descargar los PDFs (son de solo lectura).
- Rutas: `POST/PUT/DELETE /api/detalle/grupos(/:id)`, `POST/PUT/DELETE /api/detalle/grupos/:id/items` y `/api/detalle/items/:id`. El GET de `/api/cotizaciones` ya viene con `grupos` anidados (no hay un GET aparte).

### 4.2 Descargas PDF (pdfkit) — 2026-07-17

Dos PDFs generados server-side con `pdfkit` (sin dependencias nativas, corre bien en la función serverless de Vercel), datos de la empresa hardcodeados en `COMPANY` (`server/routes/detalle.js`: Agencia Fauna SpA, RUT 77.897.540-1, Sebastian Piñera 548 Las Condes, francisca.sierralta@agenciafauna.com):

1. **`GET /api/detalle/cotizaciones/:id/pdf-cliente`** — cotización completa para el cliente: resumen + detalle línea por línea de todos los grupos, con precios de venta (verde) únicamente. Nunca expone costo, utilidad ni el nombre del proveedor.
2. **`GET /api/detalle/grupos/:id/pdf-oc`** — Orden de Compra para UN proveedor puntual (un grupo): solo sus ítems, con precio de costo (celeste) y el total a pagarle. Nunca expone el precio al cliente ni la utilidad.

Botones de descarga en `CotizacionDetalle.tsx`: "📄 Cotización cliente (PDF)" a nivel de cotización (arriba del panel), "📄" por cada grupo (junto a editar/eliminar) para su OC. El botón de cotización-cliente se deshabilita si `tiene_detalle` es `false` (no hay nada que mostrar).

---

## 5. Diferencias con VíaCorp Budget (por si se comparan)

- VíaCorp usa roles `director/finanzas/viewer`; Fauna usa `encargado/finanzas/todos` (nombres distintos, misma idea de permisos server-side).
- Fauna no tiene módulo de "Presupuesto" real — el ítem de nav "Presupuesto MO" está deshabilitado a propósito (placeholder "PRONTO"), no construir hasta que se defina el alcance.
- Paleta de marca propia "Tinta / Papel / Latón / Burdeos" (ver `client/tailwind.config.js`) en vez del azul genérico de VíaCorp.
- PDF sí implementado en Fauna (a diferencia de la nota anterior) — ver sección 4.2. Pero sin envío de email todavía (VíaCorp tiene `report.js` + `resend`/`nodemailer`, Fauna solo descarga directa).

---

## 6. Pendientes conocidos (del handoff, sección "Known gaps")

- Sin autosave/undo ni manejo de conflictos multi-usuario simultáneo sobre la misma fila.
- Sin paginación — confirmar volumen esperado de filas antes de necesitarla.
- Reemplazar auth JWT hardcodeada por autenticación real antes de exponer la app fuera de la red interna.

---

## 7. Flujo de Deploy — Vercel + Neon/Postgres

Migrado desde Railway + `node:sqlite` (2026-07-16): Vercel serverless no tiene disco persistente, así que la BD pasó a Postgres (Vercel Postgres, backed by Neon) vía `@neondatabase/serverless`. `@vercel/postgres` está deprecado — se usa el driver nativo de Neon directo, que es la forma actual soportada.

```bash
# Desarrollo (igual que antes, requiere .env con DATABASE_URL apuntando a la BD de dev/preview)
cd server && npm run dev &
cd client && npm run dev

# Producción (Vercel)
# El propio Vercel corre `npm run build` (build del client a client/dist + install de server/)
# y despliega api/index.js como función serverless (ver vercel.json → rewrites /api/:path* → /api/index).
# Los estáticos de client/dist los sirve Vercel directo, no pasan por Express.
```

**Arquitectura del backend en Vercel:**
- `server/app.js` contiene toda la app Express (sin `.listen()`), reutilizada tanto por `server/index.js` (dev local) como por `api/index.js` (función serverless de Vercel — el runtime de Node de Vercel acepta una app Express como handler `(req, res)` directamente).
- `server/db.js` exporta `sql` (cliente `neon()` tageado-template) e `initDb()` (crea tablas si no existen + siembra usuarios demo + auto-seed de `fauna_seed.json` si la tabla está vacía). `app.js` hace `await initDb()` a nivel de módulo, una vez por cold start.
- Variable de entorno requerida: `DATABASE_URL` (o `POSTGRES_URL`, alias legado de Vercel) — se configura en el dashboard de Vercel al conectar/crear la base de datos Postgres (Storage tab), y localmente vía `.env` (ver `.env.example`).

**Setup manual pendiente (una sola vez, requiere acceso al dashboard de Vercel):**
1. Crear un proyecto en Vercel enlazado al repo `github.com/Alvarorinno/AgenciaFauna`.
2. Provisionar una base de datos Postgres (Storage → Postgres, Neon-backed) y conectarla al proyecto — esto puebla `DATABASE_URL`/`POSTGRES_URL` automáticamente en las env vars del proyecto.
3. Verificar que `JWT_SECRET` y los `*_PASS` de usuarios demo estén seteados en producción (no depender de los defaults hardcodeados).
4. Opcional para probar localmente contra la BD real: `npx vercel env pull` para traer las env vars al `.env` local.

**Nota:** `viacorp-budget` (hermano de este proyecto, alias "MRTOM BTL") sigue en Railway + `node:sqlite` por ahora. El usuario planea migrarlo también a Vercel más adelante, como tarea aparte una vez que esta migración quede validada en producción.

**Dominio de producción (2026-07-17):** El dominio autogenerado por Vercel (`https://agencia-fauna.vercel.app`) no incluía "mrtom" en la URL, así que se agregó el dominio propio **`agenciafauna.mrtom.cl`** al proyecto `agencia-fauna` en Vercel (`vercel domains add agenciafauna.mrtom.cl agencia-fauna --scope mr-tom`).
- `mrtom.cl` (dominio raíz, comprado fuera de Vercel pero con nameservers apuntando a `ns1/ns2.vercel-dns.com`) ya está tomado por otro proyecto (`mrtom-web`, el sitio principal de la empresa) — por eso se usó un **subdominio** (`agenciafauna.mrtom.cl`) en vez del path `mrtom.cl/agenciafauna`, que habría requerido rewrites cross-proyecto sobre `mrtom-web` con riesgo de romper el sitio principal.
- Como el DNS de `mrtom.cl` ya vive en los nameservers de Vercel, el subdominio se configuró automáticamente al agregarlo — no requirió tocar registros DNS a mano.
- Se probó y descartó primero un alias `*.vercel.app` (`mrtom-agenciafauna.vercel.app` vía `vercel alias set`): quedaba bloqueado por Vercel Deployment Protection (Vercel Authentication/SSO), porque solo el dominio de producción "oficial" del proyecto (`agencia-fauna.vercel.app`) está exento de esa protección. Los dominios propios agregados vía `vercel domains add` sí quedan exentos automáticamente, por eso se optó por el subdominio real en vez de forzar la excepción de protección (que es un ajuste de seguridad del proyecto).

---

*Fin del documento de contexto.*
