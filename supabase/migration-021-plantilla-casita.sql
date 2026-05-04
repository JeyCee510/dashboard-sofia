-- Añade plantilla "Casita del Yoga" al jsonb plantillasWA en la fila ajustes (id=1).
-- COALESCE protege si por alguna razón el array no existiera todavía.
UPDATE public.ajustes
SET data = jsonb_set(
  data,
  '{plantillasWA}',
  COALESCE(data->'plantillasWA', '[]'::jsonb) ||
    '[{"id":"casita_yoga","titulo":"Casita del Yoga","cuerpo":"📍 Casita del Yoga\nUbicación en Maps: https://maps.app.goo.gl/vHP5keN2w66HgTap9"}]'::jsonb
)
WHERE id = 1;
