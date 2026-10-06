import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EventoCanalService,
  interpretarTextoPedido,
} from "../../src/modules/eventos-canal/evento-canal.service.js";
import { TelegramAdapter } from "../../src/adapters/telegram/telegram.adapter.js";
import { CHANNEL_TYPE } from "../../src/constants/channel-type.enum.js";
import {
  FakeEventoDao,
  buildCanalServiceStub,
} from "../helpers/daos.js";
import { buildProductoServiceStub, buildVarianteServiceStub } from "../helpers/stubs.js";

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

const pedidoStub = (dto) => ({
  id: "pedido-1",
  ...dto,
  requiere_revision: Boolean(dto.requiereRevision),
});

const build = ({ productos = [producto], conCanal = true } = {}) => {
  const eventoDao = new FakeEventoDao();
  const pedidosCreados = [];

  const service = new EventoCanalService({
    canalService: buildCanalServiceStub(conCanal ? canal : null),
    eventoCanalDao: eventoDao,
    pedidoService: {
      createFromChannel: async (params) => {
        pedidosCreados.push(params);
        return pedidoStub(params.dto);
      },
    },
    productoService: buildProductoServiceStub(productos),
    varianteService: buildVarianteServiceStub([]),
    clienteService: {
      findOrCreateFromChannel: async (emprendimientoId, datos) => ({
        id: "cliente-1",
        ...datos,
      }),
    },
  });

  return { service, eventoDao, pedidosCreados };
};

const telegram = (texto, messageId = 42) =>
  new TelegramAdapter().parseAndNormalize({
    update_id: 1,
    message: {
      message_id: messageId,
      from: { id: 987, first_name: "Juan" },
      text: texto,
      date: 1735689600,
    },
  });

describe("interpretarTextoPedido", () => {
  test("extrae cantidad y descripcion", () => {
    const items = interpretarTextoPedido("2 remeras negras");
    assert.equal(items.length, 1);
    assert.equal(items[0].cantidad, 2);
    assert.equal(items[0].descripcion, "remeras negras");
  });

  test("separa el talle del final del texto", () => {
    const [item] = interpretarTextoPedido("2 remeras talle M");
    assert.equal(item.cantidad, 2);
    assert.equal(item.descripcion, "remeras");
    assert.equal(item.variante, "talle M");
  });

  test("divide varias lineas y toma 1 por defecto", () => {
    const items = interpretarTextoPedido("3 remeras\n1 gorra");
    assert.equal(items.length, 2);
    assert.equal(items[1].cantidad, 1);
    assert.equal(items[1].descripcion, "gorra");
  });

  test("devuelve lista vacia para texto vacio", () => {
    assert.deepEqual(interpretarTextoPedido(""), []);
  });
});

describe("EventoCanalService - idempotencia", () => {
  test("procesa el evento una vez", async () => {
    const { service, eventoDao, pedidosCreados } = build();

    const resultado = await service.process(telegram("2 remeras"));

    assert.equal(resultado.duplicado, false);
    assert.equal(pedidosCreados.length, 1);
    assert.equal(eventoDao.eventos[0].estado_procesamiento, "PROCESADO");
  });

  test("ignora el mismo mensaje si llega dos veces", async () => {
    const { service, pedidosCreados, eventoDao } = build();

    await service.process(telegram("2 remeras", 42));
    const segundo = await service.process(telegram("2 remeras", 42));

    assert.equal(segundo.duplicado, true);
    assert.equal(pedidosCreados.length, 1, "no debe crear un segundo pedido");
    assert.equal(eventoDao.eventos.length, 1);
  });

  test("procesa mensajes distintos del mismo canal", async () => {
    const { service, pedidosCreados } = build();

    await service.process(telegram("2 remeras", 42));
    await service.process(telegram("1 gorro", 43));

    assert.equal(pedidosCreados.length, 2);
  });
});

describe("EventoCanalService - pedidos para revision", () => {
  test("marca el pedido para revision si no identifica el producto", async () => {
    const { service, pedidosCreados } = build();

    await service.process(telegram("2 cosas raras"));

    const pedido = pedidosCreados[0];
    assert.equal(pedido.dto.requiereRevision, true);
    assert.equal(pedido.dto.items.length, 0);
    assert.equal(pedido.dto.reservarStock, false, "nunca reserva stock desde un mensaje ambiguo");
  });

  test("crea el pedido con items si identifica el producto", async () => {
    const { service, pedidosCreados } = build();

    await service.process(telegram("2 remeras"));

    const pedido = pedidosCreados[0];
    assert.equal(pedido.dto.requiereRevision, false);
    assert.deepEqual(pedido.dto.items, [{ productoId: PROD, varianteId: null, cantidad: 2 }]);
    assert.equal(pedido.canalId, CANAL_ID);
  });

  test("el tenant sale del canal, no del payload", async () => {
    const { service, pedidosCreados } = build();

    await service.process(telegram("2 remeras"));

    assert.equal(pedidosCreados[0].emprendimientoId, EMP);
  });
});

describe("EventoCanalService - canal desconocido", () => {
  test("falla si el canal externo no esta registrado", async () => {
    const { service, eventoDao } = build({ conCanal: false });

    await assert.rejects(() => service.process(telegram("2 remeras")), /No hay ningun canal|No hay ningún canal/);
    assert.equal(eventoDao.eventos.length, 0, "no se registra nada sin canal resuelto");
  });
});
