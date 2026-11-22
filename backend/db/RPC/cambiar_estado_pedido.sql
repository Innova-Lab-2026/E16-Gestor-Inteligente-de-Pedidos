-- =====================================================================
-- Función RPC: Cambiar estado de pedido con validación de transición
-- =====================================================================
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

  -- Validación de transición
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

  -- Restitucion de stock (solo al cancelar, solo si hubo reserva, una vez).
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
