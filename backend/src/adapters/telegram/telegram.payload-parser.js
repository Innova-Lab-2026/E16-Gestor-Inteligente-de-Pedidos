/**
 * Parser del payload de la Bot API de Telegram.
 * Un "update" de Telegram tiene la forma:
 *   { update_id, message: { message_id, from, chat, text|caption } }
 */
export const parseTelegramPayload = (rawPayload) => {
  const update = rawPayload?.update || rawPayload;
  const message =
    update?.message ||
    update?.edited_message ||
    update?.channel_post ||
    update?.edited_channel_post;

  if (!message) return null;

  return {
    messageId: String(message.message_id ?? update.update_id ?? "unknown_id"),
    contactId: message.from?.id ? `tg_${message.from.id}` : null,
    contactName:
      [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ") || message.from?.username || null,
    text: message.text || message.caption || "",
    receivedAt: new Date(
      (message.date ? message.date * 1000 : Date.now())
    ).toISOString(),
  };
};

export default parseTelegramPayload;