import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  createPedidoChannelSchema,
  createPedidoManualSchema,
} from "../../src/modules/pedidos/dtos/create-pedido-manual.dto.js";
import { updatePedidoDetailsSchema } from "../../src/modules/pedidos/dtos/update-pedido-details.dto.js";
import {
  changeOrderStatusSchema,
  listPedidosQuerySchema,
} from "../../src/modules/pedidos/dtos/change-order-status.dto.js";
import { createProductoSchema } from "../../src/modules/productos/dtos/create-producto.dto.js";
import { createCanalSchema } from "../../src/modules/canales/dtos/create-canal.dto.js";
import { loginSchema } from "../../src/modules/auth/dtos/login.dto.js";

const UUID = "22222222-2222-2222-2222-222222222222";

describe("DTO de pedido manual", () => {
  test("aplica defaults y coerciona numeros", () => {
    const dto = createPedidoManualSchema.parse({
      items: [{ producto_id: UUID, cantidad: "3" }],
    });

    assert.equal(dto.items[0].cantidad, 3);
    assert.equal(dto.estado_cobro, "PENDIENTE");
    assert.equal(dto.reservar_stock, false);
  });

  test("los pedidos de canal tampoco reservan stock al crearse", () => {
    const dto = createPedidoChannelSchema.parse({
      canal_id: UUID,
      items: [{ producto_id: UUID, cantidad: 1 }],
    });

    assert.equal(dto.reservar_stock, false);
  });

  test("rechaza cantidad cero o negativa", () => {
    assert.throws(
      () => createPedidoManualSchema.parse({ items: [{ producto_id: UUID, cantidad: 0 }] }),
      /entero mayor a 0/
    );
  });

  test("rechaza un pedido sin items", () => {
    assert.throws(() => createPedidoManualSchema.parse({ items: [] }), /al menos un item/);
  });

  test("rechaza un productoId que no es UUID", () => {
    assert.throws(
      () => createPedidoManualSchema.parse({ items: [{ producto_id: "abc", cantidad: 1 }] }),
      /UUID/
    );
  });

  test("acepta y valida los datos de entrega y pago", () => {
    const dto = createPedidoManualSchema.parse({
      modalidad_entrega: "ENVIO",
      direccion_entrega: "Av. Siempre Viva 123",
      fecha_prevista_entrega: "2026-11-25",
      hora_prevista_entrega: "18:30:00",
      medios_pago: ["Transferencia"],
      items: [{ producto_id: UUID, cantidad: 1 }],
    });

    assert.equal(dto.direccion_entrega, "Av. Siempre Viva 123");
    assert.equal(dto.hora_prevista_entrega, "18:30:00");
    assert.deepEqual(dto.medios_pago, ["Transferencia"]);
  });
});

describe("DTO de edición de entrega y pago", () => {
  test("permite limpiar campos opcionales y modificar los medios de pago", () => {
    const dto = updatePedidoDetailsSchema.parse({
      direccion_entrega: null,
      hora_prevista_entrega: null,
      medios_pago: ["Mercado Pago"],
    });

    assert.equal(dto.direccion_entrega, null);
    assert.equal(dto.hora_prevista_entrega, null);
    assert.deepEqual(dto.medios_pago, ["Mercado Pago"]);
  });

  test("rechaza un cuerpo vacío", () => {
    assert.throws(() => updatePedidoDetailsSchema.parse({}), /al menos un dato/);
  });
});

describe("DTO de estado de pedido", () => {
  test("acepta los estados del dominio", () => {
    assert.equal(changeOrderStatusSchema.parse({ estado: "LISTO" }).estado, "LISTO");
  });

  test("rechaza un estado inexistente", () => {
    assert.throws(() => changeOrderStatusSchema.parse({ estado: "VOLANDO" }), /inválido/);
  });
});

describe("DTO de filtros de listado de pedidos", () => {
  test("normaliza estados, pago, cliente, rango de fecha y paginación", () => {
    const filtros = listPedidosQuerySchema.parse({
      estado: ["RECIBIDO", "LISTO"],
      estado_pago: "pagado",
      desde: "2026-11-24",
      hasta: "2026-11-25",
      cliente_id: UUID,
      cliente: " Ana ",
      limite: "51",
      offset: "50",
    });

    assert.deepEqual(filtros.estado, ["RECIBIDO", "LISTO"]);
    assert.equal(filtros.estado_cobro, "PAGADO");
    assert.equal(filtros.desde, "2026-11-24");
    assert.equal(filtros.hasta, "2026-11-25");
    assert.equal(filtros.cliente_id, UUID);
    assert.equal(filtros.cliente, "Ana");
    assert.equal(filtros.limite, 51);
    assert.equal(filtros.offset, 50);
  });

  test("acepta el filtro exacto por fecha prevista y estado de cobro", () => {
    const filtros = listPedidosQuerySchema.parse({
      fecha_prevista_entrega: "2026-11-24",
      estado_cobro: "PENDIENTE",
    });

    assert.equal(filtros.fecha_prevista_entrega, "2026-11-24");
    assert.equal(filtros.estado_cobro, "PENDIENTE");
  });
});

describe("DTO de producto", () => {
  test("exige precio mayor a cero", () => {
    assert.throws(
      () => createProductoSchema.parse({ nombre: "X", precio: 0 }),
      /mayor a 0/
    );
  });

  test("acepta precio como string", () => {
    const dto = createProductoSchema.parse({ nombre: "X", precio: "1500.50" });
    assert.equal(dto.precio, 1500.5);
    assert.equal(dto.stock_minimo, 0);
  });

  test("impone maximo de longitud del nombre", () => {
    assert.throws(
      () => createProductoSchema.parse({ nombre: "a".repeat(200), precio: 10 }),
      /at most 150/
    );
  });
});

describe("DTO de canal", () => {
  test("rechaza un tipo de canal no soportado", () => {
    assert.throws(
      () => createCanalSchema.parse({ tipo: "MANUAL", identificador_externo: "x" }),
      /inválido/
    );
  });

  test("exige identificadorExterno", () => {
    assert.throws(
      () => createCanalSchema.parse({ tipo: "TELEGRAM" }),
      /Required/
    );
  });
});

describe("DTO de login", () => {
  test("rechaza emails invalidos", () => {
    assert.throws(() => loginSchema.parse({ email: "no-es-mail", password: "x" }), /email/);
  });
});
