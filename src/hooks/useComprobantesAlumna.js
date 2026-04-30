import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Lista de comprobantes asociados a una alumna específica.
// Realtime: si llega un comprobante o cambia su estado, se actualiza.
export function useComprobantesAlumna(alumnaId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!alumnaId) { setItems([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('comprobantes_pago')
      .select('*')
      .eq('alumna_id', alumnaId)
      .order('created_at', { ascending: false });
    if (error) console.error('[comprobantes alumna]', error);
    setItems(data || []);
    setLoading(false);
  }, [alumnaId]);

  useEffect(() => {
    setLoading(true);
    cargar();
    if (!alumnaId) return;
    const ch = supabase.channel(`comprobantes-alumna-${alumnaId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'comprobantes_pago',
        filter: `alumna_id=eq.${alumnaId}`,
      }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [alumnaId, cargar]);

  // Genera URL firmada (60 min) para visualizar el archivo
  const obtenerUrl = useCallback(async (storagePath) => {
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(storagePath, 3600);
    if (error) { console.error('[comprobantes signed url]', error); return null; }
    return data?.signedUrl || null;
  }, []);

  return { items, loading, obtenerUrl };
}

window.useComprobantesAlumna = useComprobantesAlumna;
