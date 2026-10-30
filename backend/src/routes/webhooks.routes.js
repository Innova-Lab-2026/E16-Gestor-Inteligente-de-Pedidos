import { Router } from "express";
import { WebhookController } from "../webhooks/webhook.controller.js";
import { WebhookService } from "../webhooks/webhook.service.js";
import { CHANNEL_TYPE } from "../constants/channel-type.enum.js";
import { integrations } from "../config/integrations.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { logger } from "../utils/logger.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const router = Router();
const controller = new WebhookController({ webhookService: new WebhookService() });

/**
 * Valida la firma X-Hub-Signature-256 de los webhooks de WhatsApp Cloud API.
 * Meta firma el cuerpo crudo de la petición con el secreto de la app.
 * No se modifica el cuerpo previamente: se usa req.rawBody (capturado por
 * el verify de express.json en app.js).
 */
const validateWhatsAppSignature = (req, res, next) => {
  const appSecret = integrations.whatsapp.appSecret;
  if (!appSecret) {
    // Sin secreto configurado, no se puede validar: se permite pasar
    // (modo desarrollo/sin credenciales de Meta aún).
    logger.warn("[WhatsApp] Falta WHATSAPP_APP_SECRET: firma no validada");
    return next();
  }

  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    logger.warn("[WhatsApp] Falta header X-Hub-Signature-256");
    return next(new UnauthorizedError("Falta firma de webhook de WhatsApp"));
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.warn("[WhatsApp] Cuerpo crudo no disponible para validar firma");
    return next(new UnauthorizedError("Cuerpo crudo no disponible"));
  }

  // El header viene como "sha256=<hex>"
  const match = signature.match(/^sha256=(.+)$/);
  if (!match) {
    logger.warn("[WhatsApp] Formato de firma invalido");
    return next(new UnauthorizedError("Formato de firma invalido"));
  }

  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const providedHash = Buffer.from(match[1], "hex");
  const expectedHash = Buffer.from(expected, "hex");

  // timingSafeEqual requiere buffers del mismo largo; si difieren, ya sabemos
  // que la firma no coincide sin necesidad de comparar.
  if (providedHash.length !== expectedHash.length || !timingSafeEqual(providedHash, expectedHash)) {
    logger.warn("[WhatsApp] Firma invalida");
    return next(new UnauthorizedError("Firma de webhook invalida"));
  }

  return next();
};

// Verificación de suscripción de Meta (WhatsApp).
router.get("/whatsapp", controller.verifyWhatsapp);

// Recepción de eventos. No requiere JWT: la autenticidad la garantiza
// que el canal externo esté registrado en `canales`.
router.post("/telegram", controller.telegramGuard, controller.receive(CHANNEL_TYPE.TELEGRAM));
router.post("/whatsapp", validateWhatsAppSignature, controller.receive(CHANNEL_TYPE.WHATSAPP));
router.post("/web", controller.receive(CHANNEL_TYPE.WEB));

export { validateWhatsAppSignature };
export default router;