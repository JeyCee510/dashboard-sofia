-- Migración 041 · `comprobantes_pago.proyecto_id`
--
-- La tabla nació antes del multi-proyecto. Sin `proyecto_id`, el Seminario
-- listaba (y contaba en su badge de pendientes) los comprobantes de la
-- formación. Era el último pendiente conocido de la sección 5 del handoff.
--
-- Los comprobantes que llegan por el link público anónimo (`/comprobante`)
-- no traen proyecto: nadie sabe a qué módulo pertenecen hasta que se asocian
-- a una persona. Quedan en NULL y la UI los muestra en todos los proyectos
-- (filtro `proyecto_id = pid OR proyecto_id IS NULL`) para que alguien los
-- triague; el trigger los adopta en cuanto se les pone alumna_id o lead_id.

alter table public.comprobantes_pago
  add column if not exists proyecto_id bigint references public.proyectos(id);

update public.comprobantes_pago c
set proyecto_id = a.proyecto_id
from public.alumnas a
where c.alumna_id = a.id and c.proyecto_id is null;

update public.comprobantes_pago c
set proyecto_id = l.proyecto_id
from public.leads l
where c.lead_id = l.id and c.proyecto_id is null;

create or replace function public.comprobante_set_proyecto()
returns trigger
language plpgsql
security definer
as $$
BEGIN
  IF NEW.proyecto_id IS NULL AND NEW.alumna_id IS NOT NULL THEN
    SELECT proyecto_id INTO NEW.proyecto_id FROM public.alumnas WHERE id = NEW.alumna_id;
  END IF;
  IF NEW.proyecto_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT proyecto_id INTO NEW.proyecto_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

drop trigger if exists comprobante_set_proyecto_trg on public.comprobantes_pago;
create trigger comprobante_set_proyecto_trg
  before insert or update of alumna_id, lead_id on public.comprobantes_pago
  for each row execute function public.comprobante_set_proyecto();

create index if not exists comprobantes_pago_proyecto_idx
  on public.comprobantes_pago (proyecto_id);
