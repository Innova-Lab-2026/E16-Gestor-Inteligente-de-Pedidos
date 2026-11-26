import { test } from "node:test";
import {
  crearDatosBase,
  ejecutarEnPostgres,
} from "../helpers/postgres-transaccion.js";

const omitir = process.env.TEST_DATABASE_URL
  ? false
  : "TEST_DATABASE_URL no está definida";

function testDb(nombre, sql, opciones = {}) {
  test(
    nombre,
    { skip: omitir, timeout: 120_000 },
    () =>
      ejecutarEnPostgres(
        `${opciones.sinDatosBase ? "" : crearDatosBase}\n${sql}`,
        { repetirMigraciones: opciones.repetirMigraciones }
      )
  );
}

testDb(
  "las migraciones 001 a 011 y sus RPC previas se pueden ejecutar dos veces",
  "",
  { sinDatosBase: true, repetirMigraciones: true }
);

testDb(
  "la RPC crea y devuelve dirección, horario y medios de pago",
  `
select set_config(
  'test.pedido',
  public.crear_pedido_con_items(
    p_emprendimiento_id := current_setting('test.emprendimiento_a')::uuid,
    p_origen_tipo := 'MANUAL',
    p_estado_cobro := 'PAGADO',
    p_modalidad_entrega := 'ENVIO',
    p_fecha_prevista_entrega := '2026-11-25',
    p_items := '[]'::jsonb,
    p_direccion_entrega := 'Av. Siempre Viva 123',
    p_hora_prevista_entrega := '18:30',
    p_medios_pago := array['Transferencia', 'Efectivo']
  )->'pedido'->>'id',
  true
);

do $$
declare
  v_pedido public.pedidos;
begin
  select * into v_pedido
  from public.pedidos
  where id = current_setting('test.pedido')::uuid;

  if v_pedido.direccion_entrega <> 'Av. Siempre Viva 123'
     or v_pedido.hora_prevista_entrega <> '18:30'::time
     or v_pedido.medios_pago <> array['Transferencia', 'Efectivo'] then
    raise exception 'La RPC no persistió los datos de entrega y pago';
  end if;
end $$;
`
);

testDb(
  "la cancelación devuelve el stock reservado una sola vez",
  `
insert into public.pedidos
  (emprendimiento_id, cliente_id, origen_tipo, estado, estado_cobro, total)
values
  (current_setting('test.emprendimiento_a')::uuid,
   current_setting('test.cliente_a')::uuid, 'MANUAL', 'RECIBIDO', 'PENDIENTE', 200)
returning set_config('test.pedido', id::text, true);

update public.productos
set stock_disponible = stock_disponible - 3
where id = current_setting('test.producto_a')::uuid;

insert into public.movimientos_stock
  (emprendimiento_id, producto_id, pedido_id, tipo, cantidad)
values
  (current_setting('test.emprendimiento_a')::uuid,
   current_setting('test.producto_a')::uuid,
   current_setting('test.pedido')::uuid, 'RESERVA_PEDIDO', -3);

do $$
declare
  v_stock integer;
  v_restituciones integer;
begin
  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido')::uuid,
    'CANCELADO',
    'prueba'
  );

  select stock_disponible into v_stock
  from public.productos
  where id = current_setting('test.producto_a')::uuid;

  select count(*) into v_restituciones
  from public.movimientos_stock
  where pedido_id = current_setting('test.pedido')::uuid
    and tipo = 'RESTITUCION_CANCELACION';

  if v_stock <> 10 or v_restituciones <> 1 then
    raise exception 'La primera cancelación dejó stock % y % restituciones',
      v_stock, v_restituciones;
  end if;

  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido')::uuid,
    'CANCELADO',
    'segundo intento'
  );

  select stock_disponible into v_stock
  from public.productos
  where id = current_setting('test.producto_a')::uuid;

  select count(*) into v_restituciones
  from public.movimientos_stock
  where pedido_id = current_setting('test.pedido')::uuid
    and tipo = 'RESTITUCION_CANCELACION';

  if v_stock <> 10 or v_restituciones <> 1 then
    raise exception 'La segunda cancelación dejó stock % y % restituciones',
      v_stock, v_restituciones;
  end if;
end $$;
`
);

testDb(
  "cancelar un pedido ignora movimientos que referencian productos de otro emprendimiento",
  `
insert into public.pedidos
  (emprendimiento_id, cliente_id, origen_tipo, estado, estado_cobro, total)
values
  (current_setting('test.emprendimiento_a')::uuid,
   current_setting('test.cliente_a')::uuid, 'MANUAL', 'RECIBIDO', 'PENDIENTE', 100)
returning set_config('test.pedido', id::text, true);

set local role authenticated;
insert into public.movimientos_stock
  (emprendimiento_id, producto_id, pedido_id, tipo, cantidad)
values
  (current_setting('test.emprendimiento_a')::uuid,
   current_setting('test.producto_b')::uuid,
   current_setting('test.pedido')::uuid, 'RESERVA_PEDIDO', -2);

select public.cambiar_estado_pedido(
  current_setting('test.emprendimiento_a')::uuid,
  current_setting('test.pedido')::uuid,
  'CANCELADO',
  'prueba de aislamiento'
);
reset role;

do $$
declare
  v_stock integer;
  v_restituciones integer;
begin
  select stock_disponible into v_stock
  from public.productos
  where id = current_setting('test.producto_b')::uuid;

  select count(*) into v_restituciones
  from public.movimientos_stock
  where pedido_id = current_setting('test.pedido')::uuid
    and tipo = 'RESTITUCION_CANCELACION';

  if v_stock <> 4 or v_restituciones <> 0 then
    raise exception 'Se restituyó stock ajeno: stock %, restituciones %',
      v_stock, v_restituciones;
  end if;
end $$;
`
);

testDb(
  "solo un envío puede pasar de LISTO a EN_VIAJE y luego ENTREGADO",
  `
insert into public.pedidos
  (emprendimiento_id, origen_tipo, estado, modalidad_entrega, ready_at)
values
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'LISTO', 'ENVIO', now()),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'LISTO', 'RETIRO', now()),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'LISTO', null, now())
returning id;

select set_config('test.pedido_envio', id::text, true)
from public.pedidos
where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
  and modalidad_entrega = 'ENVIO';

select set_config('test.pedido_retiro', id::text, true)
from public.pedidos
where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
  and modalidad_entrega = 'RETIRO';

select set_config('test.pedido_sin_modalidad', id::text, true)
from public.pedidos
where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
  and modalidad_entrega is null;

do $$
declare
  v_pedido public.pedidos;
begin
  v_pedido := public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_envio')::uuid,
    'EN_VIAJE'
  );
  if v_pedido.estado <> 'EN_VIAJE' or v_pedido.shipped_at is null then
    raise exception 'El envío no quedó EN_VIAJE con shipped_at';
  end if;

  v_pedido := public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_envio')::uuid,
    'ENTREGADO'
  );
  if v_pedido.estado <> 'ENTREGADO' or v_pedido.delivered_at is null then
    raise exception 'El envío no quedó ENTREGADO con delivered_at';
  end if;

  begin
    perform public.cambiar_estado_pedido(
      current_setting('test.emprendimiento_a')::uuid,
      current_setting('test.pedido_retiro')::uuid,
      'EN_VIAJE'
    );
    raise exception 'Se permitió EN_VIAJE para un pedido de RETIRO';
  exception when sqlstate 'P0005' then
    null;
  end;

  begin
    perform public.cambiar_estado_pedido(
      current_setting('test.emprendimiento_a')::uuid,
      current_setting('test.pedido_sin_modalidad')::uuid,
      'EN_VIAJE'
    );
    raise exception 'Se permitió EN_VIAJE sin modalidad de entrega';
  exception when sqlstate 'P0005' then
    null;
  end;
end $$;
`
);

testDb(
  "cada transición completa su timestamp de estado",
  `
insert into public.pedidos
  (emprendimiento_id, origen_tipo, estado, modalidad_entrega)
values
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'RECIBIDO', 'ENVIO'),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'RECIBIDO', 'RETIRO');

select set_config('test.pedido_fechas', id::text, true)
from public.pedidos
where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
  and modalidad_entrega = 'ENVIO';
select set_config('test.pedido_cancelado', id::text, true)
from public.pedidos
where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
  and modalidad_entrega = 'RETIRO';

do $$
declare
  v_pedido public.pedidos;
begin
  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_fechas')::uuid,
    'EN_PREPARACION'
  );
  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_fechas')::uuid,
    'LISTO'
  );
  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_fechas')::uuid,
    'EN_VIAJE'
  );
  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_fechas')::uuid,
    'ENTREGADO'
  );

  select * into v_pedido
  from public.pedidos
  where id = current_setting('test.pedido_fechas')::uuid;
  if v_pedido.confirmed_at is null or v_pedido.ready_at is null
     or v_pedido.shipped_at is null or v_pedido.delivered_at is null then
    raise exception 'Falta una fecha de transición del pedido enviado';
  end if;

  perform public.cambiar_estado_pedido(
    current_setting('test.emprendimiento_a')::uuid,
    current_setting('test.pedido_cancelado')::uuid,
    'CANCELADO',
    'motivo de prueba'
  );
  select * into v_pedido
  from public.pedidos
  where id = current_setting('test.pedido_cancelado')::uuid;
  if v_pedido.cancelled_at is null
     or v_pedido.motivo_cancelacion <> 'motivo de prueba' then
    raise exception 'La cancelación no completó cancelled_at y su motivo';
  end if;
end $$;
`
);

testDb(
  "el número de pedido es correlativo por emprendimiento y empieza en uno",
  `
insert into public.pedidos (emprendimiento_id, origen_tipo)
values
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL'),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL'),
  (current_setting('test.emprendimiento_b')::uuid, 'MANUAL');

do $$
begin
  if (select array_agg(numero order by numero)
      from public.pedidos
      where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid)
     is distinct from array[1, 2] then
    raise exception 'La secuencia del emprendimiento A no es 1, 2';
  end if;
  if (select numero from public.pedidos
      where emprendimiento_id = current_setting('test.emprendimiento_b')::uuid)
     <> 1 then
    raise exception 'La secuencia del emprendimiento B no comienza en 1';
  end if;
end $$;
`
);

testDb(
  "renombrar un producto conserva el nombre histórico del item",
  `
insert into public.pedidos (emprendimiento_id, origen_tipo)
values (current_setting('test.emprendimiento_a')::uuid, 'MANUAL')
returning set_config('test.pedido', id::text, true);

insert into public.items_pedido
  (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
values
  (current_setting('test.pedido')::uuid,
   current_setting('test.producto_a')::uuid, 1, 100, 100);

update public.productos
set nombre = 'Producto A renombrado'
where id = current_setting('test.producto_a')::uuid;

do $$
begin
  if (select producto_nombre from public.items_pedido
      where pedido_id = current_setting('test.pedido')::uuid)
     <> 'Producto A' then
    raise exception 'Cambió el nombre congelado del item';
  end if;
end $$;
`
);

testDb(
  "no repite variantes por producto ni SKU dentro del emprendimiento",
  `
do $$
begin
  begin
    insert into public.variantes (producto_id, nombre)
    values (current_setting('test.producto_variantes')::uuid, ' talle m ');
    raise exception 'Se permitió repetir una variante del mismo producto';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.productos
      (emprendimiento_id, nombre, precio, stock_disponible, sku_o_identificador)
    values
      (current_setting('test.emprendimiento_a')::uuid, 'Otro producto A', 100, 1, ' sku-a ');
    raise exception 'Se permitió repetir un SKU en el mismo emprendimiento';
  exception when unique_violation then
    null;
  end;

  insert into public.productos
    (emprendimiento_id, nombre, precio, stock_disponible, sku_o_identificador)
  values
    (current_setting('test.emprendimiento_b')::uuid, 'SKU válido en otro emprendimiento', 100, 1, 'sku-a');
end $$;
`
);

testDb(
  "identificador_externo es único por emprendimiento ignorando espacios y mayúsculas",
  `
insert into public.productos
  (emprendimiento_id, nombre, precio, stock_disponible, identificador_externo)
values
  (current_setting('test.emprendimiento_a')::uuid, 'Producto con identificador externo', 100, 1, 'Ext-01');

do $$
begin
  begin
    insert into public.productos
      (emprendimiento_id, nombre, precio, stock_disponible, identificador_externo)
    values
      (current_setting('test.emprendimiento_a')::uuid, 'Duplicado externo', 100, 1, ' ext-01 ');
    raise exception 'Se permitió repetir identificador_externo dentro del emprendimiento';
  exception when unique_violation then
    null;
  end;

  insert into public.productos
    (emprendimiento_id, nombre, precio, stock_disponible, identificador_externo)
  values
    (current_setting('test.emprendimiento_b')::uuid, 'Identificador externo en otro emprendimiento', 100, 1, 'ext-01');
end $$;
`
);

testDb(
  "documento de cliente es único dentro del emprendimiento",
  `
insert into public.clientes
  (emprendimiento_id, nombre, tipo_documento, numero_documento)
values
  (current_setting('test.emprendimiento_a')::uuid, 'Cliente con documento', 'DNI', '12345678'),
  (current_setting('test.emprendimiento_b')::uuid, 'Documento en otro emprendimiento', 'DNI', '12345678');

do $$
begin
  begin
    insert into public.clientes
      (emprendimiento_id, nombre, tipo_documento, numero_documento)
    values
      (current_setting('test.emprendimiento_a')::uuid, 'Cliente duplicado', 'DNI', '12345678');
    raise exception 'Se permitió repetir el documento dentro del emprendimiento';
  exception when unique_violation then
    null;
  end;
end $$;
`
);

testDb(
  "v_productos_stock clasifica stock simple y stock con variantes",
  `
select set_config('test.sin_simple', gen_random_uuid()::text, true);
select set_config('test.bajo_simple', gen_random_uuid()::text, true);
select set_config('test.ok_simple', gen_random_uuid()::text, true);
select set_config('test.sin_variantes', gen_random_uuid()::text, true);
select set_config('test.bajo_variantes', gen_random_uuid()::text, true);
select set_config('test.ok_variantes', gen_random_uuid()::text, true);

insert into public.productos
  (id, emprendimiento_id, nombre, precio, stock_disponible, stock_minimo)
values
  (current_setting('test.sin_simple')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Simple sin stock', 10, 0, 3),
  (current_setting('test.bajo_simple')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Simple bajo', 10, 2, 3),
  (current_setting('test.ok_simple')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Simple OK', 10, 5, 3);

insert into public.productos
  (id, emprendimiento_id, nombre, precio, tiene_variantes, stock_disponible, stock_minimo)
values
  (current_setting('test.sin_variantes')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Variantes sin stock', 10, true, null, 3),
  (current_setting('test.bajo_variantes')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Variantes bajo', 10, true, null, 3),
  (current_setting('test.ok_variantes')::uuid, current_setting('test.emprendimiento_a')::uuid, 'Variantes OK', 10, true, null, 3);

insert into public.variantes (producto_id, nombre, stock_disponible)
values
  (current_setting('test.sin_variantes')::uuid, 'Unidad', 0),
  (current_setting('test.bajo_variantes')::uuid, 'Unidad', 2),
  (current_setting('test.ok_variantes')::uuid, 'Unidad', 5);

do $$
begin
  if (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.sin_simple')::uuid) <> 'SIN_STOCK'
     or (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.bajo_simple')::uuid) <> 'BAJO'
     or (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.ok_simple')::uuid) <> 'OK'
     or (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.sin_variantes')::uuid) <> 'SIN_STOCK'
     or (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.bajo_variantes')::uuid) <> 'BAJO'
     or (select nivel from public.v_productos_stock
      where producto_id = current_setting('test.ok_variantes')::uuid) <> 'OK' then
    raise exception 'v_productos_stock devolvió un nivel incorrecto';
  end if;
end $$;
`
);

testDb(
  "v_stock_bajo lista productos simples y variantes bajo el umbral",
  `
do $$
declare
  v_simple_sin_stock uuid;
  v_simple_bajo uuid;
  v_simple_ok uuid;
  v_producto_variantes uuid;
  v_variante_baja uuid;
  v_variante_ok uuid;
  v_filas integer;
begin
  insert into public.productos
    (emprendimiento_id, nombre, precio, stock_disponible, stock_minimo)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'Simple sin stock', 10, 0, 0)
  returning id into v_simple_sin_stock;

  insert into public.productos
    (emprendimiento_id, nombre, precio, stock_disponible, stock_minimo)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'Simple bajo', 10, 2, 3)
  returning id into v_simple_bajo;

  insert into public.productos
    (emprendimiento_id, nombre, precio, stock_disponible, stock_minimo)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'Simple OK', 10, 5, 3)
  returning id into v_simple_ok;

  insert into public.productos
    (emprendimiento_id, nombre, precio, tiene_variantes, stock_disponible, stock_minimo)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'Producto con variantes bajo stock', 10, true, null, 2)
  returning id into v_producto_variantes;

  insert into public.variantes (producto_id, nombre, stock_disponible, stock_minimo)
  values (v_producto_variantes, 'Variante baja', 1, 2)
  returning id into v_variante_baja;

  insert into public.variantes (producto_id, nombre, stock_disponible, stock_minimo)
  values (v_producto_variantes, 'Variante OK', 5, 2)
  returning id into v_variante_ok;

  select count(*) into v_filas
  from public.v_stock_bajo
  where producto_id in (v_simple_sin_stock, v_simple_bajo, v_simple_ok, v_producto_variantes);
  if v_filas <> 3 then
    raise exception 'v_stock_bajo devolvió % filas; se esperaban tres', v_filas;
  end if;

  if not exists (
    select 1 from public.v_stock_bajo
    where producto_id = v_simple_sin_stock and variante_id is null and stock_disponible = 0
  ) or not exists (
    select 1 from public.v_stock_bajo
    where producto_id = v_simple_bajo and variante_id is null and stock_disponible = 2
  ) or exists (
    select 1 from public.v_stock_bajo where producto_id = v_simple_ok
  ) or not exists (
    select 1 from public.v_stock_bajo
    where producto_id = v_producto_variantes
      and variante_id = v_variante_baja
      and stock_disponible = 1
  ) or exists (
    select 1 from public.v_stock_bajo
    where producto_id = v_producto_variantes and variante_id = v_variante_ok
  ) then
    raise exception 'v_stock_bajo incluyó/excluyó una fila incorrectamente';
  end if;
end $$;
`
);

testDb(
  "v_clientes_resumen suma deudas impagas y excluye pedidos cancelados",
  `
insert into public.pedidos
  (emprendimiento_id, cliente_id, origen_tipo, estado, estado_cobro, total, cancelled_at)
values
  (current_setting('test.emprendimiento_a')::uuid, current_setting('test.cliente_a')::uuid, 'MANUAL', 'RECIBIDO', 'PENDIENTE', 125, null),
  (current_setting('test.emprendimiento_a')::uuid, current_setting('test.cliente_a')::uuid, 'MANUAL', 'RECIBIDO', 'PAGADO', 50, null),
  (current_setting('test.emprendimiento_a')::uuid, current_setting('test.cliente_a')::uuid, 'MANUAL', 'CANCELADO', 'PENDIENTE', 900, now()),
  (current_setting('test.emprendimiento_b')::uuid, current_setting('test.cliente_b')::uuid, 'MANUAL', 'CANCELADO', 'PENDIENTE', 700, now());

do $$
declare
  v_cliente record;
begin
  select deuda_total, pedidos_impagos, es_deudor
  into v_cliente
  from public.v_clientes_resumen
  where id = current_setting('test.cliente_a')::uuid;
  if v_cliente.deuda_total <> 125 or v_cliente.pedidos_impagos <> 1
     or not v_cliente.es_deudor then
    raise exception 'Resumen del cliente A incorrecto: %', row_to_json(v_cliente);
  end if;

  select deuda_total, pedidos_impagos, es_deudor
  into v_cliente
  from public.v_clientes_resumen
  where id = current_setting('test.cliente_b')::uuid;
  if v_cliente.deuda_total <> 0 or v_cliente.pedidos_impagos <> 0
     or v_cliente.es_deudor then
    raise exception 'Un pedido cancelado aparece como deuda: %', row_to_json(v_cliente);
  end if;
end $$;
`
);

testDb(
  "dashboard_resumen calcula ventas, períodos, canales, cancelados y deuda antigua",
  `
insert into public.pedidos
  (emprendimiento_id, origen_tipo, canal_id, estado, estado_cobro, total, created_at, cancelled_at)
values
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', null, 'RECIBIDO', 'PENDIENTE', 100, '2025-03-10 12:00:00+00', null),
  (current_setting('test.emprendimiento_a')::uuid, 'CANAL', current_setting('test.canal_a')::uuid, 'RECIBIDO', 'PAGADO', 200, '2025-03-11 12:00:00+00', null),
  (current_setting('test.emprendimiento_a')::uuid, 'CANAL', current_setting('test.canal_b')::uuid, 'RECIBIDO', 'PENDIENTE', 50, '2025-03-12 12:00:00+00', null),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', null, 'CANCELADO', 'PENDIENTE', 999, '2025-03-13 12:00:00+00', now()),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', null, 'RECIBIDO', 'PENDIENTE', 40, '2025-03-05 12:00:00+00', null),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', null, 'CANCELADO', 'PENDIENTE', 700, '2025-03-06 12:00:00+00', now()),
  (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', null, 'RECIBIDO', 'PENDIENTE', 30, now() - interval '12 days', null);

do $$
declare
  v_resumen jsonb;
  v_mas_viejo timestamptz;
  v_dias integer;
begin
  v_resumen := public.dashboard_resumen(
    current_setting('test.emprendimiento_a')::uuid,
    '2025-03-10 00:00:00+00',
    '2025-03-17 00:00:00+00'
  );

  if (v_resumen->>'ventas')::numeric <> 350
     or (v_resumen->>'pedidos')::integer <> 3
     or (v_resumen->>'ventas_periodo_anterior')::numeric <> 40
     or (v_resumen->>'pedidos_periodo_anterior')::integer <> 1
     or (v_resumen->>'diferencia_ventas')::numeric <> 310 then
    raise exception 'Totales o período anterior incorrectos: %', v_resumen;
  end if;

  if (v_resumen->'por_canal'->>'MANUAL')::integer <> 1
     or (v_resumen->'por_canal'->>'WHATSAPP')::integer <> 1
     or (v_resumen->'por_canal'->>'TELEGRAM')::integer <> 1
     or v_resumen->'por_canal' ? 'CANCELADO' then
    raise exception 'Totales por canal incorrectos: %', v_resumen->'por_canal';
  end if;

  select min(created_at) into v_mas_viejo
  from public.pedidos
  where emprendimiento_id = current_setting('test.emprendimiento_a')::uuid
    and estado <> 'CANCELADO'
    and estado_cobro = 'PENDIENTE';
  v_dias := floor(extract(epoch from (now() - v_mas_viejo)) / 86400)::integer;
  if (v_resumen->'pendiente_cobro'->>'monto')::numeric <> 220
     or (v_resumen->'pendiente_cobro'->>'pedidos')::integer <> 4
     or (v_resumen->'pendiente_cobro'->>'dias_mas_viejo')::integer <> v_dias then
    raise exception 'Pendiente de cobro incorrecto: %', v_resumen->'pendiente_cobro';
  end if;
end $$;
`
);

testDb(
  "dashboard_top_productos incluye desde y excluye hasta",
  `
do $$
declare
  v_pedido_inicio uuid;
  v_pedido_medio uuid;
  v_pedido_hasta uuid;
  v_resultado record;
  v_producto uuid := current_setting('test.producto_a')::uuid;
begin
  insert into public.pedidos
    (emprendimiento_id, origen_tipo, estado, total, created_at)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'RECIBIDO', 200, '2025-03-10 00:00:00+00')
  returning id into v_pedido_inicio;

  insert into public.pedidos
    (emprendimiento_id, origen_tipo, estado, total, created_at)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'RECIBIDO', 300, '2025-03-11 12:00:00+00')
  returning id into v_pedido_medio;

  insert into public.pedidos
    (emprendimiento_id, origen_tipo, estado, total, created_at)
  values
    (current_setting('test.emprendimiento_a')::uuid, 'MANUAL', 'RECIBIDO', 500, '2025-03-12 00:00:00+00')
  returning id into v_pedido_hasta;

  insert into public.items_pedido
    (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
  values
    (v_pedido_inicio, v_producto, 2, 100, 200),
    (v_pedido_medio, v_producto, 3, 100, 300),
    (v_pedido_hasta, v_producto, 5, 100, 500);

  select * into v_resultado
  from public.dashboard_top_productos(
    current_setting('test.emprendimiento_a')::uuid,
    '2025-03-10 00:00:00+00',
    '2025-03-12 00:00:00+00',
    10
  )
  where producto_id = v_producto;

  if v_resultado.unidades <> 5 or v_resultado.ingresos <> 500 then
    raise exception 'El ranking no respetó el intervalo [desde, hasta): % unidades, % ingresos',
      v_resultado.unidades, v_resultado.ingresos;
  end if;
end $$;
`
);

testDb(
  "un usuario no ve ni modifica datos ajenos en vistas, dashboard ni RPC",
  `
insert into public.pedidos
  (emprendimiento_id, cliente_id, origen_tipo, estado, estado_cobro, total)
values
  (current_setting('test.emprendimiento_b')::uuid,
   current_setting('test.cliente_b')::uuid, 'MANUAL', 'RECIBIDO', 'PENDIENTE', 321)
returning set_config('test.pedido_b', id::text, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.usuario_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_filas integer;
  v_dashboard jsonb;
begin
  select count(*) into v_filas
  from public.v_productos_stock
  where emprendimiento_id = current_setting('test.emprendimiento_b')::uuid;
  if v_filas <> 0 then
    raise exception 'El usuario A ve productos del emprendimiento B';
  end if;

  select count(*) into v_filas
  from public.v_clientes_resumen
  where emprendimiento_id = current_setting('test.emprendimiento_b')::uuid;
  if v_filas <> 0 then
    raise exception 'El usuario A ve clientes del emprendimiento B';
  end if;

  v_dashboard := public.dashboard_resumen(
    current_setting('test.emprendimiento_b')::uuid,
    now() - interval '1 day',
    now() + interval '1 day'
  );
  if (v_dashboard->>'ventas')::numeric <> 0
     or (v_dashboard->>'pedidos')::integer <> 0
     or (v_dashboard->'pendiente_cobro'->>'monto')::numeric <> 0 then
    raise exception 'El dashboard filtró datos del emprendimiento B: %', v_dashboard;
  end if;

  update public.productos
  set stock_disponible = 0
  where id = current_setting('test.producto_b')::uuid;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then
    raise exception 'El usuario A modificó un producto del emprendimiento B';
  end if;

  update public.pedidos
  set total = 0
  where id = current_setting('test.pedido_b')::uuid;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then
    raise exception 'El usuario A modificó un pedido del emprendimiento B';
  end if;

  begin
    perform public.cambiar_estado_pedido(
      current_setting('test.emprendimiento_b')::uuid,
      current_setting('test.pedido_b')::uuid,
      'CANCELADO'
    );
    raise exception 'La RPC permitió cambiar un pedido del emprendimiento B';
  exception when sqlstate '42501' then
    null;
  end;
end $$;

reset role;

do $$
begin
  if (select stock_disponible from public.productos
      where id = current_setting('test.producto_b')::uuid) <> 4
     or (select estado from public.pedidos
      where id = current_setting('test.pedido_b')::uuid) <> 'RECIBIDO' then
    raise exception 'Cambió un dato del emprendimiento B durante la prueba';
  end if;
end $$;
`
);
