import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ORDER_STATUS,
  ORDER_STATUS_TRANSITIONS,
} from "../../src/constants/order-status.enum.js";
import { changeOrderStatusSchema } from "../../src/modules/pedidos/dtos/change-order-status.dto.js";
import { PedidoService } from "../../src/modules/pedidos/pedido.service.js";
import {
  FakeMovimientoDao,
  FakePedidoDao,
} from "../helpers/daos.js";
import {
  buildClienteServiceStub,
  buildProductoServiceStub,
  buildVarianteServiceStub,
} from "../helpers/stubs.js";
import { validarUrlBaseDePruebas } from "../helpers/postgres-transaccion.js";

const EMPRENDIMIENTO_ID = "11111111-1111-1111-1111-111111111111";
const PRODUCTO_ID = "22222222-2222-2222-2222-222222222222";

describe("URL de la base de pruebas", () => {
  test("rechaza URLs cuya base no contiene test", () => {
    assert.throws(
      () =>
        validarUrlBaseDePruebas(
          "postgresql://usuario:clave@localhost/gestor"
        ),
      /nombre de la base debe contener 'test'/
    );
  });

  test("acepta la base test_gestor", () => {
    assert.equal(
      validarUrlBaseDePruebas(
        "postgresql://usuario:clave@localhost/test_gestor"
      ),
      "test_gestor"
    );
  });
});

describe("Estados agregados al modelo", () => {
  test("permite las transiciones nuevas desde LISTO y EN_VIAJE", () => {
    assert.ok(
      ORDER_STATUS_TRANSITIONS[ORDER_STATUS.LISTO].includes(
        ORDER_STATUS.EN_VIAJE
      )
    );
    assert.ok(
      ORDER_STATUS_TRANSITIONS[ORDER_STATUS.EN_VIAJE].includes(
        ORDER_STATUS.ENTREGADO
      )
    );
    assert.ok(
      ORDER_STATUS_TRANSITIONS[ORDER_STATUS.EN_VIAJE].includes(
        ORDER_STATUS.CANCELADO
      )
    );
  });

  test("no permite salir de ENTREGADO ni de CANCELADO", () => {
    assert.deepEqual(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.ENTREGADO], []);
    assert.deepEqual(ORDER_STATUS_TRANSITIONS[ORDER_STATUS.CANCELADO], []);
  });

  test("no permite llegar a EN_VIAJE desde RECIBIDO o EN_PREPARACION", () => {
    assert.ok(
      !ORDER_STATUS_TRANSITIONS[ORDER_STATUS.RECIBIDO].includes(
        ORDER_STATUS.EN_VIAJE
      )
    );
    assert.ok(
      !ORDER_STATUS_TRANSITIONS[ORDER_STATUS.EN_PREPARACION].includes(
        ORDER_STATUS.EN_VIAJE
      )
    );
  });
});

describe("DTO de cambio de estado con EN_VIAJE", () => {
  test("acepta EN_VIAJE", () => {
    assert.equal(
      changeOrderStatusSchema.parse({ estado: "EN_VIAJE" }).estado,
      ORDER_STATUS.EN_VIAJE
    );
  });

  test("rechaza un estado inventado", () => {
    assert.throws(
      () => changeOrderStatusSchema.parse({ estado: "EN_ORBITA" }),
      /inválido/
    );
  });
});

describe("PedidoService y cancelación atómica", () => {
  test("no vuelve a restituir stock cuando la RPC ya lo restituyó", async () => {
    const movimientoDao = new FakeMovimientoDao();
    const pedidoDao = new FakePedidoDao({ movimientoDao });
    const pedido = await pedidoDao.createConItems(
      {
        emprendimiento_id: EMPRENDIMIENTO_ID,
        origen_tipo: "MANUAL",
        canal_id: null,
        estado: ORDER_STATUS.RECIBIDO,
      },
      [{ productoId: PRODUCTO_ID, cantidad: 2 }]
    );

    let stock = 8;
    await movimientoDao.create({
      pedido_id: pedido.id,
      producto_id: PRODUCTO_ID,
      tipo: "RESERVA_PEDIDO",
      cantidad: -2,
    });

    const actualizarEstado = pedidoDao.updateEstado.bind(pedidoDao);
    pedidoDao.updateEstado = async (emprendimientoId, id, estado) => {
      const actualizado = await actualizarEstado(emprendimientoId, id, estado);
      if (
        estado === ORDER_STATUS.CANCELADO &&
        !movimientoDao.movimientos.some(
          (movimiento) =>
            movimiento.pedido_id === id &&
            movimiento.tipo === "RESTITUCION_CANCELACION"
        )
      ) {
        stock += 2;
        await movimientoDao.create({
          pedido_id: id,
          producto_id: PRODUCTO_ID,
          tipo: "RESTITUCION_CANCELACION",
          cantidad: 2,
        });
      }
      return actualizado;
    };

    let restitucionesDesdeServicio = 0;
    const service = new PedidoService({
      pedidoDao,
      productoService: buildProductoServiceStub(),
      varianteService: buildVarianteServiceStub(),
      clienteService: buildClienteServiceStub(),
      stockService: {
        async restituirPedido() {
          restitucionesDesdeServicio += 1;
        },
      },
    });

    for (let intento = 0; intento < 2; intento += 1) {
      await service.changeStatus({
        emprendimientoId: EMPRENDIMIENTO_ID,
        id: pedido.id,
        estado: ORDER_STATUS.CANCELADO,
      });
    }

    assert.equal(stock, 10);
    assert.equal(restitucionesDesdeServicio, 0);
    assert.equal(
      movimientoDao.movimientos.filter(
        (movimiento) =>
          movimiento.tipo === "RESTITUCION_CANCELACION"
      ).length,
      1
    );
  });
});
