import { env } from "./env.js";

export const integrations = {
  web: {
    identifier: env.WEB_CHANNEL_IDENTIFIER,
  },
  telegram: {
    verifySecret: env.TELEGRAM.VERIFY_SECRET,
  },
  whatsapp: {
    verifyToken: env.WHATSAPP.VERIFY_TOKEN,
    appId: env.WHATSAPP.APP_ID,
    appSecret: env.WHATSAPP.APP_SECRET,
    configId: env.WHATSAPP.CONFIG_ID,
    encryptionKey: env.WHATSAPP.ENCRYPTION_KEY,
  },
};

export default integrations;
