# Frontend — Gestor Inteligente de Pedidos, Ventas y Stock

Aplicación web (Next.js) para que emprendedores centralicen pedidos, ventas, clientes y stock.
Esta carpeta (`frontend/`) contiene todo el código del frontend. Se puede ejecutar localmente con pnpm o, de forma opcional, con Docker.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- pnpm
- Docker + Docker Compose (opcional)

## Requisitos

- Node.js 20.9 o posterior y pnpm (se puede habilitar con `corepack enable`)
- Docker Compose v2 solo si se elige la opción Docker
- Git

## Puesta en marcha local

Para probar el flujo completo, levantá primero Express y luego Next.js. Los comandos de frontend se ejecutan desde `frontend/`.

### 1. Clonar el repositorio

```bash
git clone https://github.com/Innova-Lab-2026/E16-Gestor-Inteligente-de-Pedidos.git
cd E16-Gestor-Inteligente-de-Pedidos
```

### 2. Configurar y levantar el backend

En una terminal:
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Completá `backend/.env` con el archivo compartido por el equipo (incluye las credenciales de Supabase y las claves de Meta WhatsApp; **no modifiques `WHATSAPP_ENCRYPTION_KEY`**). Express escucha en `http://localhost:3001`; comprobá que esté disponible con `http://localhost:3001/api/health`. La configuración completa está en [backend/README.md](../backend/README.md).

### 3. Configurar y levantar Next.js

En otra terminal, desde la raíz del repositorio:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Abrí **http://localhost:3000**. El `.env.example` define `BACKEND_API_URL=http://localhost:3001/api`; es una variable privada de servidor, no lleva el prefijo `NEXT_PUBLIC_`, e incluye `/api`.

> `.env.local` contiene configuración propia de cada persona y **no se sube al repositorio**.

### Pruebas de pedidos entrantes por WhatsApp (QA)

Para visualizar en el panel web (`/pedidos` y `/dashboard`) los pedidos generados automáticamente desde WhatsApp:

1. Mantené activo el backend en el puerto `3001` junto con el túnel público HTTPS (pestaña **Puertos** de VS Code en visibilidad **Pública**).
2. Verificá que el producto a pedir exista activo en el catálogo/Supabase del emprendimiento.
3. Seguí el circuito de pruebas de WhatsApp en [PRUEBAS_POSTMAN_CIRCUITO.md](../PRUEBAS_POSTMAN_CIRCUITO.md).

### Opción: ejecutar el frontend con Docker

```bash
docker compose up --build
```

Docker publica Next.js en **http://localhost:4000**. En este modo, editá `frontend/.env.local` para que el servidor de Next llegue al backend del host:

```env
BACKEND_API_URL=http://host.docker.internal:3001/api
```

### 4. Apagar

```bash
docker compose down
```

Para la ejecución local con pnpm, detené cada servidor con `Ctrl+C` en su terminal.

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

## Conexión con el backend y CORS

- Los únicos `fetch` al backend están en Server Actions y en `getSession`; el navegador habla con Next.js y Next.js llama a Express desde el servidor. Por eso esas llamadas son server-to-server y no están sujetas a CORS.
- `CORS_ORIGINS` en el backend restringe las llamadas que sí provengan de un navegador. Su valor local por defecto es `http://localhost:3000` (Next.js en desarrollo); no se usa `*`.
- En Docker, `localhost` dentro del contenedor es el propio contenedor. Por eso `BACKEND_API_URL` debe apuntar a `host.docker.internal` como se indica arriba. Si en el futuro el navegador llama directamente a Express desde la UI publicada por Docker, agregá también `http://localhost:4000` a `CORS_ORIGINS`.

## Despliegue en Vercel

La demo está disponible en https://e16-gestor-inteligente-de-pedidos.vercel.app/.

En la configuración del proyecto de Vercel, cargá la URL real del backend
desplegado en esta variable privada, incluyendo `/api`:

```env
BACKEND_API_URL=https://e16-gestor-inteligente-de-pedidos.onrender.com/api
```

El backend de la demo corre en Render. En el plan gratuito se suspende por inactividad, así que la primera petición puede demorar cerca de un minuto.

No cargues claves de Supabase en Vercel: el frontend se comunica con Supabase a través del backend.

Para dominios de preview de Vercel, configurá `CORS_ORIGINS` en el backend solo si alguna ruta comienza a ser llamada directamente desde el navegador. El flujo actual de autenticación no requiere CORS para hablar con Express.

## Problemas frecuentes

**`env file ... .env.local not found`**
Falta crear el archivo de variables. Ejecutá `cp .env.example .env.local` en `frontend/`.

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
Todo dentro de `frontend/src/`:
```bash
src/
├─ app/
│  ├─ (public)/
│  │  ├─ forgot-password/
│  │  ├─ login/
│  │  └─ registro/
│  └─ (app)/
│     ├─ catalogo/
│     ├─ clientes/
│     ├─ configuracion/
│     ├─ dashboard/
│     ├─ emprendimientos/
│     ├─ hoy/
│     ├─ reportes/
│     └─ pedidos/
├─ components/
│  ├─ auth/
│  ├─ emprendimientos/
│  └─ layout/
├─ config/
├─ features/
│  ├─ auth/
│  ├─ clientes/
│  ├─ dashboard/
│  ├─ emprendimientos/
│  └─ pedidos/
└─ lib/
```