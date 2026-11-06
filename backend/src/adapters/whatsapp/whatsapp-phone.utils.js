const ARGENTINA_AREA_CODES = ["221", "11"];

export const normalizeWhatsAppRecipient = (phone) => {
  if (phone === null || phone === undefined) {
    throw new Error("telefonoDestino requerido para enviar mensajes de WhatsApp");
  }

  const normalized = String(phone).replace(/[+\s\-()]/g, "");

  if (!normalized) {
    throw new Error("telefonoDestino requerido para enviar mensajes de WhatsApp");
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error("telefonoDestino inválido para enviar mensajes de WhatsApp");
  }

  if (!normalized.startsWith("549")) {
    return normalized;
  }

  const withoutCountryMobilePrefix = "54" + normalized.slice(3);

  for (const areaCode of ARGENTINA_AREA_CODES.sort((a, b) => b.length - a.length)) {
    const prefix = "54" + areaCode;
    if (withoutCountryMobilePrefix.startsWith(prefix)) {
      const rest = withoutCountryMobilePrefix.slice(prefix.length);
      if (rest.startsWith("15")) {
        return withoutCountryMobilePrefix;
      }
      return prefix + "15" + rest;
    }
  }

  return withoutCountryMobilePrefix;
};

export default normalizeWhatsAppRecipient;