-- =====================================================================
-- Migracion 002 -- Privilegios (GRANT) de la API sobre el modelo v2
--
-- Por que existe: la 001 habilito RLS y creo las politicas, pero nunca
-- concedio privilegios SQL a los roles `anon` / `authenticated`.
-- En Postgres RLS y GRANT son capas INDEPENDIENTES: sin GRANT la
-- consulta muere antes de evaluar cualquier politica y la API responde
--
--   42501 permission denied for table <tabla>
--
-- El backend entra con la publishable key + el JWT del usuario, asi que
-- PostgREST ejecuta como `authenticated` (o `anon` sin token). RLS sigue
-- siendo la unica capa que filtra filas: esto solo quita el error 42501.
--
-- Todo se deriva del catalogo (pg_class / pg_proc), no de listas de
-- nombres, para que agregar una tabla o funcion en la 001 no haga que
-- esta migracion quede vieja en silencio.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUES de la 001. Idempotente.
-- =====================================================================

-- search_path: las firmas de funcion de los loops se resuelven por
-- nombre. Fijarlo evita que un search_path distinto haga fallar los GRANT.
set search_path = public;

-- Uso del esquema (Supabase ya lo concede, pero se vuelve a asegurar).
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. TABLAS
--
-- Regla de seguridad: solo las tablas con RLS habilitado reciben
-- privilegios para anon/authenticated. Si alguien crea una tabla y
-- olvida el `enable row level security`, esta migracion NO la expone:
-- falla cerrado (42501) en vez de quedar legible desde la API.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    -- El rol `service_role` ignora RLS: se le asegura el privilegio
    -- explicito. Es el rol en el que PostgREST resuelve la clave
    -- secreta (`sb_secret_...`) del unico flujo sin usuario: los
    -- webhooks de canales.
    --
    -- Solo DML, no `grant all`: el flujo de webhooks lee y escribe
    -- filas. `truncate` (borra sin WHERE), `trigger` (permite adjuntar
    -- un trigger a la tabla) y `references` no hacen falta y amplian lo
    -- que puede un cliente que tenga la clave. Minimo privilegio.
    execute format('grant select, insert, update, delete on table public.%I to service_role', r.relname);

    if r.relrowsecurity then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', r.relname);
      -- `anon` queda en solo lectura. Los flujos sin sesion (webhooks)
      -- ya NO pasan por `anon`: el backend usa la clave secreta, que se
      -- resuelve como `service_role` y saltea RLS. Dejar escritura en
      -- `anon` no aporta nada y amplia la superficie de la API publica.
      execute format('grant select on table public.%I to anon', r.relname);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. TIPOS (ENUM y DOMINIOS)
--
-- El modelo v2 define 7 ENUM (canal_tipo, pedido_origen, pedido_estado,
-- pedido_estado_cobro, entrega_modalidad, movimiento_stock_tipo,
-- evento_estado). Sin USAGE sobre el tipo, el rol no puede ni insertar
-- un valor ni comparar una columna de ese tipo, y el error que devuelve
-- es "permission denied for type <enum>" (42501) aunque los GRANT de
-- tabla esten correctos. Son dos capas de privilegio distintas.
--
-- typrelid = 0 excluye los tipos compuestos que genera cada tabla.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype in ('e', 'd')   -- e = enum, d = domain
      and t.typrelid = 0
  loop
    execute format(
      'grant usage on type public.%I to authenticated, anon, service_role',
      r.typname
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. SECUENCIAS (por si alguna tabla futura usa identity/serial).
--
-- Hoy no hay ninguna: todas las PK son uuid con gen_random_uuid(). Se
-- concede a los mismos roles que las tablas, o sea sin `anon`, para no
-- dejar una excepcion suelta respecto de las secciones 1 y 4.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  loop
    execute format(
      'grant usage, select on sequence public.%I to authenticated, service_role',
      r.relname
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. DEFAULT PRIVILEGES: lo que se cree despues hereda lo mismo.
--
-- Ojo con el alcance: `alter default privileges` concede SIEMPRE, sin
-- mirar si la tabla nueva tiene RLS. Eso contradice la regla de "fallar
-- cerrado" de la seccion 1, asi que queda acotado al rol autenticado.
-- Para anon NO se deja default privilege a proposito: las tablas que
--crea el backend sin sesion (webhooks) ya reciben su GRANT explicito
-- en la seccion 1, y una tabla nueva sin RLS no debe quedar expuesta.
-- ---------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant usage on types to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. FUNCIONES
--
-- Postgres concede EXECUTE on function a PUBLIC por defecto. Las
-- funciones security definer de stock no deben ser invocables desde la
-- API publica, asi que primero se revoca a todo el mundo y despues se
-- concede solo a quien corresponde segun el rol del dominio.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select p.proname, p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      -- Funciones internas: las invoca un trigger (handle_new_user) o
      -- otra funcion (asegurar_perfil_usuario). No son API: no deben
      -- quedar expuestas via PostgREST a `anon`.
      and p.proname not in (
        'asegurar_perfil_usuario',  -- la invoca crear_emprendimiento
        'handle_new_user',          -- la invoca el trigger de auth.users
        'crear_emprendimiento'      -- la 003 fija su EXECUTE (solo authenticated)
      )
  loop
    -- Lectura de tenant (usuario_tiene_emprendimiento): se invoca DENTRO
    -- de las politicas RLS, o sea se ejecuta con los privilegios del rol
    -- que consulta. Sin EXECUTE las politicas no pueden evaluarse y la
    -- consulta falla en vez de devolver 0 filas.
    --
    -- Escritura de stock (ajustar_stock_*): StockDao se construye con el
    -- token del USUARIO (ver src/modules/stock/stock.dao.js), asi que la
    -- RPC entra a PostgREST como `authenticated`: revocarle EXECUTE a
    -- `authenticated` rompe el descuento de stock al crear un pedido.
    --
    -- Ojo: el EXECUTE para `anon` que sale de este loop generico lo
    -- revoca despues la 004. Sin eso, cualquiera con la publishable key
    -- (que es publica) y sin sesion podria llamar la RPC directo y
    -- descontar stock ajeno, porque son funciones security definer.
    execute format('grant execute on function %s to authenticated, anon, service_role', r.sig);
  end loop;
end $$;

-- NOTA: el chequeo de tenant de las funciones de stock esta en la
-- 004. Esta migracion solo concede privilegios.
