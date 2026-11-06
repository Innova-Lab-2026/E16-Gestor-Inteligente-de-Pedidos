import { test } from "node:test";
import assert from "node:assert/strict";
import { IntentDetector } from "../../../src/modules/whatsapp-pedidos/intent-detector.js";

const d = new IntentDetector();

test("intención directa: quiero hacer un pedido", () => {
  assert.equal(d.detect("Quiero hacer un pedido"), true);
});

test("intención directa: necesito hacer un pedido", () => {
  assert.equal(d.detect("Necesito hacer un pedido"), true);
});

test("intención probable: quiero 2 remeras negras", () => {
  assert.equal(d.detect("Quiero 2 remeras negras"), true);
});

test("consulta: ¿Tenés remeras negras?", () => {
  assert.equal(d.detect("¿Tenés remeras negras?"), false);
});

test("saludo solo: hola", () => {
  assert.equal(d.detect("Hola"), false);
});

test("plantilla ya completada: PEDIDO ...", () => {
  assert.equal(
    d.detect("PEDIDO\nProducto: Remera\nCantidad: 2\nEntrega: Retiro\nNombre: Juan"),
    false,
  );
});

test("mensaje libre similar: quiero saber precios", () => {
  assert.equal(d.detect("Quiero saber precios"), false);
});

test("cancelación: cancelar pedido", () => {
  assert.equal(d.detect("Cancelar pedido"), false);
});