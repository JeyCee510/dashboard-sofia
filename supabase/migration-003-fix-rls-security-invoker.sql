-- ─────────────────────────────────────────────────────────────────────────
-- Migración 003 · Fix RLS: SECURITY DEFINER → SECURITY INVOKER
--
-- Problema: la versión anterior de is_authorized() usaba SECURITY DEFINER,
-- lo que hacía que auth.jwt() retornara NULL bajo el contexto del owner
-- (postgres), no del caller autenticado. Resultado: todos los inserts/
-- updates/deletes vía la API REST eran rechazados por RLS.
--
-- Fix: SECURITY INVOKER (el default) — la función ejecuta con los
-- privilegios del caller, así auth.jwt() retorna el JWT del usuario.
-- Marcamos STABLE para que Postgres pueda cachear el resultado dentro
-- de una misma query y no llame la función una vez por fila.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') IN (
    'sofilira@gmail.com',
    'jclira@gmail.com'
  );
$$;

-- Limpiar test row si quedó
DELETE FROM public.leads WHERE nombre = 'TEST_DEBUG_LEAD';
