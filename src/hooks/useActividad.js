import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ──────────────────────────────────────────────────────────────
// Lectura de la bitácora.
//   useActividad({ proyectoId })                 → registro global del proyecto
//   useActividad({ proyectoId, entidad, entidadId }) → historial de UNA ficha
// ──────────────────────────────────────────────────────────────
export function useActividad({ proyectoId, entidad = null, entidadId = null, limit = 100 } = {}) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!proyectoId) { setEventos([]); setLoading(false); return; }
    let q = supabase
      .from('actividad')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (entidad) q = q.eq('entidad', entidad);
    if (entidadId) q = q.eq('entidad_id', entidadId);
    const { data, error } = await q;
    if (error) console.warn('[actividad] load', error);
    setEventos(data || []);
    setLoading(false);
  }, [proyectoId, entidad, entidadId, limit]);

  useEffect(() => {
    setLoading(true);
    cargar();
    const ch = supabase
      .channel('actividad-' + proyectoId + '-' + (entidadId || 'all'))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actividad', filter: `proyecto_id=eq.${proyectoId}` },
        cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar, proyectoId, entidadId]);

  return { eventos, loading, recargar: cargar };
}

window.useActividad = useActividad;
