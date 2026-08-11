-- Migración 039 · Leads: interés por sede + quién creó y quién está a cargo
--
-- Contexto (Seminario Angelo): Sofía hace el primer contacto y crea el lead;
-- Micaela retoma pagos y logística. Hasta ahora el traspaso sólo existía como
-- un mensaje de WhatsApp y una línea en la bitácora: nadie sabía, mirando el
-- lead, quién lo creó ni quién lo tiene hoy.
--
-- Además, el seminario son 3 sedes independientes: hace falta anotar desde el
-- primer contacto a cuál(es) quiere venir la persona.

alter table public.leads
  add column if not exists interes_sedes    int[],          -- números de sede/encuentro (1,2,3)
  add column if not exists creado_por_email text,
  add column if not exists creado_por_nombre text,
  add column if not exists asignado_a_email text,
  add column if not exists asignado_a_nombre text,
  add column if not exists asignado_at      timestamptz;

comment on column public.leads.interes_sedes is
  'Sedes/encuentros que le interesan (proyectos.config.sedes[].n). NULL = sin definir.';
comment on column public.leads.asignado_a_nombre is
  'Quién está a cargo del lead hoy. Se setea al "pasar la posta" desde la ficha.';

-- Índice para filtrar "mis leads" sin escanear la tabla entera
create index if not exists leads_asignado_a_email_idx
  on public.leads (asignado_a_email)
  where asignado_a_email is not null;

-- Backfill de creado_por con lo que ya registró la bitácora (tabla `actividad`).
-- Sólo toca filas sin dato: es idempotente y no pisa nada.
update public.leads l
set creado_por_email  = a.actor_email,
    creado_por_nombre = a.actor_nombre
from (
  select distinct on (entidad_id) entidad_id, actor_email, actor_nombre
  from public.actividad
  where entidad = 'lead' and accion = 'creo' and entidad_id is not null
  order by entidad_id, created_at asc
) a
where a.entidad_id = l.id
  and l.creado_por_email is null;

-- Las papeleras espejan las columnas de `leads`: el trigger archive_lead()
-- copia fila completa, así que necesitan las mismas columnas o falla el DELETE.
alter table public.leads_archive
  add column if not exists interes_sedes     int[],
  add column if not exists creado_por_email  text,
  add column if not exists creado_por_nombre text,
  add column if not exists asignado_a_email  text,
  add column if not exists asignado_a_nombre text,
  add column if not exists asignado_at       timestamptz;

-- El trigger copia columna por columna, así que hay que enseñarle las nuevas.
-- Conserva SECURITY DEFINER (así estaba: el trigger escribe en la papelera,
-- que el usuario no puede tocar directo). `restaurar_lead`, en cambio, sigue
-- siendo INVOKER porque llama a is_authorized() — ver constraint en AGENTS.md.
create or replace function public.archive_lead()
returns trigger
language plpgsql
security definer
as $$
BEGIN
  INSERT INTO public.leads_archive (
    id, nombre, tel, instagram, fuente, estado, mensaje, tiempo,
    created_at, updated_at, deleted_at, proyecto_id,
    interes_sedes, creado_por_email, creado_por_nombre,
    asignado_a_email, asignado_a_nombre, asignado_at
  )
  VALUES (
    OLD.id, OLD.nombre, OLD.tel, OLD.instagram, OLD.fuente, OLD.estado, OLD.mensaje, OLD.tiempo,
    OLD.created_at, OLD.updated_at, now(), OLD.proyecto_id,
    OLD.interes_sedes, OLD.creado_por_email, OLD.creado_por_nombre,
    OLD.asignado_a_email, OLD.asignado_a_nombre, OLD.asignado_at
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre, tel = EXCLUDED.tel, instagram = EXCLUDED.instagram,
    fuente = EXCLUDED.fuente, estado = EXCLUDED.estado, mensaje = EXCLUDED.mensaje,
    tiempo = EXCLUDED.tiempo, deleted_at = now(), proyecto_id = EXCLUDED.proyecto_id,
    interes_sedes = EXCLUDED.interes_sedes,
    creado_por_email = EXCLUDED.creado_por_email,
    creado_por_nombre = EXCLUDED.creado_por_nombre,
    asignado_a_email = EXCLUDED.asignado_a_email,
    asignado_a_nombre = EXCLUDED.asignado_a_nombre,
    asignado_at = EXCLUDED.asignado_at;
  RETURN OLD;
END;
$$;

-- ⚠ Bug preexistente que se corrige acá: `restaurar_lead` NO devolvía el
-- `proyecto_id`, así que restaurar un lead del Seminario lo dejaba en el
-- proyecto por defecto (la formación) y desaparecía de la vista de Sofía.
create or replace function public.restaurar_lead(p_id bigint)
returns jsonb
language plpgsql
as $$
DECLARE
  archived RECORD;
BEGIN
  IF NOT public.is_authorized() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO archived FROM public.leads_archive WHERE id = p_id LIMIT 1;
  IF archived.id IS NULL THEN
    RETURN jsonb_build_object('error', 'No existe en archivo');
  END IF;

  INSERT INTO public.leads (
    id, nombre, tel, instagram, fuente, estado, mensaje, tiempo,
    created_at, updated_at, proyecto_id,
    interes_sedes, creado_por_email, creado_por_nombre,
    asignado_a_email, asignado_a_nombre, asignado_at
  )
  VALUES (
    archived.id, archived.nombre, archived.tel, archived.instagram, archived.fuente,
    archived.estado, archived.mensaje, archived.tiempo, archived.created_at, now(),
    coalesce(archived.proyecto_id, 2),
    archived.interes_sedes, archived.creado_por_email, archived.creado_por_nombre,
    archived.asignado_a_email, archived.asignado_a_nombre, archived.asignado_at
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tel = EXCLUDED.tel,
    instagram = EXCLUDED.instagram,
    fuente = EXCLUDED.fuente,
    estado = EXCLUDED.estado,
    mensaje = EXCLUDED.mensaje,
    proyecto_id = EXCLUDED.proyecto_id,
    interes_sedes = EXCLUDED.interes_sedes,
    creado_por_email = EXCLUDED.creado_por_email,
    creado_por_nombre = EXCLUDED.creado_por_nombre,
    asignado_a_email = EXCLUDED.asignado_a_email,
    asignado_a_nombre = EXCLUDED.asignado_a_nombre,
    asignado_at = EXCLUDED.asignado_at;

  DELETE FROM public.leads_archive WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
