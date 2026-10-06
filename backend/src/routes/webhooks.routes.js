import { Router } from "express";
import { WebhookController } from "../webhooks/webhook.controller.js";
import { WebhookService } from "../webhooks/webhook.service.js";
import { CHANNEL_TYPE } from "../constants/channel-type.enum.js";

const router = Router();
const controller = new WebhookController({ webhookService: new WebhookService() });

// Verificación de suscripción de Meta (WhatsApp).
router.get("/whatsapp", controller.verifyWhatsapp);

// Recepción de eventos. No requiere JWT: la autenticidad la garantiza
// que el canal externo esté registrado en `canales`.
router.post("/telegram", controller.telegramGuard, controller.receive(CHANNEL_TYPE.TELEGRAM));
router.post("/whatsapp", controller.receive(CHANNEL_TYPE.WHATSAPP));
router.post("/web", controller.receive(CHANNEL_TYPE.WEB));

export default router;