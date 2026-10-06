import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../../src/modules/auth/auth.service.js";

/**
 * El registro es el flujo donde antes se usaba una clave privilegiada
 * "porque todavia no hay sesion". Estos tests fijan lo contrario: con
 * sesion se usa el token del usuario, y sin sesion no se escribe nada.
 */

const USUARIO = { id: "u-1", email: "a@ejemplo.com" };
const PASSWORD = "clave12345";

const buildServicio = ({ sesion = null, perfil = { id: "u-1" } } = {}) => {
  const llamados = { lecturas: [], creaciones: [] };

  const publicClientFactory = () => ({
    auth: {
      async signUp() {
        return { data: { user: USUARIO, session: sesion }, error: null };
      },
    },
  });

  const usuarioDaoFactory = (token) => ({
    async findById(id) {
      llamados.lecturas.push({ token, id });
      return perfil;
    },
  });

  const emprendimientoServiceFactory = (token) => ({
    async create({ nombre }) {
      llamados.creaciones.push({ token, nombre });
      return { id: "emp-1", nombre };
    },
  });

  return {
    llamados,
    service: new AuthService({
      publicClientFactory,
      usuarioDaoFactory,
      emprendimientoServiceFactory,
    }),
  };
};

describe("AuthService.register", () => {
  test("con sesión usa el token del usuario y crea el emprendimiento", async () => {
    const { service, llamados } = buildServicio({
      sesion: { access_token: "jwt-de-a" },
    });

    const res = await service.register({
      email: USUARIO.email,
      password: PASSWORD,
      emprendimiento: { nombre: "Kiosco del Barrio" },
    });

    assert.equal(res.pendienteConfirmacion, false);
    assert.equal(res.emprendimiento.id, "emp-1");
    assert.deepEqual(llamados.lecturas, [{ token: "jwt-de-a", id: "u-1" }]);
    assert.deepEqual(llamados.creaciones, [
      { token: "jwt-de-a", nombre: "Kiosco del Barrio" },
    ]);
  });

  test("sin sesión (email sin confirmar) no escribe nada y lo informa", async () => {
    const { service, llamados } = buildServicio({ sesion: null });

    const res = await service.register({
      email: USUARIO.email,
      password: PASSWORD,
      emprendimiento: { nombre: "Kiosco del Barrio" },
    });

    assert.equal(res.pendienteConfirmacion, true);
    assert.equal(res.session, null);
    assert.equal(res.emprendimiento, null);
    assert.deepEqual(llamados.lecturas, [], "sin sesión no hay con qué leer el perfil");
    assert.deepEqual(llamados.creaciones, [], "sin sesión no se crea el emprendimiento");
  });

  test("sin nombre de emprendimiento no se llama a la RPC", async () => {
    const { service, llamados } = buildServicio({
      sesion: { access_token: "jwt-de-a" },
    });

    const res = await service.register({ email: USUARIO.email, password: PASSWORD });

    assert.equal(res.emprendimiento, null);
    assert.deepEqual(llamados.creaciones, []);
  });

  test("si falta el perfil espejo, el error dice qué migración falta", async () => {
    const { service } = buildServicio({
      sesion: { access_token: "jwt-de-a" },
      perfil: null,
    });

    await assert.rejects(
      () => service.register({ email: USUARIO.email, password: PASSWORD }),
      /on_auth_user_created/
    );
  });
});
