import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderTemplateParser } from "../../../src/modules/whatsapp-pedidos/order-template-parser.js";

test("parser: no reconocible (sin PEDIDO)", () => {
  assert.equal(OrderTemplateParser.parse("Hola, quiero comprar"), null);
});

test("parser: simple válido", () => {
  const r = OrderTemplateParser.parse(
    "PEDIDO\nProducto: Remera\nVariante: M\nCantidad: 2\nEntrega: Retiro\nNombre: Juan",
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.items[0].productoTexto, "Remera");
});

test("parser: múltiples ítems", () => {
  const r = OrderTemplateParser.parse(
    "PEDIDO\nItems:\n- Producto: Remera | Variante: M | Cantidad: 2\n- Producto: Pantalón | Variante: 42 | Cantidad: 1\nEntrega: Envío\nDirección: Calle 1\nNombre: Juan",
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.items.length, 2);
});

test("parser: incompleto (falta Nombre)", () => {
  const r = OrderTemplateParser.parse(
    "PEDIDO\nProducto: Remera\nCantidad: 2\nEntrega: Retiro",
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Nombre")));
});

test("parser: línea desconocida", () => {
  const r = OrderTemplateParser.parse(
    "PEDIDO\nProducto: Remera\nCantidad: 2\nEntrega: Retiro\nNombre: Juan\nFoo: bar",
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("no reconocida")));
});