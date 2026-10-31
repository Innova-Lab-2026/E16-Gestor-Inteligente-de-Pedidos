import { Router } from "express";
import { WebhookController } from "../webhooks/webhook.controller.js";
import { WebhookService } from "../webhooks/webhook.service.js";
import { CHANNEL_TYPE } from "../constants/channel-type.enum.js";
import { integrations } from "../config/integrations.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { InternalServerError } from "../errors/internal-server.error.js";
import { logger } from "../utils/logger.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const router = Router();
const controller = new WebhookController({
  webhookService: new WebhookService(),
});

/**
 * Valida la firma X-Hub-Signature-256 de los webhooks de WhatsApp Cloud API.
 * Meta firma el cuerpo crudo de la petición con el secreto de la app.
 * No se modifica el cuerpo previamente: se usa req.rawBody (capturado por
 * el verify de express.json en app.js).
 */
const validateWhatsAppSignature = (req, res, next) => {
  const appSecret = integrations.whatsapp.appSecret;

  if (!appSecret) {
    return next(new InternalServerError("WHATSAPP_APP_SECRET no configurado"));
  }

  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    logger.warn("[WhatsApp] Falta header X-Hub-Signature-256");
    return next(new UnauthorizedError("Falta firma de webhook de WhatsApp"));
  }

  if (!Buffer.isBuffer(req.rawBody)) {
    logger.warn("[WhatsApp] Cuerpo crudo no disponible para validar firma");
    return next(new UnauthorizedError("Cuerpo crudo no disponible"));
  }

  const match = signature.match(/^sha256=([a-f0-9]{64})$/i);

  if (!match) {
    logger.warn("[WhatsApp] Formato de firma inválido");
    return next(new UnauthorizedError("Formato de firma inválido"));
  }

  const expectedHash = createHmac("sha256", appSecret)
    .update(req.rawBody)
    .digest();

  const providedHash = Buffer.from(match[1], "hex");

  if (!timingSafeEqual(expectedHash, providedHash)) {
    logger.warn("[WhatsApp] Firma inválida");
    return next(new UnauthorizedError("Firma de webhook inválida"));
  }

  return next();
};

// Verificación de suscripción de Meta (WhatsApp).
router.get("/whatsapp", controller.verifyWhatsapp);

// Recepción de eventos. No requiere JWT: la autenticidad la garantiza
// que el canal externo esté registrado en `canales`.
router.post(
  "/telegram",
  controller.telegramGuard,
  controller.receive(CHANNEL_TYPE.TELEGRAM),
);
router.post(
  "/whatsapp",
  validateWhatsAppSignature,
  controller.receive(CHANNEL_TYPE.WHATSAPP),
);
router.post("/web", controller.receive(CHANNEL_TYPE.WEB));

export { validateWhatsAppSignature };
export default router;
