import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";

/** 404 para rutas no registradas. */
export const notFoundMiddleware = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` },
  });
};

/**
 * Middleware centralizado de errores.
 * Los AppError se serializan con su statusCode; el resto es 500
 * y no se filtra el detalle al cliente.
 */
// eslint-disable-next-line no-unused-vars -- Express detecta el handler por aridad 4
export const errorMiddleware = (error, req, res, next) => {
  if (error instanceof AppError) {
    logger.warn(`[${error.code}] ${error.message}`);
    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  logger.error("Error no controlado", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    },
  });
};

/**
 * Envuelve un handler async para que los rechazos lleguen a Express 5
 * (que ya soporta promesas, pero mantenemos el helper para handlers
 * compuestos y para tests unitarios).
 * @param {Function} handler
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export default errorMiddleware;