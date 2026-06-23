-- ─────────────────────────────────────────────────────────────────────────
-- Migración 034 · Backfill a personas + participaciones
--
-- Llena `personas` (identidad única, deduplicada) y `participaciones` (rol de
-- cada persona en cada proyecto) a partir de las tablas legacy:
--   leads → rol 'lead' (proyecto de origen = formación junio)
--   alumnas → rol 'inscrito' (proyecto formación junio)
--   estudiantes_estudio → rol 'inscrito' (proyecto estudio)
--   taller_inscritos → rol 'inscrito' (proyecto del taller)  [0 filas hoy]
--
-- Dedup por clave: tel(últimos 9 díg) > instagram > email > nombre.
-- ADITIVO y REVERSIBLE: no toca las tablas legacy (siguen siendo la fuente de
-- verdad mientras el frontend no migre). Para revertir: TRUNCATE participaciones,
-- personas RESTART IDENTITY CASCADE.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Función de clave de match (reutilizable por el frontend para "buscar o crear persona") ──
CREATE OR REPLACE FUNCTION public.persona_match_key(p_nombre text, p_tel text, p_ig text, p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    nullif(right(regexp_replace(coalesce(p_tel,''),   '[^0-9]', '', 'g'), 9), ''),
    nullif(lower(regexp_replace(coalesce(p_ig,''),     '[@ ]',   '', 'g')),    ''),
    nullif(lower(trim(coalesce(p_email,''))),                                   ''),
    'name:' || lower(trim(coalesce(p_nombre,'')))
  );
$$;

-- ── 1. Insertar personas únicas (una por clave de match) ──
WITH src AS (
  SELECT 'leads'               AS tbl, 4 AS pri, nombre, tel, instagram, NULL::text AS email, NULL::text AS avatar FROM public.leads
  UNION ALL
  SELECT 'alumnas',                1,     nombre, tel, instagram, NULL,               avatar FROM public.alumnas
  UNION ALL
  SELECT 'estudiantes_estudio',    2,     nombre, tel, instagram, email,              avatar FROM public.estudiantes_estudio
  UNION ALL
  SELECT 'taller_inscritos',       3,     nombre, tel, instagram, email,              NULL   FROM public.taller_inscritos
),
keyed AS (
  SELECT *, public.persona_match_key(nombre, tel, instagram, email) AS mkey FROM src
),
rep AS (
  SELECT DISTINCT ON (mkey)
    mkey, nombre, tel, instagram, email, avatar
  FROM keyed
  ORDER BY mkey, pri   -- alumnas/estudiantes pisan a leads como representativo
)
INSERT INTO public.personas (nombre, tel, instagram, email, avatar, iniciales, tel_norm, ig_norm, email_norm)
SELECT
  trim(nombre),
  tel, instagram, email, avatar,
  upper(left(split_part(trim(nombre),' ',1),1) || coalesce(left(nullif(split_part(trim(nombre),' ',2),''),1),'')),
  nullif(right(regexp_replace(coalesce(tel,''), '[^0-9]','','g'),9),''),
  nullif(lower(regexp_replace(coalesce(instagram,''),'[@ ]','','g')),''),
  nullif(lower(trim(coalesce(email,''))),'')
FROM rep
WHERE NOT EXISTS (
  SELECT 1 FROM public.personas pe
  WHERE public.persona_match_key(pe.nombre, pe.tel, pe.instagram, pe.email) = rep.mkey
);

-- ── 2. Participaciones de ALUMNAS (formación junio, rol inscrito) ──
INSERT INTO public.participaciones
  (persona_id, proyecto_id, rol, estado, tipo_inscripcion, total, pagado, bono_silla, plan_pagos, notas, legacy_tabla, legacy_id, fecha_inscripcion, config)
SELECT
  pe.id, pr.id, 'inscrito', a.pago, a.tipo_inscripcion, a.total, coalesce(a.pagado,0), coalesce(a.bono_silla,false),
  a.plan_pagos, a.notas, 'alumnas', a.id, a.created_at,
  jsonb_build_object('encuentros_asistir', a.encuentros_asistir, 'inscrita', a.inscrita)
FROM public.alumnas a
JOIN public.proyectos pr ON pr.slug = 'formacion-junio-2026'
JOIN public.personas pe ON public.persona_match_key(pe.nombre, pe.tel, pe.instagram, pe.email)
                         = public.persona_match_key(a.nombre, a.tel, a.instagram, NULL)
ON CONFLICT (persona_id, proyecto_id, rol) DO NOTHING;

-- ── 3. Participaciones de ESTUDIANTES_ESTUDIO (estudio, rol inscrito) ──
INSERT INTO public.participaciones
  (persona_id, proyecto_id, rol, estado, notas, legacy_tabla, legacy_id, fecha_inscripcion)
SELECT
  pe.id, pr.id, 'inscrito', CASE WHEN e.archivada THEN 'archivado' ELSE 'activo' END,
  e.notas, 'estudiantes_estudio', e.id, coalesce(e.fecha_alta::timestamptz, e.created_at)
FROM public.estudiantes_estudio e
JOIN public.proyectos pr ON pr.slug = 'estudio'
JOIN public.personas pe ON public.persona_match_key(pe.nombre, pe.tel, pe.instagram, pe.email)
                         = public.persona_match_key(e.nombre, e.tel, e.instagram, e.email)
ON CONFLICT (persona_id, proyecto_id, rol) DO NOTHING;

-- ── 4. Participaciones de TALLER_INSCRITOS (taller, rol inscrito) ──
INSERT INTO public.participaciones
  (persona_id, proyecto_id, rol, total, notas, plan_pagos, legacy_tabla, legacy_id, fecha_inscripcion)
SELECT
  pe.id, ti.proyecto_id, 'inscrito', ti.total_calculado, ti.notas, ti.plan_pagos,
  'taller_inscritos', ti.id, ti.created_at
FROM public.taller_inscritos ti
JOIN public.personas pe ON public.persona_match_key(pe.nombre, pe.tel, pe.instagram, pe.email)
                         = public.persona_match_key(ti.nombre, ti.tel, ti.instagram, ti.email)
ON CONFLICT (persona_id, proyecto_id, rol) DO NOTHING;

-- ── 5. Participaciones de LEADS (rol lead, proyecto de interés = formación junio origen) ──
--    Solo si esa persona NO es ya inscrita en ese proyecto (un lead convertido ya no es lead).
INSERT INTO public.participaciones
  (persona_id, proyecto_id, rol, estado, fuente, notas, legacy_tabla, legacy_id, fecha_inscripcion)
SELECT
  pe.id, pr.id, 'lead', l.estado, l.fuente, l.mensaje, 'leads', l.id, l.created_at
FROM public.leads l
JOIN public.proyectos pr ON pr.slug = 'formacion-junio-2026'
JOIN public.personas pe ON public.persona_match_key(pe.nombre, pe.tel, pe.instagram, pe.email)
                         = public.persona_match_key(l.nombre, l.tel, l.instagram, NULL)
WHERE NOT EXISTS (
  SELECT 1 FROM public.participaciones x
  WHERE x.persona_id = pe.id AND x.proyecto_id = pr.id AND x.rol = 'inscrito'
)
ON CONFLICT (persona_id, proyecto_id, rol) DO NOTHING;
