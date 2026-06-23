-- ─────────────────────────────────────────────────────────────────────────
-- Migración 033 · Fundación del modelo convergido (personas + participaciones)
--
-- Ver docs/arquitectura-multiproyecto.md. Separa IDENTIDAD (personas) de
-- PARTICIPACIÓN (rol de una persona en un proyecto). Base compartida de
-- leads/usuarios entre TODOS los proyectos.
--
-- 100% ADITIVA: extiende `proyectos`, crea `personas` y `participaciones`
-- (vacías). NO toca alumnas/leads/taller_*/estudio. El backfill deduplicado
-- va en una migración aparte (034) para poder revisarlo. La app sigue igual.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Extender `proyectos` con lo que el shell necesita ──
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS shell        text NOT NULL DEFAULT 'formacion';
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS modalidad    text;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS ubicacion    text;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS cupos        integer;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS precio_base  numeric;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS fecha_inicio date;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS fecha_fin    date;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS orden        integer NOT NULL DEFAULT 0;
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_proyectos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS proyectos_touch ON public.proyectos;
CREATE TRIGGER proyectos_touch BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.touch_proyectos();

-- Seed de los proyectos legacy (Refinar la Práctica ya existe, id=1)
INSERT INTO public.proyectos (slug, nombre, tipo, shell, estado, descripcion, ubicacion, cupos, precio_base, orden, archivado_at, fecha_inicio, fecha_fin)
VALUES
  ('formacion-junio-2026', 'El Arte de Enseñar Yoga', 'formacion', 'formacion', 'archivado',
   'Formación de 50h. Junio 2026.', 'Domo Soulspace, Tumbaco', 25, 640, 10, now(), '2026-06-06', '2026-06-21'),
  ('estudio', 'Estudio', 'programa', 'estudio', 'activo',
   'Clases y membresías del día a día.', NULL, NULL, NULL, 20, NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- El taller existente usa el shell tabbed de la formación
UPDATE public.proyectos SET shell = 'formacion' WHERE slug = 'refinar-la-practica' AND (shell IS NULL OR shell = '');

-- ── 2. personas: base ÚNICA y COMPARTIDA de humanos ──
CREATE TABLE IF NOT EXISTS public.personas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      text NOT NULL,
  tel         text,
  instagram   text,
  email       text,
  avatar      text,
  iniciales   text,
  notas       text,
  -- claves normalizadas para dedup (se llenan en backfill / desde el frontend)
  tel_norm    text,   -- solo dígitos, últimos 9
  ig_norm     text,   -- minúsculas sin @
  email_norm  text,   -- minúsculas
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personas_tel_norm_idx   ON public.personas(tel_norm);
CREATE INDEX IF NOT EXISTS personas_ig_norm_idx    ON public.personas(ig_norm);
CREATE INDEX IF NOT EXISTS personas_email_norm_idx ON public.personas(email_norm);

CREATE OR REPLACE FUNCTION public.touch_personas()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS personas_touch ON public.personas;
CREATE TRIGGER personas_touch BEFORE UPDATE ON public.personas
  FOR EACH ROW EXECUTE FUNCTION public.touch_personas();

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personas_admin" ON public.personas;
CREATE POLICY "personas_admin" ON public.personas
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ── 3. participaciones: rol de una persona en un proyecto ──
CREATE TABLE IF NOT EXISTS public.participaciones (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id        bigint NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  proyecto_id       bigint NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  rol               text NOT NULL DEFAULT 'lead',   -- lead | inscrito
  estado            text,                            -- nuevo|interesado|inscrito|pendiente|completo…
  tipo_inscripcion  text,                            -- completa|dos_encuentros|… (según proyecto)
  total             numeric,
  pagado            numeric NOT NULL DEFAULT 0,
  bono_silla        boolean NOT NULL DEFAULT false,
  plan_pagos        text,
  fuente            text,                            -- instagram|whatsapp|referido… (para leads)
  notas             text,
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- campos extra por proyecto (encuentros, etc.)
  -- trazabilidad al registro legacy de origen (para el backfill / rollback)
  legacy_tabla      text,
  legacy_id         bigint,
  fecha_inscripcion timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, proyecto_id, rol)
);
CREATE INDEX IF NOT EXISTS participaciones_proyecto_idx ON public.participaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS participaciones_persona_idx  ON public.participaciones(persona_id);

CREATE OR REPLACE FUNCTION public.touch_participaciones()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS participaciones_touch ON public.participaciones;
CREATE TRIGGER participaciones_touch BEFORE UPDATE ON public.participaciones
  FOR EACH ROW EXECUTE FUNCTION public.touch_participaciones();

ALTER TABLE public.participaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participaciones_admin" ON public.participaciones;
CREATE POLICY "participaciones_admin" ON public.participaciones
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());
