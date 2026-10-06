/**
 * Evento interno normalizado que produce todo adapter.
 * El dominio sólo conoce esta forma; nunca el payload del proveedor.
 */
export class NormalizedChannelEvent {
  constructor({
    channelType,
    externalChannelId,
    externalMessageId,
    externalContactId,
    externalContactName,
    text,
    rawPayload,
    receivedAt,
  }) {
    this.channelType = channelType;
    this.externalChannelId = externalChannelId;
    this.externalMessageId = externalMessageId;
    this.externalContactId = externalContactId ?? null;
    this.externalContactName = externalContactName ?? null;
    this.text = text ?? "";
    this.rawPayload = rawPayload ?? null;
    this.receivedAt = receivedAt ?? new Date().toISOString();
  }
}

export default NormalizedChannelEvent;