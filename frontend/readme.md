# Frontend — Gestor Inteligente de Pedidos, Ventas y Stock

Aplicación web (Next.js) para que emprendedores centralicen pedidos, ventas, clientes y stock.
Esta carpeta (`frontend/`) contiene todo el código del frontend y se ejecuta **con Docker**: no hace falta instalar Node, pnpm ni ninguna otra herramienta.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- pnpm (dentro del contenedor)
- Docker + Docker Compose

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) con Docker Compose v2 (`docker compose version` debe funcionar)
- Git

No se necesita nada más.

## Puesta en marcha local

Todos los comandos se ejecutan desde la carpeta `frontend/`.

### 1. Clonar el repositorio y entrar a la carpeta

```bash
git clone https://github.com/Innova-Lab-2026/E16-Gestor-Inteligente-de-Pedidos.git
cd E16-Gestor-Inteligente-de-Pedidos
git checkout <tu-rama>        # o la rama que corresponda
cd frontend
```

### 2. Crear el archivo de variables de entorno

```bash
cp .env.example .env.local
```

Contenido por defecto:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend, vista desde el navegador. Por defecto, el backend corre en el puerto 3000. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase (completar cuando el equipo la defina). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase (completar cuando el equipo la defina). |

> `.env.local` contiene configuración propia de cada persona y **no se sube al repositorio**.
> Si agregás una variable nueva, sumala también a `.env.example`.

### 3. Levantar la aplicación

```bash
docker compose up --build
```

La primera vez tarda unos minutos porque descarga la imagen e instala las dependencias.
Cuando veas que Next.js quedó listo, abrí:

**http://localhost:4000**

> El frontend usa el puerto **4000** de tu máquina (el contenedor escucha en el 3000 internamente),
> para no chocar con el backend, que usa el 3000.

### 4. Apagar

```bash
docker compose down
```

## Comandos útiles

| Qué querés hacer | Comando |
|---|---|
| Levantar en segundo plano | `docker compose up -d` |
| Ver los logs | `docker compose logs -f web` |
| Reconstruir la imagen | `docker compose up --build` |
| Instalar una dependencia | `docker compose exec web pnpm add <paquete>` |
| Instalar tras un `git pull` con dependencias nuevas | `docker compose exec web pnpm install` |
| Correr el linter | `docker compose exec web pnpm lint` |
| Abrir una terminal dentro del contenedor | `docker compose exec web sh` |
| Reiniciar todo desde cero (borra `node_modules` del volumen) | `docker compose down -v && docker compose up --build` |

Los cambios que hagas en el código se reflejan automáticamente en el navegador (hot reload).

## Conexión con el backend

- Con el backend corriendo en `http://localhost:3000`, el frontend lo consulta desde el navegador usando `NEXT_PUBLIC_API_URL`.
- El backend debe permitir el origen `http://localhost:4000` en su configuración de **CORS**; si no, el navegador bloquea las llamadas y verás errores de CORS en la consola.
- Dentro del contenedor, `localhost` es el propio contenedor y no tu máquina. Esto no afecta a las llamadas hechas desde el navegador, pero sí a las que haga el servidor de Next (Server Components, Server Actions). Si llegara ese caso, hay que usar `host.docker.internal` y agregar al servicio `web` del `docker-compose.yml`:

  ```yaml
  extra_hosts:
    - "host.docker.internal:host-gateway"
  ```

## Problemas frecuentes

**`env file ... .env.local not found`**
Falta crear el archivo de variables. Ejecutá `cp .env.example .env.local` (paso 2).

**`port is already allocated` / `address already in use`**
El puerto 4000 está ocupado por otro programa. Cerralo o cambiá el primer número en `docker-compose.yml` (por ejemplo `"4001:3000"`) y accedé por ese puerto.

**El hot reload no detecta los cambios (Windows/Mac)**
El `docker-compose.yml` ya define `WATCHPACK_POLLING=true`. Si aun así no actualiza, reiniciá con `docker compose restart web`.

**Error de módulo no encontrado tras hacer `git pull`**
Alguien sumó una dependencia. Ejecutá `docker compose exec web pnpm install`.

**En Linux, los archivos generados (`.next`, etc.) quedan como `root` y no podés editarlos o borrarlos**
Recuperá la propiedad de la carpeta:

```bash
sudo chown -R $USER:$USER .
```

**Algo se rompió de forma rara y no sé por qué**
Reiniciá limpio: `docker compose down -v && docker compose up --build`.

## Qué no subir al repositorio

`.env.local`, `node_modules/`, `.next/` y `.pnpm-store/` deben estar en el `.gitignore`. El `.env.example` **sí** se sube (agregá `!.env.example` al final del `.gitignore` si Next lo está ignorando).

# Estructura de carpetas
Todo dentro de frontend/src/:
```bash
src/
├─ app/                          # Solo rutas y layouts. Sin lógica de negocio.
│  ├─ (public)/                  # Sin sesión (el "observador")
│  │  ├─ login/
│  │  └─ registro/
│  ├─ (app)/                     # Con sesión (se protege acá, tarea siguiente)
│  │  ├─ dashboard/
│  │  ├─ pedidos/
│  │  ├─ catalogo/
│  │  ├─ stock/
│  │  ├─ clientes/
│  │  └─ configuracion/
│  ├─ layout.tsx
│  └─ globals.css
├─ features/                     # Un módulo por área del negocio
│  ├─ auth/
│  ├─ catalogo/
│  ├─ pedidos/
│  ├─ stock/
│  ├─ clientes/
│  └─ dashboard/
│     ├─ components/             # Componentes que solo usa este módulo
│     ├─ hooks/
│     ├─ api.ts                  # Llamadas al backend de este módulo
│     ├─ schemas.ts              # Validaciones de formularios
│     └─ types.ts
├─ components/                   # Componentes compartidos por todos
│  ├─ ui/                        # Genéricos: Button, Input, Modal...
│  └─ layout/                    # Marco de la app: Sidebar, Topbar, PageHeader
├─ lib/                          # Cliente HTTP, utilidades
├─ config/                       # Rutas, estados del pedido, constantes
└─ types/                        # Tipos globales
```