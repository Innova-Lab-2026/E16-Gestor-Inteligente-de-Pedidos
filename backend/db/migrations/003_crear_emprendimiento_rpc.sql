-- =====================================================================
-- Migracion 003 -- Creacion atomica de emprendimiento
--
-- El problema que arregla
-- ----------------------
-- El DAO hacia  .insert({nombre}).select().single()
-- (src/modules/emprendimientos/emprendimiento.dao.js)
--
-- El .select() de PostgREST convierte eso en  INSERT ... RETURNING *.
-- En Postgres, el RETURNING de un INSERT tambien tiene que pasar las
-- politicas de SELECT. Y la politica de lectura es:
--
--   emp_select ... using (public.usuario_tiene_emprendimiento(id))
--
-- que busca la fila en usuarios_emprendimientos. Al momento del INSERT
-- ese vinculo TODAVIA NO EXISTE (el servicio lo creaba despues). O sea:
-- la fila recien insertada es invisible para la propia politica de
-- SELECT, y Postgres responde exactamente:
--
--   new row violates row-level security policy for table "emprendimientos"
--
-- Es un problema de orden (el check necesita el link que se crea
-- despues), no de permisos: por mas GRANT que se den, falla igual.
--
-- La solucion
-- -----------
-- Crear el emprendimiento y su vinculo de dueno en UNA sola operacion
-- security definer. Atomica, saltea RLS (por eso no le importa el
-- problema del huevo y la gallina) y devuelve la fila ya vinculada.
--
-- Quien es el dueno
-- -----------------
-- Sale SIEMPRE de auth.uid(). La funcion NO tiene un parametro
-- `p_usuario_id`: un parametro de identidad en una funcion security
-- definer es un bypass de autorizacion (quien pueda pasar cualquier uuid
-- crea tenants a nombre de otro) y no hacia falta para nada. Si no hay
-- sesion, la funcion falla con 42501 en vez de inventar un dueno.
--
-- Efecto practico: el registro de usuario (paso 14 de
-- Docs/pruebas-manuales.md) llama a esta RPC con la sesion que devuelve
-- `signUp`. El backend NO necesita ninguna clave privilegiada para dar
-- de alta un emprendimiento.
--
-- Cubre los pasos 5, 6 y 14 de Docs/pruebas-manuales.md.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUES de la 001 y la 002.
-- =====================================================================

set search_path = public;

-- La version anterior (con p_usuario_id) se elimina: existia solo para
-- que el backend pudiera pasar el dueno sin sesion. Ya no hace falta y no
-- conviene dejar la puerta abierta.
drop function if exists public.crear_emprendimiento(text, uuid);

create or replace function public.crear_emprendimiento(p_nombre text)
returns public.emprendimientos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_emp     public.emprendimientos;
begin
  -- El dueno sale de la sesion (auth.uid()), nunca de un parametro:
  -- asi ningun usuario puede crear un emprendimiento a nombre de otro.
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Se requiere una sesion de usuario para crear un emprendimiento'
      using errcode = '42501';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'El nombre del emprendimiento es obligatorio'
      using errcode = '22023';
  end if;

  -- Unicidad global normalizada (migracion 006): "Kiosco", "kiosco" y
  -- "  KIOSCO  " colisionan. El indice unico
  -- `uq_emprendimientos_nombre_normalizado` es la garantia real
  -- (sin condicion de carrera); este chequeo previo existe solo para
  -- devolver un mensaje limpio en vez del 23505 crudo. Esta funcion es
  -- security definer, asi que ve TODAS las filas y el chequeo si es
  -- global de verdad (un SELECT desde el backend con RLS solo veria
  -- los emprendimientos del usuario y no serviria).
  if exists (
    select 1 from public.emprendimientos
    where lower(btrim(nombre)) = lower(btrim(p_nombre))
  ) then
    raise exception 'Ya existe un emprendimiento con ese nombre'
      using errcode = '23505';
  end if;

  insert into public.emprendimientos (nombre)
  values (btrim(p_nombre))
  returning * into v_emp;

  -- Defensa: usuarios_emprendimientos tiene FK contra public.usuarios.
  -- Si el perfil espejo faltara (cuenta creada en Auth antes de que
  -- existieran los triggers de la 001), el insert de abajo fallaria con
  -- 23503 "Key (usuario_id)=... is not present in table usuarios".
  -- El perfil lo crea el trigger; aca se repara el caso borde.
  perform public.asegurar_perfil_usuario(v_usuario);

  insert into public.usuarios_emprendimientos (usuario_id, emprendimiento_id)
  values (v_usuario, v_emp.id)
  on conflict (usuario_id, emprendimiento_id) do nothing;

  return v_emp;
end;
$$;

-- La funcion es security definer: el EXECUTE tiene que quedar acotado a
-- los roles de la API, nunca a PUBLIC ni a `anon`. Ya no hace falta
-- service_role: el unico llamador posible es un usuario con sesion.
revoke all on function public.crear_emprendimiento(text) from public;
grant execute on function public.crear_emprendimiento(text) to authenticated;
