-- ─────────────────────────────────────────────────────────────────────────
-- Migración 031 · Borradores de proyecto (wizard de nuevo proyecto)
--
-- Sofía usa el wizard del nuevo home para definir el ALCANCE de su próximo
-- producto (qué es, tipo, frecuencia, dónde, cupos, a quién, precio, etc.).
-- Cada vez que guarda, se crea/actualiza una fila aquí en estado 'borrador'.
-- No toca ninguna tabla existente — es aditivo y de bajo riesgo.
--
-- Los campos "duros" (nombre, tipo, estado) están como columnas para poder
-- listarlos/filtrarlos; el resto del alcance vive en `scope` (jsonb) para no
-- tener que migrar el esquema cada vez que el wizard gane un campo nuevo.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proyectos_borradores (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       text NOT NULL DEFAULT 'Proyecto sin nombre',
  tipo         text,                       -- formacion | taller | retiro | intensivo | programa | clases | otro
  estado       text NOT NULL DEFAULT 'borrador',  -- borrador | en_revision | aprobado | descartado
  descripcion  text,                       -- "¿qué es?" en palabras de Sofía
  scope        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- resto de respuestas del wizard
  plan         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- "camino a seguir" derivado (módulos sugeridos, pasos)
  creado_por   text,                       -- email de quien lo definió
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proyectos_borradores_created_idx
  ON public.proyectos_borradores(created_at DESC);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.touch_proyectos_borradores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proyectos_borradores_touch ON public.proyectos_borradores;
CREATE TRIGGER proyectos_borradores_touch
  BEFORE UPDATE ON public.proyectos_borradores
  FOR EACH ROW EXECUTE FUNCTION public.touch_proyectos_borradores();

-- RLS: mismo patrón que el resto de tablas (whitelist via is_authorized()).
ALTER TABLE public.proyectos_borradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proyectos_borradores_admin" ON public.proyectos_borradores;
CREATE POLICY "proyectos_borradores_admin" ON public.proyectos_borradores
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());
