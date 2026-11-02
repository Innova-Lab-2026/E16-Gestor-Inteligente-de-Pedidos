-- Droppeamos la anterior por seguridad
drop function if exists public.registrar_movimiento_stock(uuid, uuid, text, integer, uuid, uuid, text);

create or replace function public.registrar_movimiento_stock(
  p_emprendimiento_id uuid,
  p_producto_id uuid,
  p_tipo text,          
  p_cantidad integer,   
  p_variante_id uuid default null,
  p_pedido_id uuid default null,
  p_motivo text default null
)
returns setof movimientos_stock -- <--- CAMBIO CLAVE: Devuelve la fila completa de la tabla
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_enum movimiento_stock_tipo;
begin
  -- 1. VALIDACIÓN DE NULOS MANUALES
  if p_emprendimiento_id is null or p_producto_id is null then
    raise exception 'emprendimiento_id y producto_id son obligatorios'
      using errcode = 'P0003';
  end if;
  
  if p_tipo is null or trim(p_tipo) = '' then
    raise exception 'El tipo de movimiento es obligatorio'
      using errcode = 'P0003';
  end if;

  if p_cantidad is null then
    raise exception 'La cantidad es obligatoria'
      using errcode = 'P0003';
  end if;

  -- 2. SEGURIDAD: Verificar pertenencia al tenant
  if not public.usuario_tiene_emprendimiento(p_emprendimiento_id) then
    raise exception 'Acceso denegado: No eres miembro de este emprendimiento'
      using errcode = '42501';
  end if;

  -- 3. CONVERSIÓN Y VALIDACIÓN DEL ENUM
  begin
    v_tipo_enum := p_tipo::movimiento_stock_tipo;
  exception when others then
    raise exception 'Tipo de movimiento inválido: %', p_tipo
      using errcode = 'P0003';
  end;

  -- 4. VALIDACIÓN DE INTEGRIDAD REFERENCIAL
  if not exists (
    select 1 from productos 
    where id = p_producto_id and emprendimiento_id = p_emprendimiento_id
  ) then
     raise exception 'El producto % no pertenece al emprendimiento indicado', p_producto_id
       using errcode = 'P0002';
  end if;
  
  if p_variante_id is not null then
    if not exists (
      select 1 from variantes v 
      join productos p on v.producto_id = p.id 
      where v.id = p_variante_id 
        and p.emprendimiento_id = p_emprendimiento_id
        and v.producto_id = p_producto_id
    ) then
       raise exception 'La variante % no corresponde al producto/emprendimiento indicados', p_variante_id
         using errcode = 'P0002';
    end if;
  end if;

  -- 5. INSERCIÓN FINAL
  -- Al usar RETURNS SETOF movimientos_stock, no necesitamos listar columnas en RETURNING.
  -- Simplemente hacemos INSERT ... RETURNING * y la función lo entrega tal cual.
  return query
  insert into movimientos_stock (
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
    p_cantidad,
    p_motivo
  )
  returning *;

end;
$$;

grant execute on function public.registrar_movimiento_stock(uuid, uuid, text, integer, uuid, uuid, text) to authenticated;