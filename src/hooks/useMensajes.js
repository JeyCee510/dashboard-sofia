import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

function fromDb(row) {
  return {
    id: row.id,
    alumna_id: row.alumna_id,
    alumna: row.alumna_nombre,
    preview: row.preview,
    tiempo: row.tiempo || 'ahora',
    sinLeer: !!row.sin_leer,
    esLead: !!row.es_lead,
    canal: row.canal || 'whatsapp',
  };
}

export function useMensajes(proyectoId = 2) {
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) console.error('[mensajes] load', error);
      setMensajes((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [proyectoId]);

  useEffect(() => {
    const ch = supabase.channel('mensajes-changes-' + proyectoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes', filter: `proyecto_id=eq.${proyectoId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMensajes(prev => [fromDb(payload.new), ...prev].slice(0, 20));
        } else if (payload.eventType === 'UPDATE') {
          setMensajes(prev => prev.map(m => m.id === payload.new.id ? fromDb(payload.new) : m));
        } else if (payload.eventType === 'DELETE') {
          setMensajes(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId]);

  const marcarLeido = useCallback(async (id) => {
    setMensajes(prev => prev.map(m => m.id === id ? { ...m, sinLeer: false } : m));
    const { error } = await supabase.from('mensajes').update({ sin_leer: false }).eq('id', id);
    if (error) console.error('[mensajes] marcarLeido', error);
  }, []);

  return { mensajes, loading, marcarLeido };
}
