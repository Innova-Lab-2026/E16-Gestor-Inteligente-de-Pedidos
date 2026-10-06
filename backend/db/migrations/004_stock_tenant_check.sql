-- =====================================================================
-- Migracion 004 -- Chequeo de tenant DENTRO de las funciones de stock
--
-- Por que hace falta
-- -----------------
-- ajustar_stock_producto() y ajustar_stock_variante() son SECURITY DEFINER:
-- se ejecutan con los privilegios del owner y SALTAN RLS. La migracion
-- 002 les da EXECUTE a `authenticated` porque StockDao se construye con
-- el token del usuario (src/modules/stock/stock.dao.js).
--
-- El problema: al saltar RLS, nada impide que un usuario autenticado
-- descuente stock de un emprendimiento ajeno. Solo lo frena que el
-- backend valide el tenant antes de llamar (lo hace, via
-- authMiddleware + tenantMiddleware), pero eso es una garantia del
-- codigo, no de la base: un cliente con la publishable key puede
-- llamar la RPC directo y saltarselo.
--
-- Impacto en Docs/pruebas-manuales.md: el paso 44 (webhook de Telegram
-- de B) descuenta stock del producto de B, y el paso 25 descuenta del
-- de A. Si aca se filtra por membresia, ambos siguen funcionando
-- porque el usuario SI es miembro de su tenant. Lo que se cierra es el
-- caso de un tercero.
--
-- La solucion: el chequeo va adentro de la funcion, derivando el tenant
-- desde el producto/variante. Sin sesion solo pasa el backend con la
-- clave secreta (rol `service_role`).
--
-- Antes alcanzaba con que auth.uid() fuera NULL, y esa condicion la
-- cumplia tambien `anon`, que es el rol de la publishable key (una
-- clave publica): cualquiera podia llamar la RPC y vaciar el stock de
-- un emprendimiento ajeno.
--
-- Por que la clave secreta si puede: quien la tiene ya saltea RLS por
-- completo, asi que negarle esta RPC no agrega seguridad y si romperia
-- una funcionalidad futura (reservar stock desde un canal). El chequeo
-- se apoya en que la clave secreta se resuelve como el rol
-- `service_role`; si Supabase cambia ese nombre, hay que revisarlo.
-- =====================================================================

set search_path = public;

create or replace function public.ajustar_stock_producto(p_producto_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_emp   uuid;
  v_uid   uuid := auth.uid();
begin
  select stock_disponible, emprendimiento_id
    into v_stock, v_emp
  from public.productos
  where id = p_producto_id
  for update;

  if v_stock is null then
    raise exception 'Producto % no encontrado o sin stock propio', p_producto_id
      using errcode = 'P0002';
  end if;

  -- security definer saltea RLS, asi que el tenant se verifica aca.
  -- Con sesion: hay que ser miembro del emprendimiento. Sin sesion:
  -- solo pasa la clave secreta del backend. `anon` nunca.
  if v_uid is not null then
    if not public.usuario_tiene_emprendimiento(v_emp) then
      raise exception 'El usuario no tiene acceso al emprendimiento del producto %', p_producto_id
        using errcode = '42501';
    end if;
  elsif auth.role() is distinct from 'service_role' then
    raise exception 'Sin sesion solo la clave secreta del backend puede ajustar stock (producto %)', p_producto_id
      using errcode = '42501';
  end if;

  if v_stock + p_delta < 0 then
    return null;
  end if;

  update public.productos
  set stock_disponible = v_stock + p_delta, updated_at = now()
  where id = p_producto_id;

  return v_stock + p_delta;
end;
$$;

create or replace function public.ajustar_stock_variante(p_variante_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_emp   uuid;
  v_uid   uuid := auth.uid();
begin
  select v.stock_disponible, p.emprendimiento_id
    into v_stock, v_emp
  from public.variantes v
  join public.productos p on p.id = v.producto_id
  where v.id = p_variante_id
  for update of v;

  if v_stock is null then
    raise exception 'Variante % no encontrada', p_variante_id
      using errcode = 'P0002';
  end if;

  -- El tenant de una variante se hereda del producto padre. Misma
  -- regla que en ajustar_stock_producto: miembro, o clave secreta.
  if v_uid is not null then
    if not public.usuario_tiene_emprendimiento(v_emp) then
      raise exception 'El usuario no tiene acceso al emprendimiento de la variante %', p_variante_id
        using errcode = '42501';
    end if;
  elsif auth.role() is distinct from 'service_role' then
    raise exception 'Sin sesion solo la clave secreta del backend puede ajustar stock (variante %)', p_variante_id
      using errcode = '42501';
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

-- EXECUTE para authenticated (StockDao usa el JWT del usuario) y para
-- service_role (la clave secreta del backend). Nunca para PUBLIC ni
-- para `anon`: el loop generico de la 002 le concede EXECUTE a los
-- tres roles, asi que el revoke de `anon` tiene que ir aca, que es la
-- ultima migracion en ejecutarse.
revoke all on function public.ajustar_stock_producto(uuid, integer) from public, anon;
revoke all on function public.ajustar_stock_variante(uuid, integer) from public, anon;
grant execute on function public.ajustar_stock_producto(uuid, integer)
  to authenticated, service_role;
grant execute on function public.ajustar_stock_variante(uuid, integer)
  to authenticated, service_role;