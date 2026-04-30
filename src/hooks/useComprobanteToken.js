import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Hook admin: gestiona el token de comprobantes para una persona (lead o estudiante).
// Si no existe, lo genera. Si existe, lo reusa.
export function useComprobanteToken({ leadId, alumnaId }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!leadId && !alumnaId) { setToken(null); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('comprobante_tokens').select('token').order('created_at', { ascending: false }).limit(1);
    if (alumnaId) q = q.eq('alumna_id', alumnaId);
    else if (leadId) q = q.eq('lead_id', leadId);
    const { data } = await q;
    setToken(data?.[0]?.token || null);
    setLoading(false);
  }, [leadId, alumnaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const generar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crear_comprobante_token', {
      p_alumna_id: alumnaId || null,
      p_lead_id: leadId || null,
    });
    if (error) { console.error('[ct] generar', error); throw error; }
    if (data) setToken(data);
    return data;
  }, [leadId, alumnaId]);

  return { token, loading, generar, recargar: cargar };
}
