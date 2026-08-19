-- Migración 042 · Link de inscripción para alguien que YA es inscrito
--
-- Caso Francisco Quevedo (12 ago 2026): pagó y pasó a inscrito sin que Sofía
-- alcanzara a mandarle el formulario. La RPC existente sólo acepta un lead, así
-- que una vez convertido ya no había forma de pedírselo: el panel decía
-- "Sin inscripción registrada" y no ofrecía nada.
--
-- El formulario puede hacer falta en cualquier momento del proceso, no sólo
-- antes de pagar.
create or replace function public.crear_preinscripcion_alumna(p_alumna_id bigint)
returns uuid
language plpgsql
as $$
DECLARE
  existing_token uuid;
  new_token uuid;
  alumna_name text;
  alumna_proy bigint;
BEGIN
  SELECT nombre, proyecto_id INTO alumna_name, alumna_proy
  FROM public.alumnas WHERE id = p_alumna_id;

  IF alumna_name IS NULL THEN
    RAISE EXCEPTION 'No existe esa persona';
  END IF;

  IF NOT public.puede_ver_proyecto(alumna_proy) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Nunca dos tokens vivos para la misma persona: se reusa el pendiente.
  SELECT token INTO existing_token
  FROM public.preinscripcion
  WHERE alumna_id = p_alumna_id AND estado = 'pendiente'
  ORDER BY created_at DESC LIMIT 1;

  IF existing_token IS NOT NULL THEN
    RETURN existing_token;
  END IF;

  INSERT INTO public.preinscripcion (alumna_id, lead_nombre_snapshot, token, proyecto_id)
  VALUES (p_alumna_id, alumna_name, gen_random_uuid(), alumna_proy)
  RETURNING token INTO new_token;

  RETURN new_token;
END;
$$;
