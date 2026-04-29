-- ─────────────────────────────────────────────────────────────────────────
-- Migración 005 · Sistema de preinscripción
--
-- Objetivo: Sofía genera un link único por lead. El cliente lo abre
-- (sin login) y llena un formulario. Las respuestas quedan vinculadas
-- a su lead/alumna para que Sofía las vea desde el dashboard.
--
-- Seguridad: la tabla queda bloqueada a anon vía RLS. Toda lectura/escritura
-- pública pasa por funciones RPC con SECURITY DEFINER que filtran por token.
-- El token es un UUID generado server-side (~impredecible).
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.preinscripcion (
  id              bigserial PRIMARY KEY,
  lead_id         bigint REFERENCES public.leads(id) ON DELETE CASCADE,
  alumna_id       bigint REFERENCES public.alumnas(id) ON DELETE CASCADE,
  token           uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  data            jsonb DEFAULT '{}'::jsonb,
  estado          text DEFAULT 'pendiente',  -- pendiente | completada
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  CHECK (lead_id IS NOT NULL OR alumna_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS preinscripcion_token_idx ON public.preinscripcion(token);
CREATE INDEX IF NOT EXISTS preinscripcion_lead_idx  ON public.preinscripcion(lead_id);
CREATE INDEX IF NOT EXISTS preinscripcion_alumna_idx ON public.preinscripcion(alumna_id);

ALTER TABLE public.preinscripcion ENABLE ROW LEVEL SECURITY;

-- Solo Sofía/Juan pueden ver la tabla via SELECT directo (para el panel)
DROP POLICY IF EXISTS "preinscripcion_admin" ON public.preinscripcion;
CREATE POLICY "preinscripcion_admin" ON public.preinscripcion
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── RPCs públicas (anon) — controladas por token ───

-- 1. Crear preinscripcion para un lead. Solo authenticated.
CREATE OR REPLACE FUNCTION public.crear_preinscripcion(p_lead_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  existing_token uuid;
  new_token uuid;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Si ya hay una preinscripción pendiente para este lead, devolver su token
  SELECT token INTO existing_token
  FROM public.preinscripcion
  WHERE lead_id = p_lead_id AND estado = 'pendiente'
  ORDER BY created_at DESC LIMIT 1;

  IF existing_token IS NOT NULL THEN
    RETURN existing_token;
  END IF;

  INSERT INTO public.preinscripcion (lead_id, token)
  VALUES (p_lead_id, gen_random_uuid())
  RETURNING token INTO new_token;

  RETURN new_token;
END;
$$;

-- 2. Obtener datos básicos para el form (anon ok, filtrado por token)
CREATE OR REPLACE FUNCTION public.obtener_preinscripcion(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'estado', p.estado,
    'data', p.data,
    'completed_at', p.completed_at,
    'lead_nombre', l.nombre
  ) INTO result
  FROM public.preinscripcion p
  LEFT JOIN public.leads l ON l.id = p.lead_id
  WHERE p.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;

-- 3. Enviar respuestas del form (anon ok, idempotente — solo permite si pendiente)
CREATE OR REPLACE FUNCTION public.enviar_preinscripcion(p_token uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pre_id bigint;
  pre_estado text;
BEGIN
  SELECT id, estado INTO pre_id, pre_estado
  FROM public.preinscripcion
  WHERE token = p_token
  LIMIT 1;

  IF pre_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link inválido o expirado');
  END IF;

  IF pre_estado = 'completada' THEN
    RETURN jsonb_build_object('error', 'Ya completaste este formulario');
  END IF;

  UPDATE public.preinscripcion
  SET data = p_data,
      estado = 'completada',
      completed_at = now()
  WHERE id = pre_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Permisos: las RPCs SECURITY DEFINER pueden ser llamadas por anon
GRANT EXECUTE ON FUNCTION public.obtener_preinscripcion(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_preinscripcion(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_preinscripcion(bigint) TO authenticated;
