-- ─────────────────────────────────────────────────────────────────────────
-- Migración 037 · Usuarios, roles por proyecto y bitácora de actividad
--   + alta del módulo "Seminario Angelo" (3 sedes, nov–dic 2026)
--
-- Contexto (reunión Sofía + JC, 2026-07-28): el Seminario lo gestionan DOS
-- personas — Sofía (admin, ve todo) y Micaela (colaboradora, con su propio
-- Google OAuth y acceso EXCLUSIVO a este módulo). Además se quiere registrar
-- la actividad de ambas para que Sofía la revise.
--
-- Hasta hoy la app tenía whitelist PLANA: `is_authorized()` con 2 emails
-- hardcodeados, usada por 31 policies. Esta migración NO la modifica (para no
-- alterar nada vivo) — construye ENCIMA:
--   · app_usuarios          → quién puede entrar y con qué rol
--   · usuarios_proyectos    → a qué proyectos accede cada colaborador
--   · puede_ver_proyecto()  → helper para las RLS por proyecto
--   · actividad             → bitácora (quién hizo qué, por lead y global)
--
-- ADITIVA: no toca policies existentes ni datos. La activación del acceso de
-- Micaela (actualizar las policies de las tablas del módulo) va en la 038,
-- ya con su email real.
-- SOLO toca el schema `public` (yoga). No afecta quinche ni platas_casa,
-- que tienen su propia autenticación.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Usuarios de la app ──
CREATE TABLE IF NOT EXISTS public.app_usuarios (
  email      text PRIMARY KEY,
  nombre     text,
  rol        text NOT NULL DEFAULT 'colaborador',  -- admin | colaborador
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_usuarios (email, nombre, rol) VALUES
  ('sofilira@gmail.com', 'Sofía Lira',      'admin'),
  ('jclira@gmail.com',   'Juan Cristóbal',  'admin')
ON CONFLICT (email) DO NOTHING;

-- ── 2. Acceso por proyecto (para colaboradores) ──
CREATE TABLE IF NOT EXISTS public.usuarios_proyectos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL REFERENCES public.app_usuarios(email) ON DELETE CASCADE,
  proyecto_id bigint NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  rol         text NOT NULL DEFAULT 'gestor',     -- gestor | lectura
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, proyecto_id)
);
CREATE INDEX IF NOT EXISTS usuarios_proyectos_email_idx ON public.usuarios_proyectos(email);

-- ── 3. Helpers de autorización (NO reemplazan is_authorized) ──
-- Admin = la whitelist histórica (Sofía, JC). Se mantiene tal cual.
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','auth' AS $$
  SELECT public.is_authorized()
      OR coalesce(auth.jwt() ->> 'email','') IN (
           SELECT email FROM public.app_usuarios WHERE rol='admin' AND activo
         );
$$;

-- ¿El usuario actual puede ver este proyecto?
-- Admin → todos. Colaborador → solo los que tenga asignados.
CREATE OR REPLACE FUNCTION public.puede_ver_proyecto(pid bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','auth' AS $$
  SELECT public.es_admin()
      OR EXISTS (
           SELECT 1 FROM public.usuarios_proyectos up
           JOIN public.app_usuarios u ON u.email = up.email AND u.activo
           WHERE up.proyecto_id = pid
             AND up.email = coalesce(auth.jwt() ->> 'email','')
         );
$$;

-- ¿Puede entrar a la app? (admin o colaborador activo con al menos un proyecto)
CREATE OR REPLACE FUNCTION public.puede_entrar()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','auth' AS $$
  SELECT public.es_admin()
      OR EXISTS (
           SELECT 1 FROM public.app_usuarios u
           WHERE u.email = coalesce(auth.jwt() ->> 'email','') AND u.activo
         );
$$;

ALTER TABLE public.app_usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_proyectos ENABLE ROW LEVEL SECURITY;

-- Cada quien ve su propia ficha; los admin ven y gestionan todo.
DROP POLICY IF EXISTS "app_usuarios_admin" ON public.app_usuarios;
CREATE POLICY "app_usuarios_admin" ON public.app_usuarios
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());
DROP POLICY IF EXISTS "app_usuarios_self" ON public.app_usuarios;
CREATE POLICY "app_usuarios_self" ON public.app_usuarios
  FOR SELECT USING (email = coalesce(auth.jwt() ->> 'email',''));

DROP POLICY IF EXISTS "usuarios_proyectos_admin" ON public.usuarios_proyectos;
CREATE POLICY "usuarios_proyectos_admin" ON public.usuarios_proyectos
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());
DROP POLICY IF EXISTS "usuarios_proyectos_self" ON public.usuarios_proyectos;
CREATE POLICY "usuarios_proyectos_self" ON public.usuarios_proyectos
  FOR SELECT USING (email = coalesce(auth.jwt() ->> 'email',''));

-- ── 4. Bitácora de actividad ──
-- Registro de quién hizo qué. `entidad`+`entidad_id` permiten la vista por
-- lead ("bitácora del lead"); sin filtro, es el registro global para Sofía.
CREATE TABLE IF NOT EXISTS public.actividad (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proyecto_id bigint REFERENCES public.proyectos(id) ON DELETE CASCADE,
  actor_email text,
  actor_nombre text,
  entidad     text,        -- lead | alumna | pago | comprobante | proyecto…
  entidad_id  bigint,
  accion      text NOT NULL, -- creo | actualizo | nota | cambio_estado | pago | mensaje…
  titulo      text,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actividad_proyecto_idx ON public.actividad(proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS actividad_entidad_idx  ON public.actividad(entidad, entidad_id, created_at DESC);

ALTER TABLE public.actividad ENABLE ROW LEVEL SECURITY;
-- Se lee/escribe si puedes ver ese proyecto (admins ven todo).
DROP POLICY IF EXISTS "actividad_por_proyecto" ON public.actividad;
CREATE POLICY "actividad_por_proyecto" ON public.actividad
  FOR ALL USING (public.puede_ver_proyecto(proyecto_id))
  WITH CHECK (public.puede_ver_proyecto(proyecto_id));

-- ── 5. Alta del módulo "Seminario Angelo" ──
-- 3 fines de semana / 3 sedes. Precios PROVISIONALES (Sofía enviará los
-- definitivos); el resto de la config ya refleja lo acordado en la reunión.
INSERT INTO public.proyectos
  (slug, nombre, tipo, shell, estado, descripcion, modalidad, ubicacion, cupos, precio_base, orden, fecha_inicio, fecha_fin, config)
VALUES (
  'seminario-angelo', 'Seminario Angelo', 'seminario', 'formacion', 'activo',
  'Seminario de yoga con instructores invitados · 3 fines de semana en 3 sedes (nov–dic 2026).',
  'presencial', 'Tumbaco · Vilcabamba · Tena', NULL, NULL, 5, '2026-11-20', '2026-12-13',
  jsonb_build_object(
    'tipo', 'taller',                    -- modalidad drop-in: se elige a cuáles sedes ir
    'preciosProvisionales', true,        -- ⚠ pendiente info de Sofía
    'capacidad', 0,
    'precioRegular', 0, 'precioProntoPago', 0, 'precioReserva', 0,
    'tiers', jsonb_build_object('1', 0, '2', 0, '3', 0),
    'ownerName', 'Sofía Lira',
    'studioName', 'Seminario Angelo',
    'lugar', 'Tumbaco · Vilcabamba · Tena',
    'bonoSillaCupos', 0,
    'diasFormacion', jsonb_build_array(
      jsonb_build_object('idx',0,'fecha','20–22 nov','label','Tumbaco','encuentro',1),
      jsonb_build_object('idx',1,'fecha','3–6 dic',  'label','Vilcabamba','encuentro',2),
      jsonb_build_object('idx',2,'fecha','10–13 dic','label','Tena','encuentro',3)
    ),
    'sedes', jsonb_build_array(
      jsonb_build_object('n',1,'nombre','Tumbaco','lugar','Domo','fechas','20–22 nov 2026','pago_a','sofia'),
      jsonb_build_object('n',2,'nombre','Vilcabamba','lugar','Wisdom Forest','fechas','3–6 dic 2026','pago_a','wisdom_forest'),
      jsonb_build_object('n',3,'nombre','Tena','lugar','Iscaluma','fechas','10–13 dic 2026','pago_a','iscaluma')
    ),
    'becas', jsonb_build_object('activo', true, 'nota','Auspicios de marcas para cubrir becas'),
    'plantillasWA', jsonb_build_array(
      jsonb_build_object('id','info','titulo','Info del seminario','cuerpo','Hola! Te cuento del Seminario: son 3 fines de semana — Tumbaco (20–22 nov), Vilcabamba (3–6 dic) y Tena (10–13 dic). Puedes venir a uno, a dos o a los tres. ¿Cuál te interesa? 🌿'),
      jsonb_build_object('id','pago','titulo','Datos de pago','cuerpo','Te paso los datos de pago según la sede que elijas. ¿A cuál te gustaría ir?')
    )
  )
)
ON CONFLICT (slug) DO NOTHING;
