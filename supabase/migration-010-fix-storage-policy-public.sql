-- ─────────────────────────────────────────────────────────────────────────
-- Migración 010 · Fix policy de Storage para que también acepte
-- usuarios authenticated.
--
-- Problema: la policy `comprobantes_anon_upload` era `TO anon`. Si Sofía
-- o Juan tienen sesión Supabase activa en el mismo browser y abren un
-- link `/comprobante/<token>`, su role es `authenticated`, no `anon`, y
-- el upload del archivo es rechazado por RLS.
--
-- Fix: usar `TO public` (cubre anon + authenticated).
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "comprobantes_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_upload" ON storage.objects;

CREATE POLICY "comprobantes_upload" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'comprobantes');
