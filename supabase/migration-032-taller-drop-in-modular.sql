-- 032: Patrón "taller drop-in modular" — primer proyecto: "Refinar la Práctica"
-- Cada inscrita elige cuántos encuentros toma (1, 2, 3 o paquete completo).
-- Aislado del namespace de la formación (alumnas/leads) — namespace taller_*.
--
-- APLICADA EN PROD 2026-06-23 vía MCP supabase apply_migration.
-- Esta copia versionada documenta el schema y permite reproducibilidad.

-- ────────────────────────────────────────────────────────────────────
-- 1) PROYECTOS (genérico, escalable a futuros productos)
-- ────────────────────────────────────────────────────────────────────
create table if not exists proyectos (
  id           bigserial primary key,
  slug         text unique not null,
  nombre       text not null,
  tipo         text not null,
  estado       text not null default 'activo',
  descripcion  text,
  config       jsonb not null default '{}'::jsonb,
  borrador_id  bigint references proyectos_borradores(id) on delete set null,
  creado_por   text,
  created_at   timestamptz not null default now(),
  archivado_at timestamptz
);

create index if not exists idx_proyectos_estado on proyectos(estado);
create index if not exists idx_proyectos_slug on proyectos(slug);

alter table proyectos enable row level security;
drop policy if exists proyectos_admin on proyectos;
create policy proyectos_admin on proyectos for all using (is_authorized()) with check (is_authorized());
drop policy if exists proyectos_lectura_publica on proyectos;
create policy proyectos_lectura_publica on proyectos for select using (estado = 'activo');

-- ────────────────────────────────────────────────────────────────────
-- 2) ENCUENTROS
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_encuentros (
  id          bigserial primary key,
  proyecto_id bigint not null references proyectos(id) on delete cascade,
  numero      int not null,
  fecha       date not null,
  hora_inicio text,
  hora_fin    text,
  cupos       int not null default 22,
  ubicacion   text,
  titulo      text,
  notas       text,
  created_at  timestamptz not null default now(),
  unique(proyecto_id, numero)
);

alter table taller_encuentros enable row level security;
drop policy if exists encuentros_admin on taller_encuentros;
create policy encuentros_admin on taller_encuentros for all using (is_authorized()) with check (is_authorized());
drop policy if exists encuentros_lectura_publica on taller_encuentros;
create policy encuentros_lectura_publica on taller_encuentros for select using (true);

-- ────────────────────────────────────────────────────────────────────
-- 3) INSCRITOS
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_inscritos (
  id                 bigserial primary key,
  proyecto_id        bigint not null references proyectos(id) on delete cascade,
  nombre             text not null,
  tel                text,
  instagram          text,
  email              text,
  notas              text,
  plan_pagos         text,
  comprobante_token  text unique,
  total_calculado    numeric,
  precio_especial    boolean default false,
  precio_motivo      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_inscritos_proyecto on taller_inscritos(proyecto_id);
create index if not exists idx_inscritos_comp_token on taller_inscritos(comprobante_token);

alter table taller_inscritos enable row level security;
drop policy if exists inscritos_admin on taller_inscritos;
create policy inscritos_admin on taller_inscritos for all using (is_authorized()) with check (is_authorized());
drop policy if exists inscritos_lectura_comp_token on taller_inscritos;
create policy inscritos_lectura_comp_token on taller_inscritos for select using (comprobante_token is not null);

-- ────────────────────────────────────────────────────────────────────
-- 4) RELACIÓN inscrito ↔ encuentro elegido
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_inscripciones_encuentros (
  id           bigserial primary key,
  inscrito_id  bigint not null references taller_inscritos(id) on delete cascade,
  encuentro_id bigint not null references taller_encuentros(id) on delete cascade,
  asistio      boolean,
  fuente       text default 'manual',
  created_at   timestamptz not null default now(),
  unique(inscrito_id, encuentro_id)
);

create index if not exists idx_tie_encuentro on taller_inscripciones_encuentros(encuentro_id);
create index if not exists idx_tie_inscrito on taller_inscripciones_encuentros(inscrito_id);

alter table taller_inscripciones_encuentros enable row level security;
drop policy if exists tie_admin on taller_inscripciones_encuentros;
create policy tie_admin on taller_inscripciones_encuentros for all using (is_authorized()) with check (is_authorized());
drop policy if exists tie_lectura_publica on taller_inscripciones_encuentros;
create policy tie_lectura_publica on taller_inscripciones_encuentros for select using (true);

-- ────────────────────────────────────────────────────────────────────
-- 5) PREINSCRIPCIONES PÚBLICAS — tokens para link personalizado
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_preinscripciones (
  id              bigserial primary key,
  proyecto_id     bigint not null references proyectos(id) on delete cascade,
  token           text unique not null,
  nombre          text,
  tel             text,
  instagram       text,
  email           text,
  encuentros_ids  bigint[],
  completada_at   timestamptz,
  inscrito_id     bigint references taller_inscritos(id) on delete set null,
  origen          text default 'admin',
  lead_id         bigint references leads(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pre_token on taller_preinscripciones(token);
create index if not exists idx_pre_proyecto on taller_preinscripciones(proyecto_id);

alter table taller_preinscripciones enable row level security;
drop policy if exists pre_admin on taller_preinscripciones;
create policy pre_admin on taller_preinscripciones for all using (is_authorized()) with check (is_authorized());
drop policy if exists pre_lectura_token on taller_preinscripciones;
create policy pre_lectura_token on taller_preinscripciones for select using (true);

-- ────────────────────────────────────────────────────────────────────
-- 6) PAGOS
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_pagos (
  id              bigserial primary key,
  inscrito_id     bigint not null references taller_inscritos(id) on delete cascade,
  monto           numeric not null,
  forma_pago      text,
  comprobante_url text,
  validado        boolean default false,
  validado_at     timestamptz,
  validado_por    text,
  fecha           timestamptz not null default now(),
  notas           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pagos_inscrito on taller_pagos(inscrito_id);

alter table taller_pagos enable row level security;
drop policy if exists pagos_admin on taller_pagos;
create policy pagos_admin on taller_pagos for all using (is_authorized()) with check (is_authorized());
drop policy if exists pagos_lectura_publica on taller_pagos;
create policy pagos_lectura_publica on taller_pagos for select using (
  exists (select 1 from taller_inscritos i where i.id = taller_pagos.inscrito_id and i.comprobante_token is not null)
);
drop policy if exists pagos_insert_publico on taller_pagos;
create policy pagos_insert_publico on taller_pagos for insert with check (
  exists (select 1 from taller_inscritos i where i.id = taller_pagos.inscrito_id and i.comprobante_token is not null)
);

-- ────────────────────────────────────────────────────────────────────
-- 7) EVENTOS TIMELINE
-- ────────────────────────────────────────────────────────────────────
create table if not exists taller_eventos (
  id          bigserial primary key,
  inscrito_id bigint references taller_inscritos(id) on delete cascade,
  tipo        text not null,
  payload     jsonb default '{}'::jsonb,
  actor       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_eventos_inscrito on taller_eventos(inscrito_id);
alter table taller_eventos enable row level security;
drop policy if exists eventos_admin on taller_eventos;
create policy eventos_admin on taller_eventos for all using (is_authorized()) with check (is_authorized());

-- ────────────────────────────────────────────────────────────────────
-- 8) RPCs públicos
-- ────────────────────────────────────────────────────────────────────

-- Vista pública del proyecto + encuentros con cupos en vivo
create or replace function taller_obtener_publico(p_slug text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'proyecto', jsonb_build_object(
      'id', p.id, 'slug', p.slug, 'nombre', p.nombre, 'tipo', p.tipo,
      'descripcion', p.descripcion, 'config', p.config
    ),
    'encuentros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'numero', e.numero, 'fecha', e.fecha,
        'hora_inicio', e.hora_inicio, 'hora_fin', e.hora_fin,
        'cupos', e.cupos, 'titulo', e.titulo, 'ubicacion', e.ubicacion,
        'ocupados', (select count(*) from taller_inscripciones_encuentros tie where tie.encuentro_id = e.id)
      ) order by e.numero)
      from taller_encuentros e where e.proyecto_id = p.id
    ), '[]'::jsonb)
  )
  from proyectos p where p.slug = p_slug and p.estado = 'activo';
$$;

grant execute on function taller_obtener_publico(text) to anon, authenticated;

-- Cargar preinscripción por token (prefill del form personalizado)
create or replace function taller_cargar_preinscripcion(p_token text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'id', pre.id, 'proyecto_id', pre.proyecto_id, 'token', pre.token,
    'nombre', pre.nombre, 'tel', pre.tel, 'instagram', pre.instagram, 'email', pre.email,
    'completada_at', pre.completada_at, 'encuentros_ids', pre.encuentros_ids,
    'inscrito_id', pre.inscrito_id, 'origen', pre.origen
  )
  from taller_preinscripciones pre where pre.token = p_token;
$$;

grant execute on function taller_cargar_preinscripcion(text) to anon, authenticated;

-- Admin: crear preinscripción con link personalizado (opcionalmente desde un lead)
create or replace function taller_crear_preinscripcion(
  p_proyecto_id bigint,
  p_lead_id bigint default null,
  p_nombre text default null,
  p_tel text default null,
  p_instagram text default null
) returns text language plpgsql security definer as $$
declare
  v_token text;
  v_nombre text;
  v_tel text;
  v_ig text;
begin
  if not is_authorized() then raise exception 'No autorizado'; end if;
  v_token := encode(gen_random_bytes(16), 'hex');
  if p_lead_id is not null then
    select coalesce(p_nombre, nombre), coalesce(p_tel, tel), coalesce(p_instagram, instagram)
      into v_nombre, v_tel, v_ig from leads where id = p_lead_id;
  else
    v_nombre := p_nombre; v_tel := p_tel; v_ig := p_instagram;
  end if;
  insert into taller_preinscripciones (proyecto_id, token, nombre, tel, instagram, lead_id, origen)
  values (p_proyecto_id, v_token, v_nombre, v_tel, v_ig, p_lead_id, 'admin');
  return v_token;
end;
$$;

grant execute on function taller_crear_preinscripcion(bigint, bigint, text, text, text) to authenticated;

-- Submit del form personalizado (con token)
create or replace function taller_completar_preinscripcion(
  p_token text, p_nombre text, p_tel text, p_instagram text, p_email text, p_encuentros_ids bigint[]
) returns jsonb language plpgsql security definer as $$
declare
  v_pre record; v_proyecto record;
  v_inscrito_id bigint; v_comp_token text; v_total numeric;
  v_n_enc int; v_tiers jsonb; v_lleno_id bigint;
begin
  select * into v_pre from taller_preinscripciones where token = p_token;
  if not found then raise exception 'Token inválido'; end if;
  if v_pre.completada_at is not null then raise exception 'Ya completaste tu inscripción'; end if;
  if p_nombre is null or trim(p_nombre) = '' then raise exception 'Falta tu nombre'; end if;
  if p_encuentros_ids is null or array_length(p_encuentros_ids, 1) is null then raise exception 'Elige al menos un encuentro'; end if;

  select * into v_proyecto from proyectos where id = v_pre.proyecto_id;
  v_tiers := coalesce(v_proyecto.config->'tiers', '{}'::jsonb);

  select e.id into v_lleno_id
  from unnest(p_encuentros_ids) eid
  join taller_encuentros e on e.id = eid
  where (select count(*) from taller_inscripciones_encuentros tie where tie.encuentro_id = e.id) >= e.cupos
  limit 1;
  if v_lleno_id is not null then raise exception 'Un encuentro ya no tiene cupos'; end if;

  v_n_enc := array_length(p_encuentros_ids, 1);
  v_total := coalesce((v_tiers->>v_n_enc::text)::numeric, (v_tiers->>'default')::numeric * v_n_enc, 0);
  v_comp_token := encode(gen_random_bytes(16), 'hex');

  insert into taller_inscritos (proyecto_id, nombre, tel, instagram, email, comprobante_token, total_calculado)
  values (v_pre.proyecto_id, trim(p_nombre), p_tel, p_instagram, p_email, v_comp_token, v_total)
  returning id into v_inscrito_id;

  insert into taller_inscripciones_encuentros (inscrito_id, encuentro_id, fuente)
  select v_inscrito_id, unnest(p_encuentros_ids), 'publico';

  update taller_preinscripciones set
    completada_at = now(), inscrito_id = v_inscrito_id,
    nombre = p_nombre, tel = p_tel, instagram = p_instagram, email = p_email,
    encuentros_ids = p_encuentros_ids
  where id = v_pre.id;

  insert into taller_eventos (inscrito_id, tipo, payload, actor)
  values (v_inscrito_id, 'inscripcion_publica',
          jsonb_build_object('encuentros', p_encuentros_ids, 'total', v_total, 'origen', v_pre.origen),
          coalesce(v_pre.nombre, p_nombre));

  return jsonb_build_object('inscrito_id', v_inscrito_id, 'comprobante_token', v_comp_token,
                            'total', v_total, 'proyecto_slug', v_proyecto.slug);
end;
$$;

grant execute on function taller_completar_preinscripcion(text, text, text, text, text, bigint[]) to anon, authenticated;

-- RPC público "abierto" para inscripción sin token previo (/taller/<slug>)
create or replace function taller_inscripcion_publica(
  p_slug text, p_nombre text, p_tel text, p_instagram text, p_email text, p_encuentros_ids bigint[]
) returns jsonb language plpgsql security definer as $$
declare
  v_proyecto record; v_inscrito_id bigint;
  v_comp_token text; v_pre_token text; v_total numeric;
  v_n_enc int; v_tiers jsonb; v_lleno_id bigint;
begin
  if p_nombre is null or trim(p_nombre) = '' then raise exception 'Falta tu nombre'; end if;
  if p_encuentros_ids is null or array_length(p_encuentros_ids, 1) is null then raise exception 'Elige al menos un encuentro'; end if;
  if p_tel is null or trim(p_tel) = '' then raise exception 'Necesitamos un WhatsApp'; end if;

  select * into v_proyecto from proyectos where slug = p_slug and estado = 'activo';
  if not found then raise exception 'Taller no disponible'; end if;
  v_tiers := coalesce(v_proyecto.config->'tiers', '{}'::jsonb);

  select e.id into v_lleno_id
  from unnest(p_encuentros_ids) eid
  join taller_encuentros e on e.id = eid
  where e.proyecto_id = v_proyecto.id and
        (select count(*) from taller_inscripciones_encuentros tie where tie.encuentro_id = e.id) >= e.cupos
  limit 1;
  if v_lleno_id is not null then raise exception 'Un encuentro ya no tiene cupos'; end if;

  v_n_enc := array_length(p_encuentros_ids, 1);
  v_total := coalesce((v_tiers->>v_n_enc::text)::numeric, (v_tiers->>'default')::numeric * v_n_enc, 0);
  v_comp_token := encode(gen_random_bytes(16), 'hex');
  v_pre_token := encode(gen_random_bytes(16), 'hex');

  insert into taller_inscritos (proyecto_id, nombre, tel, instagram, email, comprobante_token, total_calculado)
  values (v_proyecto.id, trim(p_nombre), p_tel, p_instagram, p_email, v_comp_token, v_total)
  returning id into v_inscrito_id;

  insert into taller_inscripciones_encuentros (inscrito_id, encuentro_id, fuente)
  select v_inscrito_id, unnest(p_encuentros_ids), 'publico';

  insert into taller_preinscripciones (proyecto_id, token, nombre, tel, instagram, email,
                                       encuentros_ids, completada_at, inscrito_id, origen)
  values (v_proyecto.id, v_pre_token, p_nombre, p_tel, p_instagram, p_email,
          p_encuentros_ids, now(), v_inscrito_id, 'publico');

  insert into taller_eventos (inscrito_id, tipo, payload, actor)
  values (v_inscrito_id, 'inscripcion_publica',
          jsonb_build_object('encuentros', p_encuentros_ids, 'total', v_total, 'origen', 'publico'),
          p_nombre);

  return jsonb_build_object('inscrito_id', v_inscrito_id, 'comprobante_token', v_comp_token,
                            'total', v_total, 'proyecto_slug', v_proyecto.slug);
end;
$$;

grant execute on function taller_inscripcion_publica(text, text, text, text, text, bigint[]) to anon, authenticated;

-- Lookup por comprobante_token (página /taller-comprobante/<token>)
create or replace function taller_obtener_por_comprobante_token(p_token text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'inscrito', jsonb_build_object(
      'id', i.id, 'nombre', i.nombre, 'total_calculado', i.total_calculado,
      'proyecto', jsonb_build_object('slug', p.slug, 'nombre', p.nombre)
    ),
    'pagado', coalesce((
      select sum(monto) from taller_pagos pg where pg.inscrito_id = i.id and pg.validado = true
    ), 0),
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'monto', pg.monto, 'forma_pago', pg.forma_pago,
        'validado', pg.validado, 'fecha', pg.fecha, 'comprobante_url', pg.comprobante_url
      ) order by pg.fecha desc)
      from taller_pagos pg where pg.inscrito_id = i.id
    ), '[]'::jsonb)
  )
  from taller_inscritos i join proyectos p on p.id = i.proyecto_id
  where i.comprobante_token = p_token;
$$;

grant execute on function taller_obtener_por_comprobante_token(text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 9) SEED — proyecto "Refinar la Práctica" (desde borrador 1)
-- ────────────────────────────────────────────────────────────────────
-- (ya aplicado en prod; idempotente)
insert into proyectos (slug, nombre, tipo, estado, descripcion, config, borrador_id, creado_por)
values (
  'refinar-la-practica', 'Refinar la Práctica', 'taller_drop_in', 'activo',
  'Taller para profundizar y refinar la práctica personal de Yoga. 6 encuentros entre julio y noviembre, diseñados en secuencia para quienes vienen a todo pero también funcionan por sí mismos.',
  jsonb_build_object(
    'ubicacion', 'Domo', 'modalidad', 'presencial', 'nivel', 'Intermedio',
    'publico', 'A quien quiera profundizar y refinar su práctica. Profes y alumnos.',
    'cupos_por_encuentro', 22,
    'tiers', jsonb_build_object('1', 80, '2', 150, '3', 210, '6', 390, 'default', 80),
    'precios_label', jsonb_build_array(
      jsonb_build_object('encuentros', 1, 'precio', 80, 'label', '1 encuentro'),
      jsonb_build_object('encuentros', 2, 'precio', 150, 'label', '2 encuentros'),
      jsonb_build_object('encuentros', 3, 'precio', 210, 'label', '3 encuentros'),
      jsonb_build_object('encuentros', 6, 'precio', 390, 'label', '6 encuentros (paquete completo)')
    )
  ),
  1, 'sofilira@gmail.com'
) on conflict (slug) do nothing;
