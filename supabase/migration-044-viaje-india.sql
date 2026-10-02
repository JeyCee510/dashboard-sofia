-- Migración 044 · Proyecto "Viaje a la India" + web pública con captura de leads
--
-- Contexto (2 oct 2026): se publica un QR que lleva a una web informativa del
-- viaje (/viaje/<slug>). Ahí la persona deja su interés y entra directo al
-- funnel de leads del proyecto, que se gestiona con el mismo motor que el
-- Seminario (estados, WhatsApp, notas, bitácora, traspaso, push).
--
-- Piezas:
--   · leads.email          — la web lo pide; hasta hoy los leads sólo tenían tel/IG
--   · proyectos id viaje-india con config.web (contenido de la página, editable)
--   · RPC anon viaje_obtener_publico(slug)  → sólo config.web (no expone cuentas)
--   · RPC anon viaje_registrar_interes(...) → crea (o actualiza) el lead + bitácora

alter table public.leads add column if not exists email text;

-- ── Proyecto ───────────────────────────────────────────────────────────────
insert into public.proyectos (slug, nombre, tipo, estado, orden, descripcion, config)
select 'viaje-india', 'Viaje a la India', 'viaje', 'activo', 1,
  'Viaje de yoga a la India · web pública con registro de interesados y funnel de seguimiento.',
  jsonb_build_object(
    'tipo', 'viaje',
    'studioName', 'Viaje a la India',
    'ownerName', 'Sofía Lira',
    'lugar', 'India',
    'usaAsistencia', false,
    'bonoSillaCupos', 0,
    'capacidad', 20,
    'diasFormacion', '[]'::jsonb,
    'material', '[]'::jsonb,
    'plantillasWA', jsonb_build_array(
      jsonb_build_object('id','primer_contacto','titulo','① Primer contacto',
        'cuerpo','Hola [Nombre] 🌿 Soy Sofía. Vi que dejaste tus datos para el viaje a la India, ¡qué alegría! ¿Te cuento cómo va a ser y resolvemos tus dudas?'),
      jsonb_build_object('id','info','titulo','② Info del viaje',
        'cuerpo','Hola [Nombre], aquí tienes toda la información del viaje a la India: [LINK_WEB]\n\nCuando lo leas, cuéntame qué te parece 🙏'),
      jsonb_build_object('id','llamada','titulo','③ Agendar llamada',
        'cuerpo','Hola [Nombre] 🌿 ¿Te parece si hablamos 15 minutos por llamada para contarte el viaje en detalle? Dime qué día y hora te acomoda.'),
      jsonb_build_object('id','seguimiento','titulo','④ Seguimiento',
        'cuerpo','Hola [Nombre], ¿cómo vas? Te escribo por el viaje a la India: quedan pocos cupos y quería saber si te quedó alguna duda 🙏'),
      jsonb_build_object('id','reserva','titulo','⑤ Reservar cupo',
        'cuerpo','Hola [Nombre] 🌿 ¡Qué lindo que te sumes! Para reservar tu cupo te paso los datos de pago:\n\n[DATOS_PAGO]\n\nApenas tengas el comprobante me lo mandas por aquí.')
    ),
    -- Contenido de la web pública. Todo lo que dice "por confirmar" se
    -- reemplaza aquí (sin tocar código) cuando estén los datos del viaje.
    'web', jsonb_build_object(
      'publica', true,
      'eyebrow', 'Viaje de yoga · 2027',
      'titulo', 'Viaje a la India',
      'subtitulo', 'Un viaje de práctica, estudio y peregrinaje a la cuna del yoga, junto a Sofía Lira.',
      'fechas', 'Fechas por confirmar',
      'duracion', '',
      'precio', '',
      'cupos', 'Cupos limitados',
      'intro', 'Estamos preparando un viaje para vivir el yoga en su origen: práctica diaria, lugares sagrados, maestros y la vida cotidiana de la India. Deja tus datos y te escribimos con el itinerario completo apenas esté listo.',
      'destinos', '[]'::jsonb,
      'incluye', '[]'::jsonb,
      'preguntas', '[]'::jsonb,
      'whatsapp', '+593986813584',
      'ctaTexto', 'Quiero recibir información',
      'graciasTexto', 'Gracias por tu interés 🙏 Te escribiremos por WhatsApp con toda la información del viaje.'
    )
  )
where not exists (select 1 from public.proyectos where slug = 'viaje-india');

-- ── Lectura pública: sólo el bloque web (nunca cuentas ni precios internos) ──
create or replace function public.viaje_obtener_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'slug', p.slug, 'web', p.config->'web')
  from proyectos p
  where p.slug = p_slug
    and p.estado = 'activo'
    and coalesce((p.config->'web'->>'publica')::boolean, false);
$$;

-- ── Registro de interés desde la web ───────────────────────────────────────
-- Si la persona ya está (mismo teléfono o email en el proyecto) NO duplica:
-- agrega la nota y deja constancia en la bitácora de que volvió a escribir.
create or replace function public.viaje_registrar_interes(
  p_slug text,
  p_nombre text,
  p_tel text,
  p_email text default null,
  p_mensaje text default null,
  p_fuente text default 'web',
  p_extra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid bigint;
  v_nombre text := left(trim(coalesce(p_nombre, '')), 120);
  v_tel text := left(trim(coalesce(p_tel, '')), 40);
  v_tel_dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  v_email text := lower(left(trim(coalesce(p_email, '')), 160));
  v_msg text := left(trim(coalesce(p_mensaje, '')), 1500);
  v_fuente text := case when p_fuente in ('qr', 'web', 'instagram', 'whatsapp', 'referido') then p_fuente else 'web' end;
  v_nota text;
  v_id bigint;
  v_recientes int;
begin
  select id into v_pid from proyectos
  where slug = p_slug and estado = 'activo'
    and coalesce((config->'web'->>'publica')::boolean, false);
  if v_pid is null then
    raise exception 'Proyecto no disponible';
  end if;
  if length(v_nombre) < 2 then
    raise exception 'Falta el nombre';
  end if;
  if length(v_tel_dig) < 7 then
    raise exception 'Falta un WhatsApp válido';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email no parece válido';
  end if;

  -- Freno básico contra spam: un QR público no debería generar más de
  -- 40 registros en 10 minutos.
  select count(*) into v_recientes from leads
  where proyecto_id = v_pid and creado_por_nombre = 'Web del viaje'
    and created_at > now() - interval '10 minutes';
  if v_recientes >= 40 then
    raise exception 'Demasiados registros seguidos, intenta en unos minutos';
  end if;

  v_nota := concat_ws(E'\n',
    'Desde la web (' || to_char(now() at time zone 'America/Guayaquil', 'DD/MM HH24:MI') || ')',
    nullif(v_msg, ''),
    case when coalesce(p_extra->>'ciudad', '') <> '' then 'Ciudad: ' || left(p_extra->>'ciudad', 80) end
  );

  -- ¿Ya existe? (mismo teléfono por sus últimos 9 dígitos, o mismo email)
  select id into v_id from leads
  where proyecto_id = v_pid
    and (
      (length(v_tel_dig) >= 7 and right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 9) = right(v_tel_dig, 9))
      or (v_email <> '' and lower(coalesce(email, '')) = v_email)
    )
  order by created_at
  limit 1;

  if v_id is not null then
    update leads set
      mensaje = case when coalesce(mensaje, '') = '' then v_nota else mensaje || E'\n\n' || v_nota end,
      email = coalesce(nullif(email, ''), nullif(v_email, '')),
      updated_at = now()
    where id = v_id;
    insert into actividad (proyecto_id, actor_nombre, entidad, entidad_id, accion, titulo, detalle)
    values (v_pid, 'Web del viaje', 'lead', v_id, 'web_interes',
      'Volvió a dejar sus datos en la web: ' || v_nombre,
      jsonb_build_object('fuente', v_fuente, 'mensaje', nullif(v_msg, ''), 'extra', p_extra));
    return jsonb_build_object('ok', true, 'nuevo', false);
  end if;

  insert into leads (nombre, tel, email, fuente, estado, mensaje, tiempo, proyecto_id, creado_por_nombre)
  values (v_nombre, v_tel, nullif(v_email, ''), v_fuente, 'nuevo', v_nota, 'ahora', v_pid, 'Web del viaje')
  returning id into v_id;

  insert into actividad (proyecto_id, actor_nombre, entidad, entidad_id, accion, titulo, detalle)
  values (v_pid, 'Web del viaje', 'lead', v_id, 'creo',
    'Se registró desde la web: ' || v_nombre,
    jsonb_build_object('fuente', v_fuente, 'mensaje', nullif(v_msg, ''), 'extra', p_extra));

  return jsonb_build_object('ok', true, 'nuevo', true);
end;
$$;

revoke all on function public.viaje_registrar_interes(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.viaje_obtener_publico(text) to anon, authenticated;
grant execute on function public.viaje_registrar_interes(text, text, text, text, text, text, jsonb) to anon, authenticated;
