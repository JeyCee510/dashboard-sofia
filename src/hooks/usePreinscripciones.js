import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Lista global de preinscripciones (todas las personas que generaron
// link, completadas o pendientes). Cada item incluye el nombre desde
// snapshot/lead/alumna para que el caller pueda mostrar contexto.
// ─────────────────────────────────────────────────────────────────────
export function usePreinscripciones() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    // Traer todas las preinscripciones; resolvemos nombres en el cliente
    // para evitar JOIN complejo en RLS.
    const { data: pres, error } = await supabase
      .from('preinscripcion')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[preinscripciones] load', error);

    // Traer nombres de leads y alumnas referenciados
    const leadIds = [...new Set((pres || []).map(p => p.lead_id).filter(Boolean))];
    const alumnaIds = [...new Set((pres || []).map(p => p.alumna_id).filter(Boolean))];

    const [leadsRes, alumnasRes] = await Promise.all([
      leadIds.length
        ? supabase.from('leads').select('id, nombre').in('id', leadIds)
        : Promise.resolve({ data: [] }),
      alumnaIds.length
        ? supabase.from('alumnas').select('id, nombre').in('id', alumnaIds)
        : Promise.resolve({ data: [] }),
    ]);
    const leadById = new Map((leadsRes.data || []).map(l => [l.id, l]));
    const alumnaById = new Map((alumnasRes.data || []).map(a => [a.id, a]));

    const enriquecidas = (pres || []).map(p => {
      const alumna = p.alumna_id ? alumnaById.get(p.alumna_id) : null;
      const lead = p.lead_id ? leadById.get(p.lead_id) : null;
      return {
        ...p,
        nombre: alumna?.nombre || lead?.nombre || p.lead_nombre_snapshot || 'Sin nombre',
        kind: alumna ? 'alumna' : (lead ? 'lead' : 'huerfana'),
        ref_id: alumna?.id || lead?.id || null,
      };
    });
    setItems(enriquecidas);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('preinscripciones-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preinscripcion' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  return { items, loading, recargar: cargar };
}

window.usePreinscripciones = usePreinscripciones;
