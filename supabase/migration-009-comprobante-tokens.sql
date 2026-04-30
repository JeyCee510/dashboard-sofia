-- ─────────────────────────────────────────────────────────────────────────
-- Migración 009 · Tokens únicos para comprobantes por persona
--
-- Cada lead/estudiante puede tener un link único reusable para subir
-- comprobantes. La persona que abre el link no necesita poner su nombre,
-- el comprobante queda automáticamente asociado a su ficha.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comprobante_tokens (
  token              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumna_id          bigint REFERENCES public.alumnas(id) ON DELETE CASCADE,
  lead_id            bigint REFERENCES public.leads(id) ON DELETE CASCADE,
  nombre_snapshot    text NOT NULL,
  contacto_snapshot  text,
  created_at         timestamptz DEFAULT now(),
  CHECK (alumna_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS comprobante_tokens_alumna_idx ON public.comprobante_tokens(alumna_id);
CREATE INDEX IF NOT EXISTS comprobante_tokens_lead_idx ON public.comprobante_tokens(lead_id);

ALTER TABLE public.comprobante_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comprobante_tokens_admin" ON public.comprobante_tokens;
CREATE POLICY "comprobante_tokens_admin" ON public.comprobante_tokens
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── RPC: crear/obtener token (admin only) ───
CREATE OR REPLACE FUNCTION public.crear_comprobante_token(
  p_alumna_id bigint DEFAULT NULL,
  p_lead_id bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  existing_token uuid;
  new_token uuid;
  nombre text;
  contacto text;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_alumna_id IS NULL AND p_lead_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar alumna_id o lead_id';
  END IF;

  -- Reusar token existente si lo hay
  IF p_alumna_id IS NOT NULL THEN
    SELECT token INTO existing_token FROM public.comprobante_tokens WHERE alumna_id = p_alumna_id ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT token INTO existing_token FROM public.comprobante_tokens WHERE lead_id = p_lead_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF existing_token IS NOT NULL THEN
    RETURN existing_token;
  END IF;

  -- Snapshot de nombre/contacto
  IF p_alumna_id IS NOT NULL THEN
    SELECT a.nombre, COALESCE(a.tel, a.instagram, '')
      INTO nombre, contacto
      FROM public.alumnas a WHERE a.id = p_alumna_id;
  ELSE
    SELECT l.nombre, COALESCE(l.tel, l.instagram, '')
      INTO nombre, contacto
      FROM public.leads l WHERE l.id = p_lead_id;
  END IF;

  IF nombre IS NULL THEN
    RAISE EXCEPTION 'Persona no encontrada';
  END IF;

  INSERT INTO public.comprobante_tokens (alumna_id, lead_id, nombre_snapshot, contacto_snapshot)
  VALUES (p_alumna_id, p_lead_id, nombre, contacto)
  RETURNING token INTO new_token;

  RETURN new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_comprobante_token(bigint, bigint) TO authenticated;

-- ─── RPC: obtener info del token (anon) ───
CREATE OR REPLACE FUNCTION public.obtener_comprobante_token(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nombre', t.nombre_snapshot,
    'contacto', t.contacto_snapshot,
    'tipo_persona', CASE WHEN t.alumna_id IS NOT NULL THEN 'estudiante' WHEN t.lead_id IS NOT NULL THEN 'lead' ELSE NULL END
  )
  FROM public.comprobante_tokens t
  WHERE t.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_comprobante_token(uuid) TO anon, authenticated;

-- ─── RPC: subir comprobante con token (anon) ───
CREATE OR REPLACE FUNCTION public.subir_comprobante_con_token(
  p_token uuid,
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
  tk RECORD;
  new_id bigint;
BEGIN
  SELECT * INTO tk FROM public.comprobante_tokens WHERE token = p_token LIMIT 1;
  IF tk.token IS NULL THEN
    RETURN jsonb_build_object('error', 'Link inválido');
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('error', 'Falta archivo');
  END IF;

  INSERT INTO public.comprobantes_pago (
    nombre_cliente, contacto, monto, fecha_pago, notas,
    storage_path, archivo_nombre, archivo_tipo,
    alumna_id, lead_id
  )
  VALUES (
    tk.nombre_snapshot, COALESCE(tk.contacto_snapshot, ''),
    p_monto, p_fecha_pago, COALESCE(p_notas, ''),
    p_storage_path, p_archivo_nombre, p_archivo_tipo,
    tk.alumna_id, tk.lead_id
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subir_comprobante_con_token(uuid, numeric, date, text, text, text, text) TO anon, authenticated;
