-- ─────────────────────────────────────────────────────────────────────────
-- Migración 012 · Bucket `material` para PDFs/recursos compartibles
--
-- Bucket público de lectura: cualquiera con el link puede ver el archivo
-- (PDF del programa, contrato, etc). Solo authenticated puede subir/actualizar.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('material', 'material', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Lectura pública (el bucket ya es public=true pero la policy lo deja explícito)
DROP POLICY IF EXISTS "material_public_read" ON storage.objects;
CREATE POLICY "material_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'material');

-- Upload solo authenticated
DROP POLICY IF EXISTS "material_auth_upload" ON storage.objects;
CREATE POLICY "material_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'material');

-- Update solo authenticated (para sobrescribir el mismo archivo)
DROP POLICY IF EXISTS "material_auth_update" ON storage.objects;
CREATE POLICY "material_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'material')
  WITH CHECK (bucket_id = 'material');

-- Delete solo authenticated
DROP POLICY IF EXISTS "material_auth_delete" ON storage.objects;
CREATE POLICY "material_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'material');
