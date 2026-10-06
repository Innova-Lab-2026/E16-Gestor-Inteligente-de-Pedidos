/** Tipos de canal soportados. */
export const CHANNEL_TYPE = Object.freeze({
  TELEGRAM: "TELEGRAM",
  WHATSAPP: "WHATSAPP",
  WEB: "WEB",
});

export const isChannelType = (value) =>
  Object.values(CHANNEL_TYPE).includes(value);

export default CHANNEL_TYPE;