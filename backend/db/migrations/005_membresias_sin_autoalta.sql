-- =====================================================================
-- Migracion 005 -- Cerrar la escalada de tenant en las membresias
--
-- Que arregla
-- -----------
-- La policy de INSERT de `usuarios_emprendimientos` era:
--
--   create policy ue_ins on public.usuarios_emprendimientos
--     for insert with check (usuario_id = auth.uid());
--
-- Parece correcta ("solo puedo crear mi propia fila") y no lo es:
-- `emprendimiento_id` quedaba libre. Cualquier usuario autenticado, con
-- la publishable key (que es publica) y su propio JWT, podia hacer
--
--   POST /rest/v1/usuarios_emprendimientos
--   { "usuario_id": "<su id>", "emprendimiento_id": "<tenant ajeno>" }
--
-- y quedaba miembro. Todas las politicas de tenant se apoyan en
-- public.usuario_tiene_emprendimiento(), que solo mira si esa fila
-- existe: el INSERT abria productos, clientes, pedidos, canales y stock
-- del emprendimiento ajeno. Que el backend valide el tenant no alcanza:
-- un cliente puede llamar a PostgREST directo, que es justo el escenario
-- que RLS tiene que cubrir.
--
-- Las otras dos, menores:
--   * `emp_insert ... with check (true)` dejaba sembrar emprendimientos
--     huerfanos: filas sin dueno, que no responden "de quien es esta
--     fila".
--   * `emp_update` no tenia WITH CHECK, que es la mitad de la politica
--     que decide que valores quedan despues del UPDATE.
--
-- Como queda
-- ----------
--   * Membresias: las crea unicamente la RPC `crear_emprendimiento`
--     (003), que es security definer y resuelve el dueno desde
--     auth.uid(). Sin politica de INSERT, un INSERT directo falla con
--     42501 / "new row violates row-level security policy".
--   * Alta de emprendimiento: idem, solo por RPC.
--   * SELECT/DELETE de las propias membresias y el UPDATE de los
--     propios emprendimientos siguen funcionando igual.
--
-- Si algun dia hace falta invitar a otro usuario, la forma correcta es
-- una RPC que valide quien invita (que quien llama sea miembro del
-- emprendimiento), no volver a abrir la politica.
--
-- La 001 ya trae estas mismas sentencias, para una instalacion nueva.
-- Esta migracion existe para una base que YA tiene la 001 aplicada.
-- Ejecutar DESPUES de la 004. Idempotente.
-- =====================================================================

set search_path = public;

-- 1. Membresias: nadie crea vinculos desde la API.
drop policy if exists ue_ins on public.usuarios_emprendimientos;

-- 2. Emprendimientos: el alta es solo por RPC y el UPDATE revalida.
drop policy if exists emp_insert on public.emprendimientos;

drop policy if exists emp_update on public.emprendimientos;
create policy emp_update on public.emprendimientos
  for update using (public.usuario_tiene_emprendimiento(id))
  with check (public.usuario_tiene_emprendimiento(id));

-- ---------------------------------------------------------------------
-- 3. Verificacion. Despues de correr la migracion, esto:
--
--   select tablename, policyname, cmd, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('emprendimientos', 'usuarios_emprendimientos')
--   order by tablename, cmd;
--
-- tiene que devolver:
--
--   emprendimientos           emp_select  SELECT  (null)
--   emprendimientos           emp_update  UPDATE  usuario_tiene_emprendimiento(id)
--   usuarios_emprendimientos  ue_del      DELETE  (null)
--   usuarios_emprendimientos  ue_sel      SELECT  (null)
--
-- Ninguna fila con cmd = 'INSERT'. El bloque de abajo falla si quedo
-- alguna, para que la migracion no se aplique a medias en silencio.
-- ---------------------------------------------------------------------

do $$
declare
  v_insert integer;
begin
  select count(*) into v_insert
  from pg_policies
  where schemaname = 'public'
    and cmd = 'INSERT'
    and tablename in ('emprendimientos', 'usuarios_emprendimientos');

  if v_insert > 0 then
    raise exception 'Quedaron % politicas de INSERT en las tablas de identidad', v_insert;
  end if;

  raise notice 'OK: sin politicas de INSERT en emprendimientos / usuarios_emprendimientos';
end $$;
