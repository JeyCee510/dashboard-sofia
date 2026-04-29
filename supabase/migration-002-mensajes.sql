-- ─────────────────────────────────────────────────────────────────────────
-- Migración 002 · Tabla mensajes
-- Para WhatsApp / Instagram / SMS recientes mostrados en CRM y home.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mensajes (
  id            bigserial PRIMARY KEY,
  alumna_id     bigint REFERENCES public.alumnas(id) ON DELETE SET NULL,
  alumna_nombre text NOT NULL,
  preview       text NOT NULL,
  tiempo        text DEFAULT 'ahora',
  sin_leer      boolean DEFAULT true,
  es_lead       boolean DEFAULT false,
  canal         text DEFAULT 'whatsapp',  -- whatsapp | instagram | sms | otro
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajes_all" ON public.mensajes;
CREATE POLICY "mensajes_all" ON public.mensajes
  FOR ALL USING (public.is_authorized()) WITH CHECK (public.is_authorized());

CREATE INDEX IF NOT EXISTS mensajes_sin_leer_idx ON public.mensajes(sin_leer) WHERE sin_leer = true;
CREATE INDEX IF NOT EXISTS mensajes_created_idx ON public.mensajes(created_at DESC);
