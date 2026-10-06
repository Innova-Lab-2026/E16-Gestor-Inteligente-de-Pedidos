-- =====================================================================
-- Migración inicial — Gestión de pedidos multicanal (modelos v2)
-- Ejecutar en el SQL Editor de Supabase (o vía CLI).
-- Idempotente: se puede reejecutar sin romper el esquema.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type canal_tipo as enum ('TELEGRAM', 'WHATSAPP', 'WEB');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pedido_origen as enum ('MANUAL', 'CANAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pedido_estado as enum ('RECIBIDO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pedido_estado_cobro as enum ('PAGADO', 'PENDIENTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entrega_modalidad as enum ('RETIRO', 'ENVIO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movimiento_stock_tipo as enum ('RESERVA_PEDIDO', 'RESTITUCION_CANCELACION', 'REPOSICION', 'PRODUCCION', 'PERDIDA', 'CORRECCION_MANUAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_estado as enum ('PROCESADO', 'ERROR', 'REVISION_REQUERIDA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. emprendimientos (tenant raíz)
-- ---------------------------------------------------------------------
create table if not exists public.emprendimientos (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(150) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. usuarios (espejo de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) not null unique,
  created_at timestamptz not null default now()
);

-- 2.1 usuarios_emprendimientos (N:M)
create table if not exists public.usuarios_emprendimientos (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (usuario_id, emprendimiento_id)
);

-- ---------------------------------------------------------------------
-- 3. clientes
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  nombre varchar(150) not null,
  telefono varchar(50),
  direccion text,
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_emp on public.clientes(emprendimiento_id);
create unique index if not exists uq_clientes_telefono
  on public.clientes(emprendimiento_id, telefono) where telefono is not null;

-- ---------------------------------------------------------------------
-- 4. productos
-- ---------------------------------------------------------------------
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  nombre varchar(150) not null,
  descripcion text,
  precio numeric(10,2) not null check (precio > 0),
  activo boolean not null default true,
  tiene_variantes boolean not null default false,
  stock_disponible integer,
  stock_minimo integer not null default 0,
  identificador_externo varchar(100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un producto con variantes no administra stock propio.
  constraint productos_stock_coherente
    check ((tiene_variantes and stock_disponible is null)
        or (not tiene_variantes and stock_disponible is not null))
);
create index if not exists idx_productos_emp on public.productos(emprendimiento_id);
create index if not exists idx_productos_ident_ext
  on public.productos(emprendimiento_id, identificador_externo);

-- ---------------------------------------------------------------------
-- 5. variantes
-- ---------------------------------------------------------------------
create table if not exists public.variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre varchar(100) not null,
  stock_disponible integer not null default 0 check (stock_disponible >= 0),
  stock_minimo integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_variantes_producto on public.variantes(producto_id);

-- ---------------------------------------------------------------------
-- 6. canales
-- ---------------------------------------------------------------------
create table if not exists public.canales (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  tipo canal_tipo not null,
  identificador_externo varchar(255) not null,
  nombre varchar(150),
  config jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Clave de resolucion del tenant: canal externo -> emprendimiento
  constraint canales_tipo_identificador_unico unique (tipo, identificador_externo)
);
create index if not exists idx_canales_emp on public.canales(emprendimiento_id);

-- ---------------------------------------------------------------------
-- 7. pedidos
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  origen_tipo pedido_origen not null,
  canal_id uuid references public.canales(id) on delete set null,
  estado pedido_estado not null default 'RECIBIDO',
  estado_cobro pedido_estado_cobro not null default 'PENDIENTE',
  modalidad_entrega entrega_modalidad,
  fecha_prevista_entrega date,
  subtotal numeric(10,2),
  total numeric(10,2),
  observaciones text,
  requiere_revision boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Regla del dominio: MANUAL => canal_id NULL; CANAL => canal_id NOT NULL
  constraint pedidos_origen_canal check (
    (origen_tipo = 'MANUAL' and canal_id is null)
    or (origen_tipo = 'CANAL' and canal_id is not null)
  )
);
create index if not exists idx_pedidos_emp on public.pedidos(emprendimiento_id);
create index if not exists idx_pedidos_estado on public.pedidos(emprendimiento_id, estado);
create index if not exists idx_pedidos_revision on public.pedidos(emprendimiento_id, requiere_revision);
create index if not exists idx_pedidos_canal on public.pedidos(canal_id);

-- ---------------------------------------------------------------------
-- 8. items_pedido (precio congelado)
-- ---------------------------------------------------------------------
create table if not exists public.items_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  variante_id uuid references public.variantes(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);
create index if not exists idx_items_pedido on public.items_pedido(pedido_id);
create index if not exists idx_items_producto on public.items_pedido(producto_id);

-- ---------------------------------------------------------------------
-- 9. movimientos_stock (bitacora, solo inserciones)
-- ---------------------------------------------------------------------
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  variante_id uuid references public.variantes(id) on delete restrict,
  pedido_id uuid references public.pedidos(id) on delete set null,
  tipo movimiento_stock_tipo not null,
  cantidad integer not null,
  motivo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_mov_emp on public.movimientos_stock(emprendimiento_id, created_at desc);
create index if not exists idx_mov_pedido on public.movimientos_stock(pedido_id);
create index if not exists idx_mov_producto on public.movimientos_stock(producto_id);

-- ---------------------------------------------------------------------
-- 10. eventos_mensajeria (idempotencia por canal_id + message_id)
-- ---------------------------------------------------------------------
create table if not exists public.eventos_mensajeria (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canales(id) on delete cascade,
  mensajeria_message_id varchar(255) not null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  payload_raw jsonb not null,
  estado_procesamiento evento_estado not null,
  created_at timestamptz not null default now(),
  -- Clave de idempotencia
  constraint eventos_canal_mensaje_unico unique (canal_id, mensajeria_message_id)
);
create index if not exists idx_eventos_canal on public.eventos_mensajeria(canal_id, created_at desc);

-- =====================================================================
-- Funciones de negocio (STABLE, en schema public)
-- =====================================================================

-- ¿El usuario autenticado tiene acceso al emprendimiento?
create or replace function public.usuario_tiene_emprendimiento(p_emprendimiento uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_emprendimientos ue
    where ue.usuario_id = auth.uid() and ue.emprendimiento_id = p_emprendimiento
  );
$$;
-- Sincroniza el perfil espejo de Supabase Auth.
--
-- `public.usuarios` es un espejo de `auth.users`, y
-- usuarios_emprendimientos tiene FK contra el:
--
--   usuarios_emprendimientos_usuario_id_fkey -> public.usuarios(id)
--
-- Si esa fila espejo falta, el sintoma aparece tarde y lejos: crear un
-- emprendimiento falla con codigo 23503 ("Key (usuario_id)=... is not
-- present in table usuarios") al insertar el vinculo, no en el alta.
--
-- Por eso el perfil NO puede depender de que el backend lo cree: se
-- garantiza desde la base con el trigger `on_auth_user_created` (mas
-- abajo), y esta funcion es el unico lugar que lo escribe. Es
-- idempotente, asi que se puede invocar sin miedo desde el trigger, el
-- backfill o una RPC.
create or replace function public.asegurar_perfil_usuario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = p_id;

  -- No existe en Auth: no hay nada que espejar.
  if not found then
    return;
  end if;

  -- `email` es NOT NULL UNIQUE y no todo usuario de Auth tiene email
  -- (los de solo telefono no lo traen). Un placeholder derivado del id
  -- mantiene la restriccion sin colisionar entre usuarios.
  insert into public.usuarios (id, email)
  values (p_id, coalesce(v_email, p_id::text || '@sin-email.invalid'))
  on conflict (id) do update set email = excluded.email;
end;
$$;

-- Trigger sobre auth.users: crea el perfil espejo al vuelo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.asegurar_perfil_usuario(new.id);
  return new;
end;
$$;



-- Ajuste atomico de stock de un producto (sin variantes).
-- Devuelve el stock resultante, o NULL si no habia stock suficiente.
create or replace function public.ajustar_stock_producto(p_producto_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
begin
  select stock_disponible into v_stock
  from public.productos
  where id = p_producto_id
  for update;

  if v_stock is null then
    raise exception 'Producto % no encontrado o sin stock propio', p_producto_id
      using errcode = 'P0002';
  end if;

  if v_stock + p_delta < 0 then
    return null;  -- stock insuficiente: el service decide que hacer
  end if;

  update public.productos
  set stock_disponible = v_stock + p_delta, updated_at = now()
  where id = p_producto_id;

  return v_stock + p_delta;
end;
$$;

-- Ajuste atomico de stock de una variante.
create or replace function public.ajustar_stock_variante(p_variante_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
begin
  select stock_disponible into v_stock
  from public.variantes
  where id = p_variante_id
  for update;

  if v_stock is null then
    raise exception 'Variante % no encontrada', p_variante_id
      using errcode = 'P0002';
  end if;

  if v_stock + p_delta < 0 then
    return null;
  end if;

  update public.variantes
  set stock_disponible = v_stock + p_delta
  where id = p_variante_id;

  return v_stock + p_delta;
end;
$$;

-- =====================================================================
-- Row Level Security: aislamiento multitenant
-- Toda tabla operativa se filtra por emprendimiento_id + membresia.
-- =====================================================================

alter table public.emprendimientos enable row level security;
alter table public.usuarios enable row level security;
alter table public.usuarios_emprendimientos enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.variantes enable row level security;
alter table public.canales enable row level security;
alter table public.pedidos enable row level security;
alter table public.items_pedido enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.eventos_mensajeria enable row level security;

-- usuarios: el usuario ve su propia ficha
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using (id = auth.uid());

drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert with check (id = auth.uid());

-- emprendimientos: ver y renombrar los propios.
--
--   * No hay politica de INSERT, y es a proposito: crear un
--     emprendimiento pasa SIEMPRE por la RPC `crear_emprendimiento`
--     (003), que es security definer e inserta la fila y su vinculo en
--     la misma transaccion, con el dueno resuelto desde auth.uid().
--     Con un `with check (true)` cualquier usuario autenticado podia
--     sembrar tenants huerfanos por PostgREST: filas que no responden
--     la pregunta "de quien es esta fila".
--   * El UPDATE lleva USING y WITH CHECK. USING decide que fila puedo
--     tocar; WITH CHECK, que valores puedo dejar despues. Sin el
--     WITH CHECK la fila podia quedar apuntando a otro tenant.
drop policy if exists emp_insert on public.emprendimientos;

drop policy if exists emp_select on public.emprendimientos;
create policy emp_select on public.emprendimientos
  for select using (public.usuario_tiene_emprendimiento(id));

drop policy if exists emp_update on public.emprendimientos;
create policy emp_update on public.emprendimientos
  for update using (public.usuario_tiene_emprendimiento(id))
  with check (public.usuario_tiene_emprendimiento(id));

-- usuarios_emprendimientos: solo las propias filas.
--
--   * SELECT: cada uno ve sus vinculos.
--   * DELETE: cada uno puede salir del emprendimiento.
--   * INSERT: NO hay politica, y eso cierra un agujero real. El vinculo
--     lo crea la RPC `crear_emprendimiento` (security definer). Con una
--     politica `with check (usuario_id = auth.uid())` alcanzaba con un
--     POST a /rest/v1/usuarios_emprendimientos para que cualquier
--     usuario autenticado se autoinvitara al emprendimiento de otro:
--     `usuario_tiene_emprendimiento()` solo mira si la fila existe, y
--     TODAS las politicas de tenant se apoyan en ella, asi que ese
--     INSERT abria productos, pedidos, stock y canales ajenos.
--     Invitar a otro usuario necesita una RPC que valide quien invita;
--     hasta entonces, sin politica la operacion falla cerrado.
drop policy if exists ue_ins on public.usuarios_emprendimientos;

drop policy if exists ue_sel on public.usuarios_emprendimientos;
create policy ue_sel on public.usuarios_emprendimientos
  for select using (usuario_id = auth.uid());

drop policy if exists ue_del on public.usuarios_emprendimientos;
create policy ue_del on public.usuarios_emprendimientos
  for delete using (usuario_id = auth.uid());

-- Tablas con emprendimiento_id directo
do $$
declare t text;
begin
  foreach t in array array['clientes','productos','canales','pedidos','movimientos_stock']
  loop
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($p$
      create policy tenant_all on public.%I
        for all
        using (public.usuario_tiene_emprendimiento(emprendimiento_id))
        with check (public.usuario_tiene_emprendimiento(emprendimiento_id))
    $p$, t);
  end loop;
end $$;

-- variantes: heredan el tenant del producto padre
drop policy if exists variantes_tenant on public.variantes;
create policy variantes_tenant on public.variantes
  for all
  using (
    exists (
      select 1 from public.productos p
      where p.id = producto_id
        and public.usuario_tiene_emprendimiento(p.emprendimiento_id)
    )
  )
  with check (
    exists (
      select 1 from public.productos p
      where p.id = producto_id
        and public.usuario_tiene_emprendimiento(p.emprendimiento_id)
    )
  );

-- items_pedido: heredan el tenant del pedido
drop policy if exists items_pedido_tenant on public.items_pedido;
create policy items_pedido_tenant on public.items_pedido
  for all
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id
        and public.usuario_tiene_emprendimiento(p.emprendimiento_id)
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id
        and public.usuario_tiene_emprendimiento(p.emprendimiento_id)
    )
  );

-- eventos_mensajeria: heredan el tenant del canal
drop policy if exists eventos_tenant on public.eventos_mensajeria;
create policy eventos_tenant on public.eventos_mensajeria
  for all
  using (
    exists (
      select 1 from public.canales c
      where c.id = canal_id
        and public.usuario_tiene_emprendimiento(c.emprendimiento_id)
    )
  )
  with check (
    exists (
      select 1 from public.canales c
      where c.id = canal_id
        and public.usuario_tiene_emprendimiento(c.emprendimiento_id)
    )
  );

-- =====================================================================
-- Permisos: son funciones security definer, asi que arrancan sin EXECUTE
-- para nadie. El grant definitivo lo fijan la 002 (authenticated: el
-- StockDao va con el JWT del usuario) y la 004 (revoca a `anon` y
-- revalida el tenant adentro de la funcion).
-- =====================================================================
revoke all on function public.ajustar_stock_producto(uuid, integer) from public;
revoke all on function public.ajustar_stock_variante(uuid, integer) from public;
-- =====================================================================
-- Sincronizacion del espejo `usuarios` con Supabase Auth
--
-- El perfil tiene que existir SIEMPRE, no solo cuando el backend se
-- acuerda de crearlo: `usuarios_emprendimientos` apunta por FK a
-- `public.usuarios`, asi que un usuario de Auth sin perfil rompe
-- cualquier alta de emprendimiento con el codigo 23503.
--
-- El trigger va sobre `auth.users` justamente para que la garantia no
-- dependa del camino: da igual si el usuario lo crea el backend
-- (POST /api/auth/register), el panel de Supabase o la CLI.
--
-- OJO: esta seccion necesita permisos sobre el schema `auth`. Se crea
-- sin problema desde el SQL Editor de Supabase (corre como `postgres`,
-- que es el dueno de `auth.users`).
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Si el email cambia en Auth, el espejo lo sigue.
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuarios de Auth creados antes de existir este trigger.
-- Es lo que repara las cuentas que ya quedaron sin perfil.
do $$
declare r record;
begin
  for r in
    select u.id
    from auth.users u
    where not exists (select 1 from public.usuarios pu where pu.id = u.id)
  loop
    perform public.asegurar_perfil_usuario(r.id);
  end loop;
end $$;

-- Son funciones internas: se invocan desde el trigger, no desde la API.
revoke all on function public.asegurar_perfil_usuario(uuid) from public;
revoke all on function public.handle_new_user() from public;

