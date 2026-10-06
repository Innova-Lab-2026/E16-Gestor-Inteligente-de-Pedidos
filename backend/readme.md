# Backend Node.js + Express (JS ESM) - Gestion de pedidos multicanal

Herramienta interna para emprendimientos: pedidos, clientes,
productos, stock y estados de entrega. Los pedidos pueden entrar a mano o
desde canales externos (Telegram, WhatsApp, Web) mediante el patron Adapter.

## Arquitectura

```text
Route -> auth/tenant -> Controller -> DTO (zod) -> Service -> DAO -> Supabase

Canal externo -> Webhook -> Adapter -> Evento normalizado
             -> EventoCanalService (canal + idempotencia) -> PedidoService -> StockService
```

- El dominio no conoce proveedores: agregar un canal es agregar un Adapter.
- El tenant se resuelve desde `usuarios_emprendimientos`, nunca desde un
  valor enviado por el cliente.
- No hay capa Repository: con una sola base de datos seria una capa sin
  responsabilidad propia. El DAO accede a la base y aplica el filtro de
  tenant. El Service no conoce SQL; el DAO no aplica reglas de negocio.

## Estructura

```text
src/
  config/      env.js, database.js, integrations.js
  constants/   enums del dominio
  errors/      AppError y derivadas
  middlewares/ auth, tenant, validator, error
  adapters/    interfaces/ + telegram/ whatsapp/ web/ + channel-adapter.factory.js
  modules/     auth, emprendimientos, usuarios, canales, productos, variantes,
               clientes, pedidos, stock, eventos-canal, dashboard
  routes/      index.js + un archivo por recurso + webhooks.routes.js
  webhooks/    webhook.controller.js, webhook.service.js
  utils/       logger.js
  app.js       configuracion de Express
  server.js    entry point
db/migrations/ 001_schema_v2.sql
tests/         unit/ + integration/
```

## Instalacion

```bash
npm install
```

Variables de entorno (`.env`):

```env
PORT=3000
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
WEB_CHANNEL_IDENTIFIER=web
TELEGRAM_WEBHOOK_SECRET=
VERIFY_TOKEN=
```

Copia comentada en `.env.example`.

### Las claves: publishable y secret

Supabase esta retirando `anon` y `service_role` (fines de 2026) y el
proyecto usa los nombres nuevos:

| Clave                | Donde vive                    | Para que                                   |
| -------------------- | ----------------------------- | ------------------------------------------ |
| `sb_publishable_...` | `.env`, y tambien el frontend | todo lo que corre con identidad de usuario |
| `sb_secret_...`      | solo el `.env` del backend    | el flujo de webhooks, que no tiene usuario |

Reglas que sigue el codigo:

- **Ninguna operacion con usuario necesita una clave privilegiada.** Si
  algo falla por permisos y la tentacion es "usar la clave secreta", el
  arreglo va en la politica RLS o en la RPC, no en la clave.
- `SUPABASE_SECRET_KEY` es obligatoria **solo** para los webhooks de
  canales (pasos 36 a 47 de `Docs/pruebas-manuales.md`). Un webhook
  llega de Telegram o Meta: no hay sesion, `auth.uid()` es NULL y no
  existe politica RLS capaz de autorizar a un tercero anonimo. Es el
  caso que Supabase documenta como "codigo que corre en un servidor
  tuyo".
- `env.js` clasifica las claves por prefijo y avisa al arrancar si
  encuentra una legacy (`eyJ...`), si la clave secreta quedo en la
  variable publicable o al reves. Los avisos salen con `npm start`.

Si tu proyecto todavia tiene las claves viejas, el backend sigue
funcionando: `SUPABASE_SERVICE_ROLE_KEY` se lee como fallback del nombre
nuevo y aparece un aviso pidiendo el renombre.

## Migracion de la base

Ejecutar en este orden en el SQL Editor de Supabase:

1. `db/migrations/001_schema_v2.sql` — tablas, ENUM, funciones atomicas de
   stock y politicas RLS de aislamiento por emprendimiento.
2. `db/migrations/002_grants_rls.sql` — **obligatoria**. Habilitar RLS no
   alcanza: los roles `anon` y `authenticated` necesitan privilegios
   `GRANT` sobre las tablas. Sin la 002, la API responde
   `42501 permission denied for table ...` y ninguna politica RLS llega a
   evaluarse.

3. `db/migrations/003_crear_emprendimiento_rpc.sql` -- alta atomica de
   emprendimiento. Sin ella, `POST /api/emprendimientos` falla con
   `new row violates row-level security policy`; el `INSERT ... RETURNING` que genera `.insert().select()`
   tiene que pasar `emp_select`, que busca el vinculo en `usuarios_emprendimientos`,
   y ese vinculo todavia no existe durante el INSERT. La RPC crea la fila y
   su vinculo en una sola transaccion. El dueno sale de `auth.uid()`: la
   funcion no acepta un id por parametro, porque un parametro de
   identidad en una funcion `security definer` es un bypass de
   autorizacion. Reejecutala si ya tenias una version anterior: borra la
   firma vieja `crear_emprendimiento(text, uuid)`.

4. `db/migrations/004_stock_tenant_check.sql` -- `ajustar_stock_*` son
   security definer (saltan RLS), asi que el chequeo de tenant va
   adentro de la funcion. Sin la 004, un usuario autenticado podria
   descontar stock del emprendimiento de otro llamando la RPC directo.

5. `db/migrations/005_membresias_sin_autoalta.sql` -- cierra la escalada
   de tenant en las membresias. La policy de INSERT de
   `usuarios_emprendimientos` dejaba `emprendimiento_id` libre: cualquier
   usuario autenticado podia autoinvitarse al emprendimiento de otro con
   un POST a `/rest/v1/usuarios_emprendimientos` y quedaba dentro de
   todos sus datos, porque `usuario_tiene_emprendimiento()` solo mira si
   la fila existe. Ahora el vinculo lo crea unicamente la RPC de la 003
   (dueño desde `auth.uid()`), el alta de emprendimiento tambien, y el
   UPDATE de `emprendimientos` revalida con `WITH CHECK`. La 001 ya trae
   estas mismas policies: la 005 es para una base que ya tiene la 001
   aplicada.

> **Si ya corriste la 001 antes, volve a ejecutarla.** Agrega el trigger
> `on_auth_user_created` sobre `auth.users` y un _backfill_ que repara las
> cuentas que ya existen en Auth sin fila en `public.usuarios`. Ver
> "El espejo `usuarios`" mas abajo.

> El alta de usuario y la creacion de emprendimientos **no** necesitan
> clave privilegiada: corren con el JWT que devuelve `signUp`. La clave
> secreta hace falta solo para los webhooks (pasos 36 a 47); sin ella,
> esos pasos responden 500 y el resto funciona igual.

## El espejo `usuarios`

`public.usuarios` es un espejo de `auth.users`, y
`usuarios_emprendimientos` apunta por FK a **ese** espejo, no a Auth. Un
usuario que existe en Auth pero no en `usuarios` es un estado invalido, y
su sintoma no aparece donde se origino:

```
insert or update on table "usuarios_emprendimientos" violates foreign key
constraint "usuarios_emprendimientos_usuario_id_fkey"
Key (usuario_id)=(...) is not present in table "usuarios".   -- 23503
```

Eso pasa al crear el primer emprendimiento, no en el alta del usuario.

Por eso el perfil no depende de que el backend se acuerde de crearlo:

- `public.asegurar_perfil_usuario(uuid)` (001) es el **unico** lugar que
  escribe el espejo. Es idempotente y `security definer`, asi que lee
  `auth.users` y funciona sin sesion.
- Un trigger `on_auth_user_created` sobre `auth.users` lo invoca. Al estar
  en Auth y no en el backend, da igual quien cree al usuario: el
  registro, el panel de Supabase o la CLI.
- La RPC `crear_emprendimiento` (003) lo vuelve a invocar antes de
  vincular, como red de seguridad.

`UsuarioDao.create` queda solo para reparaciones (hace `ON CONFLICT DO
NOTHING`; un `UPSERT` necesitaria politica de UPDATE, que `usuarios` no
tiene). El registro no lo llama: despues de `signUp` **lee** el perfil
con el token del usuario y, si el espejo no esta, corta con un error que
dice que falta el trigger, en vez de seguir y explotar despues con
`23503`.

### Tres clientes de Supabase

Se eligen por lo que la operacion necesita, no por comodidad:

| Cliente                       | Clave             | Para que                                                             |
| ----------------------------- | ----------------- | -------------------------------------------------------------------- |
| `createSupabaseClient(token)` | publishable + JWT | todo dato de un usuario: RLS decide fila por fila                    |
| `createPublicClient()`        | publishable       | endpoints de Auth (`signUp`, `signInWithPassword`); no toca tablas   |
| `createSecretClient()`        | **secreta**       | solo webhooks (36-47): es el unico flujo sin usuario; **saltea RLS** |

Dos invariantes que conviene no romper:

- `createSupabaseClient()` **sin token lanza error**, no cae a la clave
  secreta. Era el bug original: corria como `anon`, `auth.uid()` era NULL,
  todas las politicas rechazaban la operacion y el alta fallaba en
  silencio. Fallar ruidosamente es lo correcto.
- `createSecretClient()` **solo lo importan los DAOs del flujo de
  webhooks** (`canales`, `clientes`, `eventos-canal`, `pedidos`,
  `productos`, `variantes`, `stock`, `movimiento-stock`). Los DAOs de
  identidad (`usuarios`, `usuario-emprendimiento`, `emprendimiento`) no
  lo tienen disponible a proposito.
  `tests/unit/seguridad.clientes.test.js` falla si aparece en otro lado.

## Ejecucion

```bash
npm run dev     # desarrollo
npm start       # produccion
npm test        # 73 tests (node:test, sin dependencias extra)
npm run smoke   # prueba de humo: arranca el server y checkea la API
```

## Validacion rapida

Para decidir si el proyecto esta sano sin montar nada:

```bash
npm install
npm test        # logica de dominio, con dobles de DAO (no toca la base)
npm run smoke   # el servidor arranca y la API responde
```

`npm run smoke` levanta el server en el puerto 3001, corre 21
comprobaciones y lo apaga. No escribe datos: solo mira codigos de estado
y forma de la respuesta. Cubre salud, 401 en rutas protegidas, token
invalido, validacion de DTO (422), 404 y acceso publico a webhooks.

Lo que el smoke **no** cubre, porque necesita la migracion aplicada y un
usuario real: login, aislamiento por emprendimiento (RLS), reserva de
stock y creacion de pedidos. Para eso, el ciclo completo es:

```bash
# 1. Aplicar db/migrations/001_schema_v2.sql en Supabase
# 2. Crear un usuario (password min. 8 caracteres; el nombre del
#    emprendimiento va anidado en "emprendimiento")
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"yo@emprendimiento.com","password":"clave12345",
       "emprendimiento":{"nombre":"Mi emprendimiento"}}'
# 3. Login y seguir con el token
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"yo@emprendimiento.com","password":"clave12345"}'
```

## Endpoints principales

Publicos:

- `GET  /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /webhooks/telegram`
- `POST /webhooks/whatsapp`
- `POST /webhooks/web`
- `GET  /webhooks/whatsapp` (verificacion de Meta)

Protegidos (`Authorization: Bearer <token>`):

- `GET|POST /api/emprendimientos`
- `GET|PATCH /api/canales`, `POST /api/canales/:id/activar|desactivar`
- `GET|POST /api/productos`, `GET|POST /api/productos/:id/variantes`
- `POST /api/stock/movimientos`, `GET /api/stock/movimientos`
- `GET|POST /api/clientes`
- `GET|POST /api/pedidos`, `PATCH /api/pedidos/:id/estado|cobro|revision`
- `GET /api/dashboard`

El tenant se indica con el header `x-emprendimiento-id` (o query
`emprendimientoId`). Si el usuario tiene un solo emprendimiento, se
resuelve solo.

## Ejemplo: pedido manual

```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
        "items": [{ "productoId": "<uuid>", "cantidad": 2 }],
        "estadoCobro": "PENDIENTE",
        "modalidadEntrega": "RETIRO"
      }'
      ']}
```

Se crea con `origen_tipo = MANUAL`, `canal_id = NULL` y reserva stock.

## Ejemplo: webhook de Telegram

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":42,
       "from":{"id":987,"first_name":"Juan"},
       "text":"2 remeras talle M","date":1735689600}}'
```

Para que funcione, el canal debe estar registrado:

```bash
curl -X POST http://localhost:3000/api/canales \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"tipo":"TELEGRAM","identificadorExterno":"tg_987","nombre":"Bot principal"}'
```

Si el mensaje no se puede interpretar con certeza, el pedido se crea con
`requiere_revision = true` y el evento queda en `REVISION_REQUERIDA`.
