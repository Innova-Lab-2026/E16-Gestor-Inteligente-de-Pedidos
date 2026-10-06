import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { PedidoService } from "../../src/modules/pedidos/pedido.service.js";
import { StockService } from "../../src/modules/stock/stock.service.js";
import { ORDER_STATUS } from "../../src/constants/order-status.enum.js";
import { PAYMENT_STATUS } from "../../src/constants/payment-status.enum.js";
import {
  FakePedidoDao,
  FakeStockDao,
  FakeMovimientoDao,
} from "../helpers/daos.js";
import {
  buildProductoServiceStub,
  buildVarianteServiceStub,
  buildClienteServiceStub,
} from "../helpers/stubs.js";

const EMP = "11111111-1111-1111-1111-111111111111";
const CANAL = "44444444-4444-4444-4444-444444444444";
const PROD = "22222222-2222-2222-2222-222222222222";
const VAR_M = "33333333-3333-3333-3333-333333333333";

const productoSimple = {
  id: PROD,
  nombre: "Remera",
  precio: 1000,
  stock_disponible: 10,
  tiene_variantes: false,
};

const productoConVariantes = {
  id: PROD,
  nombre: "Remera",
  precio: 1000,
  tiene_variantes: true,
};

const varianteM = { id: VAR_M, producto_id: PROD, nombre: "Talle M" };

const build = ({ productos = [productoSimple], variantes = [], stock } = {}) => {
  const movimientoDao = new FakeMovimientoDao();
  const pedidoDao = new FakePedidoDao({ movimientoDao });
  const stockDao = new FakeStockDao(
    stock ?? { [PROD]: { producto: 10 } }
  );

  const service = new PedidoService({
    pedidoDao,
    productoService: buildProductoServiceStub(productos),
    varianteService: buildVarianteServiceStub(variantes),
    clienteService: buildClienteServiceStub(),
    stockService: new StockService({
      stockDao,
      movimientoStockDao: movimientoDao,
    }),
  });

  return { service, pedidoDao, movimientoDao, stockDao };
};

const dtoBase = { estadoCobro: PAYMENT_STATUS.PENDIENTE };

describe("PedidoService - creacion manual", () => {
  test("crea el pedido con origen MANUAL y canal_id NULL", async () => {
    const { service } = build();

    const pedido = await service.createManual({
      emprendimientoId: EMP,
      dto: { ...dtoBase, reservarStock: true, items: [{ productoId: PROD, cantidad: 2 }] },
    });

    assert.equal(pedido.origen_tipo, "MANUAL");
    assert.equal(pedido.canal_id, null);
    assert.equal(pedido.estado, ORDER_STATUS.RECIBIDO);
    assert.equal(pedido.emprendimiento_id, EMP);
  });

  test("congela el precio unitario y calcula el total", async () => {
    const { service, pedidoDao } = build();

    await service.createManual({
      emprendimientoId: EMP,
      dto: { ...dtoBase, reservarStock: false, items: [{ productoId: PROD, cantidad: 3 }] },
    });

    const item = pedidoDao.items[0];
    assert.equal(item.precio_unitario, 1000);
    assert.equal(item.subtotal, 3000);
    assert.equal(pedidoDao.pedidos[0].total, 3000);
  });

  test("reserva stock por defecto al crear el pedido", async () => {
    const { service, stockDao, movimientoDao } = build();

    await service.createManual({
      emprendimientoId: EMP,
      dto: { ...dtoBase, reservarStock: true, items: [{ productoId: PROD, cantidad: 4 }] },
    });

    assert.equal(stockDao.stock[PROD].producto, 6);
    assert.equal(movimientoDao.movimientos[0].tipo, "RESERVA_PEDIDO");
  });

  test("exige al menos un item si no requiere revision", async () => {
    const { service } = build();

    await assert.rejects(
      () =>
        service.createManual({
          emprendimientoId: EMP,
          dto: { ...dtoBase, items: [] },
        }),
      /al menos un item/
    );
  });

  test("exige variante cuando el producto tiene variantes", async () => {
    const { service } = build({ productos: [productoConVariantes], variantes: [varianteM] });

    await assert.rejects(
      () =>
        service.createManual({
          emprendimientoId: EMP,
          dto: { ...dtoBase, items: [{ productoId: PROD, cantidad: 1 }] },
        }),
      /tiene variantes/
    );
  });
});

describe("PedidoService - creacion desde canal", () => {
  test("crea el pedido con origen CANAL y el canal resuelto", async () => {
    const { service } = build();

    const pedido = await service.createFromChannel({
      emprendimientoId: EMP,
      canalId: CANAL,
      dto: {
        ...dtoBase,
        requiereRevision: false,
        reservarStock: false,
        items: [{ productoId: PROD, cantidad: 1 }],
      },
    });

    assert.equal(pedido.origen_tipo, "CANAL");
    assert.equal(pedido.canal_id, CANAL);
    assert.equal(pedido.requiere_revision, false);
  });

  test("rechaza un pedido de canal sin canal_id", async () => {
    const { service } = build();

    await assert.rejects(
      () =>
        service.createFromChannel({
          emprendimientoId: EMP,
          canalId: null,
          dto: { ...dtoBase, items: [] },
        }),
      /exige canal_id/
    );
  });

  test("un pedido para revision puede no tener items", async () => {
    const { service } = build();

    const pedido = await service.createFromChannel({
      emprendimientoId: EMP,
      canalId: CANAL,
      dto: {
        ...dtoBase,
        requiereRevision: true,
        motivoRevision: "No se identifico el producto",
        reservarStock: false,
        items: [],
      },
    });

    assert.equal(pedido.requiere_revision, true);
    assert.match(pedido.observaciones, /REVISAR: No se identifico el producto/);
    assert.equal(pedido.total, 0);
  });
});

describe("PedidoService - estados y cancelacion", () => {
  const crearPedidoReservado = async (buildArgs) => {
    const ctx = build(buildArgs);
    const pedido = await ctx.service.createManual({
      emprendimientoId: EMP,
      dto: { ...dtoBase, reservarStock: true, items: [{ productoId: PROD, cantidad: 2 }] },
    });
    return { ...ctx, pedido };
  };

  test("la cancelacion restituye el stock una sola vez", async () => {
    const { service, movimientoDao, stockDao, pedido } =
      await crearPedidoReservado();

    await service.changeStatus({
      emprendimientoId: EMP,
      id: pedido.id,
      estado: ORDER_STATUS.CANCELADO,
    });

    assert.equal(stockDao.stock[PROD].producto, 10, "el stock vuelve al original");

    // Un segundo intento de cancelacion no debe duplicar la restitucion.
    // Un segundo intento de cancelacion no debe duplicar la restitucion.
    await service.changeStatus({
      emprendimientoId: EMP,
      id: pedido.id,
      estado: ORDER_STATUS.CANCELADO,
    });

    const restituciones = movimientoDao.movimientos.filter(
      (m) => m.tipo === "RESTITUCION_CANCELACION"
    );
    assert.equal(restituciones.length, 1);
  });

  test("rechaza una transicion de estado invalida", async () => {
    const { service, pedido } = await crearPedidoReservado();

    await assert.rejects(
      () =>
        service.changeStatus({
          emprendimientoId: EMP,
          id: pedido.id,
          estado: ORDER_STATUS.ENTREGADO,
        }),
      /Transicion invalida|Transición inválida/
    );
  });

  test("permite avanzar de RECIBIDO a EN_PREPARACION", async () => {
    const { service, pedido } = await crearPedidoReservado();

    const actualizado = await service.changeStatus({
      emprendimientoId: EMP,
      id: pedido.id,
      estado: ORDER_STATUS.EN_PREPARACION,
    });

    assert.equal(actualizado.estado, ORDER_STATUS.EN_PREPARACION);
  });

  test("no permite modificar un pedido de otro tenant", async () => {
    const { service, pedido } = await crearPedidoReservado();

    await assert.rejects(
      () =>
        service.changeStatus({
          emprendimientoId: "OTRO-TENANT",
          id: pedido.id,
          estado: ORDER_STATUS.EN_PREPARACION,
        }),
      /no encontrado/
    );
  });
});
