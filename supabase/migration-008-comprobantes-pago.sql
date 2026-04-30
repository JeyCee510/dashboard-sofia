-- ─────────────────────────────────────────────────────────────────────────
-- Migración 008 · Comprobantes de pago + preservar preinscripciones
--
-- 1. Tabla `comprobantes_pago` con FK opcional a alumnas/leads.
-- 2. Bucket Storage 'comprobantes' (privado). Anon puede INSERT, solo
--    authorized puede SELECT/UPDATE/DELETE.
-- 3. RPC pública `subir_comprobante` que recibe metadata + storage path.
-- 4. Preinscripción: FK ON DELETE SET NULL + snapshot del nombre para que
--    quede registrada aunque el lead/alumna se borre.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Tabla comprobantes_pago ───
CREATE TABLE IF NOT EXISTS public.comprobantes_pago (
  id              bigserial PRIMARY KEY,
  -- Identificación del cliente (al subir, todavía no sabe si es lead o alumna)
  nombre_cliente  text NOT NULL,
  contacto        text,                          -- tel o IG en texto libre
  monto           numeric(10,2),
  fecha_pago      date,
  notas           text DEFAULT '',
  -- Archivo en Supabase Storage
  storage_path    text NOT NULL,                 -- ej. "comprobantes/uuid.jpg"
  archivo_nombre  text,                          -- nombre original
  archivo_tipo    text,                          -- mime
  -- Asociación posterior (cuando Sofía valida)
  alumna_id       bigint REFERENCES public.alumnas(id) ON DELETE SET NULL,
  lead_id         bigint REFERENCES public.leads(id)   ON DELETE SET NULL,
  -- Estado
  estado          text DEFAULT 'pendiente',      -- pendiente | validado | rechazado
  validado_at     timestamptz,
  validado_notas  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comprobantes_estado_idx ON public.comprobantes_pago(estado);
CREATE INDEX IF NOT EXISTS comprobantes_created_idx ON public.comprobantes_pago(created_at DESC);

ALTER TABLE public.comprobantes_pago ENABLE ROW LEVEL SECURITY;

-- Solo admin puede SELECT/UPDATE/DELETE; INSERT permitido por RPC
DROP POLICY IF EXISTS "comprobantes_admin_all" ON public.comprobantes_pago;
CREATE POLICY "comprobantes_admin_all" ON public.comprobantes_pago
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 2. Storage bucket ───
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: anon puede INSERT (subir) en este bucket
DROP POLICY IF EXISTS "comprobantes_anon_upload" ON storage.objects;
CREATE POLICY "comprobantes_anon_upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'comprobantes');

-- Policy: authenticated authorized puede leer/borrar
DROP POLICY IF EXISTS "comprobantes_admin_read" ON storage.objects;
CREATE POLICY "comprobantes_admin_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprobantes' AND public.is_authorized()
  );

DROP POLICY IF EXISTS "comprobantes_admin_delete" ON storage.objects;
CREATE POLICY "comprobantes_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprobantes' AND public.is_authorized()
  );

-- ─── 3. RPC pública para subir comprobante (después del upload) ───
CREATE OR REPLACE FUNCTION public.subir_comprobante(
  p_nombre_cliente text,
  p_contacto text,
  p_monto numeric,
  p_fecha_pago date,
  p_notas text,
  p_storage_path text,
  p_archivo_nombre text,
  p_archivo_tipo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id bigint;
BEGIN
  IF p_nombre_cliente IS NULL OR length(trim(p_nombre_cliente)) = 0 THEN
    RETURN jsonb_build_object('error', 'Falta nombre del cliente');
  END IF;
  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('error', 'Falta archivo');
  END IF;

  INSERT INTO public.comprobantes_pago (
    nombre_cliente, contacto, monto, fecha_pago, notas,
    storage_path, archivo_nombre, archivo_tipo
  )
  VALUES (
    trim(p_nombre_cliente), trim(coalesce(p_contacto, '')), p_monto, p_fecha_pago,
    coalesce(p_notas, ''), p_storage_path, p_archivo_nombre, p_archivo_tipo
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subir_comprobante(text, text, numeric, date, text, text, text, text) TO anon, authenticated;

-- ─── 4. Preservar preinscripciones cuando se borra el lead/alumna ───
-- a) Snapshot del nombre del lead para que persista
ALTER TABLE public.preinscripcion
  ADD COLUMN IF NOT EXISTS lead_nombre_snapshot text;

-- b) Cambiar FK de CASCADE a SET NULL
ALTER TABLE public.preinscripcion
  DROP CONSTRAINT IF EXISTS preinscripcion_lead_id_fkey;
ALTER TABLE public.preinscripcion
  ADD CONSTRAINT preinscripcion_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.preinscripcion
  DROP CONSTRAINT IF EXISTS preinscripcion_alumna_id_fkey;
ALTER TABLE public.preinscripcion
  ADD CONSTRAINT preinscripcion_alumna_id_fkey
  FOREIGN KEY (alumna_id) REFERENCES public.alumnas(id) ON DELETE SET NULL;

-- c) Quitar el CHECK que requería lead_id O alumna_id (porque ahora pueden quedar ambos NULL)
ALTER TABLE public.preinscripcion
  DROP CONSTRAINT IF EXISTS preinscripcion_check;
-- nota: el check se llamaba diferente, intentamos varios nombres
DO $$ BEGIN
  ALTER TABLE public.preinscripcion DROP CONSTRAINT preinscripcion_lead_id_alumna_id_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- d) Backfill snapshot con el nombre actual del lead
UPDATE public.preinscripcion p
   SET lead_nombre_snapshot = l.nombre
  FROM public.leads l
 WHERE p.lead_id = l.id AND p.lead_nombre_snapshot IS NULL;

-- e) Actualizar la RPC `crear_preinscripcion` para llenar el snapshot
CREATE OR REPLACE FUNCTION public.crear_preinscripcion(p_lead_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  existing_token uuid;
  new_token uuid;
  lead_name text;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT nombre INTO lead_name FROM public.leads WHERE id = p_lead_id;

  SELECT token INTO existing_token
  FROM public.preinscripcion
  WHERE lead_id = p_lead_id AND estado = 'pendiente'
  ORDER BY created_at DESC LIMIT 1;

  IF existing_token IS NOT NULL THEN
    RETURN existing_token;
  END IF;

  INSERT INTO public.preinscripcion (lead_id, lead_nombre_snapshot, token)
  VALUES (p_lead_id, lead_name, gen_random_uuid())
  RETURNING token INTO new_token;

  RETURN new_token;
END;
$$;

-- f) Actualizar `obtener_preinscripcion` para usar el snapshot si el lead ya no existe
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
    'lead_nombre', coalesce(l.nombre, p.lead_nombre_snapshot)
  ) INTO result
  FROM public.preinscripcion p
  LEFT JOIN public.leads l ON l.id = p.lead_id
  WHERE p.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;
