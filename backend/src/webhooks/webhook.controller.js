import { WebhookService } from "./webhook.service.js";
import { CHANNEL_TYPE } from "../constants/channel-type.enum.js";
import { logger } from "../utils/logger.js";

/**
 * Controller de webhooks: capa HTTP pura.
 *
 * Recibe req, toma headers/body, delega y devuelve la respuesta que
 * exige cada proveedor. No contiene lógica de negocio.
 */
export class WebhookController {
  constructor({ webhookService } = {}) {
    this.webhookService = webhookService || new WebhookService();

    // Los handlers se pasan como referencias a Express: se ligan al
    // controller para no perder `this`.
    this.receive = this.receive.bind(this);
    this.verifyWhatsapp = this.verifyWhatsapp.bind(this);
    this.telegramGuard = this.telegramGuard.bind(this);
  }

  /**
   * Punto de entrada común a los canales.
   * @param {string} tipoCanal
   * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>}
   */
  receive(tipoCanal) {
    return async (req, res) => {
      try {
        const resultado = await this.webhookService.process(tipoCanal, req.body);

        logger.info(
          `[Webhook] ${tipoCanal} -> ${JSON.stringify(resultado)}`
        );

        return res.status(200).json({ status: "ok", ...resultado });
      } catch (error) {
        logger.error(`[Webhook] Error en ${tipoCanal}`, error.message);

        // 202: el proveedor no debe reintentar un payload que ya se registró
        // con error interno; el reprocesado se hace desde el panel.
        const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 202;

        return res.status(status).json({
          status: "error",
          code: error.code || "WEBHOOK_ERROR",
          message: error.message,
        });
      }
    };
  }

  /** Verificación de Meta (WhatsApp). */
  verifyWhatsapp(req, res) {
    const challenge = this.webhookService.verifyWhatsapp({
      mode: req.query["hub.mode"],
      token: req.query["hub.verify_token"],
      challenge: req.query["hub.challenge"],
    });

    if (challenge) return res.status(200).send(challenge);

    return res
      .status(403)
      .json({ status: "error", message: "Verification token mismatch" });
  }

  /** Validación del secreto de Telegram antes de procesar. */
  telegramGuard(req, res, next) {
    if (!this.webhookService.verifyTelegram(req.headers["x-telegram-bot-api-secret-token"])) {
      return res.status(401).json({
        status: "error",
        message: "Secreto de Telegram inválido",
      });
    }
    return next();
  }
}

export { CHANNEL_TYPE };
export default WebhookController;