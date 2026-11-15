import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const migrations = [
  "db/migrations/001_schema_v2.sql",
  "db/migrations/002_grants_rls.sql",
  "db/migrations/003_crear_emprendimiento_rpc.sql",
  "db/migrations/004_stock_tenant_check.sql",
  "db/migrations/005_membresias_sin_autoalta.sql",
  "db/migrations/006_emprendimientos_nombre_unico.sql",
  "db/migrations/007_whatsapp_conexiones.sql",
];

const rpcs = [
  "db/RPC/crear_pedido_con_items.sql",
  "db/RPC/mover_stock_con_movimiento.sql",
];

function cargarSql(paths) {
  return paths
    .map((relativePath) =>
      readFileSync(path.join(backendDir, relativePath), "utf8").replace(
        /^\uFEFF/,
        ""
      )
    )
    .join("\n");
}

const authDePrueba = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin';
  end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    execute $function$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$
    $function$;
    execute 'grant execute on function auth.uid() to anon, authenticated, service_role';
  end if;
  if to_regprocedure('auth.role()') is null then
    execute $function$
      create function auth.role()
      returns text
      language sql
      stable
      as $body$
        select nullif(current_setting('request.jwt.claim.role', true), '');
      $body$
    $function$;
    execute 'grant execute on function auth.role() to anon, authenticated, service_role';
  end if;
end $$;
grant usage on schema auth to anon, authenticated, service_role;
`;

function psql(script) {
  try {
    return execFileSync(
      "psql",
      [
        "--no-psqlrc",
        "--quiet",
        "--set",
        "ON_ERROR_STOP=1",
        "--dbname",
        process.env.TEST_DATABASE_URL,
      ],
      {
        input: script,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      }
    );
  } catch (error) {
    const detalle = error.stderr?.toString("utf8").trim();
    const estado = error.code ?? error.signal ?? "error";
    throw new Error(
      `Falló la transacción de prueba PostgreSQL (${estado})${detalle ? `: ${detalle}` : ""}`
    );
  }
}

const todasLasMigraciones = [
  ...migrations,
  ...rpcs,
  "db/migrations/008_completar_modelo.sql",
  "db/migrations/009_ajustes_segun_diseno.sql",
];

// Las migraciones se aplican CONFIRMADAS (sin transacción envolvente), una vez
// por proceso. Motivo: la 009 hace `alter type pedido_estado add value
// 'EN_VIAJE'`, y Postgres no deja usar un valor de enum agregado en la misma
// transacción ("unsafe use of new value"). Son idempotentes, así que sobre una
// base de pruebas descartable no hay problema. Cada test corre después en su
// propia transacción con ROLLBACK y no deja datos.
let esquemaListo = false;
function prepararEsquema({ repetir = false } = {}) {
  if (!esquemaListo) {
    psql(`${authDePrueba}\n${cargarSql(todasLasMigraciones)}`);
    esquemaListo = true;
  }
  if (repetir) {
    psql(cargarSql(todasLasMigraciones));
  }
}

export function ejecutarEnPostgres(sql, { repetirMigraciones = false } = {}) {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL es necesaria para ejecutar este test");
  }

  prepararEsquema({ repetir: repetirMigraciones });
  return psql(`BEGIN;\n${sql}\nROLLBACK;\n`);
}

export const crearDatosBase = `
select set_config('test.emprendimiento_a', gen_random_uuid()::text, true);
select set_config('test.emprendimiento_b', gen_random_uuid()::text, true);
select set_config('test.usuario_a', gen_random_uuid()::text, true);
select set_config('test.usuario_b', gen_random_uuid()::text, true);
select set_config('test.producto_a', gen_random_uuid()::text, true);
select set_config('test.producto_b', gen_random_uuid()::text, true);
select set_config('test.producto_variantes', gen_random_uuid()::text, true);
select set_config('test.variante_a', gen_random_uuid()::text, true);
select set_config('test.cliente_a', gen_random_uuid()::text, true);
select set_config('test.cliente_b', gen_random_uuid()::text, true);
select set_config('test.canal_a', gen_random_uuid()::text, true);
select set_config('test.canal_b', gen_random_uuid()::text, true);

-- Sesión por defecto: usuario A. cambiar_estado_pedido exige sesión de un
-- miembro o la clave secreta; sin esto un superusuario "sin sesión" es rechazado.
select set_config('request.jwt.claim.sub', current_setting('test.usuario_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into auth.users (id, email)
values
  (current_setting('test.usuario_a')::uuid, current_setting('test.usuario_a') || '@test.invalid'),
  (current_setting('test.usuario_b')::uuid, current_setting('test.usuario_b') || '@test.invalid');

insert into public.emprendimientos (id, nombre)
values
  (current_setting('test.emprendimiento_a')::uuid, 'Prueba A ' || current_setting('test.emprendimiento_a')),
  (current_setting('test.emprendimiento_b')::uuid, 'Prueba B ' || current_setting('test.emprendimiento_b'));

insert into public.usuarios_emprendimientos (usuario_id, emprendimiento_id)
values
  (current_setting('test.usuario_a')::uuid, current_setting('test.emprendimiento_a')::uuid),
  (current_setting('test.usuario_b')::uuid, current_setting('test.emprendimiento_b')::uuid);

insert into public.clientes (id, emprendimiento_id, nombre)
values
  (current_setting('test.cliente_a')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Cliente A'),
  (current_setting('test.cliente_b')::uuid, current_setting('test.emprendimiento_b')::uuid, 'Cliente B');

insert into public.productos
  (id, emprendimiento_id, nombre, precio, stock_disponible, stock_minimo, sku_o_identificador)
values
  (current_setting('test.producto_a')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Producto A', 100, 10, 2, 'SKU-A'),
  (current_setting('test.producto_b')::uuid, current_setting('test.emprendimiento_b')::uuid, 'Producto B', 100, 4, 1, 'SKU-B');

insert into public.productos
  (id, emprendimiento_id, nombre, precio, tiene_variantes, stock_disponible, stock_minimo)
values
  (current_setting('test.producto_variantes')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Producto con variantes', 100, true, null, 3);

insert into public.variantes
  (id, producto_id, nombre, stock_disponible, stock_minimo, atributos)
values
  (current_setting('test.variante_a')::uuid, current_setting('test.producto_variantes')::uuid, 'Talle M', 1, 2, '{"talle":"M","color":"Azul"}');

insert into public.canales (id, emprendimiento_id, tipo, identificador_externo)
values
  (current_setting('test.canal_a')::uuid, current_setting('test.emprendimiento_a')::uuid, 'WHATSAPP', 'canal-a-' || current_setting('test.canal_a')),
  (current_setting('test.canal_b')::uuid, current_setting('test.emprendimiento_b')::uuid, 'TELEGRAM', 'canal-b-' || current_setting('test.canal_b'));
`;
