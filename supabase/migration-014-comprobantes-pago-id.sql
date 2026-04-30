-- ─────────────────────────────────────────────────────────────────────────
-- Migración 014 · Vincular comprobantes_pago a la fila de pagos generada
-- al validar.
--
-- Hoy validar() inserta una fila en `pagos` y marca el comprobante como
-- validado, pero no hay vínculo formal. Eso impide revertir el pago de
-- forma segura cuando se borra el comprobante.
--
-- Agrega columna pago_id (FK opcional a pagos). Al borrar un comprobante
-- validado, podemos identificar exactamente qué pago revertir.
-- ON DELETE SET NULL: si por algún motivo se borra el pago sin pasar
-- por el comprobante, este queda con pago_id=null pero no se rompe.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.comprobantes_pago
  ADD COLUMN IF NOT EXISTS pago_id bigint REFERENCES public.pagos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comprobantes_pago_id_idx
  ON public.comprobantes_pago(pago_id);
