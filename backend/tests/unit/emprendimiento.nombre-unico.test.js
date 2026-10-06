import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EmprendimientoService,
} from "../../src/modules/emprendimientos/emprendimiento.service.js";
import { ConflictError } from "../../src/errors/conflict.error.js";
import { mapNombreDuplicado } from "../../src/modules/emprendimientos/emprendimiento.dao.js";

/**
 * Unicidad global normalizada del nombre del emprendimiento.
 *
 * La garantia real es el indice unico `uq_emprendimientos_nombre_normalizado`
 * (migracion 006) sobre lower(btrim(nombre)); el DAO traduce su 23505 a un
 * 409 de dominio. No se hace "select previo" en el backend: con RLS el DAO
 * solo ve los emprendimientos del usuario y jamas podria garantizar que el
 * nombre no exista en otro tenant (ademas de la condicion de carrera).
 */

describe("EmprendimientoDao.mapNombreDuplicado", () => {
  test("23505 -> ConflictError 409 con el nombre en el mensaje", () => {
    const err = mapNombreDuplicado(
      { code: "23505", message: "duplicate key value" },
      "  Kiosco  "
    );
    assert.ok(err instanceof ConflictError);
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, "CONFLICT");
    assert.match(err.message, /Kiosco/);
  });

  test("sin nombre igual responde 409 generico", () => {
    const err = mapNombreDuplicado({ code: "23505" }, undefined);
    assert.ok(err instanceof ConflictError);
    assert.equal(err.statusCode, 409);
  });

  test("otro codigo (42501, 22023, ...) sube tal cual", () => {
    for (const code of ["42501", "22023", "PGRST116"]) {
      const original = { code, message: "otro" };
      assert.equal(mapNombreDuplicado(original, "X"), original);
    }
  });
});

describe("EmprendimientoService.rename: normaliza y delega unicidad al indice", () => {
  test("recorta espacios antes de actualizar", async () => {
    let guardado = null;
    const fakeDao = {
      async findById() {
        return { id: "emp-1", nombre: "Viejo" };
      },
      async update(id, cambios) {
        guardado = { id, cambios };
        return { id, ...cambios };
      },
    };
    const service = new EmprendimientoService({
      emprendimientoDao: fakeDao,
      usuarioEmprendimientoDao: {},
    });
    const res = await service.rename("emp-1", { nombre: "  Kiosco  " });
    assert.equal(res.nombre, "Kiosco");
    assert.deepEqual(guardado.cambios, { nombre: "Kiosco" });
  });

  test("el 409 del DAO sube como ConflictError sin envolver", async () => {
    const fakeDao = {
      async findById() {
        return { id: "emp-1", nombre: "Viejo" };
      },
      async update() {
        throw new ConflictError('Ya existe un emprendimiento con el nombre "Kiosco"');
      },
    };
    const service = new EmprendimientoService({
      emprendimientoDao: fakeDao,
      usuarioEmprendimientoDao: {},
    });
    await assert.rejects(
      () => service.rename("emp-1", { nombre: "Kiosco" }),
      (e) => e instanceof ConflictError && e.statusCode === 409
    );
  });

  test("ConflictError base: 409 CONFLICT serializable por el errorMiddleware", async () => {
    const err = new ConflictError("Ya existe");
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, "CONFLICT");
    assert.equal(err.isOperational, true);
  });
});
