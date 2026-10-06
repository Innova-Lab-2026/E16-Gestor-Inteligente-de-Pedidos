import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { StockService } from "../../src/modules/stock/stock.service.js";
import { STOCK_MOVEMENT_TYPE } from "../../src/constants/processing-status.enum.js";
import { FakeStockDao, FakeMovimientoDao } from "../helpers/daos.js";

const EMP = "11111111-1111-1111-1111-111111111111";
const PROD = "22222222-2222-2222-2222-222222222222";
const VAR = "33333333-3333-3333-3333-333333333333";

const build = (stock) => {
  const stockDao = new FakeStockDao(stock);
  const movimientoDao = new FakeMovimientoDao();
  const service = new StockService({ stockDao, movimientoStockDao: movimientoDao });
  return { service, stockDao, movimientoDao };
};

describe("StockService · reserva y restitución de un pedido", () => {
  test("reserva todos los items del pedido", async () => {
    const { service, stockDao, movimientoDao } = build({
      [PROD]: { producto: 10 },
      [VAR]: { variante: 4 },
    });

    const movimientos = await service.reservarPedido({
      emprendimientoId: EMP,
      pedidoId: "pedido-1",
      items: [
        { productoId: PROD, cantidad: 3 },
        { productoId: PROD, varianteId: VAR, cantidad: 2 },
      ],
    });

    assert.equal(movimientos.length, 2);
    assert.equal(stockDao.stock[PROD].producto, 7);
    assert.equal(stockDao.stock[VAR].variante, 2);
    assert.ok(movimientos.every((m) => m.pedido_id === "pedido-1"));
  });

  test("exige al menos un item para reservar", async () => {
    const { service } = build({ [PROD]: { producto: 10 } });
    await assert.rejects(
      () =>
        service.reservarPedido({ emprendimientoId: EMP, pedidoId: "p", items: [] }),
      /no tiene items/
    );
  });

  test("la restitución devuelve el stock y queda auditada", async () => {
    const { service, stockDao, movimientoDao } = build({
      [PROD]: { producto: 7 },
    });

    await service.reservarPedido({
      emprendimientoId: EMP,
      pedidoId: "pedido-1",
      items: [{ productoId: PROD, cantidad: 3 }],
    });
    await service.restituirPedido({
      emprendimientoId: EMP,
      pedidoId: "pedido-1",
      items: [{ productoId: PROD, cantidad: 3 }],
    });

    assert.equal(stockDao.stock[PROD].producto, 7, "vuelve al valor original");

    const tipos = movimientoDao.movimientos.map((m) => m.tipo);
    assert.deepEqual(tipos, ["RESERVA_PEDIDO", "RESTITUCION_CANCELACION"]);
  });

  test("una reposición manual suma stock sin pedido asociado", async () => {
    const { service, movimientoDao } = build({ [PROD]: { producto: 1 } });

    await service.ajustarManual({
      emprendimientoId: EMP,
      productoId: PROD,
      tipo: STOCK_MOVEMENT_TYPE.REPOSICION,
      cantidad: 20,
      motivo: "Compra a proveedor",
    });

    const movimiento = movimientoDao.movimientos[0];
    assert.equal(movimiento.cantidad, 20);
    assert.equal(movimiento.pedido_id, null);
  });
});
