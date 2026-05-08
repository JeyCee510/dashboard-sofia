-- migration-025-fix-gabriela-y-silla-40.sql
-- 1) Corrección manual del registro de Gabriela Moyano (id=15):
--    Compró 2 encuentros (fines de semana por definir), renunció a silla,
--    total $370, pagó $200 + $170 = $370.
-- 2) Actualiza el evento silla_renunciada para reflejar el nuevo diferencial.
-- 3) (Opcional futuro) Si en algún momento se persiste precios en ajustes,
--    actualizarlos también. Por ahora ajustes.precios es NULL → JS default.

BEGIN;

-- Alumna ──
UPDATE public.alumnas
   SET tipo_inscripcion   = 'dos_encuentros',
       encuentros_asistir = NULL,           -- Gabriela aún no define cuáles 2
       bono_silla         = false,
       total              = 370,
       pagado             = 370,
       pago               = 'completo'
 WHERE id = 15;

-- Pagos ──
-- Primer pago: $200 (era pronto-pago; ahora es parcial dado que ya no es esa promo)
UPDATE public.pagos
   SET tipo  = 'reserva',
       notas = COALESCE(notas, '') || ' [corregido en migration-025]'
 WHERE id = 14;

-- Segundo pago: era $200, debe ser $170
UPDATE public.pagos
   SET monto = 170,
       tipo  = 'completo',
       notas = COALESCE(notas, '') || ' [corregido en migration-025: era 200, ahora 170]'
 WHERE id = 15;

-- Evento silla_renunciada ──
-- Antes decía "Pronto pago: precio fijo, no baja". Ahora refleja el nuevo
-- diferencial $40 con monto.
UPDATE public.eventos_alumna
   SET subtitulo = 'Total bajó $40 (de $410 a $370)',
       monto     = -40
 WHERE alumna_id = 15
   AND tipo = 'silla_renunciada';

COMMIT;
