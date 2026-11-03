/**
 * Cifrado simmetrico de credenciales individuales (access tokens, etc.)
 * al reposo.
 *
 * Utiliza AES-256-GCM (cifrado autenticado) sobre Node.js `crypto`.
 * La clave maestra proviene de `WHATSAPP_ENCRYPTION_KEY` (32 bytes en base64).
 *
 * Cada valor cifrado incluye: iv (12 bytes) + texto cifrado + tag (16 bytes),
 * todo serializado en base64 y separado por puntos.
 *
 * Formato de salida: <iv_b64>.<ciphertext_b64>.<tag_b64>
 *
 * No se expone texto plano en logs ni en errores.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SEPARATOR = ".";

/**
 * Decodifica la clave maestra desde base64. Lanza si falta o es invalida.
 * @returns {Buffer} clave de 32 bytes
 */
function obtenerClaveMaestra() {
  const raw = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta WHATSAPP_ENCRYPTION_KEY en .env (32 bytes en base64). " +
        "Es obligatoria para cifrar credenciales de WhatsApp al reposo."
    );
  }
  let clave;
  try {
    clave = Buffer.from(raw, "base64");
  } catch (error) {
    throw new Error(
      "WHATSAPP_ENCRYPTION_KEY no es un base64 valido: " + error.message
    );
  }
  if (clave.length !== 32) {
    throw new Error(
      `WHATSAPP_ENCRYPTION_KEY debe tener 32 bytes (tiene ${clave.length}). ` +
        "Generala con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  return clave;
}

/**
 * Cifra un texto plano. Devuelve base64 con formato iv.ciphertext.tag.
 * @param {string} textoPlano
 * @returns {string}
 */
export const cifrar = (textoPlano) => {
  if (textoPlano === undefined || textoPlano === null) return null;
  if (typeof textoPlano !== "string") {
    throw new Error("cifrar() espera un string");
  }

  const clave = obtenerClaveMaestra();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, clave, iv);
  cipher.setAAD(Buffer.from("whatsapp-conexion", "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(SEPARATOR);
};

/**
 * Descifra un valor cifrado con `cifrar`. Devuelve el texto plano o null si
 * la entrada es null/undefined.
 * @param {string|null} cifrado
 * @returns {string|null}
 */
export const descifrar = (cifrado) => {
  if (cifrado === undefined || cifrado === null) return null;
  if (typeof cifrado !== "string") {
    throw new Error("descifrar() espera un string o null");
  }

  const partes = cifrado.split(SEPARATOR);
  if (partes.length !== 3) {
    throw new Error("Formato de credencial cifrada invalido");
  }

  const clave = obtenerClaveMaestra();
  let iv, ciphertext, tag;
  try {
    iv = Buffer.from(partes[0], "base64");
    ciphertext = Buffer.from(partes[1], "base64");
    tag = Buffer.from(partes[2], "base64");
  } catch {
    throw new Error("Formato de credencial cifrada invalido");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, clave, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from("whatsapp-conexion", "utf8"));

    const textoPlano = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return textoPlano;
  } catch (error) {
    if (error.message.includes("authentication tag") || error.message.includes("invalid")) {
      throw new Error("Formato de credencial cifrada invalido");
    }
    throw error;
  }
};

/**
 * Indica si la clave de cifrado esta configurada (sin revelar su valor).
 * @returns {boolean}
 */
export const estaConfigurado = () => {
  try {
    obtenerClaveMaestra();
    return true;
  } catch {
    return false;
  }
};

export default { cifrar, descifrar, estaConfigurado };
