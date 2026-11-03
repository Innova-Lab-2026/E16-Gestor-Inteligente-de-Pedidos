import { CHANNEL_TYPE } from "../../constants/channel-type.enum.js";
import { ChannelAdapter } from "../interfaces/channel.adapter.interface.js";
import { NormalizedChannelEvent } from "../channel-event.js";
import { parseWhatsappPayload } from "./whatsapp.payload-parser.js";

/**
 * Adapter de WhatsApp (Meta Cloud API).
 *
 * Soporta recepcion de mensajes (webhook) y envio de mensajes salientes
 * mediante WhatsApp Cloud API. El envio requiere un access token valido
 * de una conexion WhatsApp activa.
 */
export class WhatsAppAdapter extends ChannelAdapter {
  static channelType = CHANNEL_TYPE.WHATSAPP;

  parseIncomingPayload(rawPayload) {
    return parseWhatsappPayload(rawPayload);
  }

  normalizeIncomingEvent(parsed) {
    return new NormalizedChannelEvent({
      channelType: WhatsAppAdapter.channelType,
      externalChannelId: parsed.phoneNumberId,
      externalMessageId: parsed.messageId,
      externalContactId: parsed.contactId,
      externalContactName: parsed.contactName,
      text: parsed.text,
      rawPayload: parsed,
      receivedAt: parsed.receivedAt,
    });
  }

  async sendMessage({
    accessToken,
    phoneNumberId,
    telefonoDestino,
    tipo = "texto",
    texto,
    nombrePlantilla,
    idiomaPlantilla = "es",
    parametrosPlantilla = [],
  }) {
    if (!accessToken) {
      throw new Error("Access token requerido para enviar mensajes de WhatsApp");
    }
    if (!phoneNumberId) {
      throw new Error("phoneNumberId requerido para enviar mensajes de WhatsApp");
    }
    if (!telefonoDestino) {
      throw new Error("telefonoDestino requerido para enviar mensajes de WhatsApp");
    }

    const url = "https://graph.facebook.com/v20.0/" + phoneNumberId + "/messages";

    let payload;
    if (tipo === "plantilla") {
      if (!nombrePlantilla) {
        throw new Error("nombrePlantilla es requerido para mensajes de plantilla");
      }
      const componentes = [{
        type: "body",
        parameters: parametrosPlantilla.map((p) => ({ type: "text", text: p })),
      }];
      payload = {
        messaging_product: "whatsapp",
        to: telefonoDestino,
        type: "template",
        template: {
          name: nombrePlantilla,
          language: { code: idiomaPlantilla },
          components: componentes,
        },
      };
    } else {
      if (!texto) {
        throw new Error("texto es requerido para mensajes de texto");
      }
      payload = {
        messaging_product: "whatsapp",
        to: telefonoDestino,
        type: "text",
        text: { body: texto },
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const mensajeError = data.error?.message || "Error " + response.status + " de Meta";
        throw new Error("WhatsApp API: " + mensajeError);
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.message_id ?? null,
        contactId: data.messages?.[0]?.contacts?.[0]?.wa_id ?? null,
        rawResponse: data,
      };
    } catch (error) {
      if (error.message.startsWith("WhatsApp API:")) throw error;
      throw new Error("Error de red enviando mensaje de WhatsApp: " + error.message);
    }
  }
}

export default WhatsAppAdapter;
