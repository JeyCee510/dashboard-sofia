import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect } = React;

// Hook ligero: solo cuenta comprobantes en estado 'pendiente'.
// Se mantiene actualizado en realtime cuando llega uno nuevo o cambia estado.
export function useComprobantesPendientes() {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState(null); // info del más reciente para subtitle

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      // Comprobantes DE ESTE proyecto. Los que entran por el link público
      // anónimo llegan sin proyecto (nadie sabe a qué módulo son): se
      // muestran en todos para que alguien los asigne al validarlos.
      const pid = window.PROYECTO_ID || 2;
      const { count: c } = await supabase
        .from('comprobantes_pago')
        .select('*', { count: 'exact', head: true })
        .or(`proyecto_id.eq.${pid},proyecto_id.is.null`)
        .eq('estado', 'pendiente');
      if (cancelled) return;
      setCount(c || 0);

      // Tomar el más reciente para el subtitle
      const { data } = await supabase
        .from('comprobantes_pago')
        .select('nombre_cliente, monto, created_at')
        .or(`proyecto_id.eq.${pid},proyecto_id.is.null`)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      setLatest(data?.[0] || null);
    };

    cargar();

    const ch = supabase
      .channel('comprobantes-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comprobantes_pago' }, cargar)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  return { count, latest };
}
