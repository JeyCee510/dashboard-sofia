-- ─────────────────────────────────────────────────────────────────────────
-- Migración 011 · Tabla eventos_alumna
--
-- Registra cualquier movimiento trazable en la vida de una alumna:
-- inscripción, asignación/renuncia de silla, cambio de tipo, etc.
-- Los pagos se siguen registrando en `pagos` (audit financiero limpio);
-- el timeline UI mergea ambas tablas y las muestra cronológicamente.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eventos_alumna (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumna_id   bigint NOT NULL REFERENCES alumnas(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  -- 'inscrita' | 'inscrita_desde_lead' | 'silla_asignada_auto' | 'silla_asignada_manual'
  -- 'silla_renunciada' | 'tipo_cambiado' | 'nota'
  titulo      text,
  subtitulo   text,
  monto       numeric,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_alumna_alumna_idx
  ON eventos_alumna(alumna_id, created_at DESC);

ALTER TABLE eventos_alumna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_alumna_select" ON eventos_alumna;
DROP POLICY IF EXISTS "eventos_alumna_insert" ON eventos_alumna;
DROP POLICY IF EXISTS "eventos_alumna_delete" ON eventos_alumna;

CREATE POLICY "eventos_alumna_select" ON eventos_alumna
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "eventos_alumna_insert" ON eventos_alumna
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "eventos_alumna_delete" ON eventos_alumna
  FOR DELETE TO authenticated USING (true);
