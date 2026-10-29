import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { WebhookController } from "../../src/webhooks/webhook.controller.js";
import { WebhookService } from "../../src/webhooks/webhook.service.js";
import { ChannelAdapterFactory } from "../../src/adapters/channel-adapter.factory.js";
import { CHANNEL_TYPE } from "../../src/constants/channel-type.enum.js";
import { errorMiddleware } from "../../src/middlewares/error.middleware.js";
import {
  FakeEventoDao,
  buildCanalServiceStub,
} from "../helpers/daos.js";
import { buildProductoServiceStub } from "../helpers/stubs.js";
import { validateWhatsAppSignature } from "../../src/routes/webhooks.routes.js";
import { integrations } from "../../src/config/integrations.js";
import { createHmac } from "node:crypto";

const EMP = "11111111-1111-1111-1111-111111111111";
const CANAL_ID = "44444444-4444-4444-4444-444444444444";
const PROD = "22222222-2222-2222-2222-222222222222";

const canalTelegram = {
  id: CANAL_ID,
  tipo: CHANNEL_TYPE.TELEGRAM,
  emprendimiento_id: EMP,
  identificador_externo: "tg_987",
  activo: true,
};

const canalWhatsapp = {
  id: "55555555-5555-5555-5555-555555555555",
  tipo: CHANNEL_TYPE.WHATSAPP,
  emprendimiento_id: EMP,
  identificador_externo: "wa_5491112345678",
  activo: true,
};

const producto = {
  id: PROD,
  nombre: "Remera",
  precio: 1000,
  tiene_variantes: false,
  stock_disponible: 10,
};

/**
 * Monta la app real de webhooks con el servicio inyectando dobles,
 * para probar el flujo HTTP completo sin base de datos.
 */
const buildApp = () => {
  const eventoDao = new FakeEventoDao();
  const pedidos = [];

  const canales = new Map([
    [canalTelegram.identificador_externo, canalTelegram],
    [canalWhatsapp.identificador_externo, canalWhatsapp],
  ]);

  const eventoCanalService = {
    async process(evento) {
      const c = await buildCanalServiceStub(
        canales.get(evento.externalChannelId) ?? null
      ).resolverPorEvento(evento);

      const previo = await eventoDao.findByExternalId(
        c.id,
        evento.externalMessageId
      );
      if (previo) return { duplicado: true, evento: previo, pedidoId: previo.pedido_id };

      const registrado = await eventoDao.create({
        canalId: c.id,
        mensajeriaMessageId: evento.externalMessageId,
        payloadRaw: evento.rawPayload,
        estadoProcesamiento: "REVISION_REQUERIDA",
      });

      const dto = {
        clienteId: "cliente-1",
        requiereRevision: !/remera/i.test(evento.text),
        motivoRevision: "sin match",
        items: [],
        reservarStock: false,
      };
      pedidos.push(dto);
      const pedido = { id: "pedido-1", requiere_revision: dto.requiereRevision };
      const actualizado = await eventoDao.actualizarEstado(
        registrado.id,
        dto.requiereRevision ? "REVISION_REQUERIDA" : "PROCESADO",
        pedido.id
      );
      return { duplicado: false, evento: actualizado, pedido };
    },
  };

  const webhookService = new WebhookService({
    adapterFactory: new ChannelAdapterFactory(),
    eventoCanalService,
  });
  const controller = new WebhookController({ webhookService });

  const app = express();
  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.post("/webhooks/telegram", controller.receive(CHANNEL_TYPE.TELEGRAM));
  app.post(
    "/webhooks/whatsapp",
    validateWhatsAppSignature,
    controller.receive(CHANNEL_TYPE.WHATSAPP)
  );
  app.get("/webhooks/whatsapp", controller.verifyWhatsapp);
  app.use(errorMiddleware);

  return { app, eventoDao, pedidos };
};

let server;
let baseUrl;
let ctx;

const telegramPayload = (messageId, text) => ({
  update_id: 1,
  message: {
    message_id: messageId,
    from: { id: 987, first_name: "Juan" },
    text,
    date: 1735689600,
  },
});

const whatsappPayload = (messageId, from, text) => ({
  entry: [
    {
      changes: [
        {
          value: {
            timestamp: "1735689600",
            contacts: [{ profile: { name: "Cliente Test" } }],
            messages: [
              { id: messageId, from, text: { body: text } },
            ],
          },
        },
      ],
    },
  ],
});

const whatsappStatusPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [{ id: "status-123", status: "delivered" }],
          },
        },
      ],
    },
  ],
};

before(async () => {
  ctx = buildApp();
  await new Promise((resolve) => {
    server = ctx.app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const post = async (path, body, opts = {}) => {
  const rawBody = JSON.stringify(body);
  const headers = { "Content-Type": "application/json" };

  if (opts.sign !== false) {
    const secret = integrations.whatsapp.appSecret || "";
    const sig = createHmac("sha256", secret).update(rawBody).digest("hex");
    headers["x-hub-signature-256"] = `sha256=${sig}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: rawBody,
  });
  return { status: res.status, data: await res.json() };
};

describe("Flujo webhook HTTP", () => {
  test("acepta un mensaje de Telegram y crea el pedido", async () => {
    const { status, data } = await post("/webhooks/telegram", telegramPayload(1, "2 remeras"));

    assert.equal(status, 200);
    assert.equal(data.duplicado, false);
    assert.equal(data.requiereRevision, false);
    assert.equal(data.pedidoId, "pedido-1");
  });

  test("es idempotente ante reintentos del proveedor", async () => {
    const { status, data } = await post("/webhooks/telegram", telegramPayload(1, "2 remeras"));

    assert.equal(status, 200);
    assert.equal(data.duplicado, true);
    assert.equal(ctx.pedidos.length, 1, "no se crea un segundo pedido");
  });

  test("procesa mensajes distintos correctamente", async () => {
    const { data } = await post("/webhooks/telegram", telegramPayload(2, "algo raro"));
    assert.equal(data.duplicado, false);
    assert.equal(data.requiereRevision, true);
  });

  test("responde 200 sin procesar si el payload no trae mensaje", async () => {
    const { status, data } = await post("/webhooks/telegram", { update_id: 9 });
    assert.equal(status, 200);
    assert.equal(data.ignorado, true);
  });

  test("responde 403 si falla la verificacion de Meta", async () => {
    const res = await fetch(`${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=incorrecto&hub.challenge=CHALLENGE`);
    assert.equal(res.status, 403);
  });

  test("responde 200 con el challenge cuando la verificacion de Meta es exitosa", async () => {
    const res = await fetch(`${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=mi_token_secreto_123&hub.challenge=CHALLENGE_123`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "CHALLENGE_123");
  });

  test("acepta un mensaje de WhatsApp y crea el pedido", async () => {
    const { status, data } = await post("/webhooks/whatsapp", whatsappPayload("wamid.msg1", "5491112345678", "2 remeras negras"));

    assert.equal(status, 200);
    assert.equal(data.duplicado, false);
    assert.equal(data.requiereRevision, false);
  });

  test("es idempotente ante reenvios del mismo mensaje de WhatsApp", async () => {
    const { status: s1 } = await post("/webhooks/whatsapp", whatsappPayload("wamid.msg-dup", "5491112345678", "1 producto"));
    assert.equal(s1, 200);

    const { status: s2, data } = await post("/webhooks/whatsapp", whatsappPayload("wamid.msg-dup", "5491112345678", "1 producto"));
    assert.equal(s2, 200);
    assert.equal(data.duplicado, true, "no debe reprocesar el mismo mensaje");
  });

  test("responde 200 sin procesar si el payload de WhatsApp solo tiene status", async () => {
    const { status, data } = await post("/webhooks/whatsapp", whatsappStatusPayload);
    assert.equal(status, 200);
    assert.equal(data.ignorado, true);
  });

  test("rechaza un mensaje de WhatsApp de un canal no registrado", async () => {
    const payload = whatsappPayload("wamid.msg-nocanal", "99999999999999", "texto");
    const { status } = await post("/webhooks/whatsapp", payload);
    assert.equal(status, 404, "canal no registrado debe devolver 404");
  });

  test("rechaza webhook de WhatsApp sin firma X-Hub-Signature-256", async () => {
    const { status } = await post("/webhooks/whatsapp", whatsappPayload("wamid.msg-nosig", "5491112345678", "texto"), { sign: false });
    assert.equal(status, 401, "sin firma debe devolver 401");
  });

  test("rechaza webhook de WhatsApp con firma invalida", async () => {
    const rawBody = JSON.stringify(whatsappPayload("wamid.msg-badsig", "5491112345678", "texto"));
    const res = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=firmaintencionalmenteinvalida0000000000",
      },
      body: rawBody,
    });
    assert.equal(res.status, 401, "firma invalida debe devolver 401");
  });

  test("acepta webhook de WhatsApp con firma valida", async () => {
    const { status, data } = await post("/webhooks/whatsapp", whatsappPayload("wamid.msg-validsig", "5491112345678", "texto con firma valida"));
    assert.equal(status, 200, "firma valida debe ser aceptada");
  });
});
