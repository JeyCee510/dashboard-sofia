-- ─────────────────────────────────────────────────────────────────────────
-- Migración 035 · Puente taller → base compartida de personas
--
-- Refinar la Práctica (y futuros talleres drop-in) siguen usando su motor
-- propio (taller_inscritos, links públicos, selección modular por encuentro,
-- tiers). Para que NO queden aislados del resto, este trigger espeja cada
-- inscrito del taller hacia el pool COMPARTIDO `personas` + `participaciones`.
--
-- Resultado: una persona que se inscribe a un taller también aparece en la
-- base única de contactos (dedup por tel/IG/email vía persona_match_key),
-- sin cambiar nada del flujo del taller. Aditivo y reversible.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_taller_inscrito_a_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_persona_id bigint;
  v_key text;
BEGIN
  v_key := public.persona_match_key(NEW.nombre, NEW.tel, NEW.instagram, NEW.email);

  SELECT id INTO v_persona_id
  FROM public.personas
  WHERE public.persona_match_key(nombre, tel, instagram, email) = v_key
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    INSERT INTO public.personas (nombre, tel, instagram, email, iniciales, tel_norm, ig_norm, email_norm)
    VALUES (
      NEW.nombre, NEW.tel, NEW.instagram, NEW.email,
      upper(left(split_part(trim(NEW.nombre),' ',1),1) || coalesce(left(nullif(split_part(trim(NEW.nombre),' ',2),''),1),'')),
      nullif(right(regexp_replace(coalesce(NEW.tel,''), '[^0-9]','','g'),9),''),
      nullif(lower(regexp_replace(coalesce(NEW.instagram,''),'[@ ]','','g')),''),
      nullif(lower(trim(coalesce(NEW.email,''))),'')
    )
    RETURNING id INTO v_persona_id;
  END IF;

  INSERT INTO public.participaciones
    (persona_id, proyecto_id, rol, total, notas, plan_pagos, legacy_tabla, legacy_id, fecha_inscripcion)
  VALUES
    (v_persona_id, NEW.proyecto_id, 'inscrito', NEW.total_calculado, NEW.notas, NEW.plan_pagos, 'taller_inscritos', NEW.id, NEW.created_at)
  ON CONFLICT (persona_id, proyecto_id, rol)
  DO UPDATE SET total = EXCLUDED.total, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS taller_inscrito_sync ON public.taller_inscritos;
CREATE TRIGGER taller_inscrito_sync
  AFTER INSERT OR UPDATE ON public.taller_inscritos
  FOR EACH ROW EXECUTE FUNCTION public.sync_taller_inscrito_a_persona();

-- Backfill de los inscritos del taller que ya existieran (hoy 0, idempotente)
DO $$
DECLARE r record; v_persona_id bigint; v_key text;
BEGIN
  FOR r IN SELECT * FROM public.taller_inscritos LOOP
    v_key := public.persona_match_key(r.nombre, r.tel, r.instagram, r.email);
    SELECT id INTO v_persona_id FROM public.personas
      WHERE public.persona_match_key(nombre, tel, instagram, email) = v_key LIMIT 1;
    IF v_persona_id IS NULL THEN
      INSERT INTO public.personas (nombre, tel, instagram, email, iniciales, tel_norm, ig_norm, email_norm)
      VALUES (r.nombre, r.tel, r.instagram, r.email,
        upper(left(split_part(trim(r.nombre),' ',1),1) || coalesce(left(nullif(split_part(trim(r.nombre),' ',2),''),1),'')),
        nullif(right(regexp_replace(coalesce(r.tel,''), '[^0-9]','','g'),9),''),
        nullif(lower(regexp_replace(coalesce(r.instagram,''),'[@ ]','','g')),''),
        nullif(lower(trim(coalesce(r.email,''))),''))
      RETURNING id INTO v_persona_id;
    END IF;
    INSERT INTO public.participaciones
      (persona_id, proyecto_id, rol, total, notas, plan_pagos, legacy_tabla, legacy_id, fecha_inscripcion)
    VALUES (v_persona_id, r.proyecto_id, 'inscrito', r.total_calculado, r.notas, r.plan_pagos, 'taller_inscritos', r.id, r.created_at)
    ON CONFLICT (persona_id, proyecto_id, rol) DO UPDATE SET total = EXCLUDED.total, updated_at = now();
  END LOOP;
END $$;
