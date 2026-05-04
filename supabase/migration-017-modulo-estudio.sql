-- ─────────────────────────────────────────────────────────────────────────
-- Migración 017 · Módulo Estudio Sofía Lira (MVP)
--
-- Hasta ahora el dashboard manejaba SOLO la formación "El Arte de Enseñar
-- Yoga". Ahora añadimos el módulo del estudio (negocio recurrente) con
-- estudiantes con membresías mensuales/paquetes/drop-in y vencimientos.
--
-- Decisiones de modelo:
--   1. Tablas separadas (no extender `alumnas`): el estudio es otro
--      negocio con otras reglas (membresías recurrentes, no una sola
--      formación). Mezclarlas complicaría el dominio.
--   2. Catálogo de planes editable (`planes_catalogo`) con seed de planes
--      típicos. Sofía edita precios/nombres desde Ajustes.
--   3. `membresias` = instancia de plan asignado a estudiante. Renovar
--      crea una nueva membresía (historial completo). La "actual" es la
--      más reciente por fecha_inicio.
--   4. Estado en BD: activa | cancelada. "Vencida" se DERIVA en frontend
--      (fecha_fin < hoy OR clases_usadas >= clases_totales). Esto evita
--      necesitar un cron para marcar vencimientos.
--   5. Paquetes vencen por clases O por fecha (lo primero que ocurra).
--   6. Snapshot del plan en `plan_snapshot` (jsonb) para que editar/borrar
--      un plan no rompa membresías históricas.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Catálogo de planes ───
CREATE TABLE IF NOT EXISTS public.planes_catalogo (
  id              bigserial PRIMARY KEY,
  nombre          text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('mensualidad','paquete','drop_in','trimestral','semestral')),
  precio          numeric(10,2) NOT NULL DEFAULT 0,
  duracion_dias   integer NOT NULL,                  -- 30=mensual, 90=trim, 180=sem, 1=drop-in, paquete=ventana hasta vencer
  num_clases      integer,                           -- null = ilimitado o N/A; numérico para paquetes y planes "X clases/sem"
  descripcion     text DEFAULT '',
  activo          boolean NOT NULL DEFAULT true,     -- false = oculto del wizard pero preserva membresías históricas
  orden           integer NOT NULL DEFAULT 100,      -- para mostrar en UI
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planes_catalogo_activo_orden_idx ON public.planes_catalogo(activo, orden);

-- ─── 2. Estudiantes del estudio ───
-- Separadas de `alumnas` (formación). Mismas convenciones de campos
-- (iniciales, avatar OKLCH) para reusar componentes UI.
CREATE TABLE IF NOT EXISTS public.estudiantes_estudio (
  id                bigserial PRIMARY KEY,
  nombre            text NOT NULL,
  iniciales         text,
  tel               text,
  instagram         text,
  email             text,
  fecha_nacimiento  date,
  notas             text DEFAULT '',
  fecha_alta        date NOT NULL DEFAULT current_date,
  archivada         boolean NOT NULL DEFAULT false,  -- soft-archive (papelera lo veremos en una migración futura si hace falta)
  avatar            text,                            -- color OKLCH precomputado, igual que alumnas
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudiantes_estudio_archivada_idx ON public.estudiantes_estudio(archivada);
CREATE INDEX IF NOT EXISTS estudiantes_estudio_nombre_idx ON public.estudiantes_estudio(lower(nombre));

-- ─── 3. Membresías ───
-- Una compra de plan por una estudiante. Renovar = crear NUEVA fila.
-- La membresía "actual" de una estudiante es la fila con mayor fecha_inicio.
CREATE TABLE IF NOT EXISTS public.membresias (
  id              bigserial PRIMARY KEY,
  estudiante_id   bigint NOT NULL REFERENCES public.estudiantes_estudio(id) ON DELETE CASCADE,
  plan_id         bigint REFERENCES public.planes_catalogo(id) ON DELETE SET NULL,
  plan_snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb, -- {nombre, tipo, precio, duracion_dias, num_clases} al momento de la compra
  fecha_inicio    date NOT NULL DEFAULT current_date,
  fecha_fin       date NOT NULL,                      -- = fecha_inicio + (plan_snapshot->>'duracion_dias')::int
  clases_totales  integer,                            -- snapshot del plan; null = ilimitado
  clases_usadas   integer NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cancelada')),
  notas           text DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membresias_estudiante_idx ON public.membresias(estudiante_id, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS membresias_fecha_fin_idx ON public.membresias(fecha_fin) WHERE estado = 'activa';

-- ─── 4. Pagos del estudio ───
-- Igual estructura que `pagos` (formación) pero apunta a estudiante/membresía.
CREATE TABLE IF NOT EXISTS public.pagos_estudio (
  id              bigserial PRIMARY KEY,
  estudiante_id   bigint NOT NULL REFERENCES public.estudiantes_estudio(id) ON DELETE CASCADE,
  membresia_id    bigint REFERENCES public.membresias(id) ON DELETE SET NULL,
  monto           numeric(10,2) NOT NULL,
  forma           text NOT NULL DEFAULT 'transferencia' CHECK (forma IN ('transferencia','efectivo','payphone','canje')),
  fecha           date NOT NULL DEFAULT current_date,
  comprobante_url text,
  notas           text DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagos_estudio_estudiante_idx ON public.pagos_estudio(estudiante_id, fecha DESC);
CREATE INDEX IF NOT EXISTS pagos_estudio_fecha_idx ON public.pagos_estudio(fecha DESC);
CREATE INDEX IF NOT EXISTS pagos_estudio_forma_idx ON public.pagos_estudio(forma);

-- ─── 5. Triggers updated_at ───
-- (la función set_updated_at() ya debería existir del schema base; si no, la creamos)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planes_catalogo_updated_at ON public.planes_catalogo;
CREATE TRIGGER planes_catalogo_updated_at
  BEFORE UPDATE ON public.planes_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS estudiantes_estudio_updated_at ON public.estudiantes_estudio;
CREATE TRIGGER estudiantes_estudio_updated_at
  BEFORE UPDATE ON public.estudiantes_estudio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS membresias_updated_at ON public.membresias;
CREATE TRIGGER membresias_updated_at
  BEFORE UPDATE ON public.membresias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 6. RLS + policies ───
ALTER TABLE public.planes_catalogo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes_estudio  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membresias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_estudio        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planes_catalogo_admin" ON public.planes_catalogo;
CREATE POLICY "planes_catalogo_admin" ON public.planes_catalogo
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

DROP POLICY IF EXISTS "estudiantes_estudio_admin" ON public.estudiantes_estudio;
CREATE POLICY "estudiantes_estudio_admin" ON public.estudiantes_estudio
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

DROP POLICY IF EXISTS "membresias_admin" ON public.membresias;
CREATE POLICY "membresias_admin" ON public.membresias
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

DROP POLICY IF EXISTS "pagos_estudio_admin" ON public.pagos_estudio;
CREATE POLICY "pagos_estudio_admin" ON public.pagos_estudio
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 7. RPC: crear estudiante con membresía + pago en un solo round-trip ───
-- Onboarding rápido. Atómico: si falla algo, rollback.
CREATE OR REPLACE FUNCTION public.crear_estudiante_con_membresia(
  p_nombre          text,
  p_tel             text DEFAULT NULL,
  p_instagram       text DEFAULT NULL,
  p_email           text DEFAULT NULL,
  p_notas           text DEFAULT '',
  p_avatar          text DEFAULT NULL,
  p_plan_id         bigint DEFAULT NULL,
  p_fecha_inicio    date DEFAULT current_date,
  p_pago_monto      numeric DEFAULT NULL,
  p_pago_forma      text DEFAULT 'transferencia'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estudiante_id   bigint;
  v_membresia_id    bigint;
  v_pago_id         bigint;
  v_plan            RECORD;
  v_fecha_fin       date;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- 1. Crear estudiante
  INSERT INTO public.estudiantes_estudio (nombre, tel, instagram, email, notas, avatar, fecha_alta)
  VALUES (p_nombre, p_tel, p_instagram, p_email, coalesce(p_notas,''), p_avatar, current_date)
  RETURNING id INTO v_estudiante_id;

  -- 2. Si hay plan, crear membresía con snapshot
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.planes_catalogo WHERE id = p_plan_id;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'Plan % no existe', p_plan_id;
    END IF;

    v_fecha_fin := p_fecha_inicio + (v_plan.duracion_dias || ' days')::interval;

    INSERT INTO public.membresias (
      estudiante_id, plan_id, plan_snapshot,
      fecha_inicio, fecha_fin,
      clases_totales, clases_usadas, estado
    )
    VALUES (
      v_estudiante_id, v_plan.id,
      jsonb_build_object(
        'nombre', v_plan.nombre,
        'tipo', v_plan.tipo,
        'precio', v_plan.precio,
        'duracion_dias', v_plan.duracion_dias,
        'num_clases', v_plan.num_clases
      ),
      p_fecha_inicio, v_fecha_fin,
      v_plan.num_clases, 0, 'activa'
    )
    RETURNING id INTO v_membresia_id;
  END IF;

  -- 3. Si hay pago, registrarlo
  IF p_pago_monto IS NOT NULL AND p_pago_monto > 0 THEN
    INSERT INTO public.pagos_estudio (estudiante_id, membresia_id, monto, forma, fecha)
    VALUES (v_estudiante_id, v_membresia_id, p_pago_monto, coalesce(p_pago_forma,'transferencia'), current_date)
    RETURNING id INTO v_pago_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'estudiante_id', v_estudiante_id,
    'membresia_id', v_membresia_id,
    'pago_id', v_pago_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_estudiante_con_membresia(
  text, text, text, text, text, text, bigint, date, numeric, text
) TO authenticated;

-- ─── 8. RPC: renovar membresía ───
-- Crea una NUEVA membresía con un plan dado. La anterior queda en historial.
-- Opcional: registra el pago.
CREATE OR REPLACE FUNCTION public.renovar_membresia(
  p_estudiante_id bigint,
  p_plan_id       bigint,
  p_fecha_inicio  date DEFAULT current_date,
  p_pago_monto    numeric DEFAULT NULL,
  p_pago_forma    text DEFAULT 'transferencia'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_membresia_id  bigint;
  v_pago_id       bigint;
  v_plan          RECORD;
  v_fecha_fin     date;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_plan FROM public.planes_catalogo WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plan % no existe', p_plan_id;
  END IF;

  v_fecha_fin := p_fecha_inicio + (v_plan.duracion_dias || ' days')::interval;

  INSERT INTO public.membresias (
    estudiante_id, plan_id, plan_snapshot,
    fecha_inicio, fecha_fin, clases_totales, clases_usadas, estado
  )
  VALUES (
    p_estudiante_id, v_plan.id,
    jsonb_build_object(
      'nombre', v_plan.nombre,
      'tipo', v_plan.tipo,
      'precio', v_plan.precio,
      'duracion_dias', v_plan.duracion_dias,
      'num_clases', v_plan.num_clases
    ),
    p_fecha_inicio, v_fecha_fin,
    v_plan.num_clases, 0, 'activa'
  )
  RETURNING id INTO v_membresia_id;

  IF p_pago_monto IS NOT NULL AND p_pago_monto > 0 THEN
    INSERT INTO public.pagos_estudio (estudiante_id, membresia_id, monto, forma, fecha)
    VALUES (p_estudiante_id, v_membresia_id, p_pago_monto, coalesce(p_pago_forma,'transferencia'), current_date)
    RETURNING id INTO v_pago_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'membresia_id', v_membresia_id,
    'pago_id', v_pago_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.renovar_membresia(bigint, bigint, date, numeric, text) TO authenticated;

-- ─── 9. Seed: planes típicos de un estudio de yoga en Quito ───
-- Sofía edita precios/nombres desde el módulo de Ajustes (lo construimos
-- en el paso 5 del MVP). Marcamos como activos para que aparezcan en el
-- wizard de onboarding.
INSERT INTO public.planes_catalogo (nombre, tipo, precio, duracion_dias, num_clases, descripcion, orden)
VALUES
  ('Mensualidad 1x/sem',     'mensualidad', 35.00,  30,  4,    'Una clase por semana durante un mes',                10),
  ('Mensualidad 2x/sem',     'mensualidad', 60.00,  30,  8,    'Dos clases por semana durante un mes',               20),
  ('Mensualidad ilimitada',  'mensualidad', 90.00,  30,  NULL, 'Asistencia ilimitada durante un mes',                30),
  ('Paquete 10 clases',      'paquete',     90.00,  60,  10,   'Diez clases con vigencia de 60 días',                40),
  ('Paquete 20 clases',      'paquete',     160.00, 90,  20,   'Veinte clases con vigencia de 90 días',              50),
  ('Drop-in',                'drop_in',     12.00,  1,   1,    'Una clase suelta, sin compromiso',                   60),
  ('Trimestral ilimitada',   'trimestral',  240.00, 90,  NULL, 'Tres meses ilimitado con descuento',                 70),
  ('Semestral ilimitada',    'semestral',   450.00, 180, NULL, 'Seis meses ilimitado con descuento mayor',           80)
ON CONFLICT DO NOTHING;
