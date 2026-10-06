import { extractBearerToken, createSupabaseClient } from "../config/database.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware de autenticación.
 * Valida el JWT contra Supabase Auth e inyecta:
 *   req.userToken -> JWT crudo
 *   req.user      -> { id, email }
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError(
        "Acceso denegado: se requiere el header 'Authorization: Bearer <token>'"
      );
    }

    const supabase = createSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedError("Token inválido o sesión expirada", {
        supabaseMessage: error?.message,
      });
    }

    req.userToken = token;
    req.user = { id: data.user.id, email: data.user.email };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Versión laxa: sólo extrae el token sin validarlo.
 * Útil para operaciones públicas que igual deben propagar el JWT.
 */
export const optionalAuthMiddleware = (req, res, next) => {
  const token = extractBearerToken(req);
  if (token) req.userToken = token;
  return next();
};

export default authMiddleware;