import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

const DEFAULT_AJUSTES = {
  capacidad: 25,
  precioRegular: 640,
  precioProntoPago: 484,
  precioReserva: 200,
  fechaProntoPago: '10 mayo',
  ownerName: 'Sofía Lira',
  studioName: 'Yoga Sofía Lira',
  lugar: 'Domo Soulspace · Tumbaco',
  diasFormacion: [
    { idx: 0, fecha: '6 jun', label: 'Día 1', encuentro: 1 },
    { idx: 1, fecha: '7 jun', label: 'Día 2', encuentro: 1 },
    { idx: 2, fecha: '13 jun', label: 'Día 3', encuentro: 2 },
    { idx: 3, fecha: '14 jun', label: 'Día 4', encuentro: 2 },
    { idx: 4, fecha: '20 jun', label: 'Día 5', encuentro: 3 },
    { idx: 5, fecha: '21 jun', label: 'Día 6', encuentro: 3 },
  ],
  bonoSillaCupos: 6,
  plantillasWA: [
    { id: 'pgrm', titulo: 'Datos del programa', cuerpo: 'Hola! Te paso los detalles de la formación: 50 horas, 6-21 junio, sáb y dom de 7:30 a 18:00 en Domo Soulspace, Tumbaco. ¿Quieres que te llame? 🙏' },
    { id: 'tr', titulo: 'Datos de transferencia', cuerpo: 'Transferencias a:\nSofía Lira\nProdubanco Ahorro #12054049429\nCédula #1709369225\nsofilira@gmail.com\n\nApenas tengas el comprobante mándamelo y reservamos 🌿' },
    { id: 'ub', titulo: 'Ubicación', cuerpo: 'Domo Soulspace, calle Alfredo Donoso, La Morita, Tumbaco.\nUbicación en Maps: https://maps.app.goo.gl/WrauzvKJot5NbNZF7' },
    { id: 'crn', titulo: 'Cronograma', cuerpo: 'Cronograma del día:\n7:30-11:30 práctica y teoría\n11:30-14:00 almuerzo\n14:00-16:30 laboratorio técnico\n16:30-18:00 yogasana' },
  ],
};

// Pequeño debounce para no spamear writes mientras se edita
function useDebounced(fn, delay = 700) {
  const tref = React.useRef(null);
  return React.useCallback((...args) => {
    if (tref.current) clearTimeout(tref.current);
    tref.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export function useAjustes() {
  const [ajustes, setAjustes] = useState(DEFAULT_AJUSTES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('ajustes').select('data').eq('id', 1).single();
      if (cancelled) return;
      if (error) {
        console.error('[ajustes] load', error);
      } else if (data?.data) {
        setAjustes({ ...DEFAULT_AJUSTES, ...data.data });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: si Sofía cambia ajustes en otra pestaña, sincronizar
  useEffect(() => {
    const ch = supabase.channel('ajustes-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ajustes' }, (payload) => {
        if (payload.new?.data) setAjustes(prev => ({ ...DEFAULT_AJUSTES, ...payload.new.data }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const persist = useCallback(async (full) => {
    const { error } = await supabase.from('ajustes').update({ data: full }).eq('id', 1);
    if (error) console.error('[ajustes] update', error);
  }, []);

  const persistDebounced = useDebounced(persist, 700);

  const updateAjustes = useCallback((patch) => {
    setAjustes(prev => {
      const next = { ...prev, ...patch };
      persistDebounced(next);
      return next;
    });
  }, [persistDebounced]);

  return { ajustes, loading, updateAjustes };
}

export { DEFAULT_AJUSTES };
