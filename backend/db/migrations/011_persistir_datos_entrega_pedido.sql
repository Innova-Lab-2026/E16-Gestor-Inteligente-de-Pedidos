-- La RPC anterior omitía datos que ya tienen columnas en pedidos desde las
-- migraciones 008 y 009. Se reemplaza su firma manteniendo intactos los datos.
drop function if exists public.crear_pedido_con_items(
  uuid, pedido_origen, uuid, uuid, pedido_estado_cobro, entrega_modalidad,
  date, numeric, numeric, text, boolean, jsonb
);

create or replace function public.crear_pedido_con_items(
  p_emprendimiento_id uuid,
  p_origen_tipo pedido_origen,
  p_canal_id uuid default null,
  p_cliente_id uuid default null,
  p_estado_cobro pedido_estado_cobro default 'PENDIENTE',
  p_modalidad_entrega entrega_modalidad default null,
  p_fecha_prevista_entrega date default null,
  p_subtotal numeric default 0,
  p_total numeric default 0,
  p_observaciones text default null,
  p_requiere_revision boolean default false,
  p_items jsonb default '[]'::jsonb,
  p_direccion_entrega text default null,
  p_hora_prevista_entrega time default null,
  p_medios_pago text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos;
  v_items jsonb;
begin
  if auth.uid() is not null then
    if not public.usuario_tiene_emprendimiento(p_emprendimiento_id) then
      raise exception 'Acceso denegado: No eres miembro de este emprendimiento'
        using errcode = '42501';
    end if;
  elsif auth.role() is distinct from 'service_role' then
    raise exception 'Sin sesion solo la clave secreta del backend puede crear pedidos'
      using errcode = '42501';
  end if;

  if (p_origen_tipo = 'MANUAL' and p_canal_id is not null)
     or (p_origen_tipo = 'CANAL' and p_canal_id is null) then
    raise exception 'Inconsistencia origen/canal'
      using errcode = 'P0003';
  end if;

  insert into public.pedidos (
    emprendimiento_id, cliente_id, origen_tipo, canal_id, estado, estado_cobro,
    modalidad_entrega, fecha_prevista_entrega, subtotal, total, observaciones,
    requiere_revision, direccion_entrega, hora_prevista_entrega, medios_pago
  ) values (
    p_emprendimiento_id, p_cliente_id, p_origen_tipo, p_canal_id, 'RECIBIDO',
    p_estado_cobro, p_modalidad_entrega, p_fecha_prevista_entrega, p_subtotal,
    p_total, p_observaciones, p_requiere_revision, p_direccion_entrega,
    p_hora_prevista_entrega, coalesce(p_medios_pago, '{}'::text[])
  )
  returning * into v_pedido;

  if jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    insert into public.items_pedido (pedido_id, producto_id, variante_id, cantidad, precio_unitario, subtotal)
    select
      v_pedido.id,
      (item->>'producto_id')::uuid,
      nullif(item->>'variante_id','')::uuid,
      (item->>'cantidad')::int,
      (item->>'precio_unitario')::numeric,
      (item->>'subtotal')::numeric
    from jsonb_array_elements(p_items) as item;
  end if;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from public.items_pedido i where i.pedido_id = v_pedido.id;

  return jsonb_build_object('pedido', to_jsonb(v_pedido), 'items', v_items);
end;
$$;

grant execute on function public.crear_pedido_con_items(
  uuid, pedido_origen, uuid, uuid, pedido_estado_cobro, entrega_modalidad,
  date, numeric, numeric, text, boolean, jsonb, text, time, text[]
) to authenticated, service_role;
