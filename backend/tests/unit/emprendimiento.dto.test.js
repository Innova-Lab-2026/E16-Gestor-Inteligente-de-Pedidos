import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createEmprendimientoSchema,
  updateEmprendimientoSchema,
} from "../../src/modules/emprendimientos/dtos/create-emprendimiento.dto.js";
import { registerSchema } from "../../src/modules/auth/dtos/register.dto.js";

describe("emprendimiento DTO", () => {
  test("accepts complete onboarding data and requires it for new businesses", () => {
    const result = createEmprendimientoSchema.parse({
      nombre: "Mi tienda",
      rubro: "Otro",
      especialidad: "Ferretería",
      canales_venta: ["WHATSAPP", "EN_PERSONA"],
      modalidades_entrega: ["RETIRO", "ENVIO"],
    });

    assert.deepEqual(result.canales_venta, ["WHATSAPP", "EN_PERSONA"]);
    assert.deepEqual(result.modalidades_entrega, ["RETIRO", "ENVIO"]);
    assert.equal(
      createEmprendimientoSchema.safeParse({ nombre: "Legado" }).success,
      false,
    );
  });

  test("rejects unsupported channels and delivery modes", () => {
    assert.equal(
      createEmprendimientoSchema.safeParse({
        nombre: "Mi tienda",
        rubro: "Flores",
        canales_venta: ["INSTAGRAM"],
        modalidades_entrega: ["ENVIO"],
      }).success,
      false,
    );
    assert.equal(
      updateEmprendimientoSchema.safeParse({
        modalidades_entrega: ["DELIVERY"],
      }).success,
      false,
    );
  });

  test("requires a specialty for Otro and keeps onboarding data in registration", () => {
    const emprendimiento = {
      nombre: "Mi tienda",
      rubro: "Otro",
      canales_venta: ["WHATSAPP"],
      modalidades_entrega: ["RETIRO"],
    };

    assert.equal(
      createEmprendimientoSchema.safeParse(emprendimiento).success,
      false,
    );
    const result = registerSchema.parse({
      email: "hola@example.com",
      password: "Clave123!",
      emprendimiento: {
        ...emprendimiento,
        especialidad: "Ferretería",
      },
    });
    assert.deepEqual(result.emprendimiento.canales_venta, ["WHATSAPP"]);
    assert.deepEqual(result.emprendimiento.modalidades_entrega, ["RETIRO"]);
  });
});
