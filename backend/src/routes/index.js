import { Router } from "express";
import authRoutes from "./auth.routes.js";
import emprendimientosRoutes from "./emprendimientos.routes.js";
import canalesRoutes from "./canales.routes.js";
import productosRoutes, { stockRouter, variantesRouter } from "./productos.routes.js";
import clientesRoutes from "./clientes.routes.js";
import pedidosRoutes from "./pedidos.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import webhooksRoutes from "./webhooks.routes.js";

/**
 * Router principal de la API (/api).
 * Un único lugar donde se declara la superficie HTTP.
 */
const router = Router();

// Webhooks públicos: se montan también en /webhooks desde app.js.
router.use("/webhooks", webhooksRoutes);

// Salud del servicio.
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API de gestión de pedidos multicanal",
    timestamp: new Date().toISOString(),
  });
});

// Autenticación
router.use("/auth", authRoutes);

// Dominio (requieren JWT + tenant)
router.use("/emprendimientos", emprendimientosRoutes);
router.use("/canales", canalesRoutes);
router.use("/productos", productosRoutes);
router.use("/variantes", variantesRouter);
router.use("/stock", stockRouter);
router.use("/clientes", clientesRoutes);
router.use("/pedidos", pedidosRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;