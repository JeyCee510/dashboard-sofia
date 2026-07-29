import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Devuelve un objeto { transferencia: $X, efectivo: $Y, payphone: $Z,
// canje: $W, total: $T, count: N } sumando todos los pagos del ciclo.
// Realtime: si entra/borra un pago, se recalcula.
// ─────────────────────────────────────────────────────────────────────
const FORMAS = ['transferencia', 'efectivo', 'payphone', 'canje'];

export function useDesglosePagos() {
  const [desglose, setDesglose] = useState({
    transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0, count: 0,
  });
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    // Sólo los pagos DEL PROYECTO activo (antes sumaba los de todos los
    // proyectos: el Seminario mostraba los $4.640 de la formación).
    const { data, error } = await supabase
      .from('pagos')
      .select('monto, forma')
      .eq('proyecto_id', window.PROYECTO_ID || 2);
    if (error) { console.error('[desglose pagos]', error); return; }
    const out = { transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0, count: 0 };
    (data || []).forEach(p => {
      const monto = Number(p.monto) || 0;
      const forma = FORMAS.includes(p.forma) ? p.forma : 'transferencia';
      out[forma] += monto;
      out.total += monto;
      out.count += 1;
    });
    setDesglose(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('pagos-desglose')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  return { desglose, loading, recargar: cargar };
}

window.useDesglosePagos = useDesglosePagos;
