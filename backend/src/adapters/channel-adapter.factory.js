import { ChannelAdapter } from "./interfaces/channel.adapter.interface.js";
import { TelegramAdapter } from "./telegram/telegram.adapter.js";
import { WhatsAppAdapter } from "./whatsapp/whatsapp.adapter.js";
import { WebContactAdapter } from "./web/web-contact.adapter.js";
import { CHANNEL_TYPE, isChannelType } from "../constants/channel-type.enum.js";

const REGISTRY = {
  [CHANNEL_TYPE.TELEGRAM]: new TelegramAdapter(),
  [CHANNEL_TYPE.WHATSAPP]: new WhatsAppAdapter(),
  [CHANNEL_TYPE.WEB]: new WebContactAdapter(),
};

/**
 * Factory de adapters de canal.
 * Resuelve qué implementación usar a partir de channel.tipo.
 * No contiene lógica de negocio: sólo instanciación y registro.
 */
export class ChannelAdapterFactory {
  /**
   * @param {typeof ChannelAdapter[]} [adapters] instancias adicionales (para tests)
   */
  constructor(adapters = []) {
    this.registry = { ...REGISTRY };
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  /**
   * @param {typeof ChannelAdapter} adapter clase con `static channelType`
   */
  register(adapter) {
    const type = adapter.channelType;
    if (!isChannelType(type)) {
      throw new Error(
        `Adapter con channelType inválido: ${type}. Tipos permitidos: ${Object.values(
          CHANNEL_TYPE
        ).join(", ")}`
      );
    }
    this.registry[type] = new adapter();
    return this;
  }

  /**
   * @param {string} channelType
   * @returns {ChannelAdapter}
   * @throws {Error} si el tipo no está registrado
   */
  get(channelType) {
    const adapter = this.registry[channelType];
    if (!adapter) {
      throw new Error(
        `No hay adapter registrado para el canal "${channelType}". Registrados: ${Object.keys(
          this.registry
        ).join(", ")}`
      );
    }
    return adapter;
  }

  supports(channelType) {
    return Boolean(this.registry[channelType]);
  }

  list() {
    return Object.keys(this.registry);
  }
}

export const channelAdapterFactory = new ChannelAdapterFactory();
export default channelAdapterFactory;