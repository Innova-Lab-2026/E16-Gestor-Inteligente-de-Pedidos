export function notFoundMiddleware(req, res, _next) {
  const msg = `Ruta no encontrada: ${req.method} ${req.originalUrl}`;
  return res.status(404).json({ error: msg, message: msg });
}

export function errorMiddleware(err, req, res, _next) {
  console.error("[Backend Error]", req.method, req.originalUrl, err);

  if (err?.name === "ZodError") {
    const detalle = (err.issues || err.errors || [])
      .map((i) => i.message)
      .join(", ");
    const msg = detalle || "Datos de entrada inválidos";
    return res.status(400).json({ error: msg, message: msg });
  }

  const status = err?.statusCode || err?.status || 500;
  const msg =
    status < 500 || process.env.NODE_ENV !== "production"
      ? err?.message || "Error interno del servidor"
      : "Error interno del servidor";

  return res.status(status).json({ error: msg, message: msg });
}

export default errorMiddleware;