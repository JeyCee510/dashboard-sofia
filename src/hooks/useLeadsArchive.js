import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Lee leads_archive (papelera). Permite restaurar y purgar definitivamente.
//
// NOTA: hoy la papelera de la app usa `useArchive` (leads + alumnas juntos).
// Este hook quedó sin consumidores; se le deja el filtro por proyecto para que
// no reviva como fuga de datos entre módulos si alguien lo reengancha.
export function useLeadsArchive() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads_archive')
      .select('*')
      .eq('proyecto_id', window.PROYECTO_ID || 2)
      .order('deleted_at', { ascending: false })
      .limit(100);
    if (error) console.error('[leads_archive] load', error);
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const restaurar = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('restaurar_lead', { p_id: id });
    if (error) { console.error('[leads_archive] restaurar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    await cargar();
  }, [cargar]);

  const purgarDefinitivo = useCallback(async (id) => {
    const { error } = await supabase.from('leads_archive').delete().eq('id', id);
    if (error) { console.error('[leads_archive] purge', error); throw error; }
    await cargar();
  }, [cargar]);

  return { items, loading, restaurar, purgarDefinitivo, recargar: cargar };
}
