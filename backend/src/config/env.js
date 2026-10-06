// Configuración centralizada y validada de variables de entorno.
// Falla rápido al arrancar si falta algo requerido.
import dotenv from "dotenv";

dotenv.config();

const read = (key, fallback) => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

/**
 * Clasifica una clave de Supabase por su formato.
 *
 * Supabase deprecó las claves `anon` y `service_role` (fines de 2026): los
 * proyectos nuevos usan `sb_publishable_...` (bajo privilegio) y
 * `sb_secret_...` (alto privilegio). Las viejas eran JWT, y un JWT
 * empieza con `eyJ`. Sirve para avisar, no para bloquear: un proyecto
 * puede estar todavía en la etapa anterior de la migración.
 *
 * @param {string|undefined} clave
 * @returns {'publishable'|'secret'|'legacy-jwt'|'desconocida'|'ausente'}
 */
export const clasificarClave = (clave) => {
  if (!clave) return "ausente";
  if (clave.startsWith("sb_publishable_")) return "publishable";
  if (clave.startsWith("sb_secret_")) return "secret";
  if (clave.startsWith("eyJ")) return "legacy-jwt";
  return "desconocida";
};

export const env = {
  NODE_ENV: read("NODE_ENV", "development"),
  PORT: Number(read("PORT", 3000)),

  SUPABASE_URL: read("SUPABASE_URL", read("VITE_SUPABASE_URL")),

  // Clave publicable (`sb_publishable_...`). La usa TODO lo que corre con
  // identidad de usuario: el backend la usa igual que el navegador y las
  // políticas RLS deciden fila por fila. Ninguna operación de datos
  // necesita más que esto.
  SUPABASE_PUBLISHABLE_KEY: read(
    "SUPABASE_PUBLISHABLE_KEY",
    read("VITE_SUPABASE_PUBLISHABLE_KEY")
  ),

  // Clave secreta (`sb_secret_...`). Saltea RLS: la usa únicamente el
  // flujo de webhooks, que por definición no tiene usuario (quien llama
  // es Telegram o Meta, no una persona logueada). Nunca en un camino que
  // ya tenga JWT.
  //
  // `SUPABASE_SERVICE_ROLE_KEY` es el nombre legado (la vieja service_role
  // key): se sigue leyendo para no romper un .env que ya la tenga, pero
  // corresponde renombrar la variable.
  SUPABASE_SECRET_KEY: read(
    "SUPABASE_SECRET_KEY",
    read("SUPABASE_SERVICE_ROLE_KEY")
  ),

  // Identificador del frontend/panel que puede pedir canales de tipo WEB.
  WEB_CHANNEL_IDENTIFIER: read("WEB_CHANNEL_IDENTIFIER", "web"),

  TELEGRAM: {
    VERIFY_SECRET: read("TELEGRAM_WEBHOOK_SECRET", ""),
  },

  WHATSAPP: {
    VERIFY_TOKEN: read("VERIFY_TOKEN", ""),
    PHONE_NUMBER_ID: read("WHATSAPP_PHONE_NUMBER_ID", ""),
    ACCESS_TOKEN: read("WHATSAPP_ACCESS_TOKEN", ""),
  },
};

// Claves internas obligatorias -> nombre real en .env, para que el error
// sea accionable.
const REQUIRED = {
  SUPABASE_URL: "VITE_SUPABASE_URL (o SUPABASE_URL)",
  SUPABASE_PUBLISHABLE_KEY:
    "SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY",
};

/**
 * Valida la configuración. Se invoca desde server.js (no al importar)
 * para permitir que los tests importen el módulo sin .env.
 * @returns {string[]} lista de variables faltantes
 */
export const validateEnv = () => {
  const missing = Object.keys(REQUIRED).filter((key) => !env[key]);
  if (missing.length > 0) {
    const names = missing.map((key) => REQUIRED[key]).join(", ");
    throw new Error(
      `Configuración de entorno incompleta. Faltan en .env: ${names}`
    );
  }
  return missing;
};

/**
 * Avisos de configuración que no impiden arrancar: se loguean en
 * server.js. Evitan el escenario silencioso, que es el peor: un backend
 * arrancando con una clave legacy o, peor, con la clave secreta en el
 * lugar de la publicable.
 * @returns {string[]}
 */
export const advertenciasDeEntorno = () => {
  const avisos = [];
  const publica = clasificarClave(env.SUPABASE_PUBLISHABLE_KEY);
  const secreta = clasificarClave(env.SUPABASE_SECRET_KEY);

  if (publica === "legacy-jwt") {
    avisos.push(
      "La clave publicable es una clave legacy (anon). Supabase la deprecia a " +
        "fines de 2026: cambiala por `sb_publishable_...` en Project Settings -> API Keys."
    );
  }
  if (publica === "secret") {
    avisos.push(
      "La variable publicable contiene una clave SECRETA (sb_secret_...). Esa " +
        "clave saltea RLS: no puede usarse como clave de la API ni viajar al navegador."
    );
  }
  if (secreta === "legacy-jwt") {
    avisos.push(
      "La variable secreta contiene una clave legacy (service_role). Renombrá " +
        "`SUPABASE_SERVICE_ROLE_KEY` a `SUPABASE_SECRET_KEY` con el valor sb_secret_... " +
        "(los webhooks siguen funcionando igual hasta fines de 2026)."
    );
  }
  if (secreta === "publishable") {
    avisos.push(
      "SUPABASE_SECRET_KEY tiene una clave PUBLICABLE: los webhooks van a fallar " +
        "con RLS, porque corren sin sesión."
    );
  }
  if (secreta === "ausente") {
    avisos.push(
      "Falta SUPABASE_SECRET_KEY (sb_secret_...): los webhooks de canales van a " +
        "responder 500 hasta que la definas."
    );
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY) {
    avisos.push(
      "Solo está definida `SUPABASE_SERVICE_ROLE_KEY` (nombre legado): renombrala a " +
        "`SUPABASE_SECRET_KEY`. Es la misma clave, con el nombre actual."
    );
  }

  return avisos;
};

export default env;
