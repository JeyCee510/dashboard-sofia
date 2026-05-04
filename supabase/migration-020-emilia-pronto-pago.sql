-- Migración puntual: Emilia Muñoz pasa a plan pronto-pago.
-- Total se ajusta de $640 a $484 (precio fijo de pronto-pago).
-- Pagado se mantiene en lo que ya pagó. Estado se queda 'parcial' porque
-- aún no termina de pagar. El tipo del pago en `pagos` se actualiza a
-- 'pronto-pago' para reflejar la intención del plan.

UPDATE alumnas SET total = 484 WHERE nombre = 'Emilia Muñoz';
UPDATE pagos SET tipo = 'pronto-pago' WHERE alumna_id IN (SELECT id FROM alumnas WHERE nombre = 'Emilia Muñoz');
INSERT INTO eventos_alumna (alumna_id, tipo, titulo, subtitulo)
SELECT id, 'tipo_cambiado', 'Plan cambiado a pronto pago', 'Total ajustado de $640 a $484'
FROM alumnas WHERE nombre = 'Emilia Muñoz';
