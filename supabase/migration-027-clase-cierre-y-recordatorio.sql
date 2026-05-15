-- migration-027-clase-cierre-y-recordatorio.sql
-- 1) Reduce cupos de la clase del 16-may: 22 → 18
-- 2) Define hora de cierre de inscripciones (hoy 15-may 12:00 Ecuador → 17:00 UTC)
-- 3) Actualiza RPCs obtener_clase_publica + inscribirse_a_clase para chequear
--    el cierre y exponer la hora al frontend
-- 4) Agrega plantilla WhatsApp "Recordatorio clase mañana" en ajustes

BEGIN;

-- ── Columna nueva: hora de cierre de inscripciones ──
ALTER TABLE public.clases_abiertas
  ADD COLUMN IF NOT EXISTS cierra_inscripciones_at timestamptz;

-- ── Update de la clase activa ──
UPDATE public.clases_abiertas
   SET cupos_max               = 18,
       cierra_inscripciones_at = '2026-05-15 17:00:00+00'  -- 12:00 Ecuador (UTC-5)
 WHERE slug = 'yoga-16-mayo';

-- ── RPC obtener_clase_publica: incluir cierre + flag cerrado ──
CREATE OR REPLACE FUNCTION public.obtener_clase_publica(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  inscritos integer;
BEGIN
  SELECT * INTO c FROM public.clases_abiertas WHERE slug = p_slug AND activa = true;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Clase no disponible');
  END IF;
  SELECT COUNT(*) INTO inscritos FROM public.clase_inscripciones WHERE clase_id = c.id;
  RETURN jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'titulo', c.titulo,
    'descripcion', c.descripcion,
    'fecha', c.fecha,
    'hora_inicio', c.hora_inicio,
    'hora_fin', c.hora_fin,
    'ubicacion', c.ubicacion,
    'cupos_max', c.cupos_max,
    'inscritos_count', inscritos,
    'cupos_disponibles', GREATEST(0, c.cupos_max - inscritos),
    'cierra_inscripciones_at', c.cierra_inscripciones_at,
    'cerrado', (c.cierra_inscripciones_at IS NOT NULL AND now() > c.cierra_inscripciones_at)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_clase_publica(text) TO anon, authenticated;

-- ── RPC inscribirse_a_clase: bloquear si cerrado ──
CREATE OR REPLACE FUNCTION public.inscribirse_a_clase(
  p_slug text,
  p_nombre text,
  p_email text,
  p_telefono text DEFAULT '',
  p_notas text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  inscritos integer;
  ya_inscrito boolean;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RETURN jsonb_build_object('error', 'Falta el nombre');
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 OR p_email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('error', 'Email inválido');
  END IF;

  SELECT * INTO c FROM public.clases_abiertas WHERE slug = p_slug AND activa = true;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Clase no disponible');
  END IF;

  -- Cierre de inscripciones
  IF c.cierra_inscripciones_at IS NOT NULL AND now() > c.cierra_inscripciones_at THEN
    RETURN jsonb_build_object('error', 'Inscripciones cerradas');
  END IF;

  -- Email duplicado
  SELECT EXISTS(
    SELECT 1 FROM public.clase_inscripciones
    WHERE clase_id = c.id AND lower(email) = lower(p_email)
  ) INTO ya_inscrito;
  IF ya_inscrito THEN
    RETURN jsonb_build_object('error', 'Este email ya está inscrito a la clase');
  END IF;

  -- Cupos
  SELECT COUNT(*) INTO inscritos FROM public.clase_inscripciones WHERE clase_id = c.id;
  IF inscritos >= c.cupos_max THEN
    RETURN jsonb_build_object('error', 'Sin cupos disponibles');
  END IF;

  INSERT INTO public.clase_inscripciones (clase_id, nombre, email, telefono, notas)
  VALUES (c.id, trim(p_nombre), lower(trim(p_email)), trim(p_telefono), p_notas);

  RETURN jsonb_build_object(
    'ok', true,
    'cupos_disponibles', GREATEST(0, c.cupos_max - inscritos - 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscribirse_a_clase(text, text, text, text, text) TO anon, authenticated;

-- ── Plantilla nueva: recordatorio clase mañana ──
UPDATE public.ajustes
   SET data = jsonb_set(
     data,
     '{plantillasWA}',
     COALESCE(data->'plantillasWA', '[]'::jsonb) || jsonb_build_array(
       jsonb_build_object(
         'id', 'recordatorio_clase',
         'titulo', 'Recordatorio clase mañana',
         'cuerpo',
         'Hola querida(o)! 🌿 Te recuerdo que mañana sábado nos encontramos para nuestra clase gratuita de prueba.

📅 Sábado 16 de mayo · 08:30–10:30
📍 La Casita del Yoga
https://maps.app.goo.gl/vHP5keN2w66HgTap9

Llega 10 min antes con ropa cómoda. Si tienes mat propio, tráelo (hay extras también).

Nos vemos en el mat! 💗'
       )
     ),
     true
   )
 WHERE id = 1;

COMMIT;
