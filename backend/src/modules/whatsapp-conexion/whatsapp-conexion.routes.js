import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middlewares/validator.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../../middlewares/tenant.middleware.js";
import { WhatsAppConexionController } from "./whatsapp-conexion.controller.js";
import {
  conectarWhatsappSchema,
  conectarManualWhatsappSchema,
  callbackWhatsappSchema,
  enviarMensajeSchema,
} from "./dtos/index.js";

const router = Router();
const controller = new WhatsAppConexionController();

const idParams = validate({ params: z.object({ id: z.string().uuid() }) });

// Todas las rutas requieren autenticacion y tenant
router.use(authMiddleware, tenantMiddleware());

// Inicio de conexion Embedded Signup
router.post(
  "/whatsapp/conectar",
  validate({ body: conectarWhatsappSchema }),
  controller.iniciarConexion
);

// Conexion manual de prueba (Meta Cloud API, sin Embedded Signup)
router.post(
  "/whatsapp/conectar-manual",
  validate({ body: conectarManualWhatsappSchema }),
  controller.conectarManual
);

// Callback de Meta Embedded Signup
router.get(
  "/whatsapp/callback",
  validate({ query: callbackWhatsappSchema }),
  controller.completarConexion
);

// Listar conexiones del emprendimiento actual
router.get("/whatsapp", controller.listarConexiones);

// Obtener detalle de una conexion
router.get(
  "/whatsapp/:id",
  idParams,
  controller.obtenerConexion
);

// Desactivar una conexion
router.post(
  "/whatsapp/:id/desactivar",
  idParams,
  validate({ body: z.object({ emprendimientoId: z.string().uuid() }) }),
  controller.desactivarConexion
);

// Eliminar una conexion
router.delete(
  "/whatsapp/:id",
  idParams,
  validate({ body: z.object({ emprendimientoId: z.string().uuid() }) }),
  controller.eliminarConexion
);

// Envio de mensaje saliente por WhatsApp
router.post(
  "/whatsapp/enviar",
  validate({ body: enviarMensajeSchema }),
  controller.enviarMensaje
);

export default router;
