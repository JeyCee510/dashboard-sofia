-- ─────────────────────────────────────────────────────────────────────────
-- Migración 016 · Forma de pago en `pagos`
--
-- Hasta ahora la tabla `pagos` solo distinguía `tipo` (reserva/parcial/
-- pronto-pago/completo/saldo) que mezcla dos dimensiones:
--   - estado/categoría del pago (reserva, saldo, etc.)
--   - método (efectivo, transferencia, etc.)
--
-- Añadimos columna `forma` para el método: transferencia | efectivo |
-- payphone | canje. Default 'transferencia' (lo más común). Pagos viejos
-- se asumen transferencia por la regla de origen.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS forma text NOT NULL DEFAULT 'transferencia';

CREATE INDEX IF NOT EXISTS pagos_forma_idx ON public.pagos(forma);
