import { env } from "./env.js";

/**
 * Configuración de integraciones externas.
 *
 * Deliberadamente genérica: no existe un config por proveedor
 * (no hay config/whatsapp.js). Cada canal lee lo que necesita desde acá.
 */
export const integrations = {
  web: {
    identifier: env.WEB_CHANNEL_IDENTIFIER,
  },
  telegram: {
    verifySecret: env.TELEGRAM.VERIFY_SECRET,
  },
  whatsapp: {
    verifyToken: env.WHATSAPP.VERIFY_TOKEN,
    phoneNumberId: env.WHATSAPP.PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP.ACCESS_TOKEN,
  },
};

export default integrations;