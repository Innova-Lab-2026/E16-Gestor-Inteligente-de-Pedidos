-- Run after migration 009 to persist the full business onboarding.
set search_path = public;

alter table public.emprendimientos
  add column if not exists canales_venta text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'emprendimientos_canales_venta_validos'
      and conrelid = 'public.emprendimientos'::regclass
  ) then
    alter table public.emprendimientos
      add constraint emprendimientos_canales_venta_validos
      check (
        array_position(canales_venta, null) is null
        and canales_venta <@ array['WHATSAPP', 'TELEGRAM', 'EN_PERSONA']::text[]
      );
  end if;
end;
$$;

drop function if exists public.crear_emprendimiento(text);

create or replace function public.crear_emprendimiento(
  p_nombre text,
  p_rubro text,
  p_especialidad text,
  p_canales_venta text[],
  p_modalidades_entrega entrega_modalidad[]
)
returns public.emprendimientos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_emp public.emprendimientos;
  v_canales text[] := coalesce(p_canales_venta, '{}'::text[]);
  v_modalidades entrega_modalidad[] :=
    coalesce(p_modalidades_entrega, '{}'::entrega_modalidad[]);
  v_rubro text := nullif(btrim(p_rubro), '');
  v_especialidad text := nullif(btrim(p_especialidad), '');
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    raise exception 'Se requiere una sesion de usuario para crear un emprendimiento'
      using errcode = '42501';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'El nombre del emprendimiento es obligatorio'
      using errcode = '22023';
  end if;

  if v_rubro is null then
    raise exception 'El rubro del emprendimiento es obligatorio'
      using errcode = '22023';
  end if;

  if v_rubro = 'Otro' and v_especialidad is null then
    raise exception 'La especialidad es obligatoria para el rubro Otro'
      using errcode = '22023';
  end if;

  if v_rubro is not null and length(v_rubro) > 100 then
    raise exception 'El rubro no puede superar los 100 caracteres'
      using errcode = '22023';
  end if;

  if v_especialidad is not null and length(v_especialidad) > 150 then
    raise exception 'La especialidad no puede superar los 150 caracteres'
      using errcode = '22023';
  end if;

  if array_position(v_canales, null) is not null or not (
    v_canales <@ array['WHATSAPP', 'TELEGRAM', 'EN_PERSONA']::text[]
  ) then
    raise exception 'Hay un canal de venta invalido'
      using errcode = '22023';
  end if;

  if array_position(v_modalidades, null) is not null then
    raise exception 'Hay una modalidad de entrega invalida'
      using errcode = '22023';
  end if;

  if cardinality(v_canales) = 0 or cardinality(v_modalidades) = 0 then
    raise exception 'Se requiere al menos un canal y una modalidad de entrega'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.emprendimientos
    where lower(btrim(nombre)) = lower(btrim(p_nombre))
  ) then
    raise exception 'Ya existe un emprendimiento con ese nombre'
      using errcode = '23505';
  end if;

  insert into public.emprendimientos (
    nombre,
    rubro,
    especialidad,
    canales_venta,
    modalidades_entrega,
    onboarding_completado_at
  )
  values (
    btrim(p_nombre),
    v_rubro,
    v_especialidad,
    v_canales,
    v_modalidades,
    now()
  )
  returning * into v_emp;

  perform public.asegurar_perfil_usuario(v_usuario);

  insert into public.usuarios_emprendimientos (usuario_id, emprendimiento_id)
  values (v_usuario, v_emp.id)
  on conflict (usuario_id, emprendimiento_id) do nothing;

  return v_emp;
end;
$$;

revoke all on function public.crear_emprendimiento(
  text, text, text, text[], entrega_modalidad[]
) from public;
grant execute on function public.crear_emprendimiento(
  text, text, text, text[], entrega_modalidad[]
) to authenticated;
