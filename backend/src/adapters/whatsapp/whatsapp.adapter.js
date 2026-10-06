import { CHANNEL_TYPE } from "../../constants/channel-type.enum.js";
import { ChannelAdapter } from "../interfaces/channel.adapter.interface.js";
import { NormalizedChannelEvent } from "../channel-event.js";
import { parseWhatsappPayload } from "./whatsapp.payload-parser.js";

/**
 * Adapter de WhatsApp (Meta Cloud API).
 *
 * Modo prueba: sólo normaliza el evento entrante. El envío de mensajes
 * queda fuera de alcance, por eso no implementa `sendMessage`.
 */
export class WhatsAppAdapter extends ChannelAdapter {
  static channelType = CHANNEL_TYPE.WHATSAPP;

  parseIncomingPayload(rawPayload) {
    return parseWhatsappPayload(rawPayload);
  }

  normalizeIncomingEvent(parsed) {
    return new NormalizedChannelEvent({
      channelType: WhatsAppAdapter.channelType,
      externalChannelId: parsed.contactId,
      externalMessageId: parsed.messageId,
      externalContactId: parsed.contactId,
      externalContactName: parsed.contactName,
      text: parsed.text,
      rawPayload: parsed,
      receivedAt: parsed.receivedAt,
    });
  }
}

export default WhatsAppAdapter;