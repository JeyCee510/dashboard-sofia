-- ─────────────────────────────────────────────────────────────────────────
-- Migración 015 · Actualizar plantillas WhatsApp
--
-- - Quita la plantilla "Cómo reservar $200" (id='rsv')
-- - Agrega "Datos de transferencia" (id='tr') con los datos bancarios reales
-- - Actualiza "Ubicación" (id='ub') con el link de Google Maps
-- ─────────────────────────────────────────────────────────────────────────

UPDATE public.ajustes
SET data = jsonb_set(
  data,
  '{plantillasWA}',
  '[
    {"id":"pgrm","titulo":"Datos del programa","cuerpo":"Hola! Te paso los detalles de la formación: 50 horas, 6-21 junio, sáb y dom de 7:30 a 18:00 en Domo Soulspace, Tumbaco. ¿Quieres que te llame? 🙏"},
    {"id":"tr","titulo":"Datos de transferencia","cuerpo":"Transferencias a:\nSofía Lira\nProdubanco Ahorro #12054049429\nCédula #1709369225\nsofilira@gmail.com\n\nApenas tengas el comprobante mándamelo y reservamos 🌿"},
    {"id":"ub","titulo":"Ubicación","cuerpo":"Domo Soulspace, calle Alfredo Donoso, La Morita, Tumbaco.\nUbicación en Maps: https://maps.app.goo.gl/WrauzvKJot5NbNZF7"},
    {"id":"crn","titulo":"Cronograma","cuerpo":"Cronograma del día:\n7:30-11:30 práctica y teoría\n11:30-14:00 almuerzo\n14:00-16:30 laboratorio técnico\n16:30-18:00 yogasana"}
  ]'::jsonb
)
WHERE id = 1;
