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

const EMP = "11111111-1111-1111-1111-111111111111";
const CANAL_ID = "44444444-4444-4444-4444-444444444444";
const PROD = "22222222-2222-2222-2222-222222222222";

const canal = {
  id: CANAL_ID,
  tipo: CHANNEL_TYPE.TELEGRAM,
  emprendimiento_id: EMP,
  identificador_externo: "tg_987",
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

  const eventoCanalService = {
    async process(evento) {
      const c = await buildCanalServiceStub(canal).resolverPorEvento(evento);

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
  app.use(express.json());
  app.post("/webhooks/telegram", controller.receive(CHANNEL_TYPE.TELEGRAM));
  app.post("/webhooks/whatsapp", controller.receive(CHANNEL_TYPE.WHATSAPP));
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

before(async () => {
  ctx = buildApp();
  await new Promise((resolve) => {
    server = ctx.app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const post = async (path, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
});
