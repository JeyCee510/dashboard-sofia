-- migration-026-normalize-pago-estado.sql
-- Backfill: alumnas.pago era un mix de "estado" (pendiente/parcial/completo)
-- y "tipo de pago" (pronto-pago). A partir de ahora se deriva el estado
-- puramente de pagado vs total. Esta migración normaliza filas existentes
-- para que la columna no muestre 'pronto-pago' cuando todavía falta plata.

BEGIN;

UPDATE public.alumnas
   SET pago = CASE
     WHEN COALESCE(total, 0) > 0 AND COALESCE(pagado, 0) >= total THEN 'completo'
     WHEN COALESCE(pagado, 0) > 0 THEN 'parcial'
     ELSE 'pendiente'
   END;

COMMIT;
