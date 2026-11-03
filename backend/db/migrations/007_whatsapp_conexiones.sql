-- =====================================================================
-- Migracion 007 — Conexiones de WhatsApp por emprendimiento (multitenant)
-- Idempotente. Ejecutar DESPUES de 001 y 006.
-- =====================================================================
set search_path = public;

do $$ begin
  create type whatsapp_estado_conexion as enum (
    'pendiente', 'activo', 'deshabilitado', 'revocado', 'error'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.whatsapp_conexiones (
  id uuid primary key default gen_random_uuid(),
  emprendimiento_id uuid not null references public.emprendimientos(id) on delete cascade,
  waba_id varchar(255) not null,
  app_id varchar(255),
  config_id varchar(255),
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  estado whatsapp_estado_conexion not null default 'pendiente',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conexiones_waba_unico unique (waba_id),
  constraint whatsapp_conexiones_emp_waba_unico unique (emprendimiento_id, waba_id)
);
create index if not exists idx_whatsapp_conexiones_emp on public.whatsapp_conexiones(emprendimiento_id);
create index if not exists idx_whatsapp_conexiones_estado on public.whatsapp_conexiones(estado);
create index if not exists idx_whatsapp_conexiones_waba on public.whatsapp_conexiones(waba_id);

create table if not exists public.whatsapp_numeros (
  id uuid primary key default gen_random_uuid(),
  whatsapp_conexion_id uuid not null references public.whatsapp_conexiones(id) on delete cascade,
  phone_number_id varchar(255) not null,
  numero_telefono varchar(50) not null,
  nombre_registro varchar(255),
  nombre_canal varchar(150),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_numeros_phone_number_id_unico unique (phone_number_id),
  constraint whatsapp_numeros_conexion_numero_unico unique (whatsapp_conexion_id, numero_telefono)
);
create index if not exists idx_whatsapp_numeros_conexion on public.whatsapp_numeros(whatsapp_conexion_id);
create index if not exists idx_whatsapp_numeros_phone_number_id on public.whatsapp_numeros(phone_number_id);
create index if not exists idx_whatsapp_numeros_activo on public.whatsapp_numeros(activo);

alter table if exists public.canales
  add column if not exists whatsapp_conexion_id uuid
    references public.whatsapp_conexiones(id) on delete set null;
create index if not exists idx_canales_whatsapp_conexion on public.canales(whatsapp_conexion_id);

alter table if exists public.whatsapp_conexiones enable row level security;
alter table if exists public.whatsapp_numeros enable row level security;

drop policy if exists whatsapp_conexiones_tenant on public.whatsapp_conexiones;
create policy whatsapp_conexiones_tenant on public.whatsapp_conexiones
  for all using (
    exists (select 1 from public.usuarios_emprendimientos ue
      where ue.usuario_id = auth.uid()
        and ue.emprendimiento_id = whatsapp_conexiones.emprendimiento_id)
  )
  with check (
    exists (select 1 from public.usuarios_emprendimientos ue
      where ue.usuario_id = auth.uid()
        and ue.emprendimiento_id = whatsapp_conexiones.emprendimiento_id)
  );

drop policy if exists whatsapp_numeros_tenant on public.whatsapp_numeros;
create policy whatsapp_numeros_tenant on public.whatsapp_numeros
  for all using (
    exists (select 1 from public.whatsapp_conexiones wc
      join public.usuarios_emprendimientos ue on ue.emprendimiento_id = wc.emprendimiento_id
      where wc.id = whatsapp_numeros.whatsapp_conexion_id and ue.usuario_id = auth.uid())
  )
  with check (
    exists (select 1 from public.whatsapp_conexiones wc
      join public.usuarios_emprendimientos ue on ue.emprendimiento_id = wc.emprendimiento_id
      where wc.id = whatsapp_numeros.whatsapp_conexion_id and ue.usuario_id = auth.uid())
  );

comment on table public.whatsapp_conexiones is
  'Conexiones de WhatsApp Business Platform por emprendimiento. Credenciales cifradas.';
comment on column public.whatsapp_conexiones.access_token_encrypted is
  'Access token de Meta cifrado con AES-256-GCM (clave WHATSAPP_ENCRYPTION_KEY).';
comment on table public.whatsapp_numeros is
  'Numeros de telefono asociados a una conexion WhatsApp. phone_number_id resuelve el webhook entrante.';
