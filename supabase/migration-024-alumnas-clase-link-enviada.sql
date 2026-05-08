-- migration-024-alumnas-clase-link-enviada.sql
-- Permitir que ClaseAbiertaPanel también funcione desde la ficha de alumna.
-- Espejo de leads.clase_link_enviada_at (de migration-022).

ALTER TABLE public.alumnas
  ADD COLUMN IF NOT EXISTS clase_link_enviada_at timestamptz;
