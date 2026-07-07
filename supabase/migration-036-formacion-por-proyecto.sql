-- ─────────────────────────────────────────────────────────────────────────
-- Migración 036 · Parametrizar el motor de la formación por proyecto
--
-- Objetivo: que el MISMO código de la formación (alumnas/leads/pagos/
-- asistencia/ajustes + todas sus pantallas y features) corra también para el
-- taller "Refinar la Práctica", filtrando por proyecto_id. Así el taller
-- hereda TODO (leads, estudiantes, WhatsApp, mensajes, difusión, comprobantes,
-- preinscripción, voz) sin duplicar código; solo se adaptan precios (tiers) y
-- modalidad (drop-in por encuentro) vía la config de ajustes del proyecto.
--
-- ADITIVA: columnas nullable + backfill de lo existente a la formación de
-- junio. La app viva sigue igual (el store lee ajustes id=1 y select('*')).
-- El frontend por-proyecto se activa en fases siguientes (rama feat/taller-full).
-- ─────────────────────────────────────────────────────────────────────────

-- 1) proyecto_id en las tablas del namespace formación
ALTER TABLE public.alumnas        ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.leads          ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.pagos          ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.asistencia     ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.eventos_alumna ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.preinscripcion ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);
ALTER TABLE public.mensajes       ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);

-- 2) ajustes por proyecto (hoy singleton id=1)
ALTER TABLE public.ajustes ADD COLUMN IF NOT EXISTS proyecto_id bigint REFERENCES public.proyectos(id);

-- 3) Backfill: todo lo existente pertenece a la formación de junio
DO $$
DECLARE fid bigint; rid bigint;
BEGIN
  SELECT id INTO fid FROM public.proyectos WHERE slug='formacion-junio-2026';
  SELECT id INTO rid FROM public.proyectos WHERE slug='refinar-la-practica';

  UPDATE public.alumnas        SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.leads          SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.pagos          SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.asistencia     SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.eventos_alumna SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.preinscripcion SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.mensajes       SET proyecto_id=fid WHERE proyecto_id IS NULL;
  UPDATE public.ajustes        SET proyecto_id=fid WHERE proyecto_id IS NULL;  -- singleton id=1 → formación

  -- 4) Ajustes del TALLER (Refinar): la tabla `ajustes` es singleton (constraint
  --    only_one_row), así que los ajustes del taller viven en `proyectos.config`.
  --    Misma FORMA que los ajustes de la formación → el frontend (Fase 2) carga
  --    ajustes desde proyectos.config para proyectos != formación.
  UPDATE public.proyectos SET config = coalesce(config,'{}'::jsonb) || jsonb_build_object(
    'tipo', 'taller',
    'capacidad', 22,
    'precioRegular', 390,
    'precioProntoPago', 390,
    'precioReserva', 80,
    'tiers', jsonb_build_object('1',80,'2',150,'3',210,'6',390),
    'preciosLabel', jsonb_build_array(
      jsonb_build_object('label','1 encuentro','precio',80,'encuentros',1),
      jsonb_build_object('label','2 encuentros','precio',150,'encuentros',2),
      jsonb_build_object('label','3 encuentros','precio',210,'encuentros',3),
      jsonb_build_object('label','Paquete completo (6)','precio',390,'encuentros',6)
    ),
    'fechaProntoPago', '',
    'ownerName', 'Sofía Lira',
    'studioName', 'Refinar la Práctica',
    'lugar', 'Domo · Tumbaco',
    'nivel', 'Intermedio',
    'bonoSillaCupos', 0,
    'diasFormacion', jsonb_build_array(
      jsonb_build_object('idx',0,'fecha','25 jul','label','Encuentro 1','encuentro',1),
      jsonb_build_object('idx',1,'fecha','15 ago','label','Encuentro 2','encuentro',2),
      jsonb_build_object('idx',2,'fecha','5 sep', 'label','Encuentro 3','encuentro',3),
      jsonb_build_object('idx',3,'fecha','3 oct', 'label','Encuentro 4','encuentro',4),
      jsonb_build_object('idx',4,'fecha','17 oct','label','Encuentro 5','encuentro',5),
      jsonb_build_object('idx',5,'fecha','7 nov', 'label','Encuentro 6','encuentro',6)
    ),
    'plantillasWA', jsonb_build_array(
      jsonb_build_object('id','pgrm','titulo','Datos del taller','cuerpo','Hola! Te paso los detalles de Refinar la Práctica: 6 sábados (25 jul, 15 ago, 5 sep, 3 oct, 17 oct, 7 nov), de 8:00 a 17:00 en el Domo (Tumbaco). Eliges cuántos encuentros tomas 🌿'),
      jsonb_build_object('id','prec','titulo','Precios','cuerpo','Precios: 1 encuentro $80 · 2 encuentros $150 · 3 encuentros $210 · paquete completo (6) $390. ¿Cuáles quieres tomar?'),
      jsonb_build_object('id','tr','titulo','Datos de transferencia','cuerpo','Transferencias a:\nSofía Lira\nProdubanco Ahorro #12054049429\nCédula #1709369225\nsofilira@gmail.com\n\nApenas tengas el comprobante mándamelo y reservo tu cupo 🙏'),
      jsonb_build_object('id','ub','titulo','Ubicación','cuerpo','Domo, Tumbaco.\nUbicación en Maps: https://maps.app.goo.gl/WrauzvKJot5NbNZF7')
    ),
    'transferencia', jsonb_build_object('banco','Produbanco','tipoCuenta','Ahorro','cuenta','12054049429','cedula','1709369225','email','sofilira@gmail.com','titular','Sofía Lira')
  )
  WHERE id = rid;
END $$;

-- 5) Índices de filtrado por proyecto
CREATE INDEX IF NOT EXISTS leads_proyecto_idx     ON public.leads(proyecto_id);
CREATE INDEX IF NOT EXISTS mensajes_proyecto_idx  ON public.mensajes(proyecto_id);
CREATE INDEX IF NOT EXISTS preins_proyecto_idx    ON public.preinscripcion(proyecto_id);
