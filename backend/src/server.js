import "dotenv/config";
import app from "./app.js";
import { advertenciasDeEntorno, validateEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 3000;

try {
  validateEnv();
} catch (error) {
  logger.error(error.message);
  logger.error("Revisa el archivo .env antes de arrancar el servidor.");
  process.exit(1);
}

// Avisos que no impiden arrancar: claves legacy, clave secreta en el
// lugar equivocado y falta de la clave de webhooks.
for (const aviso of advertenciasDeEntorno()) {
  logger.warn(aviso);
}

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en el puerto ${PORT}`);
  logger.info("recorda levantar el tunel publico en desarrollo.");
});
