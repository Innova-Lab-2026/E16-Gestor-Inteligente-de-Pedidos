import { NormalizedChannelEvent } from "../channel-event.js";

/**
 * Contrato común de los adapters de canal.
 *
 * La interfaz es mínima y orientada a capacidades realmente
 * compartidas: no todos los canales pueden enviar mensajes, por lo que
 * `sendMessage` es opcional.
 *
 * Responsabilidad exclusiva: traducir el formato del proveedor a un
 * NormalizedChannelEvent. Jamás debe contener reglas de negocio ni
 * crear pedidos oDiscount stock.
 */
export class ChannelAdapter {
  /** @type {'TELEGRAM'|'WHATSAPP'|'WEB'} */
  static channelType = null;

  /**
   * @param {object} rawPayload
   * @returns {object|null} estructura propia del canal, o null si no es aplicable
   */
  // eslint-disable-next-line no-unused-vars
  parseIncomingPayload(rawPayload) {
    throw new Error('Method "parseIncomingPayload()" must be implemented.');
  }

  /**
   * @param {object} parsedPayload
   * @returns {NormalizedChannelEvent}
   */
  // eslint-disable-next-line no-unused-vars
  normalizeIncomingEvent(parsedPayload) {
    throw new Error('Method "normalizeIncomingEvent()" must be implemented.');
  }

  /**
   * Atajo: payload crudo -> evento normalizado.
   * @param {object} rawPayload
   * @returns {NormalizedChannelEvent|null} null si el payload no es un mensaje entrante
   */
  parseAndNormalize(rawPayload) {
    const parsed = this.parseIncomingPayload(rawPayload);
    if (!parsed) return null;
    return this.normalizeIncomingEvent(parsed);
  }
}

export default ChannelAdapter;