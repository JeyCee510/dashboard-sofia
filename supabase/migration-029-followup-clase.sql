-- migration-029-followup-clase.sql
-- 1) Tracking de follow-up post-clase enviado por lead
-- 2) Actualiza fechaProntoPago a "lunes 18 de mayo" (la nueva deadline)
-- 3) Agrega plantilla followup_clase con placeholders [Nombre],
--    [fechaProntoPago] y [LINK_INSCRIPCION]

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS followup_clase_enviado_at timestamptz;

-- Actualiza fechaProntoPago
UPDATE public.ajustes
   SET data = jsonb_set(data, '{fechaProntoPago}', '"lunes 18 de mayo"', false)
 WHERE id = 1;

-- Agrega plantilla followup_clase (sin pisar las existentes)
UPDATE public.ajustes
   SET data = jsonb_set(
     data,
     '{plantillasWA}',
     COALESCE(data->'plantillasWA', '[]'::jsonb) || jsonb_build_array(
       jsonb_build_object(
         'id', 'followup_clase',
         'titulo', 'Follow-up post clase',
         'cuerpo',
         'Hola querida(o) [Nombre],

Quiero agradecerte por habernos acompañado en la práctica de hoy. Para mí es un verdadero gusto coincidir con otros profesores y practicantes igual de curiosos, motivados y comprometidos tanto con su propia práctica como con el servicio que brindamos a los demás.

Si es un SI para ti el ser parte del entrenamiento de 50 horas - El arte de enseñar yoga, te tengo una linda noticia. Inscríbete hasta el [fechaProntoPago] y con tu inscripción te regalo una silla de Yoga. Es un elemento potente y muy útil para sostenernos mientras imprimimos las acciones en el cuerpo, y quiero que practiques, y mucho.

Avísame si tienes dudas o necesitas hablar respecto a formas de pago.

¡Nos vemos pronto en el mat!
Un abrazo,
Sofía

[LINK_INSCRIPCION]'
       )
     ),
     true
   )
 WHERE id = 1
   AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(data->'plantillasWA') p
      WHERE p->>'id' = 'followup_clase'
   );

COMMIT;
