-- migration-030-plan-pagos.sql
-- Campo libre para que Sofía anote cómo se está acordando el plan
-- de pagos del saldo pendiente de cada alumna. Solo informativo.

ALTER TABLE public.alumnas
  ADD COLUMN IF NOT EXISTS plan_pagos text;
