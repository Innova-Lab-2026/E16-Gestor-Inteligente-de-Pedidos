-- =====================================================================
-- Función RPC: Aplicar delta de stock y registrar movimiento en una transacción
-- =====================================================================
-- Droppeamos por seguridad
drop function if exists public.mover_stock_con_movimiento(uuid, uuid, uuid, uuid, text, integer, text);

create or replace function public.mover_stock_con_movimiento(
  p_emprendimiento_id uuid,
  p_producto_id uuid,
  p_tipo text default null,      -- <-- CAMBIO: Ahora tiene default (null)
  p_cantidad integer default null, -- <-- CAMBIO: Ahora tiene default (null)
  p_variante_id uuid default null,
  p_pedido_id uuid default null,
  p_motivo text default null
)
returns table (
  stock_resultante integer,
  movimiento_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_mov uuid;
  v_delta integer;
  v_tipo_enum movimiento_stock_tipo;
begin
  -- 1. VALIDACIÓN DE NULOS EXPLÍCITA (Compensa el 'default null' de la firma)
  if p_emprendimiento_id is null or p_producto_id is null then
    raise exception 'emprendimiento_id y producto_id son obligatorios' using errcode = 'P0003';
  end if;
  
  if p_tipo is null or trim(p_tipo) = '' then
    raise exception 'Tipo de movimiento obligatorio' using errcode = 'P0003';
  end if;

  if p_cantidad is null then
    raise exception 'Cantidad obligatoria' using errcode = 'P0003';
  end if;

  -- Asignamos el delta una vez validado que no es null
  v_delta := p_cantidad;

  -- 2. SEGURIDAD TENANT
  if not public.usuario_tiene_emprendimiento(p_emprendimiento_id) then
    raise exception 'Acceso denegado: No eres miembro de este emprendimiento' using errcode = '42501';
  end if;

  -- 3. CASTEO DEL TIPO A ENUM
  begin
    v_tipo_enum := p_tipo::movimiento_stock_tipo;
  exception when others then
    raise exception 'Tipo de movimiento inválido: %', p_tipo using errcode = 'P0003';
  end;

  -- 4. AJUSTE ATÓMICO DE STOCK
  if p_variante_id is not null then
    update public.variantes 
    set stock_disponible = stock_disponible + v_delta
    where id = p_variante_id
      and producto_id = p_producto_id
      and exists (
        select 1 from public.productos p 
        where p.id = variantes.producto_id 
          and p.emprendimiento_id = p_emprendimiento_id
      )
    returning stock_disponible into v_stock;

    if v_stock is null then
      raise exception 'Variante no encontrada o no pertenece al tenant' using errcode = 'P0004';
    end if;
    
    if v_stock < 0 then
       raise exception 'Stock insuficiente para variante %. Quedaría en %', p_variante_id, v_stock using errcode = 'P0006';
    end if;

  else
    update public.productos 
    set stock_disponible = stock_disponible + v_delta
    where id = p_producto_id
      and emprendimiento_id = p_emprendimiento_id
    returning stock_disponible into v_stock;

    if v_stock is null then
      raise exception 'Producto no encontrado o no pertenece al tenant' using errcode = 'P0004';
    end if;

    if v_stock < 0 then
       raise exception 'Stock insuficiente para producto %. Quedaría en %', p_producto_id, v_stock using errcode = 'P0006';
    end if;
  end if;

  -- 5. REGISTRAR MOVIMIENTO EN BITÁCORA
  insert into public.movimientos_stock (
    emprendimiento_id, 
    producto_id, 
    variante_id, 
    pedido_id, 
    tipo, 
    cantidad, 
    motivo
  ) values (
    p_emprendimiento_id, 
    p_producto_id, 
    p_variante_id, 
    p_pedido_id, 
    v_tipo_enum, 
    v_delta, 
    p_motivo
  )
  returning id into v_mov;

  -- 6. RETORNAR RESULTADOS
  return query select v_stock, v_mov;
end;
$$;

grant execute on function public.mover_stock_con_movimiento(uuid, uuid, text, integer, uuid, uuid, text) to authenticated;