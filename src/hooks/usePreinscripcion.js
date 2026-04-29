import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Lee preinscripción asociada a un lead. Devuelve la última (cualquier estado).
// Las admin (Sofía/Juan) tienen RLS para SELECT directo.
export function usePreinscripcion(leadId, alumnaId) {
  const [pre, setPre] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!leadId && !alumnaId) { setPre(null); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('preinscripcion').select('*').order('created_at', { ascending: false }).limit(1);
    if (leadId) q = q.eq('lead_id', leadId);
    else if (alumnaId) q = q.eq('alumna_id', alumnaId);
    const { data, error } = await q;
    if (error) console.error('[preinscripcion] load', error);
    setPre(data && data[0] ? data[0] : null);
    setLoading(false);
  }, [leadId, alumnaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Crear (o recuperar la pendiente existente) — usa RPC
  const generar = useCallback(async () => {
    if (!leadId) return null;
    const { data, error } = await supabase.rpc('crear_preinscripcion', { p_lead_id: leadId });
    if (error) { console.error('[preinscripcion] generar', error); return null; }
    await cargar();
    return data; // token uuid
  }, [leadId, cargar]);

  return { pre, loading, generar, recargar: cargar };
}
