// Prueba de humo: valida que el servidor arranque y que la superficie
// publica/protega se comporte. No toca datos reales: solo comprueba
// codigos de estado y forma de la respuesta.
//
//   node tests/smoke.js
//
// Requiere .env con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.SMOKE_PORT || 3001);
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

/** Devuelve { status, body } sin lanzar excepcion en 4xx/5xx. */
const call = async (path, options = {}) => {
  try {
    const res = await fetch(`${BASE}${path}`, options);
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } catch (error) {
    return { status: 0, body: String(error.message) };
  }
};

const server = spawn("node", ["src/server.js"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

// Espera a que el puerto responda (max ~10s).
const waitForBoot = async () => {
  for (let i = 0; i < 50; i++) {
    const { status } = await call("/api/health");
    if (status === 200) return true;
    await sleep(200);
  }
  return false;
};

try {
  console.log(`\nArrancando servidor en el puerto ${PORT}...`);
  const booted = await waitForBoot();

  if (!booted) {
    console.log("El servidor no respondio en /api/health.");
    console.log("Salida del proceso:\n" + serverLog);
    console.log("\nRevisa .env: faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.\n");
    process.exit(1);
  }

  console.log("\n1. Salud y raiz");
  const health = await call("/api/health");
  check("GET /api/health -> 200", health.status === 200);
  check("health informa OK", health.body?.status === "OK");

  const root = await call("/");
  check("GET / -> 200", root.status === 200);

  console.log("\n2. Autenticacion (JWT requerido)");
  for (const path of [
    "/api/pedidos",
    "/api/productos",
    "/api/clientes",
    "/api/canales",
    "/api/dashboard",
  ]) {
    const { status, body } = await call(path);
    check(`GET ${path} sin token -> 401`, status === 401, `(llego ${status})`);
    check(`401 con codigo de error`, body?.error?.code === "UNAUTHORIZED");
  }

  console.log("\n3. Token invalido");
  const bad = await call("/api/pedidos", {
    headers: { Authorization: "Bearer no-es-un-jwt" },
  });
  check("Bearer invalido -> 401", bad.status === 401, `(llego ${bad.status})`);

  console.log("\n4. Validacion de entrada (DTO / zod)");
  // 422 y no 400: el body es sintacticamente valido, el problema es de
  // esquema. Es lo que define validate.middleware.js (VALIDATION_ERROR).
  const badBody = await call("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  check("POST /api/auth/login sin body -> 422", badBody.status === 422, `(llego ${badBody.status})`);
  check("422 con codigo VALIDATION_ERROR", badBody.body?.error?.code === "VALIDATION_ERROR");
  check("422 reporta los issues del DTO", Array.isArray(badBody.body?.error?.details?.issues));

  console.log("\n5. 404 y 405");
  const missing = await call("/api/no-existe");
  check("ruta inexistente -> 404", missing.status === 404);
  check("404 con codigo NOT_FOUND", missing.body?.error?.code === "NOT_FOUND");

  console.log("\n6. Webhooks publicos (no exigen JWT)");
  const tg = await call("/webhooks/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ update_id: 999999 }),
  });
  check("POST /webhooks/telegram responde sin 401", tg.status !== 401, `(llego ${tg.status})`);

  const wa = await call("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=incorrecto&hub.challenge=1");
  check("GET /webhooks/whatsapp con token erroneo -> 403", wa.status === 403, `(llego ${wa.status})`);

  console.log(`\nResultado: ${passed} ok, ${failed} fail\n`);
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  server.kill("SIGTERM");
  // node:test / fetch pueden dejar handles abiertos en Windows.
  await sleep(300);
  if (!server.killed) server.kill("SIGKILL");
}
