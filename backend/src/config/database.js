import { createClient } from "@supabase/supabase-js";
import { env, validateEnv } from "./env.js";

/**
 * Cliente Supabase con la identidad del USUARIO.
 *
 * Usa la publishable key + el JWT, de modo que PostgREST ejecuta como
 * `authenticated` y las politicas RLS filtran las filas. Es el cliente
 * de todo lo que pasa por `authMiddleware` + `tenantMiddleware` y
 * tambien el del registro de usuario, que corre con la sesion que
 * devuelve `signUp`.
 *
 * @param {string} userToken
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const createSupabaseClient = (userToken) => {
  validateEnv();

  if (!userToken) {
    throw new Error(
      "createSupabaseClient() exige un token de usuario. Si el flujo no " +
        "tiene sesion (webhooks de canales), el cliente correcto es " +
        "createSecretClient()."
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
};

/**
 * Cliente publico: publishable key, SIN identidad de usuario.
 *
 * Es para los endpoints de Supabase Auth (`signUp`,
 * `signInWithPassword`, `updateUser`): no son acceso a datos y no pasan
 * por RLS. Es exactamente lo que hace el navegador con la publishable
 * key, asi que NO necesita ninguna clave privilegiada.
 *
 * No sirve para tocar tablas: sin JWT, auth.uid() es NULL y las
 * politicas de tenant rechazan la operacion.
 */
export const createPublicClient = () => {
  validateEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Cliente secreto (`sb_secret_...`): saltea RLS.
 *
 * Existe por UN solo motivo: un webhook de canal llega de Telegram o
 * Meta, sin sesion y sin ningun usuario al que atribuir la operacion.
 * RLS decide con `auth.uid()`, y ahi no hay ningun uid posible: o el
 * backend usa la clave secreta, o habria que mover todo el flujo de
 * webhooks a funciones SQL `security definer`. Es exactamente el caso
 * que Supabase documenta como "codigo que corre en un servidor tuyo"
 * (ver readme.md).
 *
 * Reglas de uso, no negociables:
 *  - Solo lo instancian los DAOs del flujo de webhooks.
 *  - El emprendimiento sale SIEMPRE del canal registrado
 *    (`canales.identificador_externo`), nunca de un dato del request.
 *  - Nunca en un camino que ya tenga JWT: ahi la respuesta correcta es
 *    RLS, no saltarla.
 *
 * `tests/unit/seguridad.clientes.test.js` falla si este cliente aparece
 * en cualquier archivo fuera de esa lista blanca.
 */
export const createSecretClient = () => {
  validateEnv();

  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY en .env (clave `sb_secret_...`): es " +
        "obligatoria para los webhooks de canales, que corren sin sesion."
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Extrae el token JWT del header Authorization.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export const extractBearerToken = (req) => {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.split(" ")[1];
  return token || null;
};

export default createSupabaseClient;
