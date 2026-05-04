-- ─────────────────────────────────────────────────────────────────────────
-- Migración 019 · Asistencia a clases + Congelación de membresías (estudio)
--
-- 1. `clases_realizadas` — instancia de una clase en una fecha concreta.
--    MVP simple ad-hoc: Sofía crea una clase puntual (ej: "Hatha 7am del
--    4 may"). Sin horarios recurrentes todavía — eso queda para iteración 2.
--
-- 2. `asistencia_estudio` — quién asistió a qué clase. UNIQUE
--    (estudiante_id, clase_realizada_id) para no contar 2 veces.
--    Trigger AFTER INSERT incrementa `clases_usadas` de la membresía
--    asignada (si la hay).
--
-- 3. `congelaciones_membresia` — historial de pausas. Una membresía puede
--    tener varias congelaciones. Mientras `hasta` es NULL, está congelada.
--    Al descongelar se calcula `dias_extension` y se suma a la `fecha_fin`
--    de la membresía.
--
-- RPCs:
--   - marcar_asistencia_estudio(estudiante_id, clase_realizada_id, membresia_id?)
--   - congelar_membresia(membresia_id, desde, notas?)
--   - descongelar_membresia(membresia_id, hasta?)
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Clases realizadas ───
CREATE TABLE IF NOT EXISTS public.clases_realizadas (
  id            bigserial PRIMARY KEY,
  fecha         date NOT NULL DEFAULT current_date,
  hora_inicio   time,
  nombre        text NOT NULL DEFAULT '',     -- "Hatha 7am", "Vinyasa noche", lo que ponga Sofía
  capacidad     int,                          -- opcional, informativo
  notas         text DEFAULT '',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clases_realizadas_fecha_idx ON public.clases_realizadas(fecha DESC);

ALTER TABLE public.clases_realizadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clases_realizadas_admin" ON public.clases_realizadas;
CREATE POLICY "clases_realizadas_admin" ON public.clases_realizadas
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 2. Asistencia ───
CREATE TABLE IF NOT EXISTS public.asistencia_estudio (
  id                 bigserial PRIMARY KEY,
  estudiante_id      bigint NOT NULL REFERENCES public.estudiantes_estudio(id) ON DELETE CASCADE,
  clase_realizada_id bigint NOT NULL REFERENCES public.clases_realizadas(id)   ON DELETE CASCADE,
  membresia_id       bigint REFERENCES public.membresias(id) ON DELETE SET NULL,
  presente           boolean NOT NULL DEFAULT true,
  notas              text DEFAULT '',
  created_at         timestamptz DEFAULT now(),
  UNIQUE (estudiante_id, clase_realizada_id)
);

CREATE INDEX IF NOT EXISTS asistencia_estudio_clase_idx ON public.asistencia_estudio(clase_realizada_id);
CREATE INDEX IF NOT EXISTS asistencia_estudio_estudiante_idx ON public.asistencia_estudio(estudiante_id);
CREATE INDEX IF NOT EXISTS asistencia_estudio_membresia_idx ON public.asistencia_estudio(membresia_id);

ALTER TABLE public.asistencia_estudio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asistencia_estudio_admin" ON public.asistencia_estudio;
CREATE POLICY "asistencia_estudio_admin" ON public.asistencia_estudio
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- Trigger AFTER INSERT: si la asistencia tiene membresia_id y es paquete
-- (clases_totales no null), incrementar clases_usadas.
CREATE OR REPLACE FUNCTION public.after_insert_asistencia_estudio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.presente IS TRUE AND NEW.membresia_id IS NOT NULL THEN
    UPDATE public.membresias
       SET clases_usadas = clases_usadas + 1
     WHERE id = NEW.membresia_id
       AND clases_totales IS NOT NULL;       -- solo paquetes
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asistencia_estudio_after_insert ON public.asistencia_estudio;
CREATE TRIGGER asistencia_estudio_after_insert
  AFTER INSERT ON public.asistencia_estudio
  FOR EACH ROW EXECUTE FUNCTION public.after_insert_asistencia_estudio();

-- Trigger AFTER DELETE: revertir el contador (por si Sofía borra una asistencia).
CREATE OR REPLACE FUNCTION public.after_delete_asistencia_estudio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.presente IS TRUE AND OLD.membresia_id IS NOT NULL THEN
    UPDATE public.membresias
       SET clases_usadas = GREATEST(0, clases_usadas - 1)
     WHERE id = OLD.membresia_id
       AND clases_totales IS NOT NULL;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS asistencia_estudio_after_delete ON public.asistencia_estudio;
CREATE TRIGGER asistencia_estudio_after_delete
  AFTER DELETE ON public.asistencia_estudio
  FOR EACH ROW EXECUTE FUNCTION public.after_delete_asistencia_estudio();

-- ─── 3. Congelaciones ───
-- Una fila por episodio de pausa. `hasta` IS NULL = membresía congelada
-- actualmente. Al cerrar (descongelar) se calcula dias_extension y se
-- extiende fecha_fin de la membresía.
CREATE TABLE IF NOT EXISTS public.congelaciones_membresia (
  id              bigserial PRIMARY KEY,
  membresia_id    bigint NOT NULL REFERENCES public.membresias(id) ON DELETE CASCADE,
  desde           date NOT NULL,
  hasta           date,                        -- NULL = activamente congelada
  dias_extension  int,                         -- = (hasta - desde), calculado al cerrar
  notas           text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS congelaciones_membresia_idx ON public.congelaciones_membresia(membresia_id);
-- Evitar dos congelaciones abiertas para la misma membresía
CREATE UNIQUE INDEX IF NOT EXISTS congelaciones_una_abierta
  ON public.congelaciones_membresia(membresia_id)
  WHERE hasta IS NULL;

ALTER TABLE public.congelaciones_membresia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "congelaciones_admin" ON public.congelaciones_membresia;
CREATE POLICY "congelaciones_admin" ON public.congelaciones_membresia
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 4. RPC: marcar asistencia ───
-- Si no se pasa membresia_id, intenta autodetectar la membresía activa
-- de la estudiante (la más reciente con estado='activa' y fecha_fin >= fecha
-- de la clase). Idempotente: si ya existe, no duplica.
CREATE OR REPLACE FUNCTION public.marcar_asistencia_estudio(
  p_estudiante_id      bigint,
  p_clase_realizada_id bigint,
  p_membresia_id       bigint DEFAULT NULL,
  p_presente           boolean DEFAULT true,
  p_notas              text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id          bigint;
  v_existente   bigint;
  v_clase_fecha date;
  v_membresia   bigint := p_membresia_id;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- ¿Ya hay asistencia para esta (estudiante, clase)?
  SELECT id INTO v_existente FROM public.asistencia_estudio
   WHERE estudiante_id = p_estudiante_id AND clase_realizada_id = p_clase_realizada_id;
  IF v_existente IS NOT NULL THEN
    -- Update presente/notas si difiere; el trigger NO se dispara en UPDATE,
    -- así que mantenemos el contador como estaba.
    UPDATE public.asistencia_estudio
       SET presente = p_presente, notas = coalesce(p_notas, notas)
     WHERE id = v_existente;
    RETURN jsonb_build_object('ok', true, 'id', v_existente, 'updated', true);
  END IF;

  -- Auto-detectar membresía si no la pasaron
  IF v_membresia IS NULL THEN
    SELECT fecha INTO v_clase_fecha FROM public.clases_realizadas WHERE id = p_clase_realizada_id;
    SELECT id INTO v_membresia
      FROM public.membresias
     WHERE estudiante_id = p_estudiante_id
       AND estado = 'activa'
       AND fecha_inicio <= coalesce(v_clase_fecha, current_date)
       AND fecha_fin    >= coalesce(v_clase_fecha, current_date)
     ORDER BY fecha_inicio DESC
     LIMIT 1;
  END IF;

  INSERT INTO public.asistencia_estudio (estudiante_id, clase_realizada_id, membresia_id, presente, notas)
  VALUES (p_estudiante_id, p_clase_realizada_id, v_membresia, p_presente, coalesce(p_notas, ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'membresia_id', v_membresia);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_asistencia_estudio(bigint, bigint, bigint, boolean, text) TO authenticated;

-- ─── 5. RPC: congelar membresía ───
CREATE OR REPLACE FUNCTION public.congelar_membresia(
  p_membresia_id bigint,
  p_desde        date DEFAULT NULL,
  p_notas        text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing bigint;
  v_id       bigint;
  v_desde    date := coalesce(p_desde, current_date);
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- ¿Ya está congelada?
  SELECT id INTO v_existing FROM public.congelaciones_membresia
   WHERE membresia_id = p_membresia_id AND hasta IS NULL
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Membresía ya está congelada');
  END IF;

  INSERT INTO public.congelaciones_membresia (membresia_id, desde, notas)
  VALUES (p_membresia_id, v_desde, coalesce(p_notas, ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'desde', v_desde);
END;
$$;

GRANT EXECUTE ON FUNCTION public.congelar_membresia(bigint, date, text) TO authenticated;

-- ─── 6. RPC: descongelar membresía ───
-- Cierra la congelación abierta con `hasta` (default hoy), calcula días y
-- extiende fecha_fin de la membresía sumando esos días.
CREATE OR REPLACE FUNCTION public.descongelar_membresia(
  p_membresia_id bigint,
  p_hasta        date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cong       RECORD;
  v_hasta      date := coalesce(p_hasta, current_date);
  v_dias       int;
  v_nueva_fin  date;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_cong FROM public.congelaciones_membresia
   WHERE membresia_id = p_membresia_id AND hasta IS NULL
   LIMIT 1;
  IF v_cong.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Membresía no está congelada');
  END IF;

  v_dias := GREATEST(0, (v_hasta - v_cong.desde));

  -- Cerrar la congelación
  UPDATE public.congelaciones_membresia
     SET hasta = v_hasta, dias_extension = v_dias
   WHERE id = v_cong.id;

  -- Extender fecha_fin de la membresía
  UPDATE public.membresias
     SET fecha_fin = fecha_fin + v_dias
   WHERE id = p_membresia_id
   RETURNING fecha_fin INTO v_nueva_fin;

  RETURN jsonb_build_object('ok', true, 'dias', v_dias, 'nueva_fecha_fin', v_nueva_fin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.descongelar_membresia(bigint, date) TO authenticated;
