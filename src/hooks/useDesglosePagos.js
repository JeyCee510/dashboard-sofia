import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Desglose de lo cobrado en el ciclo, por dos ejes distintos:
//
//   · por FORMA (transferencia / efectivo / payphone / canje)
//   · por DESTINO — a qué cuenta entró realmente el dinero
//
// El segundo es el que importa en proyectos con aliados (Seminario): el abono
// de los retiros se paga DIRECTO a la cuenta del hospedaje, así que esa plata
// nunca pasa por Sofía y NO debe engordar su estado de cuenta. Se registra
// igual, porque para el estudiante sí cuenta como pagado.
// ─────────────────────────────────────────────────────────────────────
const FORMAS = ['transferencia', 'efectivo', 'payphone', 'canje'];
const DESTINO_PROPIO = 'sofia'; // el resto son cuentas de aliados

export function useDesglosePagos() {
  const [desglose, setDesglose] = useState({
    transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0, count: 0,
    propio: 0, aliados: 0, porDestino: {},
  });
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    // Sólo los pagos DEL PROYECTO activo (antes sumaba los de todos los
    // proyectos: el Seminario mostraba los $4.640 de la formación).
    const { data, error } = await supabase
      .from('pagos')
      .select('monto, forma, destino')
      .eq('proyecto_id', window.PROYECTO_ID || 2);
    if (error) { console.error('[desglose pagos]', error); return; }
    const out = {
      transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0, count: 0,
      propio: 0, aliados: 0, porDestino: {},
    };
    (data || []).forEach(p => {
      const monto = Number(p.monto) || 0;
      const forma = FORMAS.includes(p.forma) ? p.forma : 'transferencia';
      out[forma] += monto;
      out.total += monto;
      out.count += 1;
      // Sin destino = proyectos de una sola cuenta (formación, estudio): todo propio.
      const destino = p.destino || DESTINO_PROPIO;
      out.porDestino[destino] = (out.porDestino[destino] || 0) + monto;
      if (destino === DESTINO_PROPIO) out.propio += monto;
      else out.aliados += monto;
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
