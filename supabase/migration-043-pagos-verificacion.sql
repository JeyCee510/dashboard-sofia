-- Migración 043 · Verificación de pagos
--
-- Sofía necesita distinguir "lo registré" de "confirmé que la plata entró a la
-- cuenta". Hasta ahora un pago registrado era indistinguible de uno verificado
-- contra el banco, y con tres cuentas distintas (Sofía, Izhcayluma, Wisdom)
-- esa revisión es justamente el control que hace falta.
alter table public.pagos
  add column if not exists verificado_at    timestamptz,
  add column if not exists verificado_por   text,
  add column if not exists verificado_notas text;

comment on column public.pagos.verificado_at is
  'Cuándo alguien confirmó que el dinero efectivamente entró a la cuenta. NULL = registrado pero sin revisar.';

create index if not exists pagos_sin_verificar_idx
  on public.pagos (proyecto_id)
  where verificado_at is null;
