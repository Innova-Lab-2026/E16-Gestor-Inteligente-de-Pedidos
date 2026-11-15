-- =====================================================================
-- Migracion 008 -- Completar el modelo de datos contra el PDF del MVP
-- Ejecutar DESPUES de 001..007 y de db/RPC/*. Idempotente.
--
-- Que cubre (todo sale de un hueco concreto del codigo actual):
--   1. Timestamps de estado (confirmed_at, ready_at, delivered_at,
--      cancelled_at): existian en la tabla pero nadie los escribia.
--   2. Cancelacion atomica: hoy el estado cambia en una RPC y el stock
--      se restituye despues, en otra llamada. Si la 2da falla, el pedido
--      queda CANCELADO con el stock perdido. Ahora va todo en la RPC.
--   3. pedidos.numero (correlativo legible por emprendimiento),
--      direccion_entrega y motivo_cancelacion.
--   4. items_pedido guarda el nombre del producto/variante al momento de
--      la venta (si despues se renombra, el pedido historico no cambia).
--   5. Unicidad de variantes/SKU/identificador externo (el flujo de
--      WhatsApp resuelve productos por identificador: no puede repetirse).
--   6. updated_at automatico (trigger) en vez de depender del backend.
--   7. Alertas de bajo stock y ranking de productos para el dashboard,
--      calculados en la base (el PDF pide no duplicar logica en el front).
--   8. Indices para los filtros de pedidos (fecha, cobro, cliente).
-- =====================================================================
set search_path = public;

-- ---------------------------------------------------------------------
-- 0. Trigger generico de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter table public.clientes  add column if not exists updated_at timestamptz not null default now();
alter table public.variantes add column if not exists updated_at timestamptz not null default now();

do $$
declare t text;
begin
  foreach t in array array[
    'emprendimientos','productos','variantes','clientes','canales','pedidos',
    'whatsapp_conexiones','whatsapp_numeros'
  ]
  loop
    -- whatsapp_* viene de la 007: si no esta aplicada, se omite sin fallar.
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
      execute format(
        'create trigger trg_%1$s_updated_at before update on public.%1$I
           for each row execute function public.set_updated_at()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. pedidos: numero legible, direccion de entrega, motivo de cancelacion
-- ---------------------------------------------------------------------
alter table public.pedidos add column if not exists numero integer;
alter table public.pedidos add column if not exists direccion_entrega text;
alter table public.pedidos add column if not exists motivo_cancelacion text;

-- Backfill de numero en pedidos existentes (orden de creacion).
with ordenados as (
  select id,
         row_number() over (partition by emprendimiento_id order by created_at, id) as n
  from public.pedidos
  where numero is null
)
update public.pedidos p set numero = o.n
from ordenados o where p.id = o.id;

create unique index if not exists uq_pedidos_emp_numero
  on public.pedidos (emprendimiento_id, numero);

-- Correlativo por emprendimiento. El advisory lock serializa altas
-- concurrentes del MISMO tenant (max()+1 solo seria una carrera).
create or replace function public.asignar_numero_pedido()
returns trigger
language plpgsql
as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtextextended(new.emprendimiento_id::text, 0));
    select coalesce(max(numero), 0) + 1 into new.numero
    from public.pedidos
    where emprendimiento_id = new.emprendimiento_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_numero on public.pedidos;
create trigger trg_pedidos_numero
  before insert on public.pedidos
  for each row execute function public.asignar_numero_pedido();

-- Un pedido cancelado debe tener su timestamp, y viceversa.
do $$ begin
  alter table public.pedidos add constraint pedidos_cancelado_coherente
    check ((estado = 'CANCELADO') = (cancelled_at is not null)) not valid;
exception when duplicate_object then null; end $$;
-- NOT VALID: no revalida filas viejas (pueden estar CANCELADO sin fecha).
-- Despues de corregirlas:  alter table pedidos validate constraint pedidos_cancelado_coherente;

-- Backfill best-effort de los timestamps que nunca se escribieron.
update public.pedidos set cancelled_at = updated_at where estado = 'CANCELADO' and cancelled_at is null;
update public.pedidos set delivered_at = updated_at where estado = 'ENTREGADO' and delivered_at is null;
update public.pedidos set ready_at     = updated_at where estado = 'LISTO'     and ready_at is null;

-- ---------------------------------------------------------------------
-- 2. items_pedido: nombre congelado junto con el precio
-- ---------------------------------------------------------------------
alter table public.items_pedido add column if not exists producto_nombre varchar(150);
alter table public.items_pedido add column if not exists variante_nombre varchar(100);

update public.items_pedido i set producto_nombre = p.nombre
from public.productos p where p.id = i.producto_id and i.producto_nombre is null;
update public.items_pedido i set variante_nombre = v.nombre
from public.variantes v where v.id = i.variante_id and i.variante_nombre is null;

-- Se completa solo al insertar: no hace falta tocar la RPC
-- crear_pedido_con_items ni el backend.
create or replace function public.congelar_nombres_item()
returns trigger
language plpgsql
as $$
begin
  if new.producto_nombre is null then
    select nombre into new.producto_nombre from public.productos where id = new.producto_id;
  end if;
  if new.variante_id is not null and new.variante_nombre is null then
    select nombre into new.variante_nombre from public.variantes where id = new.variante_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_items_pedido_nombres on public.items_pedido;
create trigger trg_items_pedido_nombres
  before insert on public.items_pedido
  for each row execute function public.congelar_nombres_item();

-- ---------------------------------------------------------------------
-- 3. Unicidad (no aborta la migracion si ya hay duplicados: avisa)
-- ---------------------------------------------------------------------
do $$ begin
  create unique index if not exists uq_variantes_producto_nombre
    on public.variantes (producto_id, lower(btrim(nombre)));
exception when unique_violation then
  raise warning 'uq_variantes_producto_nombre NO creado: hay variantes duplicadas dentro de un producto. Corregir y reejecutar.';
end $$;

do $$ begin
  create unique index if not exists uq_productos_emp_sku
    on public.productos (emprendimiento_id, lower(btrim(sku_o_identificador)))
    where sku_o_identificador is not null;
exception when unique_violation then
  raise warning 'uq_productos_emp_sku NO creado: hay SKU repetidos dentro de un emprendimiento.';
end $$;

do $$ begin
  create unique index if not exists uq_productos_emp_identificador_externo
    on public.productos (emprendimiento_id, lower(btrim(identificador_externo)))
    where identificador_externo is not null;
exception when unique_violation then
  raise warning 'uq_productos_emp_identificador_externo NO creado: hay identificadores externos repetidos.';
end $$;

-- ---------------------------------------------------------------------
-- 4. Indices para filtros de pedidos (fecha, cobro, cliente)
-- ---------------------------------------------------------------------
create index if not exists idx_pedidos_emp_fecha
  on public.pedidos (emprendimiento_id, created_at desc);
create index if not exists idx_pedidos_emp_cobro
  on public.pedidos (emprendimiento_id, estado_cobro);
create index if not exists idx_pedidos_cliente
  on public.pedidos (cliente_id);
create index if not exists idx_pedidos_emp_entrega
  on public.pedidos (emprendimiento_id, fecha_prevista_entrega)
  where fecha_prevista_entrega is not null;
create index if not exists idx_clientes_emp_nombre
  on public.clientes (emprendimiento_id, lower(nombre));

-- ---------------------------------------------------------------------
-- 5. cambiar_estado_pedido: transicion + timestamps + restitucion atomica
--
-- Misma firma que antes (+ p_motivo opcional), asi el backend actual
-- sigue funcionando sin cambios. Se borra la firma vieja: si quedaran
-- las dos, llamar con 3 argumentos seria ambiguo.
--
-- Restitucion: la fuente de verdad son los movimientos del pedido, no
-- los items. Se devuelve exactamente lo que se reservo, una sola vez.
-- Si el pedido nunca reservo stock (ej. pedido de canal sin reserva),
-- no hay nada que devolver.
-- ---------------------------------------------------------------------
drop function if exists public.cambiar_estado_pedido(uuid, uuid, pedido_estado);

create or replace function public.cambiar_estado_pedido(
  p_emprendimiento_id uuid,
  p_pedido_id uuid,
  p_nuevo_estado pedido_estado,
  p_motivo text default null
)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual pedido_estado;
  v_pedido public.pedidos;
  r record;
begin
  if auth.uid() is not null then
    if not public.usuario_tiene_emprendimiento(p_emprendimiento_id) then
      raise exception 'Acceso denegado' using errcode = '42501';
    end if;
  elsif auth.role() is distinct from 'service_role' then
    raise exception 'Sin sesion solo la clave secreta del backend puede cambiar estado'
      using errcode = '42501';
  end if;

  select estado into v_actual
  from public.pedidos
  where id = p_pedido_id and emprendimiento_id = p_emprendimiento_id
  for update;

  if v_actual is null then
    raise exception 'Pedido no encontrado' using errcode = 'P0004';
  end if;

  if v_actual = p_nuevo_estado then
    select * into v_pedido from public.pedidos where id = p_pedido_id;
    return v_pedido;
  end if;

  if not (
    (v_actual = 'RECIBIDO'       and p_nuevo_estado in ('EN_PREPARACION','CANCELADO')) or
    (v_actual = 'EN_PREPARACION' and p_nuevo_estado in ('LISTO','CANCELADO')) or
    (v_actual = 'LISTO'          and p_nuevo_estado in ('ENTREGADO','CANCELADO'))
  ) then
    raise exception 'Transicion invalida: % -> %', v_actual, p_nuevo_estado using errcode = 'P0005';
  end if;

  update public.pedidos
  set estado = p_nuevo_estado,
      confirmed_at = case when p_nuevo_estado = 'EN_PREPARACION' then coalesce(confirmed_at, now()) else confirmed_at end,
      ready_at     = case when p_nuevo_estado = 'LISTO'          then now() else ready_at end,
      delivered_at = case when p_nuevo_estado = 'ENTREGADO'      then now() else delivered_at end,
      cancelled_at = case when p_nuevo_estado = 'CANCELADO'      then now() else cancelled_at end,
      motivo_cancelacion = case when p_nuevo_estado = 'CANCELADO' then p_motivo else motivo_cancelacion end,
      updated_at = now()
  where id = p_pedido_id and emprendimiento_id = p_emprendimiento_id
  returning * into v_pedido;

  -- Restitucion de stock (solo al cancelar, solo si hubo reserva, una vez).
  if p_nuevo_estado = 'CANCELADO'
     and not exists (
       select 1 from public.movimientos_stock
       where pedido_id = p_pedido_id and tipo = 'RESTITUCION_CANCELACION'
     )
  then
    for r in
      select producto_id, variante_id, sum(-cantidad)::int as devolver
      from public.movimientos_stock
      where pedido_id = p_pedido_id and tipo = 'RESERVA_PEDIDO'
      group by producto_id, variante_id
      having sum(-cantidad) > 0
    loop
      if r.variante_id is not null then
        update public.variantes set stock_disponible = stock_disponible + r.devolver
        where id = r.variante_id;
      else
        update public.productos set stock_disponible = stock_disponible + r.devolver, updated_at = now()
        where id = r.producto_id;
      end if;

      insert into public.movimientos_stock
        (emprendimiento_id, producto_id, variante_id, pedido_id, tipo, cantidad, motivo)
      values
        (p_emprendimiento_id, r.producto_id, r.variante_id, p_pedido_id,
         'RESTITUCION_CANCELACION', r.devolver,
         'Restitucion por cancelacion del pedido ' || p_pedido_id);
    end loop;
  end if;

  return v_pedido;
end;
$$;

revoke all on function public.cambiar_estado_pedido(uuid, uuid, pedido_estado, text) from public, anon;
grant execute on function public.cambiar_estado_pedido(uuid, uuid, pedido_estado, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Dashboard: bajo stock y ranking (security invoker => RLS aplica)
-- ---------------------------------------------------------------------

-- Productos sin variantes y variantes que llegaron o bajaron del minimo.
create or replace view public.v_stock_bajo
with (security_invoker = true) as
  select p.emprendimiento_id,
         p.id as producto_id,
         null::uuid as variante_id,
         p.nombre,
         p.stock_disponible,
         p.stock_minimo
  from public.productos p
  where p.activo and not p.tiene_variantes
    and p.stock_disponible <= p.stock_minimo
  union all
  select p.emprendimiento_id,
         p.id,
         v.id,
         p.nombre || ' - ' || v.nombre,
         v.stock_disponible,
         v.stock_minimo
  from public.variantes v
  join public.productos p on p.id = v.producto_id
  where p.activo and v.activo and p.tiene_variantes
    and v.stock_disponible <= v.stock_minimo;

-- Ranking de productos/variantes. Los CANCELADO no cuentan como venta.
-- Usa el nombre congelado del item (no el actual del catalogo).
create or replace function public.dashboard_top_productos(
  p_emprendimiento_id uuid,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_limite integer default 10
)
returns table (
  producto_id uuid,
  variante_id uuid,
  nombre text,
  unidades bigint,
  ingresos numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.producto_id,
         i.variante_id,
         coalesce(i.producto_nombre, '(sin nombre)')
           || coalesce(' - ' || i.variante_nombre, '') as nombre,
         sum(i.cantidad)::bigint as unidades,
         sum(i.subtotal) as ingresos
  from public.items_pedido i
  join public.pedidos p on p.id = i.pedido_id
  where p.emprendimiento_id = p_emprendimiento_id
    and p.estado <> 'CANCELADO'
    and (p_desde is null or p.created_at >= p_desde)
    and (p_hasta is null or p.created_at <= p_hasta)
  group by i.producto_id, i.variante_id, i.producto_nombre, i.variante_nombre
  order by unidades desc, ingresos desc
  limit greatest(p_limite, 1);
$$;

revoke all on function public.dashboard_top_productos(uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.dashboard_top_productos(uuid, timestamptz, timestamptz, integer)
  to authenticated, service_role;

revoke all on public.v_stock_bajo from anon;
grant select on public.v_stock_bajo to authenticated, service_role;
