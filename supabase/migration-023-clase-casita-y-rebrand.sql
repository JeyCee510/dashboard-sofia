-- migration-023-clase-casita-y-rebrand.sql
-- 1) Clase abierta del 16-may: ubicación confirmada = La Casita del Yoga
-- 2) Rebrand del studioName en el singleton de ajustes (id=1):
--    'Yoga Sofía Lira' → 'Sofía Lira Yoga'

UPDATE public.clases_abiertas
   SET ubicacion = 'La Casita del Yoga'
 WHERE slug = 'yoga-16-mayo';

UPDATE public.ajustes
   SET data = jsonb_set(data, '{studioName}', '"Sofía Lira Yoga"', false)
 WHERE id = 1;
