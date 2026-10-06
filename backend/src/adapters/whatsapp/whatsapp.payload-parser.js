/**
 * Parser del payload de WhatsApp Cloud API (Meta).
 * Los mensajes de texto llegan en entry[].changes[].value.messages[].
 */
export const parseWhatsappPayload = (rawPayload) => {
  const entry = rawPayload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;

  return {
    messageId: message.id || "unknown_id",
    contactId: message.from ? `wa_${message.from}` : null,
    contactName: value?.contacts?.[0]?.profile?.name || null,
    text: message.text?.body || message.caption || "",
    receivedAt: new Date(
      (value?.timestamp ? Number(value.timestamp) * 1000 : Date.now())
    ).toISOString(),
  };
};

export default parseWhatsappPayload;