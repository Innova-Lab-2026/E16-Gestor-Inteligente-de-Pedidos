import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { StockService } from "../../src/modules/stock/stock.service.js";
import { STOCK_MOVEMENT_TYPE } from "../../src/constants/processing-status.enum.js";
import {
  FakeStockDao,
  FakeMovimientoDao,
} from "../helpers/daos.js";

export const EMP = "11111111-1111-1111-1111-111111111111";
export const PROD = "22222222-2222-2222-2222-222222222222";
export const VAR = "33333333-3333-3333-3333-333333333333";

export const build = (stock) => {
  const stockDao = new FakeStockDao(stock);
  const movimientoDao = new FakeMovimientoDao();
  const service = new StockService({ stockDao, movimientoStockDao: movimientoDao });
  return { service, stockDao, movimientoDao };
};

describe("StockService · signo de los movimientos", () => {
  test("la reserva descuenta y la restitución suma", () => {
    assert.equal(StockService.signedQuantity(STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO, 3), -3);
    assert.equal(
      StockService.signedQuantity(STOCK_MOVEMENT_TYPE.RESTITUCION_CANCELACION, 3),
      3
    );
    assert.equal(StockService.signedQuantity(STOCK_MOVEMENT_TYPE.REPOSICION, 10), 10);
    assert.equal(StockService.signedQuantity(STOCK_MOVEMENT_TYPE.PERDIDA, 2), -2);
  });

  test("la corrección manual respeta el signo enviado", () => {
    assert.equal(StockService.signedQuantity(STOCK_MOVEMENT_TYPE.CORRECCION_MANUAL, 5), 5);
    assert.equal(StockService.signedQuantity(STOCK_MOVEMENT_TYPE.CORRECCION_MANUAL, -5), -5);
  });
});

describe("StockService · disponibilidad", () => {
  test("informa si alcanza el stock", async () => {
    const { service } = build({ [PROD]: { producto: 5 } });

    const ok = await service.checkAvailability({ productoId: PROD, cantidad: 3 });
    assert.equal(ok.suficiente, true);
    assert.equal(ok.disponible, 5);

    const falta = await service.checkAvailability({ productoId: PROD, cantidad: 9 });
    assert.equal(falta.suficiente, false);
  });

  test("rechaza cantidades no positivas", async () => {
    const { service } = build({ [PROD]: { producto: 5 } });
    await assert.rejects(
      () => service.checkAvailability({ productoId: PROD, cantidad: 0 }),
      /entero mayor a 0/
    );
  });
});

describe("StockService · movimientos", () => {
  test("descuenta stock de producto y registra el movimiento", async () => {
    const { service, stockDao, movimientoDao } = build({
      [PROD]: { producto: 10 },
    });

    const { stockResultante, movimiento } = await service.move({
      emprendimientoId: EMP,
      productoId: PROD,
      tipo: STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO,
      cantidad: 4,
    });

    assert.equal(stockResultante, 6);
    assert.equal(stockDao.stock[PROD].producto, 6);
    assert.equal(movimiento.cantidad, -4, "la cantidad se guarda con signo");
    assert.equal(movimientoDao.movimientos.length, 1);
  });

  test("descuenta stock de la variante cuando se indica", async () => {
    const { service, stockDao } = build({
      [VAR]: { variante: 3 },
    });

    await service.move({
      emprendimientoId: EMP,
      productoId: PROD,
      varianteId: VAR,
      tipo: STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO,
      cantidad: 1,
    });

    assert.equal(stockDao.stock[VAR].variante, 2);
  });

  test("falla sin registrar movimiento cuando no alcanza el stock", async () => {
    const { service, movimientoDao, stockDao } = build({
      [PROD]: { producto: 1 },
    });

    await assert.rejects(
      () =>
        service.move({
          emprendimientoId: EMP,
          productoId: PROD,
          tipo: STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO,
          cantidad: 5,
        }),
      /Stock insuficiente/
    );

    assert.equal(
      movimientoDao.movimientos.length,
      0,
      "no debe dejar la bitácora inconsistente"
    );
    assert.equal(stockDao.stock[PROD].producto, 1, "el stock no cambia");
  });

  test("rechaza tipos de movimiento desconocidos", async () => {
    const { service } = build({ [PROD]: { producto: 1 } });
    await assert.rejects(
      () =>
        service.move({
          emprendimientoId: EMP,
          productoId: PROD,
          tipo: "INVENTADO",
          cantidad: 1,
        }),
      /Tipo de movimiento inválido/
    );
  });
});
