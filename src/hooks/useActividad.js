import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ──────────────────────────────────────────────────────────────
// Lectura de la bitácora.
//   useActividad({ proyectoId })                 → registro global del proyecto
//   useActividad({ proyectoId, entidad, entidadId }) → historial de UNA ficha
// ──────────────────────────────────────────────────────────────
// Acciones que le importan a Sofía en la vista global. Las ediciones menores
// ('actualizo') se registran igual, pero sólo se ven dentro de cada ficha —
// si no, el registro global se vuelve ruido y deja de leerse.
// El historial es la caja negra de la app: si una acción no está acá, no se
// puede reconstruir después. Ante la duda, incluirla.
export const ACCIONES_RELEVANTES = ['creo', 'pago', 'cambio_estado', 'nota', 'mensaje', 'asigno',
  'link_inscripcion', 'link_pago', 'envio_wa', 'verifico', 'actualizo', 'elimino'];

export function useActividad({ proyectoId, entidad = null, entidadId = null, limit = 100, soloRelevantes = false } = {}) {
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
    if (soloRelevantes) q = q.in('accion', ACCIONES_RELEVANTES);
    const { data, error } = await q;
    if (error) console.warn('[actividad] load', error);
    setEventos(data || []);
    setLoading(false);
  }, [proyectoId, entidad, entidadId, limit, soloRelevantes]);

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
