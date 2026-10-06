import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { tenantMiddleware } from "../../src/middlewares/tenant.middleware.js";
import { authMiddleware } from "../../src/middlewares/auth.middleware.js";
import { CHANNEL_TYPE } from "../../src/constants/channel-type.enum.js";

const EMP_A = "11111111-1111-1111-1111-111111111111";
const EMP_B = "99999999-9999-9999-9999-999999999999";

/** DAO stub: devuelve los emprendimientos del usuario. */
const usuarioRepo = (emprendimientos) => ({
  async listByUser() {
    return emprendimientos;
  },
});

const run = (middleware, req) =>
  new Promise((resolve, reject) => {
    const res = { status: () => res, json: () => res };
    middleware(req, res, (err) => (err ? reject(err) : resolve(req)));
  });

const baseReq = (extra = {}) => ({
  user: { id: "u1" },
  userToken: "token",
  headers: {},
  query: {},
  body: {},
  ...extra,
});

describe("tenantMiddleware", () => {
  test("resuelve el tenant cuando el usuario tiene un solo emprendimiento", async () => {
    const mw = tenantMiddleware(
      usuarioRepo([{ emprendimiento_id: EMP_A, nombre: "A" }])
    );
    const req = baseReq();

    await run(mw, req);
    assert.equal(req.tenant.id, EMP_A);
    assert.equal(req.tenant.nombre, "A");
  });

  test("rechaza un emprendimiento al que el usuario no tiene acceso", async () => {
    const mw = tenantMiddleware(
      usuarioRepo([{ emprendimiento_id: EMP_A, nombre: "A" }])
    );
    const req = baseReq({ headers: { "x-emprendimiento-id": EMP_B } });

    await assert.rejects(
      () => run(mw, req),
      (err) => {
        assert.equal(err.code, "UNVERIFIED_TENANT");
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });
  test("pide el tenant explicito cuando el usuario tiene varios", async () => {
    const mw = tenantMiddleware(
      usuarioRepo([
        { emprendimiento_id: EMP_A, nombre: "A" },
        { emprendimiento_id: EMP_B, nombre: "B" },
      ])
    );

    await assert.rejects(() => run(mw, baseReq()), /varios emprendimientos/);
  });

  test("acepta el tenant indicado si el usuario es miembro", async () => {
    const mw = tenantMiddleware(
      usuarioRepo([
        { emprendimiento_id: EMP_A, nombre: "A" },
        { emprendimiento_id: EMP_B, nombre: "B" },
      ])
    );
    const req = baseReq({ headers: { "x-emprendimiento-id": EMP_A } });

    await run(mw, req);
    assert.equal(req.tenant.id, EMP_A);
  });

  test("acepta el tenant enviado por query", async () => {
    const mw = tenantMiddleware(
      usuarioRepo([{ emprendimiento_id: EMP_A, nombre: "A" }])
    );
    const req = baseReq({ query: { emprendimientoId: EMP_A } });

    await run(mw, req);
    assert.equal(req.tenant.id, EMP_A);
  });

  test("falla si el usuario no pertenece a ningun emprendimiento", async () => {
    const mw = tenantMiddleware(usuarioRepo([]));
    await assert.rejects(() => run(mw, baseReq()), /no pertenece a ningún/);
  });

  test("falla si no hay usuario autenticado", async () => {
    const mw = tenantMiddleware(usuarioRepo([]));
    const req = { headers: {}, query: {}, body: {} };

    await assert.rejects(() => run(mw, req), /usuario autenticado/);
  });
});

describe("authMiddleware", () => {
  test("rechaza peticiones sin header Authorization", async () => {
    await assert.rejects(() => run(authMiddleware, { headers: {} }), /Authorization/);
  });

  test("rechaza un header que no es Bearer", async () => {
    await assert.rejects(
      () => run(authMiddleware, { headers: { authorization: "Basic abc" } }),
      /Authorization/
    );
  });
});

describe("constantes de canal", () => {
  test("CHANNEL_TYPE no incluye MANUAL", () => {
    assert.equal(Object.values(CHANNEL_TYPE).includes("MANUAL"), false);
  });
});
