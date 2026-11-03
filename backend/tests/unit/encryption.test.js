import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { cifrar, descifrar, estaConfigurado } from "../../src/utils/encryption.js";

// Forzar una clave de prueba para las pruebas (32 bytes base64)
const CLAVE_PRUEBA =
  "10XP3BhOLW3ngAZu6s4W90JfshQzCU4MJNdeOTGoKFc="; // 32 bytes generados con crypto.randomBytes(32)

describe("encryption — utilidad de cifrado", () => {
  test("cifrar y descifrar son reversibles", () => {
    // Sobrescribir la variable de entorno para usar una clave predecible
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;

    const original = "access-token-de-prueba-12345";
    const cifrado = cifrar(original);
    const descifrado = descifrar(cifrado);

    assert.notEqual(cifrado, original, "El valor cifrado no debe ser texto plano");
    assert.equal(descifrado, original, "El descifrado debe recuperar el original");
  });

  test("dos cifrados del mismo texto dan resultados diferentes (IV aleatorio)", () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;

    const c1 = cifrar("texto-secreto");
    const c2 = cifrar("texto-secreto");

    assert.notEqual(c1, c2, "Cada cifrado debe usar un IV diferente");
  });

  test("descifrar de null devuelve null", () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;

    assert.equal(descifrar(null), null);
    assert.equal(descifrar(undefined), null);
  });

  test("cifrar de null devuelve null", () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;

    assert.equal(cifrar(null), null);
    assert.equal(cifrar(undefined), null);
  });

  test("descifrar con formato invalido lanza error", () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;

    assert.throws(() => descifrar("formato-invalido"), /Formato de credencial/);
    assert.throws(() => descifrar("solo.una.part"), /Formato de credencial/);
  });

  test("estaConfigurado devuelve true con clave valida", () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = CLAVE_PRUEBA;
    assert.equal(estaConfigurado(), true);
  });

  test("estaConfigurado devuelve false sin clave", () => {
    delete process.env.WHATSAPP_ENCRYPTION_KEY;
    assert.equal(estaConfigurado(), false);
  });

  test("cifrar sin clave lanza error", () => {
    delete process.env.WHATSAPP_ENCRYPTION_KEY;

    assert.throws(() => cifrar("algo"), /WHATSAPP_ENCRYPTION_KEY/);
  });
});
