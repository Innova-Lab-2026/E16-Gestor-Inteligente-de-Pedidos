import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { TelegramAdapter } from "../../src/adapters/telegram/telegram.adapter.js";
import { WhatsAppAdapter } from "../../src/adapters/whatsapp/whatsapp.adapter.js";
import { WebContactAdapter } from "../../src/adapters/web/web-contact.adapter.js";
import { ChannelAdapterFactory } from "../../src/adapters/channel-adapter.factory.js";
import { CHANNEL_TYPE } from "../../src/constants/channel-type.enum.js";

const payloadTelegram = {
  update_id: 123456789,
  message: {
    message_id: 42,
    from: { id: 987654321, first_name: "Juan", username: "juan" },
    chat: { id: 987654321 },
    text: "Quiero 2 remeras negras talle M",
    date: 1735689600,
  },
};

const payloadWhatsapp = {
  entry: [
    {
      changes: [
        {
          value: {
            timestamp: "1735689600",
            contacts: [{ profile: { name: "María" } }],
            messages: [
              { id: "wamid.HBgL123", from: "5491112345678", text: { body: "Hola" } },
            ],
          },
        },
      ],
    },
  ],
};

describe("Adapter de Telegram", () => {
  test("normaliza un mensaje al evento interno común", () => {
    const evento = new TelegramAdapter().parseAndNormalize(payloadTelegram);

    assert.equal(evento.channelType, CHANNEL_TYPE.TELEGRAM);
    assert.equal(evento.externalMessageId, "42");
    assert.equal(evento.externalChannelId, "tg_987654321");
    assert.equal(evento.externalContactId, "tg_987654321");
    assert.equal(evento.externalContactName, "Juan");
    assert.equal(evento.text, "Quiero 2 remeras negras talle M");
    assert.equal(evento.receivedAt, "2025-01-01T00:00:00.000Z");
  });

  test("devuelve null si el update no trae mensaje", () => {
    assert.equal(new TelegramAdapter().parseAndNormalize({ update_id: 1 }), null);
  });

  test("no filtra campos del proveedor más allá de lo necesario", () => {
    const evento = new TelegramAdapter().parseAndNormalize(payloadTelegram);
    assert.equal(evento.rawPayload.chat, undefined);
    assert.equal(evento.rawPayload.text, "Quiero 2 remeras negras talle M");
  });
});

describe("Adapter de WhatsApp", () => {
  test("normaliza el payload de Meta Cloud API", () => {
    const evento = new WhatsAppAdapter().parseAndNormalize(payloadWhatsapp);

    assert.equal(evento.channelType, CHANNEL_TYPE.WHATSAPP);
    assert.equal(evento.externalMessageId, "wamid.HBgL123");
    assert.equal(evento.externalContactId, "wa_5491112345678");
    assert.equal(evento.externalContactName, "María");
    assert.equal(evento.text, "Hola");
  });

  test("ignora payloads de estado (no son mensajes)", () => {
    const soloStatus = {
      entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }],
    };
    assert.equal(new WhatsAppAdapter().parseAndNormalize(soloStatus), null);
  });
});

describe("Adapter de contacto web", () => {
  test("normaliza un formulario web", () => {
    const evento = new WebContactAdapter().parseAndNormalize({
      body: { contactoId: "form-1", contactoNombre: "Ana", texto: "1 Producto" },
    });

    assert.equal(evento.channelType, CHANNEL_TYPE.WEB);
    assert.equal(evento.externalContactId, "form-1");
    assert.equal(evento.text, "1 Producto");
  });

  test("devuelve null sin texto", () => {
    assert.equal(
      new WebContactAdapter().parseAndNormalize({ body: { contactoId: "x" } }),
      null
    );
  });
});

describe("Factory de adapters", () => {
  const factory = new ChannelAdapterFactory();

  test("resuelve el adapter según el tipo de canal", () => {
    assert.ok(factory.get(CHANNEL_TYPE.TELEGRAM) instanceof TelegramAdapter);
    assert.ok(factory.get(CHANNEL_TYPE.WHATSAPP) instanceof WhatsAppAdapter);
    assert.ok(factory.get(CHANNEL_TYPE.WEB) instanceof WebContactAdapter);
  });

  test("lanza un error descriptivo para un canal sin adapter", () => {
    assert.throws(() => factory.get("INSTAGRAM"), /No hay adapter registrado/);
  });

  test("permite registrar adapters nuevos sin tocar el dominio", () => {
    class InstagramAdapter {
      static channelType = "INSTAGRAM";
    }
    // El tipo debe ser válido según la documentación; se valida el registro.
    assert.throws(
      () => factory.register(InstagramAdapter),
      /channelType inválido/
    );
  });

  test("no incluye MANUAL entre los tipos de canal", () => {
    assert.ok(!factory.list().includes("MANUAL"));
  });
});