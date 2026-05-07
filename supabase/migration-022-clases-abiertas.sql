-- ─────────────────────────────────────────────────────────────────────────
-- Migración 022 · Clases abiertas (eventos públicos con inscripción libre)
--
-- Caso de uso: Sofía ofrece una clase gratuita y comparte UN link único con
-- todos sus leads/inscritos. Cualquiera con el link puede inscribirse hasta
-- llenar el cupo.
--
-- Diferencia con `preinscripcion`: aquella es 1 token POR LEAD (privada).
-- Esta es 1 link COMPARTIDO (slug público) abierto a quien lo reciba.
--
-- Schema reusable para múltiples clases futuras (módulo estudio puede usar
-- la misma tabla).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clases_abiertas (
  id              bigserial PRIMARY KEY,
  slug            text NOT NULL UNIQUE,           -- ej. 'yoga-16-mayo' (URL pública)
  titulo          text NOT NULL,
  descripcion     text DEFAULT '',
  fecha           date,                            -- Sábado 16 may 2026
  hora_inicio     time,                            -- 08:30
  hora_fin        time,                            -- 10:30
  ubicacion       text DEFAULT '',                 -- "Casita del Yoga o Domo (por definir)"
  cupos_max       integer NOT NULL DEFAULT 20,
  activa          boolean NOT NULL DEFAULT true,   -- toggle para cerrar inscripciones manualmente
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clases_abiertas_slug_idx ON public.clases_abiertas(slug);
CREATE INDEX IF NOT EXISTS clases_abiertas_activa_idx ON public.clases_abiertas(activa);

ALTER TABLE public.clases_abiertas ENABLE ROW LEVEL SECURITY;

-- Admin (Sofía/Juan) puede todo
DROP POLICY IF EXISTS "clases_abiertas_admin" ON public.clases_abiertas;
CREATE POLICY "clases_abiertas_admin" ON public.clases_abiertas
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- Anon puede SELECT solo de las activas (lo necesita el form público)
DROP POLICY IF EXISTS "clases_abiertas_anon_read" ON public.clases_abiertas;
CREATE POLICY "clases_abiertas_anon_read" ON public.clases_abiertas
  FOR SELECT TO anon, authenticated USING (activa = true);

-- ─────────────────────────────────────────────────────────────────────────
-- Tabla de inscripciones a clase
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clase_inscripciones (
  id              bigserial PRIMARY KEY,
  clase_id        bigint NOT NULL REFERENCES public.clases_abiertas(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  email           text NOT NULL,
  telefono        text DEFAULT '',
  notas           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  -- previene duplicados con mismo email en la misma clase
  UNIQUE (clase_id, email)
);

CREATE INDEX IF NOT EXISTS clase_inscripciones_clase_idx ON public.clase_inscripciones(clase_id);

ALTER TABLE public.clase_inscripciones ENABLE ROW LEVEL SECURITY;

-- Admin (Sofía/Juan) puede ver todo
DROP POLICY IF EXISTS "clase_inscripciones_admin" ON public.clase_inscripciones;
CREATE POLICY "clase_inscripciones_admin" ON public.clase_inscripciones
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- Anon puede ver el COUNT por clase (necesario para mostrar cupos disponibles
-- al público sin exponer la lista de inscritos). El frontend usa la RPC
-- `cupos_disponibles_clase` para no leer la tabla directamente.

-- ─────────────────────────────────────────────────────────────────────────
-- RPC pública: leer info de clase por slug + cupos disponibles
-- ─────────────────────────────────────────────────────────────────────────
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
    RETURN jsonb_build_object('error', 'Clase no encontrada o inactiva');
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
    'cupos_disponibles', GREATEST(0, c.cupos_max - inscritos)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_clase_publica(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- RPC pública: inscribirse a clase. Valida cupos antes de insertar.
-- ─────────────────────────────────────────────────────────────────────────
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

  -- Verificar si el email ya está inscrito a esta clase
  SELECT EXISTS(
    SELECT 1 FROM public.clase_inscripciones
    WHERE clase_id = c.id AND lower(email) = lower(p_email)
  ) INTO ya_inscrito;
  IF ya_inscrito THEN
    RETURN jsonb_build_object('error', 'Este email ya está inscrito a la clase');
  END IF;

  -- Verificar cupos disponibles
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

-- ─────────────────────────────────────────────────────────────────────────
-- Tracking en leads: si Sofía marcó que envió el link de la clase a un lead.
-- (Para "respondió" matcheamos por nombre fuzzy en el frontend.)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS clase_link_enviada_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT inicial: la clase del 16 mayo
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.clases_abiertas (slug, titulo, descripcion, fecha, hora_inicio, hora_fin, ubicacion, cupos_max)
VALUES (
  'yoga-16-mayo',
  'Clase de Yoga abierta · regalo',
  'Una clase guiada por Sofía Lira, gratuita, para quienes están interesados o ya inscritos en la formación de junio. Espacio para conocernos y practicar antes de empezar.',
  '2026-05-16',
  '08:30',
  '10:30',
  'La Casita del Yoga o Domo Soulspace (por definir, te confirmamos un día antes)',
  22
)
ON CONFLICT (slug) DO NOTHING;
