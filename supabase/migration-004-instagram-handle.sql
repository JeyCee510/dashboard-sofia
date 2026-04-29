-- ─────────────────────────────────────────────────────────────────────────
-- Migración 004 · Campo Instagram opcional en alumnas y leads
-- Para que Sofía pueda escribirles directo a IG desde el dashboard.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.alumnas ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.leads   ADD COLUMN IF NOT EXISTS instagram text;
