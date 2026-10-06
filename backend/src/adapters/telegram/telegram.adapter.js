import { CHANNEL_TYPE } from "../../constants/channel-type.enum.js";
import { ChannelAdapter } from "../interfaces/channel.adapter.interface.js";
import { NormalizedChannelEvent } from "../channel-event.js";
import { parseTelegramPayload } from "./telegram.payload-parser.js";

/**
 * Adapter de Telegram. Conoce únicamente Telegram.
 */
export class TelegramAdapter extends ChannelAdapter {
  static channelType = CHANNEL_TYPE.TELEGRAM;

  parseIncomingPayload(rawPayload) {
    return parseTelegramPayload(rawPayload);
  }

  normalizeIncomingEvent(parsed) {
    return new NormalizedChannelEvent({
      channelType: TelegramAdapter.channelType,
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

export default TelegramAdapter;