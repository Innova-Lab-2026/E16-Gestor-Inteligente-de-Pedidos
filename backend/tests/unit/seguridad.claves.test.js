import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { clasificarClave } from "../../src/config/env.js";

/**
 * Guarda de la separación de clientes de Supabase.
 *
 * La clave secreta (`sb_secret_...`) saltea RLS. El único flujo que la
 * necesita es el de webhooks, porque no tiene sesión que atribuir. Si
 * aparece en cualquier otro archivo, este test falla: es la diferencia
 * entre "el webhook no tiene identidad" y "elegimos saltearnos RLS".
 */

// DAOs alcanzables desde un webhook. `createFromChannel` nunca reserva
// stock, pero el DAO igual tiene que poder leer y escribir el pedido.
const DAOS_WEBHOOK = [
  "src/modules/canales/canal.dao.js",
  "src/modules/clientes/cliente.dao.js",
  "src/modules/eventos-canal/evento-canal.dao.js",
  "src/modules/pedidos/pedido.dao.js",
  "src/modules/productos/producto.dao.js",
  "src/modules/stock/movimiento-stock.dao.js",
  "src/modules/stock/stock.dao.js",
  "src/modules/variantes/variante.dao.js",
];

const DAOS_IDENTIDAD = [
  "src/modules/emprendimientos/emprendimiento.dao.js",
  "src/modules/usuarios/usuario.dao.js",
  "src/modules/usuarios/usuario-emprendimiento.dao.js",
];

const PERMITIDOS = new Set([
  "src/config/database.js", // donde se define el cliente
  "src/config/env.js", // donde se lee la variable
  "src/server.js", // solo los avisos de entorno
  ...DAOS_WEBHOOK,
]);

const recorrer = (dir) =>
  readdirSync(dir).flatMap((entrada) => {
    const ruta = `${dir}/${entrada}`;
    return statSync(join(dir, entrada)).isDirectory()
      ? recorrer(ruta)
      : ruta.replace(/\\/g, "/");
  });

const FUENTES = recorrer("src").filter((ruta) => ruta.endsWith(".js"));

describe("Separación de clientes de Supabase", () => {
  test("createSecretClient no aparece fuera del flujo de webhooks", () => {
    const culpables = FUENTES.filter(
      (ruta) =>
        !PERMITIDOS.has(ruta) && readFileSync(ruta, "utf8").includes("createSecretClient")
    );

    assert.deepEqual(
      culpables,
      [],
      "solo los DAOs de webhooks pueden usar la clave secreta"
    );
  });

  test("solo los DAOs de webhooks tienen fallback a la clave secreta", () => {
    const conFallback = FUENTES.filter(
      (ruta) =>
        ruta.endsWith(".dao.js") &&
        /:\s*createSecretClient\(\)/.test(readFileSync(ruta, "utf8"))
    );

    assert.deepEqual(conFallback.sort(), [...DAOS_WEBHOOK].sort());
  });

  test("los DAOs de identidad exigen token y no pueden saltearse RLS", () => {
    for (const ruta of DAOS_IDENTIDAD) {
      const texto = readFileSync(ruta, "utf8");
      assert.ok(
        !texto.includes("createSecretClient"),
        `${ruta} no debe tener la clave secreta disponible`
      );
      assert.ok(
        texto.includes("return createSupabaseClient(this.token)"),
        `${ruta} debe usar siempre el token del usuario`
      );
    }
  });

  test("database.js expone los tres clientes y ningún alias legado", async () => {
    const mod = await import("../../src/config/database.js");

    assert.equal(typeof mod.createSupabaseClient, "function");
    assert.equal(typeof mod.createPublicClient, "function");
    assert.equal(typeof mod.createSecretClient, "function");
    assert.equal(mod.createServiceClient, undefined, "el nombre legado ya no existe");
  });

  test("createSupabaseClient sin token falla en vez de escalar", async () => {
    const mod = await import("../../src/config/database.js");

    // El invariante es "falla ruidosamente, nunca escala a la clave
    // secreta". Si el entorno no tiene .env completo, falla todavia mas
    // temprano (validateEnv), que es igual de ruidoso y correcto.
    assert.throws(
      () => mod.createSupabaseClient(),
      /exige un token|Configuración de entorno incompleta/
    );
  });
});

describe("Claves de Supabase", () => {
  test("clasifica las claves por prefijo", () => {
    assert.equal(clasificarClave("sb_publishable_abc123"), "publishable");
    assert.equal(clasificarClave("sb_secret_abc123"), "secret");
    assert.equal(clasificarClave("eyJhbGciOiJIUzI1NiI"), "legacy-jwt");
    assert.equal(clasificarClave("cualquier-cosa"), "desconocida");
    assert.equal(clasificarClave(""), "ausente");
    assert.equal(clasificarClave(undefined), "ausente");
  });
});
