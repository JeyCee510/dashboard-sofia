-- ─────────────────────────────────────────────────────────────────────────
-- Migración 038 · RLS por proyecto (activa el acceso restringido de Micaela)
--
-- Cambia las policies de las tablas del módulo de `is_authorized()` (whitelist
-- plana) a `puede_ver_proyecto(proyecto_id)`.
--
-- Para Sofía y JC es EQUIVALENTE: `puede_ver_proyecto` devuelve true para
-- admins en cualquier proyecto (incluso si proyecto_id fuera NULL). O sea,
-- no-op para ellos. Para Micaela (colaboradora) sólo devuelve true en el
-- proyecto que tenga asignado → Seminario Angelo.
--
-- Las tablas SIN proyecto_id (comprobantes, papeleras, clases abiertas,
-- módulo estudio…) NO se tocan: siguen con is_authorized(), lo que significa
-- que Micaela no las ve. Es el comportamiento deseado (denegado por defecto).
--
-- SOLO schema `public` (yoga). No toca quinche ni platas_casa.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Tablas de datos del módulo (todas tienen proyecto_id desde la mig 036) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnas','leads','pagos','asistencia','eventos_alumna','preinscripcion','mensajes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_por_proyecto', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.puede_ver_proyecto(proyecto_id)) WITH CHECK (public.puede_ver_proyecto(proyecto_id))',
      t || '_por_proyecto', t
    );
  END LOOP;
END $$;

-- ── Proyectos: cada quien ve los suyos (admin ve todos) ──
-- Necesario para que el launcher de Micaela liste sólo el Seminario.
DROP POLICY IF EXISTS "proyectos_visibles" ON public.proyectos;
CREATE POLICY "proyectos_visibles" ON public.proyectos
  FOR SELECT TO authenticated USING (public.puede_ver_proyecto(id));

-- IMPORTANTE: existía `proyectos_lectura_publica` con USING (estado='activo')
-- SIN restricción de rol. Como las policies permisivas se combinan con OR,
-- eso dejaba a cualquier usuario autenticado (p.ej. Micaela) ver TODOS los
-- proyectos activos. La limitamos al rol `anon`, que es para lo que existe:
-- las páginas públicas de inscripción (/taller/<slug>).
DROP POLICY IF EXISTS "proyectos_lectura_publica" ON public.proyectos;
CREATE POLICY "proyectos_lectura_publica" ON public.proyectos
  FOR SELECT TO anon USING (estado = 'activo');

-- `proyectos_admin` (FOR ALL con is_authorized) ya existe y cubre la escritura
-- de Sofía/JC; se mantiene tal cual. Micaela no escribe proyectos.
