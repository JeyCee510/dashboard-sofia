import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Hook unificado: trae leads_archive + alumnas_archive en una sola lista,
// ordenada por deleted_at (más reciente primero), cada item con un campo
// `_kind` = 'lead' | 'alumna' para que la UI pueda mostrar badge.
// ─────────────────────────────────────────────────────────────────────
export function useArchive() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [leadsRes, alumnasRes] = await Promise.all([
      supabase.from('leads_archive')
        .select('*').order('deleted_at', { ascending: false }).limit(100),
      supabase.from('alumnas_archive')
        .select('*').order('deleted_at', { ascending: false }).limit(100),
    ]);
    if (leadsRes.error) console.error('[archive] leads', leadsRes.error);
    if (alumnasRes.error) console.error('[archive] alumnas', alumnasRes.error);
    const leads = (leadsRes.data || []).map(r => ({ ...r, _kind: 'lead' }));
    const alumnas = (alumnasRes.data || []).map(r => ({ ...r, _kind: 'alumna' }));
    const merged = [...leads, ...alumnas].sort(
      (a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)
    );
    setItems(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('archive-unified')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_archive' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumnas_archive' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  // Restaurar un lead (sigue siendo lead, mismo id si está libre)
  const restaurarLead = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('restaurar_lead', { p_id: id });
    if (error) { console.error('[archive] restaurar lead', error); throw error; }
    if (data?.error) throw new Error(data.error);
    await cargar();
  }, [cargar]);

  // Restaurar una alumna borrada → vuelve como LEAD (id nuevo)
  const restaurarAlumna = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('restaurar_alumna_como_lead', { p_id: id });
    if (error) { console.error('[archive] restaurar alumna', error); throw error; }
    if (data?.error) throw new Error(data.error);
    await cargar();
  }, [cargar]);

  // Wrapper polimórfico
  const restaurar = useCallback(async (item) => {
    if (item._kind === 'alumna') return restaurarAlumna(item.id);
    return restaurarLead(item.id);
  }, [restaurarLead, restaurarAlumna]);

  // Purgar definitivo
  const purgar = useCallback(async (item) => {
    const tabla = item._kind === 'alumna' ? 'alumnas_archive' : 'leads_archive';
    const { error } = await supabase.from(tabla).delete().eq('id', item.id);
    if (error) { console.error('[archive] purge', error); throw error; }
    await cargar();
  }, [cargar]);

  return { items, loading, restaurar, purgar, recargar: cargar };
}

window.useArchive = useArchive;
