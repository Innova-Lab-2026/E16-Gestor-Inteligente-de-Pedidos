import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware genérico de validación con Zod.
 *
 * Uso: router.post("/x", validate({ body: schema, params: schema }), handler)
 *
 * El resultado del parseo se inyecta en req.validated y reemplaza a
 * req.body / req.params / req.query, de modo que el controller no
 * trabajo con datos sin sanitizar.
 *
 * @param {{ body?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny }} schemas
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    req.validated = req.validated || {};
    for (const source of ["params", "query", "body"]) {
      const schema = schemas?.[source];
      if (!schema) continue;
      const parsed = schema.parse(req[source] ?? {});
      req.validated[source] = parsed;
      if (source === "body") req.body = parsed;
    }
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return next(
        new AppError("Datos inválidos", 422, "VALIDATION_ERROR", {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        })
      );
    }
    return next(error);
  }
};

export default validate;