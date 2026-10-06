import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardas de la capa de datos: RLS, GRANT y funciones SQL.
 *
 * No necesitan una base de datos: leen las migraciones y el codigo fuente
 * y fallan si alguien afloja una regla que sostiene el aislamiento entre
 * emprendimientos. La idea es que una regresion de seguridad no pueda
 * entrar sin que se vea en el diff de un test.
 *
 * Cada test nombra la regla que defiende.
 */

const leer = (ruta) => readFileSync(ruta, "utf8");

const SCHEMA = leer("db/migrations/001_schema_v2.sql");
const GRANTS = leer("db/migrations/002_grants_rls.sql");
const RPC_ALTA = leer("db/migrations/003_crear_emprendimiento_rpc.sql");
const RPC_STOCK = leer("db/migrations/004_stock_tenant_check.sql");
const MEMBRESIAS = leer("db/migrations/005_membresias_sin_autoalta.sql");
const NOMBRE_UNICO = leer("db/migrations/006_emprendimientos_nombre_unico.sql");

const CRUDOS = {
  schema: SCHEMA,
  grants: GRANTS,
  rpcAlta: RPC_ALTA,
  rpcStock: RPC_STOCK,
  membresias: MEMBRESIAS,
  nombreUnico: NOMBRE_UNICO,
};

// Tablas de identidad: no cuelgan de un emprendimiento. El resto son de
// negocio y tienen que poder responder "de quien es esta fila".
const TABLAS_IDENTIDAD = [
  "emprendimientos",
  "usuarios",
  "usuarios_emprendimientos",
];

// Tablas donde un INSERT abierto por RLS habilita una escalada de tenant.
// `usuarios` queda afuera a proposito: su politica de INSERT crea el
// espejo de la propia identidad (`with check (id = auth.uid())`) y no
// toca ninguna fila de otro.
const TABLAS_CON_AUTOALTA = ["emprendimientos", "usuarios_emprendimientos"];

/**
 * Quita los comentarios `--` de linea. Sin esto, un comentario que
 * *menciona* una sentencia prohibida haria fallar (o pasar) un test por
 * el motivo equivocado. Ojo: no se puede anclar en `$` sin la flag `m`, y
 * `.*` no consume el `\r`, asi que se corta en el `--` a secas.
 */
const sinComentarios = (sql) =>
  sql
    .split("\n")
    .map((linea) => linea.replace(/--.*/, ""))
    .join("\n");

/** Corta el SQL en sentencias por `;` (alcanza para GRANT/REVOKE). */
const sentencias = (sql) => sinComentarios(sql).split(";");

/**
 * Devuelve las policies con su cuerpo: { nombre, tabla, cuerpo }.
 * Las policies del repo son multilinea, asi que alcanza con acumular
 * lineas hasta el `;` que cierra la sentencia.
 */
const policies = (sql) => {
  const salida = [];
  let actual = null;

  for (const linea of sql.split("\n")) {
    const inicio = /create policy (\w+) on public\.(\w+)/i.exec(linea);

    if (inicio) {
      actual = { nombre: inicio[1], tabla: inicio[2], cuerpo: linea };
      continue;
    }
    if (!actual) continue;

    actual.cuerpo += `\n${linea}`;
    if (linea.includes(";")) {
      salida.push(actual);
      actual = null;
    }
  }

  return salida;
};

const FUENTES = readdirSync("src", { recursive: true })
  .map((ruta) => `src/${String(ruta).replace(/\\/g, "/")}`)
  .filter((ruta) => ruta.endsWith(".js") && statSync(join(ruta)).isFile());

describe("RLS: tablas y politicas (001)", () => {
  test("toda tabla creada tiene row level security habilitado", () => {
    const creadas = [
      ...SCHEMA.matchAll(/create table if not exists public\.(\w+)/gi),
    ].map((m) => m[1]);
    const conRls = [
      ...SCHEMA.matchAll(/alter table public\.(\w+) enable row level security/gi),
    ].map((m) => m[1]);

    assert.ok(creadas.length >= 11, "se esperaban las tablas del modelo v2");
    assert.deepEqual(
      creadas.sort(),
      conRls.sort(),
      "una tabla sin RLS queda expuesta por completo a la API"
    );
  });

  test("cada tabla de negocio tiene politica (no se mezclan los tenants)", () => {
    const creadas = [
      ...SCHEMA.matchAll(/create table if not exists public\.(\w+)/gi),
    ].map((m) => m[1]);
    const deNegocio = creadas.filter((t) => !TABLAS_IDENTIDAD.includes(t));

    const directas = new Set(policies(SCHEMA).map((p) => p.tabla));
    const bucle = /foreach\s+t\s+in\s+array\s+array\[([^\]]*)\]/i.exec(SCHEMA);
    const enBucle = new Set(
      [...(bucle?.[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1])
    );

    const sinPolitica = deNegocio.filter(
      (t) => !directas.has(t) && !enBucle.has(t)
    );
    assert.deepEqual(sinPolitica, [], "toda tabla de negocio necesita politica");
  });

  test("el UPDATE de emprendimientos valida la fila resultante", () => {
    const update = policies(SCHEMA).find((p) => p.nombre === "emp_update");

    assert.ok(update, "falta la politica emp_update");
    assert.match(update.cuerpo, /using \(/i, "USING: que filas puedo tocar");
    assert.match(
      update.cuerpo,
      /with check \(/i,
      "WITH CHECK: que valores puedo dejar despues del UPDATE"
    );
  });

  test("las tablas que heredan el tenant revalidan en USING y WITH CHECK", () => {
    for (const tabla of ["variantes", "items_pedido", "eventos_mensajeria"]) {
      const politica = policies(SCHEMA).find((p) => p.tabla === tabla);

      assert.ok(politica, `falta la politica de ${tabla}`);
      assert.match(politica.cuerpo, /using \(/i, `${tabla} sin USING`);
      assert.match(politica.cuerpo, /with check \(/i, `${tabla} sin WITH CHECK`);
      assert.match(
        politica.cuerpo,
        /usuario_tiene_emprendimiento/,
        `${tabla} no resuelve el tenant del padre`
      );
    }
  });

  test("el tenant sale del vinculo, no de un campo del request", () => {
    const bloque = /create policy tenant_all on public\.%I[\s\S]*?\$p\$/i.exec(SCHEMA);

    assert.ok(bloque, "no se encontro el loop de politicas de tenant");
    assert.match(
      bloque[0],
      /using \(public\.usuario_tiene_emprendimiento\(emprendimiento_id\)\)/
    );
    assert.match(
      bloque[0],
      /with check \(public\.usuario_tiene_emprendimiento\(emprendimiento_id\)\)/
    );
  });
});

describe("Membresias: nadie se autoinvita a un emprendimiento ajeno", () => {
  test("no hay politica de INSERT en las tablas con autoalta", () => {
    for (const tabla of TABLAS_CON_AUTOALTA) {
      const inserts = policies(SCHEMA)
        .filter((p) => p.tabla === tabla && /for insert/i.test(p.cuerpo))
        .map((p) => p.nombre);

      assert.deepEqual(
        inserts,
        [],
        `${tabla} no puede aceptar INSERT desde la API: el vinculo lo crea la RPC`
      );
    }
  });

  test("la 005 borra las policies de autoalta en una base ya migrada", () => {
    assert.match(
      MEMBRESIAS,
      /drop policy if exists ue_ins on public\.usuarios_emprendimientos/
    );
    assert.match(
      MEMBRESIAS,
      /drop policy if exists emp_insert on public\.emprendimientos/
    );
  });

  test("la 005 deja el UPDATE de emprendimientos con WITH CHECK", () => {
    const update = policies(MEMBRESIAS).find((p) => p.tabla === "emprendimientos");

    assert.ok(update, "la 005 tiene que recrear emp_update");
    assert.match(update.cuerpo, /with check \(/i);
  });

  test("el vinculo lo crea la RPC, con el dueno de la sesion", () => {
    const sql = sinComentarios(RPC_ALTA);

    assert.match(sql, /insert into public\.usuarios_emprendimientos/);
    assert.match(sql, /v_usuario := auth\.uid\(\)/);
    assert.doesNotMatch(
      sql,
      /p_usuario_id/,
      "un id de identidad por parametro es un bypass de autorizacion"
    );
    assert.doesNotMatch(
      sql,
      /grant execute[\s\S]{0,120}?to[\s\S]{0,40}?anon/,
      "la RPC no puede ser invocable sin sesion"
    );
  });
});

describe("GRANT y funciones (002 / 003 / 004)", () => {
  test("`anon` no recibe escritura sobre ninguna tabla", () => {
    const culpables = sentencias(GRANTS).filter(
      (s) =>
        /\bgrant\b/i.test(s) &&
        /\b(insert|update|delete|truncate)\b/i.test(s) &&
        /\banon\b/i.test(s)
    );

    assert.deepEqual(
      culpables.map((s) => s.trim().split("\n").pop().trim()),
      [],
      "la publishable key es publica: con `anon` no se escribe nada"
    );
  });

  test("`anon` no recibe privilegios sobre secuencias", () => {
    const conSecuencias = sentencias(GRANTS).filter(
      (s) => /on sequence/i.test(s) && /\banon\b/i.test(s)
    );

    assert.deepEqual(conSecuencias, []);
  });

  test("el EXECUTE de las funciones internas no se concede por el loop generico", () => {
    assert.match(GRANTS, /p\.proname not in \(/);
    for (const interna of [
      "asegurar_perfil_usuario",
      "handle_new_user",
      "crear_emprendimiento",
    ]) {
      assert.match(GRANTS, new RegExp(`'${interna}'`), `${interna} quedo expuesta`);
    }
  });

  test("las funciones de stock revocan el EXECUTE a `anon` y validan el tenant adentro", () => {
    for (const fn of ["ajustar_stock_producto", "ajustar_stock_variante"]) {
      assert.match(
        RPC_STOCK,
        new RegExp(
          `revoke all on function public\\.${fn}\\(uuid, integer\\) from public, anon`
        )
      );
      assert.match(
        RPC_STOCK,
        new RegExp(
          `grant execute on function public\\.${fn}\\(uuid, integer\\)\\s*\\n?\\s*to authenticated, service_role`
        )
      );
    }

    // security definer saltea RLS: el chequeo de tenant va en el cuerpo.
    assert.match(
      RPC_STOCK,
      /if not public\.usuario_tiene_emprendimiento\(v_emp\) then/
    );
    assert.match(RPC_STOCK, /auth\.role\(\) is distinct from 'service_role'/);
  });

  test("ninguna migracion concede EXECUTE a PUBLIC", () => {
    for (const [nombre, sql] of Object.entries(CRUDOS)) {
      const culpables = sentencias(sql).filter(
        (s) =>
          /\bgrant\b/i.test(s) && /\bexecute\b/i.test(s) && /\bto\s+public\b/i.test(s)
      );
      assert.deepEqual(culpables, [], `${nombre} concede EXECUTE a PUBLIC`);
    }
  });

  test("el nombre del emprendimiento es unico global y normalizado", () => {
    // La garantia es el indice unico sobre lower(btrim(nombre)):
    // "Kiosco", "kiosco" y "  KIOSCO  " colisionan. Sin este indice,
    // un check-then-insert en el backend tendria condicion de carrera
    // y, peor, con RLS solo veria los emprendimientos del usuario.
    assert.match(
      NOMBRE_UNICO,
      /create unique index if not exists uq_emprendimientos_nombre_normalizado/i
    );
    assert.match(NOMBRE_UNICO, /lower\s*\(\s*btrim\s*\(\s*nombre\s*\)\s*\)/i);
  });

  test("la RPC de alta rechaza el nombre duplicado con 23505", () => {
    // La RPC es security definer (ve todas las filas), asi que su
    // chequeo previo SI es global de verdad; el 23505 del indice queda
    // como garantia ante carreras. El DAO lo traduce a 409.
    assert.match(RPC_ALTA, /uq_emprendimientos_nombre_normalizado/);
    assert.match(RPC_ALTA, /lower\s*\(\s*btrim\s*\(\s*nombre\s*\)/i);
    assert.match(RPC_ALTA, /errcode\s*=\s*'23505'/);
  });

  test("el DAO traduce el 23505 de nombre duplicado a ConflictError (409)", () => {
    const dao = leer("src/modules/emprendimientos/emprendimiento.dao.js");
    assert.match(dao, /ConflictError/);
    assert.match(dao, /23505/);
  });
});

describe("Configuracion: claves y verificacion del JWT", () => {
  test("createSupabaseClient nunca se invoca sin token", () => {
    const culpables = FUENTES.filter(
      (ruta) =>
        ruta !== "src/config/database.js" &&
        /createSupabaseClient\(\s*\)/.test(leer(ruta))
    );

    assert.deepEqual(
      culpables,
      [],
      "sin token auth.uid() es NULL: el cliente tiene que fallar, no escalar"
    );
  });

  test("el JWT se verifica contra Supabase Auth, sin secreto compartido", () => {
    const culpables = FUENTES.filter((ruta) =>
      /SUPABASE_JWT_SECRET|jwt\.verify|jsonwebtoken/.test(leer(ruta))
    );

    assert.deepEqual(
      culpables,
      [],
      "no se arma infraestructura propia alrededor del JWT secret: el token se valida con getUser()"
    );
    assert.match(
      leer("src/middlewares/auth.middleware.js"),
      /auth\.getUser\(token\)/
    );
  });

  test("la clave secreta no puede viajar al navegador", () => {
    const conPrefijoDeCliente = [
      "src/config/env.js",
      "src/config/database.js",
      ".env.example",
      "readme.md",
    ].filter((ruta) => /VITE_SUPABASE_SECRET/.test(leer(ruta)));

    assert.deepEqual(conPrefijoDeCliente, []);

    // El .env no se versiona: la clave secreta vive solo ahi.
    assert.match(leer(".gitignore"), /(^|\n)\.env\r?\n/);
  });
});



