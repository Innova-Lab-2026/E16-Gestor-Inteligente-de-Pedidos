-- =====================================================================
-- Migracion 009 -- Ajustes del modelo segun el diseno de Figma
-- Ejecutar DESPUES de la 008. Idempotente.
--
-- Cada bloque cita la pantalla del diseno que lo motiva.
--   1. Onboarding (pasos 1-3)      -> emprendimientos, canales, usuarios
--   2. Pedidos                     -> estado EN_VIAJE, hora, medios de pago
--   3. Catalogo                    -> foto, marca, modelo, genero, variantes
--                                     con atributos (talle x color)
--   4. Clientes                    -> apellido, documento, email, condicion
--   5. Vistas/RPC de lectura       -> catalogo, clientes, "Reportes"
-- =====================================================================
set search_path = public;

-- ---------------------------------------------------------------------
-- 1. ONBOARDING
-- ---------------------------------------------------------------------

-- Paso 1: "Nombre del emprendimiento" + "Que vendes?" (Facturas, Farmacia,
-- Flores... u "Otro" con su especialidad).
-- Paso 2: "Como realizas la entrega? Retiro / Envio".
alter table public.emprendimientos add column if not exists rubro varchar(100);
alter table public.emprendimientos add column if not exists especialidad varchar(150);
alter table public.emprendimientos
  add column if not exists modalidades_entrega entrega_modalidad[] not null default '{}';
alter table public.emprendimientos add column if not exists onboarding_completado_at timestamptz;

-- Registro: "Acepto los terminos y condiciones y la politica de privacidad".
alter table public.usuarios add column if not exists terminos_aceptados_at timestamptz;

-- Paso 2/3: telefono por canal y validacion con codigo.
alter table public.canales add column if not exists telefono varchar(50);
alter table public.canales add column if not exists verificado_at timestamptz;

create table if not exists public.canal_verificaciones (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canales(id) on delete cascade,
  codigo_hash text not null,                 -- nunca el codigo en claro
  expira_at timestamptz not null,
  intentos integer not null default 0 check (intentos >= 0),
  usado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_canal_verif_canal on public.canal_verificaciones(canal_id, created_at desc);

alter table public.canal_verificaciones enable row level security;
drop policy if exists canal_verif_tenant on public.canal_verificaciones;
create policy canal_verif_tenant on public.canal_verificaciones
  for all
  using (exists (select 1 from public.canales c
                 where c.id = canal_id and public.usuario_tiene_emprendimiento(c.emprendimiento_id)))
  with check (exists (select 1 from public.canales c
                 where c.id = canal_id and public.usuario_tiene_emprendimiento(c.emprendimiento_id)));
grant select, insert, update, delete on public.canal_verificaciones to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. PEDIDOS
-- ---------------------------------------------------------------------

-- Tarjeta de pedido: "En viaje" (envios). Ver nota de transaccion abajo.
alter type pedido_estado add value if not exists 'EN_VIAJE' after 'LISTO';

-- "Fecha de despacho / Horario" y "Hoy 18:30".
alter table public.pedidos add column if not exists hora_prevista_entrega time;
-- "Forma de pago: podes elegir mas de una". El export de Figma no lista las
-- opciones, por eso es texto libre y no un enum (definirlas con el equipo).
alter table public.pedidos add column if not exists medios_pago text[] not null default '{}';
-- Boton "Avisar a cliente" (pedido listo).
alter table public.pedidos add column if not exists cliente_avisado_at timestamptz;
alter table public.pedidos add column if not exists shipped_at timestamptz;

-- cambiar_estado_pedido con EN_VIAJE. Misma firma que la 008.
--   RECIBIDO -> EN_PREPARACION | CANCELADO
--   EN_PREPARACION -> LISTO | CANCELADO
--   LISTO -> ENTREGADO | EN_VIAJE (solo si no es RETIRO) | CANCELADO
--   EN_VIAJE -> ENTREGADO | CANCELADO
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
  v_modalidad entrega_modalidad;
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

  select estado, modalidad_entrega into v_actual, v_modalidad
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
    (v_actual = 'LISTO'          and p_nuevo_estado in ('ENTREGADO','CANCELADO')) or
    (v_actual = 'LISTO'          and p_nuevo_estado = 'EN_VIAJE'
                                 and coalesce(v_modalidad = 'ENVIO', false)) or
    (v_actual = 'EN_VIAJE'       and p_nuevo_estado in ('ENTREGADO','CANCELADO'))
  ) then
    raise exception 'Transicion invalida: % -> %', v_actual, p_nuevo_estado using errcode = 'P0005';
  end if;

  update public.pedidos
  set estado = p_nuevo_estado,
      confirmed_at = case when p_nuevo_estado = 'EN_PREPARACION' then coalesce(confirmed_at, now()) else confirmed_at end,
      ready_at     = case when p_nuevo_estado = 'LISTO'          then now() else ready_at end,
      shipped_at   = case when p_nuevo_estado = 'EN_VIAJE'       then now() else shipped_at end,
      delivered_at = case when p_nuevo_estado = 'ENTREGADO'      then now() else delivered_at end,
      cancelled_at = case when p_nuevo_estado = 'CANCELADO'      then now() else cancelled_at end,
      motivo_cancelacion = case when p_nuevo_estado = 'CANCELADO' then p_motivo else motivo_cancelacion end,
      updated_at = now()
  where id = p_pedido_id and emprendimiento_id = p_emprendimiento_id
  returning * into v_pedido;

  if p_nuevo_estado = 'CANCELADO'
     and not exists (
       select 1
       from public.movimientos_stock m
       join public.productos p
         on p.id = m.producto_id
        and p.emprendimiento_id = p_emprendimiento_id
       left join public.variantes v
         on v.id = m.variante_id
        and v.producto_id = m.producto_id
       where m.pedido_id = p_pedido_id
         and m.emprendimiento_id = p_emprendimiento_id
         and m.tipo = 'RESTITUCION_CANCELACION'
         and (m.variante_id is null or v.id is not null)
     )
  then
    for r in
      select m.producto_id, m.variante_id, sum(-m.cantidad)::int as devolver
      from public.movimientos_stock m
      join public.productos p
        on p.id = m.producto_id
       and p.emprendimiento_id = p_emprendimiento_id
      left join public.variantes v
        on v.id = m.variante_id
       and v.producto_id = m.producto_id
      where m.pedido_id = p_pedido_id
        and m.emprendimiento_id = p_emprendimiento_id
        and m.tipo = 'RESERVA_PEDIDO'
        and (m.variante_id is null or v.id is not null)
      group by m.producto_id, m.variante_id
      having sum(-m.cantidad) > 0
    loop
      if r.variante_id is not null then
        update public.variantes v
        set stock_disponible = v.stock_disponible + r.devolver
        from public.productos p
        where v.id = r.variante_id
          and v.producto_id = r.producto_id
          and p.id = v.producto_id
          and p.emprendimiento_id = p_emprendimiento_id;
      else
        update public.productos set stock_disponible = stock_disponible + r.devolver, updated_at = now()
        where id = r.producto_id
          and emprendimiento_id = p_emprendimiento_id;
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
-- 3. CATALOGO
-- ---------------------------------------------------------------------

-- "Ingresa una foto" (opcional), Marca, Modelo, Genero (opcionales).
-- La subida de la foto va por Supabase Storage (bucket + policies: se
-- configura en el panel); aca solo se guarda la URL.
alter table public.productos add column if not exists foto_url text;
alter table public.productos add column if not exists marca varchar(100);
alter table public.productos add column if not exists modelo varchar(100);
alter table public.productos add column if not exists genero varchar(30);
-- "Elegi el tipo de tamano": ej. {talle,color}. Define que atributos lleva
-- cada variante de este producto.
alter table public.productos add column if not exists tipos_variante text[] not null default '{}';

-- La variante pasa de un solo nombre a atributos (talle x color), como en
-- "Talle L / Color Azul". `nombre` se conserva: lo arma el backend a partir
-- de los atributos (ej. "L / Azul") y sigue sirviendo para el WhatsApp.
alter table public.variantes add column if not exists atributos jsonb not null default '{}';
do $$ begin
  alter table public.variantes add constraint variantes_atributos_objeto
    check (jsonb_typeof(atributos) = 'object');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 4. CLIENTES
-- ---------------------------------------------------------------------
do $$ begin
  create type cliente_condicion as enum ('OK', 'DEUDOR', 'IRRESPETUOSO', 'CANCELADOR');
exception when duplicate_object then null; end $$;

-- Alta de cliente: Nombre, Apellido (opc.), Tipo y numero de documento,
-- Celular/WhatsApp, Email (opc.), Direccion (opc.), foto (opc.).
alter table public.clientes add column if not exists apellido varchar(150);
alter table public.clientes add column if not exists tipo_documento tipo_documento;
alter table public.clientes add column if not exists numero_documento varchar(50);
alter table public.clientes add column if not exists email varchar(255);
alter table public.clientes add column if not exists foto_url text;
-- Insignia de la lista ("Ok", "Deudor") y filtros Irrespetuoso/Cancelador/Deudor.
-- Las frases tipo "Canta mucho" / "Le gusta el violeta" van en `observaciones`.
alter table public.clientes add column if not exists condicion cliente_condicion not null default 'OK';

do $$ begin
  create unique index if not exists uq_clientes_documento
    on public.clientes (emprendimiento_id, tipo_documento, numero_documento)
    where numero_documento is not null;
exception when unique_violation then
  raise warning 'uq_clientes_documento NO creado: hay clientes con el mismo documento en un emprendimiento.';
end $$;

create index if not exists idx_clientes_emp_condicion on public.clientes (emprendimiento_id, condicion);

-- ---------------------------------------------------------------------
-- 5. LECTURAS PARA LAS PANTALLAS (security invoker: RLS aplica)
-- ---------------------------------------------------------------------

-- Catalogo: una fila por producto, con el total y el semaforo.
--   nivel: SIN_STOCK (rojo) | BAJO (naranja) | OK
--   Con variantes, el stock es la suma de las variantes activas y el umbral
--   ("Avisar cuando queden") es el del producto.
--   atributos_resumen: {"talle": 4, "color": 3} -> "4 talles - 3 colores".
create or replace view public.v_productos_stock
with (security_invoker = true) as
select t.*,
       case when t.stock_total <= 0 then 'SIN_STOCK'
            when t.stock_total <= t.stock_minimo then 'BAJO'
            else 'OK' end as nivel
from (
  select p.emprendimiento_id,
         p.id as producto_id,
         p.nombre,
         p.precio,
         p.activo,
         p.tiene_variantes,
         p.foto_url,
         p.stock_minimo,
         coalesce(
           case when p.tiene_variantes
                then (select sum(v.stock_disponible) from public.variantes v
                      where v.producto_id = p.id and v.activo)
                else p.stock_disponible end, 0)::int as stock_total,
         (select count(*) from public.variantes v
           where v.producto_id = p.id and v.activo)::int as cant_variantes,
         (select coalesce(jsonb_object_agg(s.k, s.n), '{}'::jsonb)
            from (select a.key as k, count(distinct a.value) as n
                  from public.variantes v, jsonb_each_text(v.atributos) a
                  where v.producto_id = p.id and v.activo
                  group by a.key) s) as atributos_resumen
  from public.productos p
) t;

-- Clientes: lista con ultimo pedido y deuda ("Ver quien me debe").
-- Deudor = tiene pedidos no cancelados sin cobrar, o fue marcado a mano.
create or replace view public.v_clientes_resumen
with (security_invoker = true) as
select t.*,
       (t.deuda_total > 0 or t.condicion = 'DEUDOR') as es_deudor
from (
  select c.*,
         (select max(p.created_at) from public.pedidos p
           where p.cliente_id = c.id and p.estado <> 'CANCELADO') as ultimo_pedido_at,
         coalesce((select sum(p.total) from public.pedidos p
           where p.cliente_id = c.id and p.estado <> 'CANCELADO'
             and p.estado_cobro = 'PENDIENTE'), 0) as deuda_total,
         (select count(*) from public.pedidos p
           where p.cliente_id = c.id and p.estado <> 'CANCELADO'
             and p.estado_cobro = 'PENDIENTE')::int as pedidos_impagos
  from public.clientes c
) t;

-- Pantalla "Reportes" (Esta semana / Este mes).
--   ventas = pedidos no cancelados creados en [desde, hasta) (cobrados o no;
--            lo pendiente se muestra aparte en "Pendiente de cobro").
--   "$41.000 mas que la semana pasada" = comparacion con el periodo anterior
--   de igual duracion.
--   por_canal: {"WHATSAPP": 11, "TELEGRAM": 2, "MANUAL": 5}
--   pendiente_cobro es de todo el historial (no depende del periodo).
create or replace function public.dashboard_resumen(
  p_emprendimiento_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_len interval;
  v_actual record;
  v_previo record;
  v_pend record;
  v_canales jsonb;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then
    raise exception 'Rango invalido' using errcode = 'P0003';
  end if;
  -- Sin chequeo explicito de tenant: es security invoker, asi que RLS ya
  -- filtra por membresia (un emprendimiento ajeno devuelve todo en cero).

  v_len := p_hasta - p_desde;

  select count(*)::int as pedidos, coalesce(sum(total), 0) as ventas into v_actual
  from public.pedidos
  where emprendimiento_id = p_emprendimiento_id and estado <> 'CANCELADO'
    and created_at >= p_desde and created_at < p_hasta;

  select count(*)::int as pedidos, coalesce(sum(total), 0) as ventas into v_previo
  from public.pedidos
  where emprendimiento_id = p_emprendimiento_id and estado <> 'CANCELADO'
    and created_at >= p_desde - v_len and created_at < p_desde;

  select coalesce(jsonb_object_agg(s.canal, s.n), '{}'::jsonb) into v_canales
  from (select coalesce(c.tipo::text, 'MANUAL') as canal, count(*) as n
        from public.pedidos p
        left join public.canales c on c.id = p.canal_id
        where p.emprendimiento_id = p_emprendimiento_id and p.estado <> 'CANCELADO'
          and p.created_at >= p_desde and p.created_at < p_hasta
        group by 1) s;

  select count(*)::int as pedidos, coalesce(sum(total), 0) as monto, min(created_at) as mas_viejo
  into v_pend
  from public.pedidos
  where emprendimiento_id = p_emprendimiento_id and estado <> 'CANCELADO'
    and estado_cobro = 'PENDIENTE';

  return jsonb_build_object(
    'ventas', v_actual.ventas,
    'pedidos', v_actual.pedidos,
    'ventas_periodo_anterior', v_previo.ventas,
    'pedidos_periodo_anterior', v_previo.pedidos,
    'diferencia_ventas', v_actual.ventas - v_previo.ventas,
    'por_canal', v_canales,
    'pendiente_cobro', jsonb_build_object(
      'monto', v_pend.monto,
      'pedidos', v_pend.pedidos,
      'dias_mas_viejo', case when v_pend.mas_viejo is null then null
                             else floor(extract(epoch from (now() - v_pend.mas_viejo)) / 86400)::int end
    )
  );
end;
$$;

revoke all on function public.dashboard_resumen(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_resumen(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

revoke all on public.v_productos_stock, public.v_clientes_resumen from anon;
grant select on public.v_productos_stock, public.v_clientes_resumen to authenticated, service_role;

-- Nota: en el SQL Editor de Supabase, `alter type ... add value` y su uso en
-- la misma transaccion no se llevan bien. Esta migracion solo nombra
-- 'EN_VIAJE' dentro del cuerpo de una funcion (se evalua al ejecutarla), asi
-- que corre completa de una vez.
