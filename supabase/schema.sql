-- ─────────────────────────────────────────────────────────────────────────
-- Schema · Dashboard Yoga Sofía Lira
-- Single-tenant: una sola "instancia" de datos, accesible por una whitelist
-- de emails (Sofía + Juan Cristóbal admin).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Helper: ¿el usuario autenticado está autorizado? ───
-- En lugar de owner_id por fila, usamos una whitelist en SECURITY DEFINER.
-- Para invitar a otra persona: añadir su email a la lista de abajo y
-- volver a ejecutar este bloque (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.is_authorized()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'email' IN (
    'sofilira@gmail.com',
    'jclira@gmail.com'
  );
$$;

-- ─── 2. Tablas ───

CREATE TABLE IF NOT EXISTS public.alumnas (
  id            bigserial PRIMARY KEY,
  nombre        text NOT NULL,
  iniciales     text,
  tel           text,
  pago          text DEFAULT 'pendiente',         -- 'pronto-pago' | 'completo' | 'parcial' | 'pendiente'
  pagado        numeric(10,2) DEFAULT 0,
  total         numeric(10,2) DEFAULT 640,
  bono_silla    boolean DEFAULT false,
  notas         text DEFAULT '',
  inscrita      text,                              -- texto formateado tipo "14 abr"
  avatar        text,                              -- color OKLCH precomputado
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id            bigserial PRIMARY KEY,
  nombre        text NOT NULL,
  tel           text,
  fuente        text,                              -- instagram | whatsapp | referido | otro
  estado        text DEFAULT 'nuevo',              -- nuevo | interesado | reservado | frío
  mensaje       text DEFAULT '',
  tiempo        text DEFAULT 'ahora',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id            bigserial PRIMARY KEY,
  alumna_id     bigint REFERENCES public.alumnas(id) ON DELETE CASCADE,
  monto         numeric(10,2) NOT NULL,
  tipo          text DEFAULT 'parcial',            -- pronto-pago | reserva | parcial | completo
  fecha         timestamptz DEFAULT now(),
  notas         text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.asistencia (
  id            bigserial PRIMARY KEY,
  alumna_id     bigint REFERENCES public.alumnas(id) ON DELETE CASCADE,
  dia_idx       int NOT NULL,
  presente      boolean NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (alumna_id, dia_idx)
);

CREATE TABLE IF NOT EXISTS public.ajustes (
  id            int PRIMARY KEY DEFAULT 1,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- Insertar fila única de ajustes con defaults si no existe
INSERT INTO public.ajustes (id, data)
VALUES (1, jsonb_build_object(
  'capacidad', 25,
  'precioRegular', 640,
  'precioProntoPago', 484,
  'precioReserva', 200,
  'fechaProntoPago', '10 mayo',
  'ownerName', 'Sofía Lira',
  'studioName', 'Yoga Sofía Lira',
  'lugar', 'Domo Soulspace · Tumbaco',
  'bonoSillaCupos', 6
))
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Triggers updated_at ───

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS alumnas_touch ON public.alumnas;
CREATE TRIGGER alumnas_touch BEFORE UPDATE ON public.alumnas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS leads_touch ON public.leads;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS ajustes_touch ON public.ajustes;
CREATE TRIGGER ajustes_touch BEFORE UPDATE ON public.ajustes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 4. Row Level Security ───

ALTER TABLE public.alumnas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes    ENABLE ROW LEVEL SECURITY;

-- Políticas: cualquier email autorizado puede SELECT/INSERT/UPDATE/DELETE.

-- alumnas
DROP POLICY IF EXISTS "alumnas_all" ON public.alumnas;
CREATE POLICY "alumnas_all" ON public.alumnas
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- leads
DROP POLICY IF EXISTS "leads_all" ON public.leads;
CREATE POLICY "leads_all" ON public.leads
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- pagos
DROP POLICY IF EXISTS "pagos_all" ON public.pagos;
CREATE POLICY "pagos_all" ON public.pagos
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- asistencia
DROP POLICY IF EXISTS "asistencia_all" ON public.asistencia;
CREATE POLICY "asistencia_all" ON public.asistencia
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ajustes
DROP POLICY IF EXISTS "ajustes_all" ON public.ajustes;
CREATE POLICY "ajustes_all" ON public.ajustes
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

-- ─── 5. Índices útiles ───
CREATE INDEX IF NOT EXISTS alumnas_pago_idx     ON public.alumnas(pago);
CREATE INDEX IF NOT EXISTS leads_estado_idx     ON public.leads(estado);
CREATE INDEX IF NOT EXISTS pagos_alumna_idx     ON public.pagos(alumna_id);
CREATE INDEX IF NOT EXISTS asistencia_dia_idx   ON public.asistencia(dia_idx);
