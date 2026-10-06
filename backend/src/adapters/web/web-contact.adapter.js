import { CHANNEL_TYPE } from "../../constants/channel-type.enum.js";
import { ChannelAdapter } from "../interfaces/channel.adapter.interface.js";
import { NormalizedChannelEvent } from "../channel-event.js";
import { integrations } from "../../config/integrations.js";

/**
 * Adapter de un formulario / contacto web.
 *
 * Demuestra que el patrón no está limitado a plataformas de mensajería:
 * cualquier fuente externa con un identificador de canal puede generar
 * pedidos usando exactamente el mismo flujo.
 *
 * Espera un body: { contactoId, contactoNombre, texto, mensajeId? }
 */
export class WebContactAdapter extends ChannelAdapter {
  static channelType = CHANNEL_TYPE.WEB;

  parseIncomingPayload(rawPayload) {
    const body = rawPayload?.body ?? rawPayload;
    if (!body || (!body.texto && !body.text)) return null;

    return {
      messageId: String(body.mensajeId || body.messageId || `web_${Date.now()}`),
      contactId: body.contactoId || body.contactId || "web-anonimo",
      contactName: body.contactoNombre || body.contactName || null,
      text: body.texto || body.text || "",
      receivedAt: body.receivedAt || new Date().toISOString(),
    };
  }

  normalizeIncomingEvent(parsed) {
    return new NormalizedChannelEvent({
      channelType: WebContactAdapter.channelType,
      // Para WEB el "canal" es un único identificador global configurable.
      externalChannelId: integrations.web.identifier,
      externalMessageId: parsed.messageId,
      externalContactId: parsed.contactId,
      externalContactName: parsed.contactName,
      text: parsed.text,
      rawPayload: parsed,
      receivedAt: parsed.receivedAt,
    });
  }
}

export default WebContactAdapter;