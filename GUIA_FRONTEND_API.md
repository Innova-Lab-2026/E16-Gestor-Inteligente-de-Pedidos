# Guía de consumo de API — Gestor Inteligente de Pedidos

Documentación para el equipo **Frontend**. Explica cómo integrarse con el backend, autenticarse, aislar datos por emprendimiento y consumir cada endpoint.

> Proyecto: `E16-Gestor-Inteligente-de-Pedidos`  
> Backend: Node.js + Express (ESM) + Supabase  
> Puerto por defecto: `3000`

---

## 1. Vista general

| Concepto | Valor |
|----------|-------|
| Base URL API | `http://localhost:3000/api` (desarrollo) |
| Base URL webhooks | `http://localhost:3000/webhooks` |
| Formato | `application/json` |
| Autenticación | JWT de Supabase (`Authorization: Bearer <token>`) |
| Identificadores | UUID (v4) en todos los recursos |
| Fechas | ISO 8601 (`YYYY-MM-DDTHH:MM:SS.sssZ`) |
| Respuestas de error | `{ error: { code, message, details? } }` |

El backend expone una **única superficie HTTP** bajo `/api`. Los webhooks de canales externos (Telegram, WhatsApp, Web) viven bajo `/webhooks` y normalmente **no los consume el frontend**; se enumeran a título informativo.

---

## 2. Variables de entorno que necesita el frontend

El frontend de Vite necesita las claves públicas de Supabase. Pídalas al equipo de backend (vienen en `backend/.env`):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Reglas importantes:

- **Nunca** use `SUPABASE_SECRET_KEY` / `sb_secret_...` en el frontend. Esa clave solo la usa el backend en webhooks de canales (no hay sesión de usuario).
- La clave publicable **no es un secreto**: viaja en el bundle del navegador.
- Todas las operaciones con identidad de usuario se hacen con la clave publicable + el JWT del usuario. Supabase aplica RLS (Row Level Security) fila por fila.

---

## 3. Autenticación

Endpoints públicos (no requieren token):

```text
POST /api/auth/register
POST /api/auth/login
```

Endpoints protegidos (requieren `Authorization: Bearer <jwt>`):

```text
GET  /api/auth/me
PUT  /api/auth/me
```

### 3.1 Registro

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "yo@emprendimiento.com",
  "password": "clave12345",
  "emprendimiento": {
    "nombre": "Mi emprendimiento"
  },
  "metadata": {}
}
```

Respuesta (201):

```json
{
  "message": "Usuario registrado exitosamente",
  "user": { "id": "<uuid>", "email": "..." },
  "session": { "access_token": "<jwt>", "refresh_token": "..." },
  "emprendimiento": { "id": "<uuid>", "nombre": "Mi emprendimiento" }
}
```

### 3.2 Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "yo@emprendimiento.com",
  "password": "clave12345"
}
```

Respuesta (200): devuelve `access_token` (y normalmente `user` y `session`). Guarde el `access_token` y úselo en posteriores requests:

```http
Authorization: Bearer <access_token>
```

### 3.3 Perfil del usuario

```http
GET  /api/auth/me          # devuelve { id, email, user_metadata, created_at }
PUT  /api/auth/me          # body: { metadata?: object, password?: string (mín. 8) }
```

---

## 4. Aislamiento por emprendimiento (tenant)

Cada dato pertenece a un **emprendimiento**. El backend nunca confía en un `emprendimientoId` enviado por el cliente: lo valida contra la tabla `usuarios_emprendimientos`.

### 4.1 Cómo se resuelve el tenant

En requests protegidos, el backend busca el emprendimiento en este orden:

1. Header `x-emprendimiento-id`
2. Query o body `emprendimientoId`

Si el usuario tiene **un solo** emprendimiento, se resuelve automáticamente y no hace falta enviarlo. Si tiene **varios**, es obligatorio indicar cuál se usa.

Ejemplo de request con header:

```http
GET /api/pedidos
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid-del-emprendimiento>
```

El objeto `req.tenant` inyectado en el backend tiene `{ id, nombre }`.

---

## 5. Cliente HTTP recomendado (fetch / axios)

Ejemplo base con `fetch`:

```js
const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('access_token'); // o de tu store de auth
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const err = new Error(body?.error?.message || 'Error en la petición');
    err.status = res.status;
    err.code = body?.error?.code;
    err.details = body?.error?.details;
    throw err;
  }

  return body;
}

// Uso
const pedidos = await request('/pedidos', {
  headers: { 'x-emprendimiento-id': '<uuid>' },
});
```

---

## 6. Endpoints por recurso

Todas las rutas de esta sección están bajo `http://localhost:3000/api` y requieren JWT, salvo las de auth y `/health`.

### 6.1 Salud

```http
GET /api/health
```

Respuesta:

```json
{
  "status": "OK",
  "message": "API de gestión de pedidos multicanal",
  "timestamp": "2026-10-16T..."
}
```

### 6.2 Emprendimientos (tenant del usuario)

```text
GET    /api/emprendimientos        # lista los emprendimientos del usuario
POST   /api/emprendimientos        # crea uno nuevo
GET    /api/emprendimientos/:id
PATCH  /api/emprendimientos/:id
GET    /api/emprendimientos/me/usuario        # perfil del usuario autenticado
GET    /api/emprendimientos/me/usuario/:id
```

**Crear emprendimiento:**

```http
POST /api/emprendimientos
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "nombre": "Mi emprendimiento"
}
```

Respuesta (201): `{ id, nombre, ... }`

**Actualizar:**

```http
PATCH /api/emprendimientos/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{ "nombre": "Nuevo nombre" }
```

> Nota: las rutas `/api/emprendimientos/:id` exigen además `x-emprendimiento-id` (o resolución automática) y que el usuario sea miembro de ese emprendimiento.

### 6.3 Canales (orígenes de pedidos externos)

```text
GET    /api/canales
POST   /api/canales
GET    /api/canales/:id
PATCH  /api/canales/:id
POST   /api/canales/:id/activar
POST   /api/canales/:id/desactivar
GET    /api/canales/:id/eventos
```

Tipos de canal válidos: `TELEGRAM`, `WHATSAPP`, `WEB`.

**Crear canal:**

```http
POST /api/canales
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "tipo": "TELEGRAM",
  "identificadorExterno": "tg_987",
  "nombre": "Bot principal",
  "config": {},
  "activo": true
}
```

### 6.4 Productos

```text
GET    /api/productos                 ?incluirInactivos=true (opcional)
POST   /api/productos
GET    /api/productos/:id
PATCH  /api/productos/:id
```

**Crear producto:**

```http
POST /api/productos
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "nombre": "Remera estampada",
  "descripcion": "Algodón, talle M",
  "precio": 15000,
  "tieneVariantes": false,
  "stockDisponible": 20,
  "stockMinimo": 3,
  "identificadorExterno": "SKU-001"
}
```

Por defecto `GET /api/productos` devuelve solo activos. Pase `?incluirInactivos=true` para ver todos.

### 6.5 Variantes (de un producto)

```text
GET    /api/productos/:productoId/variantes
POST   /api/productos/:productoId/variantes
PATCH  /api/variantes/:id
```

**Crear variante:**

```http
POST /api/productos/<producto-uuid>/variantes
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "nombre": "Talle M - Rojo",
  "stockDisponible": 5,
  "stockMinimo": 2,
  "activo": true
}
```

### 6.6 Stock (movimientos de inventario)

```text
GET  /api/stock/movimientos                ?limite=100
POST /api/stock/movimientos
```

Tipos de movimiento válidos: `REPOSICION`, `PRODUCCION`, `PERDIDA`, `CORRECCION_MANUAL`.  
(`RESERVA_PEDIDO` y `RESTITUCION_CANCELACION` son manejados internamente por pedidos.)

**Ajuste manual de stock:**

```http
POST /api/stock/movimientos
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "productoId": "<uuid>",
  "varianteId": null,
  "tipo": "REPOSICION",
  "cantidad": 10,
  "motivo": "Llegada de mercadería"
}
```

La respuesta incluye `stockResultante` y el movimiento registrado.

### 6.7 Clientes

```text
GET    /api/clientes
POST   /api/clientes
GET    /api/clientes/:id
PATCH  /api/clientes/:id
```

**Crear cliente:**

```http
POST /api/clientes
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "telefono": "+54 9 11 1234-5678",
  "direccion": "Calle Falsa 123",
  "observaciones": "Cliente frecuente"
}
```

### 6.8 Pedidos (recurso principal)

```text
GET    /api/pedidos                            ?estado=&requiereRevision=&limite=&offset=
POST   /api/pedidos                            (origen MANUAL)
GET    /api/pedidos/:id
PATCH  /api/pedidos/:id/estado                 body: { estado }
PATCH  /api/pedidos/:id/cobro                  body: { estadoCobro }
PATCH  /api/pedidos/:id/revision               body: { requiereRevision, observaciones? }
GET    /api/pedidos/:id/movimientos
GET    /api/pedidos/:id/eventos
```

#### Listar pedidos

Query params opcionales:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estado` | `RECIBIDO`, `EN_PREPARACION`, `LISTO`, `ENTREGADO`, `CANCELADO` | filtra por estado |
| `requiereRevision` | `"true" \| "false"` | solo pedidos que requieren revisión |
| `limite` | number (1–200) | default `50` |
| `offset` | number | default `0` |

#### Crear pedido manual (desde la app)

```http
POST /api/pedidos
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{
  "clienteId": "<uuid>",                  // opcional
  "modalidadEntrega": "RETIRO",           // RETIRO | ENVÍO (opcional)
  "fechaPrevistaEntrega": "2026-10-20",   // opcional
  "estadoCobro": "PENDIENTE",             // PAGADO | PENDIENTE (default PENDIENTE)
  "observaciones": "Sin delivery",        // opcional, máx. 2000
  "reservarStock": true,                  // default true
  "items": [
    { "productoId": "<uuid>", "cantidad": 2 },
    { "productoId": "<uuid>", "varianteId": "<uuid>", "cantidad": 1, "precioUnitario": 15000 }
  ]
}
```

Respuesta (201): objeto pedido completo (ver esquema abajo).  
Regla del dominio: `origen_tipo = MANUAL` y `canal_id = NULL`. Si se omite `precioUnitario`, se congela el precio actual del producto.

#### Obtener pedido por id

```http
GET /api/pedidos/<uuid>
```

#### Cambiar estado del pedido

Transiciones válidas:
- `RECIBIDO` → `EN_PREPARACION`, `CANCELADO`
- `EN_PREPARACION` → `LISTO`, `CANCELADO`
- `LISTO` → `ENTREGADO`, `CANCELADO`
- `ENTREGADO`, `CANCELADO` → no hay salidas (terminales)

```http
PATCH /api/pedidos/<uuid>/estado
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{ "estado": "EN_PREPARACION" }
```

Al cancelar desde un estado no terminal se restituye el stock automáticamente.

#### Cambiar estado de cobro

```http
PATCH /api/pedidos/<uuid>/cobro
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{ "estadoCobro": "PAGADO" }
```

Valores: `PAGADO`, `PENDIENTE`.

#### Marcar revisión

```http
PATCH /api/pedidos/<uuid>/revision
Authorization: Bearer <jwt>
x-emprendimiento-id: <uuid>
Content-Type: application/json

{ "requiereRevision": true, "observaciones": "Faltan datos del cliente" }
```

Usado para pedidos de canal que no se pudieron interpretar con certeza.

#### Movimientos y eventos de un pedido

```http
GET /api/pedidos/<uuid>/movimientos   # bitácora de stock del pedido
GET /api/pedidos/<uuid>/eventos       # eventos de canal asociados
```

#### Esquema de respuesta de pedido

```json
{
  "id": "<uuid>",
  "emprendimiento_id": "<uuid>",
  "cliente_id": "<uuid> | null",
  "origen_tipo": "MANUAL | CANAL",
  "canal_id": "<uuid> | null",
  "estado": "RECIBIDO | EN_PREPARACION | LISTO | ENTREGADO | CANCELADO",
  "estado_cobro": "PAGADO | PENDIENTE",
  "modalidad_entrega": "RETIRO | ENVÍO | null",
  "fecha_prevista_entrega": "2026-10-20T00:00:00.000Z | null",
  "subtotal": 30000,
  "total": 30000,
  "observaciones": "... | null",
  "requiere_revision": false,
  "created_at": "2026-...",
  "updated_at": "2026-...",
  "items": [
    {
      "id": "<uuid>",
      "pedido_id": "<uuid>",
      "producto_id": "<uuid>",
      "variante_id": "<uuid> | null",
      "cantidad": 2,
      "precio_unitario": 15000,
      "subtotal": 30000,
      "producto": { "id": "<uuid>", "nombre": "Remera" },
      "variante": { "id": "<uuid>", "nombre": "Talle M" } | null
    }
  ],
  "cliente": { "id": "<uuid>", "nombre": "Juan Pérez" } | null,
  "movimientos_stock": [ ... ]
}
```

Los nombres de clave en **respuestas** usan `snake_case`. Los nombres en **requests** (body) usan `camelCase` según los DTO del backend.

### 6.9 Dashboard (panel)

```http
GET /api/dashboard?desde=2026-10-01&hasta=2026-10-16
```

`desde` y `hasta` son opcionales (fechas ISO).

Respuesta:

```json
{
  "cantidadPedidos": 12,
  "porEstado": { "RECIBIDO": 3, "EN_PREPARACION": 2, "LISTO": 1, "ENTREGADO": 5, "CANCELADO": 1 },
  "facturado": 75000,
  "pendienteCobro": 25000,
  "pedidosRequiriendoRevision": 2,
  "ultimosPedidos": [ ... ]
}
```

---

## 7. Webhooks (informativo para el frontend)

Reciben eventos de canales externos. No requieren JWT; la autenticidad se garantiza porque el canal debe estar registrado previamente en `/api/canales`.

```text
POST /webhooks/telegram
POST /webhooks/whatsapp
POST /webhooks/web
GET  /webhooks/whatsapp   # verificación de suscripción de Meta
```

Un mensaje entrante de Telegram/WhatsApp se normaliza y, si se interpreta con certeza, crea un pedido con `origen_tipo = CANAL`. Si no, queda con `requiere_revision = true` para que el emprendedor lo complete desde el panel.

---

## 8. Formato de errores

Todas las respuestas de error siguen este formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [
      { "path": ["email"], "message": "email inválido" }
    ]
  }
}
```

| Código HTTP | Significado típico |
|-------------|--------------------|
| 400 | Parámetros inválidos / negocio (stock insuficiente, transición no válida) |
| 401 | Token faltante, inválido o expirado |
| 403 | No pertenece al emprendimiento solicitado |
| 404 | Recurso no encontrado |
| 422 | Error de validación del body (Zod) |
| 500 | Error interno (sin detalle en producción) |

Headers de error relevantes: `Authorization` (401) y `x-emprendimiento-id` (403 si no se indica o no se pertenece).

---

## 9. Valores válidos (enums del dominio)

Use estos valores exactamente tal cual en los requests:

**Estado de pedido:** `RECIBIDO`, `EN_PREPARACION`, `LISTO`, `ENTREGADO`, `CANCELADO`

**Estado de cobro:** `PAGADO`, `PENDIENTE`

**Modalidad de entrega:** `RETIRO`, `ENVÍO`

**Origen del pedido:** `MANUAL` (desde la app), `CANAL` (desde Telegram/WhatsApp/Web)

**Tipo de canal:** `TELEGRAM`, `WHATSAPP`, `WEB`

**Tipo de movimiento de stock:** `REPOSICION`, `PRODUCCION`, `PERDIDA`, `CORRECCION_MANUAL`

---

## 10. Ejemplos prácticos (JavaScript / fetch)

### Login y guardar token

```js
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'yo@emprendimiento.com', password: 'clave12345' }),
});
const data = await res.json(); // { access_token, ... }
localStorage.setItem('access_token', data.session.access_token);
```

### Crear pedido manual

```js
const token = localStorage.getItem('access_token');
const tenantId = '<uuid-emprendimiento>';

const res = await fetch('http://localhost:3000/api/pedidos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-emprendimiento-id': tenantId,
  },
  body: JSON.stringify({
    modalidadEntrega: 'RETIRO',
    estadoCobro: 'PENDIENTE',
    reservarStock: true,
    items: [
      { productoId: '<uuid-producto>', cantidad: 2 },
      { productoId: '<uuid-producto-2>', varianteId: '<uuid-variante>', cantidad: 1 },
    ],
  }),
});

const pedido = await res.json(); // 201
```

### Cambiar estado a "EN_PREPARACION"

```js
await fetch(`http://localhost:3000/api/pedidos/<uuid-pedido>/estado`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-emprendimiento-id': tenantId,
  },
  body: JSON.stringify({ estado: 'EN_PREPARACION' }),
});
```

---

## 11. Checklist para el frontend

- [ ] Obtener `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del backend.
- [ ] Implementar login/registro y guardar `access_token`.
- [ ] Enviar `Authorization: Bearer <token>` en todas las rutas protegidas.
- [ ] Si el usuario tiene varios emprendimientos, enviar `x-emprendimiento-id` (obtener lista desde `GET /api/emprendimientos`).
- [ ] Tratar errores con el formato `{ error: { code, message, details } }`.
- [ ] Usar `snake_case` al leer respuestas y `camelCase` al escribir bodies.
- [ ] Todos los IDs son UUIDs.
- [ ] No usar `SUPABASE_SECRET_KEY` en el navegador.
- [ ] Los webhooks de canales (`/webhooks/*`) son solo informativos para el frontend.

---

## 12. Levantar el backend para pruebas

Desde `backend/`:

```bash
npm install
cp .env.example .env   # editar con las credenciales de Supabase
npm run dev            # nodemon en http://localhost:3000
```

Validación rápida sin base de datos:

```bash
npm test       # 73 tests unitarios/integración (dobles de DAO)
npm run smoke  # levanta el server y verifica 21 comprobaciones de la API
```

Para el ciclo completo (login, pedidos, stock) se debe aplicar la migración `db/migrations/001_schema_v2.sql` en Supabase y crear un usuario.

---

> ¿Dudas o cambios en contratos? Coordine con el equipo de backend antes de modificar payloads; los DTOs de validación viven en `backend/src/modules/*/dtos/`.