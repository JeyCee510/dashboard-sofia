-- migration-028-clase-inscripcion-manual.sql
-- 1) Restaurar cupos_max = 22 (Sofía quiere meter manualmente más)
-- 2) email en clase_inscripciones pasa a NULLABLE (los manuales pueden no tenerlo)
-- 3) Nueva RPC `inscribir_lead_a_clase_manual`: solo authenticated, bypassea
--    el cierre de inscripciones públicas. Sigue validando cupos.

BEGIN;

UPDATE public.clases_abiertas
   SET cupos_max = 22
 WHERE slug = 'yoga-16-mayo';

ALTER TABLE public.clase_inscripciones
  ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.inscribir_lead_a_clase_manual(
  p_slug text,
  p_nombre text,
  p_email text DEFAULT NULL,
  p_telefono text DEFAULT '',
  p_notas text DEFAULT 'inscripción manual (Sofía)'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  inscritos integer;
  ya_inscrito boolean := false;
BEGIN
  -- Auth gate: solo authenticated (Sofía con sesión)
  IF NOT public.is_authorized() THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;

  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RETURN jsonb_build_object('error', 'Falta el nombre');
  END IF;

  SELECT * INTO c FROM public.clases_abiertas WHERE slug = p_slug AND activa = true;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Clase no disponible');
  END IF;

  -- Duplicado: por email (si vino) o por nombre exacto si no
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.clase_inscripciones
      WHERE clase_id = c.id AND lower(email) = lower(p_email)
    ) INTO ya_inscrito;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.clase_inscripciones
      WHERE clase_id = c.id AND lower(nombre) = lower(p_nombre)
    ) INTO ya_inscrito;
  END IF;
  IF ya_inscrito THEN
    RETURN jsonb_build_object('error', 'Ya está en la lista de inscritos');
  END IF;

  -- Cupos: SIGUE respetando el límite (no bypassea el cap)
  SELECT COUNT(*) INTO inscritos FROM public.clase_inscripciones WHERE clase_id = c.id;
  IF inscritos >= c.cupos_max THEN
    RETURN jsonb_build_object('error', 'Sin cupos disponibles');
  END IF;

  INSERT INTO public.clase_inscripciones (clase_id, nombre, email, telefono, notas)
  VALUES (c.id, trim(p_nombre), NULLIF(trim(COALESCE(p_email, '')), ''), trim(p_telefono), p_notas);

  RETURN jsonb_build_object(
    'ok', true,
    'cupos_disponibles', GREATEST(0, c.cupos_max - inscritos - 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscribir_lead_a_clase_manual(text, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.inscribir_lead_a_clase_manual(text, text, text, text, text) FROM anon;

COMMIT;
