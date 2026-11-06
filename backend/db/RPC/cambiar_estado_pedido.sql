-- =====================================================================
-- Función RPC: Cambiar estado de pedido con validación de transición
-- =====================================================================
create or replace function public.cambiar_estado_pedido(
  p_emprendimiento_id uuid,
  p_pedido_id uuid,
  p_nuevo_estado pedido_estado
)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual pedido_estado;
  v_pedido public.pedidos;
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

  -- Validación de transición
  if not (
    (v_actual = 'RECIBIDO' and p_nuevo_estado in ('EN_PREPARACION','CANCELADO')) or
    (v_actual = 'EN_PREPARACION' and p_nuevo_estado in ('LISTO','CANCELADO')) or
    (v_actual = 'LISTO' and p_nuevo_estado in ('ENTREGADO','CANCELADO'))
  ) then
    raise exception 'Transicion invalida: % -> %', v_actual, p_nuevo_estado using errcode = 'P0005';
  end if;

  update public.pedidos
  set estado = p_nuevo_estado, updated_at = now()
  where id = p_pedido_id and emprendimiento_id = p_emprendimiento_id
  returning * into v_pedido;

  return v_pedido;
end;
$$;

grant execute on function public.cambiar_estado_pedido(uuid, uuid, pedido_estado) to authenticated, service_role;
