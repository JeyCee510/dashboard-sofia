-- ─────────────────────────────────────────────────────────────────────────
-- Migración 007 · Papelera de leads borrados
--
-- Cuando se borra un lead (manualmente, por voz, o por convertirse a alumna),
-- queremos un registro just-in-case por si se elimina por error. Soft-archive
-- via trigger BEFORE DELETE en `leads`.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads_archive (
  id            bigint PRIMARY KEY,
  nombre        text,
  tel           text,
  instagram     text,
  fuente        text,
  estado        text,
  mensaje       text,
  tiempo        text,
  created_at    timestamptz,
  updated_at    timestamptz,
  deleted_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_archive_deleted_idx ON public.leads_archive(deleted_at DESC);

ALTER TABLE public.leads_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_archive_admin" ON public.leads_archive;
CREATE POLICY "leads_archive_admin" ON public.leads_archive
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- Trigger: copiar lead a archive antes de borrarlo
CREATE OR REPLACE FUNCTION public.archive_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leads_archive (
    id, nombre, tel, instagram, fuente, estado, mensaje, tiempo,
    created_at, updated_at, deleted_at
  )
  VALUES (
    OLD.id, OLD.nombre, OLD.tel, OLD.instagram, OLD.fuente, OLD.estado, OLD.mensaje, OLD.tiempo,
    OLD.created_at, OLD.updated_at, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tel = EXCLUDED.tel,
    instagram = EXCLUDED.instagram,
    fuente = EXCLUDED.fuente,
    estado = EXCLUDED.estado,
    mensaje = EXCLUDED.mensaje,
    tiempo = EXCLUDED.tiempo,
    deleted_at = now();
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS leads_archive_trg ON public.leads;
CREATE TRIGGER leads_archive_trg
  BEFORE DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.archive_lead();

-- RPC para restaurar un lead borrado: reinserta en leads y limpia el archive
CREATE OR REPLACE FUNCTION public.restaurar_lead(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  archived RECORD;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO archived FROM public.leads_archive WHERE id = p_id LIMIT 1;
  IF archived.id IS NULL THEN
    RETURN jsonb_build_object('error', 'No existe en archivo');
  END IF;

  -- Reinsertar en leads (si el id ya existe en leads, actualizar)
  INSERT INTO public.leads (id, nombre, tel, instagram, fuente, estado, mensaje, tiempo, created_at, updated_at)
  VALUES (archived.id, archived.nombre, archived.tel, archived.instagram, archived.fuente, archived.estado, archived.mensaje, archived.tiempo, archived.created_at, now())
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tel = EXCLUDED.tel,
    instagram = EXCLUDED.instagram,
    fuente = EXCLUDED.fuente,
    estado = EXCLUDED.estado,
    mensaje = EXCLUDED.mensaje;

  -- Quitar del archive
  DELETE FROM public.leads_archive WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restaurar_lead(bigint) TO authenticated;
