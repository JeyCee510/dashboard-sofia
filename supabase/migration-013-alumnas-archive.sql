-- ─────────────────────────────────────────────────────────────────────────
-- Migración 013 · Papelera de alumnas borradas
--
-- Mismo patrón que leads_archive (migración 007). Cuando se borra una
-- alumna, se archiva por si fue por error. Al restaurar, vuelve como
-- LEAD (no como alumna), porque si Sofía borró la alumna, posiblemente
-- la formación con esa persona no avanzó. Re-inscribirla como estudiante
-- es una decisión que se toma a posteriori (vía "Convertir lead a estudiante").
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alumnas_archive (
  id            bigint PRIMARY KEY,
  nombre        text,
  iniciales     text,
  tel           text,
  instagram     text,
  pago          text,
  pagado        numeric,
  total         numeric,
  bono_silla    boolean,
  notas         text,
  inscrita      text,
  avatar        text,
  tipo_inscripcion text,
  encuentros_asistir integer[],
  created_at    timestamptz,
  updated_at    timestamptz,
  deleted_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alumnas_archive_deleted_idx ON public.alumnas_archive(deleted_at DESC);

ALTER TABLE public.alumnas_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alumnas_archive_admin" ON public.alumnas_archive;
CREATE POLICY "alumnas_archive_admin" ON public.alumnas_archive
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- Trigger: copiar alumna a archive antes de borrarla
CREATE OR REPLACE FUNCTION public.archive_alumna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.alumnas_archive (
    id, nombre, iniciales, tel, instagram, pago, pagado, total, bono_silla,
    notas, inscrita, avatar, tipo_inscripcion, encuentros_asistir,
    created_at, updated_at, deleted_at
  )
  VALUES (
    OLD.id, OLD.nombre, OLD.iniciales, OLD.tel, OLD.instagram, OLD.pago,
    OLD.pagado, OLD.total, OLD.bono_silla, OLD.notas, OLD.inscrita,
    OLD.avatar, OLD.tipo_inscripcion, OLD.encuentros_asistir,
    OLD.created_at, OLD.updated_at, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre, tel = EXCLUDED.tel, instagram = EXCLUDED.instagram,
    pago = EXCLUDED.pago, pagado = EXCLUDED.pagado, total = EXCLUDED.total,
    bono_silla = EXCLUDED.bono_silla, notas = EXCLUDED.notas,
    inscrita = EXCLUDED.inscrita, avatar = EXCLUDED.avatar,
    tipo_inscripcion = EXCLUDED.tipo_inscripcion,
    encuentros_asistir = EXCLUDED.encuentros_asistir,
    deleted_at = now();
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS alumnas_archive_trg ON public.alumnas;
CREATE TRIGGER alumnas_archive_trg
  BEFORE DELETE ON public.alumnas
  FOR EACH ROW EXECUTE FUNCTION public.archive_alumna();

-- RPC: restaurar como LEAD (no vuelve como alumna).
-- Toma datos del archive, los inserta en leads, borra del archive.
CREATE OR REPLACE FUNCTION public.restaurar_alumna_como_lead(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  archived RECORD;
  new_lead_id bigint;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO archived FROM public.alumnas_archive WHERE id = p_id LIMIT 1;
  IF archived.id IS NULL THEN
    RETURN jsonb_build_object('error', 'No existe en archivo');
  END IF;

  -- Insertar como nuevo lead. NO reusamos el id (alumna y lead viven en
  -- tablas separadas con su propia secuencia).
  INSERT INTO public.leads (nombre, tel, instagram, fuente, estado, mensaje)
  VALUES (
    archived.nombre,
    archived.tel,
    archived.instagram,
    'referido',
    'nuevo',
    'Restaurada desde papelera (era estudiante)'
  )
  RETURNING id INTO new_lead_id;

  -- Quitar del archive
  DELETE FROM public.alumnas_archive WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'lead_id', new_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restaurar_alumna_como_lead(bigint) TO authenticated;
