import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  WhatsAppConexionService,
  ESTADO_CONEXION,
} from "../../src/modules/whatsapp-conexion/whatsapp-conexion.service.js";

class FakeDao {
  constructor() {
    this.conexiones = [];
    this.numeros = [];
    this.secuencia = 0;
    this.accessTokens = new Map();
  }

  async create({ emprendimientoId, conexion }) {
    this.secuencia += 1;
    const row = {
      id: `conexion-${this.secuencia}`,
      emprendimiento_id: emprendimientoId,
      waba_id: conexion.wabaId,
      app_id: conexion.appId,
      config_id: conexion.configId,
      access_token_encrypted: "ENCRIPTADO",
      token_expires_at: conexion.tokenExpiresAt ?? null,
      estado: conexion.estado ?? "pendiente",
      metadata: conexion.metadata ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.conexiones.push(row);
    this.accessTokens.set(row.id, conexion.accessToken);
    return row;
  }

  async listByEmprendimiento(emprendimientoId) {
    return this.conexiones.filter(
      (c) => c.emprendimiento_id === emprendimientoId
    );
  }

  async findById(emprendimientoId, id) {
    return (
      this.conexiones.find(
        (c) => c.id === id && c.emprendimiento_id === emprendimientoId
      ) || null
    );
  }

  async findByIdOrFail(emprendimientoId, id) {
    const row = await this.findById(emprendimientoId, id);
    if (!row) {
      const { NotFoundError } = await import("../../src/errors/not-found.error.js");
      throw new NotFoundError(`Conexion ${id} no encontrada`);
    }
    return row;
  }

  async setEstado(emprendimientoId, id, estado) {
    const row = await this.findByIdOrFail(emprendimientoId, id);
    row.estado = estado;
    row.updated_at = new Date().toISOString();
    return row;
  }

  async descifrarAccessToken(emprendimientoId, id) {
    await this.findByIdOrFail(emprendimientoId, id);
    return this.accessTokens.get(id) ?? null;
  }

  async crearNumero(conexionId, numero) {
    const row = {
      id: `numero-${this.numeros.length + 1}`,
      whatsapp_conexion_id: conexionId,
      phone_number_id: numero.phoneNumberId,
      numero_telefono: numero.numeroTelefono,
      nombre_registro: numero.nombreRegistro ?? null,
      nombre_canal: numero.nombreCanal ?? null,
      activo: numero.activo ?? true,
    };
    this.numeros.push(row);
    return row;
  }

  async listNumerosByConexion(conexionId) {
    return this.numeros.filter((n) => n.whatsapp_conexion_id === conexionId);
  }

  async actualizarNumero(conexionId, numeroId, cambios) {
    const row = this.numeros.find(
      (n) => n.id === numeroId && n.whatsapp_conexion_id === conexionId
    );
    if (!row) return null;
    Object.assign(row, cambios);
    return row;
  }
}

const EMP_A = "11111111-1111-1111-1111-111111111111";
const EMP_B = "22222222-2222-2222-2222-222222222222";
const USUARIO = "33333333-3333-3333-3333-333333333333";

describe("WhatsAppConexionService", () => {
  describe("ESTADO_CONEXION", () => {
    test("tiene los estados esperados", () => {
      assert.equal(ESTADO_CONEXION.PENDIENTE, "pendiente");
      assert.equal(ESTADO_CONEXION.ACTIVO, "activo");
      assert.equal(ESTADO_CONEXION.DESHABILITADO, "deshabilitado");
      assert.equal(ESTADO_CONEXION.REVOCADO, "revocado");
      assert.equal(ESTADO_CONEXION.ERROR, "error");
    });
  });

  describe("iniciarConexion", () => {
    test("genera una URL de Embedded Signup con state vinculado", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      const resultado = await svc.iniciarConexion({
        emprendimientoId: EMP_A,
        usuarioId: USUARIO,
        nombreCanal: "Mi WhatsApp",
      });

      assert.ok(resultado.connectionUrl);
      assert.equal(resultado.estado, "pendiente");
      assert.ok(resultado.state);

      const stateDecoded = JSON.parse(
        Buffer.from(resultado.state, "base64url").toString("utf8")
      );
      assert.equal(stateDecoded.u, USUARIO);
      assert.equal(stateDecoded.e, EMP_A);
    });
  });

  describe("listarConexiones", () => {
    test("devuelve solo las conexiones del emprendimiento solicitado", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      await dao.create({
        emprendimientoId: EMP_A,
        conexion: { wabaId: "waba-1", estado: ESTADO_CONEXION.ACTIVO },
      });
      await dao.create({
        emprendimientoId: EMP_B,
        conexion: { wabaId: "waba-2", estado: ESTADO_CONEXION.ACTIVO },
      });

      const conexionesA = await svc.listarConexiones(EMP_A, USUARIO);
      assert.equal(conexionesA.length, 1);
      assert.equal(conexionesA[0].wabaId, "waba-1");

      const conexionesB = await svc.listarConexiones(EMP_B, USUARIO);
      assert.equal(conexionesB.length, 1);
      assert.equal(conexionesB[0].wabaId, "waba-2");
    });

    test("no devuelve access tokens ni credenciales cifradas", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      await dao.create({
        emprendimientoId: EMP_A,
        conexion: { wabaId: "waba-1", estado: ESTADO_CONEXION.ACTIVO },
      });

      const conexiones = await svc.listarConexiones(EMP_A, USUARIO);
      assert.equal(conexiones[0].access_token_encrypted, undefined);
      assert.equal(conexiones[0].accessToken, undefined);
    });
  });

  describe("desactivarConexion", () => {
    test("cambia el estado a deshabilitado y desactiva los numeros", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      const conexion = await dao.create({
        emprendimientoId: EMP_A,
        conexion: { wabaId: "waba-1", estado: ESTADO_CONEXION.ACTIVO },
      });

      await dao.crearNumero(conexion.id, {
        phoneNumberId: "phone-1",
        numeroTelefono: "+5491123456789",
        activo: true,
      });

      const resultado = await svc.desactivarConexion(
        EMP_A,
        conexion.id,
        USUARIO
      );

      assert.equal(resultado.estado, "deshabilitado");

      const actualizada = await dao.findById(EMP_A, conexion.id);
      assert.equal(actualizada.estado, "deshabilitado");

      const numeros = await dao.listNumerosByConexion(conexion.id);
      assert.equal(numeros[0].activo, false);
    });
  });

  describe("obtenerAccessToken", () => {
    test("devuelve el access token descifrado para conexion activa", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      const conexion = await dao.create({
        emprendimientoId: EMP_A,
        conexion: {
          wabaId: "waba-1",
          accessToken: "token-secreto-123",
          estado: ESTADO_CONEXION.ACTIVO,
        },
      });

      const token = await svc.obtenerAccessToken(
        EMP_A,
        conexion.id,
        USUARIO
      );

      assert.equal(token, "token-secreto-123");
    });

    test("rechaza conexion no activa", async () => {
      const dao = new FakeDao();
      const svc = new WhatsAppConexionService({ dao });

      const conexion = await dao.create({
        emprendimientoId: EMP_A,
        conexion: { wabaId: "waba-1", estado: ESTADO_CONEXION.PENDIENTE },
      });

      await assert.rejects(
        () => svc.obtenerAccessToken(EMP_A, conexion.id, USUARIO),
        /no esta activa/
      );
    });
  });
});
