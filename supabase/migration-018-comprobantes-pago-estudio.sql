-- ─────────────────────────────────────────────────────────────────────────
-- Migración 018 · Comprobantes de pago del módulo Estudio
--
-- Espejo de `comprobantes_pago` (migración 008) pero atado al dominio
-- estudio: FKs a estudiantes_estudio / membresias / pagos_estudio.
--
-- ¿Por qué tabla separada y no extender comprobantes_pago?
--   - El dominio estudio vive en tablas paralelas (estudiantes_estudio,
--     no alumnas). Mantener simetría hace el código más legible.
--   - Si más adelante quieres reportes unificados, un VIEW
--     `comprobantes_unificados` lo resuelve sin migrar datos.
--
-- Reusa:
--   - Bucket Storage 'comprobantes' (ya creado en migración 008)
--   - Policies de Storage existentes (anon INSERT, authorized SELECT/DELETE)
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Tabla comprobantes_pago_estudio ───
CREATE TABLE IF NOT EXISTS public.comprobantes_pago_estudio (
  id              bigserial PRIMARY KEY,
  -- Identificación del cliente (al subir, puede no estar aún en BD)
  nombre_cliente  text NOT NULL,
  contacto        text,                          -- tel o IG en texto libre
  monto           numeric(10,2),
  fecha_pago      date,
  forma           text DEFAULT 'transferencia'   -- transferencia | efectivo | payphone | canje
                  CHECK (forma IN ('transferencia','efectivo','payphone','canje')),
  notas           text DEFAULT '',
  -- Archivo en Supabase Storage (mismo bucket 'comprobantes')
  storage_path    text NOT NULL,
  archivo_nombre  text,
  archivo_tipo    text,
  -- Asociación posterior cuando Sofía valida
  estudiante_id   bigint REFERENCES public.estudiantes_estudio(id) ON DELETE SET NULL,
  membresia_id    bigint REFERENCES public.membresias(id)          ON DELETE SET NULL,
  pago_id         bigint REFERENCES public.pagos_estudio(id)       ON DELETE SET NULL,
  -- Estado
  estado          text DEFAULT 'pendiente'       -- pendiente | validado | rechazado
                  CHECK (estado IN ('pendiente','validado','rechazado')),
  validado_at     timestamptz,
  validado_notas  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comprobantes_estudio_estado_idx ON public.comprobantes_pago_estudio(estado);
CREATE INDEX IF NOT EXISTS comprobantes_estudio_created_idx ON public.comprobantes_pago_estudio(created_at DESC);
CREATE INDEX IF NOT EXISTS comprobantes_estudio_estudiante_idx ON public.comprobantes_pago_estudio(estudiante_id);

ALTER TABLE public.comprobantes_pago_estudio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comprobantes_estudio_admin" ON public.comprobantes_pago_estudio;
CREATE POLICY "comprobantes_estudio_admin" ON public.comprobantes_pago_estudio
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 2. RPC pública: subir comprobante (callable por anon) ───
-- Mismo patrón que `subir_comprobante` (formación).
CREATE OR REPLACE FUNCTION public.subir_comprobante_estudio(
  p_nombre_cliente text,
  p_contacto       text,
  p_monto          numeric,
  p_fecha_pago     date,
  p_forma          text,
  p_notas          text,
  p_storage_path   text,
  p_archivo_nombre text,
  p_archivo_tipo   text
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

  INSERT INTO public.comprobantes_pago_estudio (
    nombre_cliente, contacto, monto, fecha_pago, forma, notas,
    storage_path, archivo_nombre, archivo_tipo
  )
  VALUES (
    trim(p_nombre_cliente),
    trim(coalesce(p_contacto, '')),
    p_monto,
    p_fecha_pago,
    coalesce(p_forma, 'transferencia'),
    coalesce(p_notas, ''),
    p_storage_path,
    p_archivo_nombre,
    p_archivo_tipo
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subir_comprobante_estudio(text, text, numeric, date, text, text, text, text, text) TO anon, authenticated;

-- ─── 3. RPC: validar comprobante (admin) ───
-- Lo asocia a estudiante (y opcionalmente membresía), crea el pago_estudio
-- correspondiente y guarda la FK pago_id para auto-reverso al borrar.
CREATE OR REPLACE FUNCTION public.validar_comprobante_estudio(
  p_id            bigint,
  p_estudiante_id bigint,
  p_membresia_id  bigint DEFAULT NULL,
  p_monto         numeric DEFAULT NULL,
  p_forma         text DEFAULT NULL,
  p_fecha_pago    date DEFAULT NULL,
  p_notas         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_comp     RECORD;
  v_pago_id  bigint;
  v_monto    numeric;
  v_forma    text;
  v_fecha    date;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_comp FROM public.comprobantes_pago_estudio WHERE id = p_id;
  IF v_comp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Comprobante no existe');
  END IF;
  IF v_comp.estado <> 'pendiente' THEN
    RETURN jsonb_build_object('error', 'Comprobante ya procesado');
  END IF;

  -- Defaults: usar lo que vino en el upload si admin no lo cambió
  v_monto := coalesce(p_monto, v_comp.monto);
  v_forma := coalesce(p_forma, v_comp.forma, 'transferencia');
  v_fecha := coalesce(p_fecha_pago, v_comp.fecha_pago, current_date);

  IF v_monto IS NULL OR v_monto <= 0 THEN
    RETURN jsonb_build_object('error', 'Monto inválido');
  END IF;

  -- Crear el pago_estudio
  INSERT INTO public.pagos_estudio (estudiante_id, membresia_id, monto, forma, fecha, comprobante_url, notas)
  VALUES (
    p_estudiante_id,
    p_membresia_id,
    v_monto,
    v_forma,
    v_fecha,
    v_comp.storage_path,
    coalesce(p_notas, v_comp.notas, '')
  )
  RETURNING id INTO v_pago_id;

  -- Marcar comprobante como validado y enlazarlo al pago + estudiante
  UPDATE public.comprobantes_pago_estudio
     SET estado = 'validado',
         validado_at = now(),
         validado_notas = coalesce(p_notas, validado_notas),
         estudiante_id = p_estudiante_id,
         membresia_id = coalesce(p_membresia_id, membresia_id),
         pago_id = v_pago_id,
         monto = v_monto,
         forma = v_forma,
         fecha_pago = v_fecha
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'pago_id', v_pago_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_comprobante_estudio(bigint, bigint, bigint, numeric, text, date, text) TO authenticated;

-- ─── 4. RPC: rechazar comprobante (admin) ───
CREATE OR REPLACE FUNCTION public.rechazar_comprobante_estudio(
  p_id    bigint,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.comprobantes_pago_estudio
     SET estado = 'rechazado',
         validado_at = now(),
         validado_notas = coalesce(p_notas, validado_notas)
   WHERE id = p_id AND estado = 'pendiente';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Comprobante no existe o ya procesado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechazar_comprobante_estudio(bigint, text) TO authenticated;

-- ─── 5. Auto-reverso del pago al borrar comprobante validado ───
-- Si Sofía borra un comprobante que ya validó, también se borra el pago
-- creado por la validación (igual patrón que migración 014 para formación).
CREATE OR REPLACE FUNCTION public.before_delete_comprobante_estudio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.pago_id IS NOT NULL THEN
    DELETE FROM public.pagos_estudio WHERE id = OLD.pago_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS comprobantes_estudio_before_delete ON public.comprobantes_pago_estudio;
CREATE TRIGGER comprobantes_estudio_before_delete
  BEFORE DELETE ON public.comprobantes_pago_estudio
  FOR EACH ROW EXECUTE FUNCTION public.before_delete_comprobante_estudio();
