-- =====================================================================
-- Migracion 006 -- Nombre unico (global, normalizado) de emprendimientos
--
-- Regla: `emprendimientos.nombre` es unico a nivel global, ignorando
-- mayusculas/minusculas y espacios de borde. "Kiosco", "kiosco" y
-- "  KIOSCO  " colisionan entre si.
--
-- Por que un indice unico y no un "select previo" en el backend:
-- el check-then-insert tiene condicion de carrera (dos altas en
-- paralelo pasan el select y duplican) y, peor, el DAO corre con RLS:
-- solo ve los emprendimientos del usuario, asi que un select previo
-- jamas podria garantizar unicidad GLOBAL. El indice es la unica
-- garantia real; el backend solo traduce el 23505 a un 409.
--
-- La RPC es security definer (ve todas las filas) y por eso SI puede
-- dar un mensaje limpio antes de chocar con el indice: el chequeo
-- explicito de abajo existe solo por UX, la garantia es el indice.
--
-- Normalizacion: la RPC `crear_emprendimiento` ya hace btrim(), asi que
-- el indice normaliza con lower(btrim(nombre)). No se usa citext para
-- no agregar una extension solo por esto.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUES de la 001.
-- Idempotente: se puede reejecutar.
-- =====================================================================

set search_path = public;

-- Si ya hay duplicados normalizados, el CREATE UNIQUE falla con 23505
-- y lista los valores en colision: hay que renombrarlos a mano antes
-- de reintentar. No se borra ni se renombra nada solo.
create unique index if not exists uq_emprendimientos_nombre_normalizado
  on public.emprendimientos (lower(btrim(nombre)));
