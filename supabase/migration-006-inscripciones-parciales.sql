-- ─────────────────────────────────────────────────────────────────────────
-- Migración 006 · Inscripciones parciales
--
-- Algunas estudiantes pueden inscribirse solo a 1 o 2 encuentros (no a la
-- formación completa). Necesitamos:
--   - tipo_inscripcion: 'completa' | 'dos_encuentros' | 'un_encuentro'
--   - encuentros_asistir: array de números [1,2,3] (qué encuentros asiste)
--
-- La asistencia (tabla `asistencia`) sigue siendo por dia_idx 0-5,
-- pero la UI filtra los días según encuentros_asistir:
--   Encuentro 1 → días 0, 1
--   Encuentro 2 → días 2, 3
--   Encuentro 3 → días 4, 5
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.alumnas
  ADD COLUMN IF NOT EXISTS tipo_inscripcion text DEFAULT 'completa',
  ADD COLUMN IF NOT EXISTS encuentros_asistir int[] DEFAULT ARRAY[1,2,3];

-- Constraint suave: solo valores válidos en tipo_inscripcion
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alumnas_tipo_inscripcion_chk') THEN
    ALTER TABLE public.alumnas
      ADD CONSTRAINT alumnas_tipo_inscripcion_chk
      CHECK (tipo_inscripcion IN ('completa', 'dos_encuentros', 'un_encuentro'));
  END IF;
END $$;

-- Backfill: cualquier fila previa queda como 'completa' con los 3 encuentros
UPDATE public.alumnas
   SET tipo_inscripcion = COALESCE(tipo_inscripcion, 'completa'),
       encuentros_asistir = COALESCE(encuentros_asistir, ARRAY[1,2,3])
 WHERE tipo_inscripcion IS NULL OR encuentros_asistir IS NULL;
