import { channelAdapterFactory } from "../adapters/channel-adapter.factory.js";
import { CHANNEL_TYPE } from "../constants/channel-type.enum.js";
import { EventoCanalService } from "../modules/eventos-canal/evento-canal.service.js";
import { integrations } from "../config/integrations.js";
import { logger } from "../utils/logger.js";
import { NotFoundError } from "../errors/not-found.error.js";
import { AppError } from "../errors/app-error.js";

/**
 * Servicio de webhooks: sólo técnica de integración.
 *
 * Responsabilidades: identificar el canal, obtener el adapter,
 * normalizar el payload y delegar en el módulo de eventos.
 * No crea pedidos, no toca stock, no busca productos.
 */
export class WebhookService {
  /**
   * @param {{ adapterFactory?: import('../adapters/channel-adapter.factory.js').ChannelAdapterFactory, eventoCanalService?: EventoCanalService }} [deps]
   */
  constructor({ adapterFactory, eventoCanalService } = {}) {
    this.adapterFactory = adapterFactory || channelAdapterFactory;
    this.eventoCanalService = eventoCanalService || new EventoCanalService();
  }

  /**
   * @param {'TELEGRAM'|'WHATSAPP'|'WEB'} tipoCanal
   * @param {object} rawBody
   * @returns {Promise<{duplicado: boolean, pedidoId?: string, mensaje: string}>}
   */
  async process(tipoCanal, rawBody) {
    const adapter = this.adapterFactory.get(tipoCanal);

    const evento = adapter.parseAndNormalize(rawBody);
    if (!evento) {
      // Payload técnico (status, ping, etc.): no es un mensaje de negocio.
      return { duplicado: false, ignorado: true, mensaje: "Payload sin mensaje entrante" };
    }

    const resultado = await this.eventoCanalService.process(evento);

    if (resultado.duplicado) {
      return {
        duplicado: true,
        pedidoId: resultado.pedidoId,
        mensaje: "Evento ya procesado",
      };
    }

    return {
      duplicado: false,
      pedidoId: resultado.pedido?.id,
      requiereRevision: Boolean(resultado.pedido?.requiere_revision),
      mensaje: "Evento procesado",
    };
  }

  /** Verificación de suscripción de Meta (WhatsApp). */
  verifyWhatsapp({ mode, token, challenge }) {
    if (
      mode === "subscribe" &&
      token &&
      token === integrations.whatsapp.verifyToken
    ) {
      logger.info("[Webhook] WhatsApp webhook verificado");
      return challenge;
    }
    return null;
  }

  /** Verificación opcional por secreto de Telegram. */
  verifyTelegram(secret) {
    if (!integrations.telegram.verifySecret) return true;
    return secret === integrations.telegram.verifySecret;
  }

  get tiposSoportados() {
    return Object.values(CHANNEL_TYPE);
  }
}

export { NotFoundError, AppError };
export default WebhookService;