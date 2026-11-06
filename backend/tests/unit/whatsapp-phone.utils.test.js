import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizeWhatsAppRecipient } from "../../src/adapters/whatsapp/whatsapp-phone.utils.js";

describe("normalizeWhatsAppRecipient", () => {
  test("normaliza número argentino con 549", () => {
    assert.equal(normalizeWhatsAppRecipient("5492215943942"), "54221155943942");
  });

  test("elimina +", () => {
    assert.equal(normalizeWhatsAppRecipient("+5492215943942"), "54221155943942");
  });

  test("elimina espacios", () => {
    assert.equal(normalizeWhatsAppRecipient("54 9 221 5943942"), "54221155943942");
  });

  test("conserva argentino sin 549", () => {
    assert.equal(normalizeWhatsAppRecipient("542215943942"), "542215943942");
  });

  test("conserva número de otro país", () => {
    assert.equal(normalizeWhatsAppRecipient("14155552671"), "14155552671");
  });

  test("elimina + en otro país", () => {
    assert.equal(normalizeWhatsAppRecipient("+14155552671"), "14155552671");
  });

  test("rechaza null", () => {
    assert.throws(() => normalizeWhatsAppRecipient(null));
  });

  test("rechaza undefined", () => {
    assert.throws(() => normalizeWhatsAppRecipient(undefined));
  });

  test("rechaza vacío", () => {
    assert.throws(() => normalizeWhatsAppRecipient(""));
  });

  test("rechaza formato inválido", () => {
    assert.throws(() => normalizeWhatsAppRecipient("abc"));
  });
});