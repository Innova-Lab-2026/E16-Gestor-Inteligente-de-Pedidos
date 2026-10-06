import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createPedidoManualSchema } from "../../src/modules/pedidos/dtos/create-pedido-manual.dto.js";
import { changeOrderStatusSchema } from "../../src/modules/pedidos/dtos/change-order-status.dto.js";
import { createProductoSchema } from "../../src/modules/productos/dtos/create-producto.dto.js";
import { createCanalSchema } from "../../src/modules/canales/dtos/create-canal.dto.js";
import { loginSchema } from "../../src/modules/auth/dtos/login.dto.js";

const UUID = "22222222-2222-2222-2222-222222222222";

describe("DTO de pedido manual", () => {
  test("aplica defaults y coerciona numeros", () => {
    const dto = createPedidoManualSchema.parse({
      items: [{ productoId: UUID, cantidad: "3" }],
    });

    assert.equal(dto.items[0].cantidad, 3);
    assert.equal(dto.estadoCobro, "PENDIENTE");
    assert.equal(dto.reservarStock, true);
  });

  test("rechaza cantidad cero o negativa", () => {
    assert.throws(
      () => createPedidoManualSchema.parse({ items: [{ productoId: UUID, cantidad: 0 }] }),
      /entero mayor a 0/
    );
  });

  test("rechaza un pedido sin items", () => {
    assert.throws(() => createPedidoManualSchema.parse({ items: [] }), /al menos un item/);
  });

  test("rechaza un productoId que no es UUID", () => {
    assert.throws(
      () => createPedidoManualSchema.parse({ items: [{ productoId: "abc", cantidad: 1 }] }),
      /UUID/
    );
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
    assert.equal(dto.stockMinimo, 0);
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
      () => createCanalSchema.parse({ tipo: "MANUAL", identificadorExterno: "x" }),
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
