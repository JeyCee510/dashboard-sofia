import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// useClasesAbiertas — lista de todas las clases (admin). Realtime para
// que cuando alguien edite/cree una se vea al instante.
// ─────────────────────────────────────────────────────────────────────
export function useClasesAbiertas() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    // "Clase abierta" es una función exclusiva de la formación de junio
    // (proyecto 2). En los demás proyectos no aplica: devolvemos vacío para
    // no mostrar datos ajenos en "Inscripciones recibidas".
    if ((window.PROYECTO_ID || 2) !== 2) { setItems([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('clases_abiertas')
      .select('*')
      .order('fecha', { ascending: true });
    if (error) console.error('[clases_abiertas]', error);
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('clases-abiertas-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clases_abiertas' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  // La clase activa más próxima (para inyectar plantilla + tracking en leads)
  const activa = items.find(c => c.activa);

  const actualizar = useCallback(async (id, patch) => {
    const { error } = await supabase.from('clases_abiertas').update(patch).eq('id', id);
    if (error) throw error;
  }, []);

  return { items, activa, loading, actualizar, recargar: cargar };
}

// ─────────────────────────────────────────────────────────────────────
// useInscripcionesClase — lista de inscripciones a una clase (admin)
// ─────────────────────────────────────────────────────────────────────
export function useInscripcionesClase(claseId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!claseId) { setItems([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('clase_inscripciones')
      .select('*')
      .eq('clase_id', claseId)
      .order('created_at', { ascending: false });
    if (error) console.error('[clase_inscripciones]', error);
    setItems(data || []);
    setLoading(false);
  }, [claseId]);

  useEffect(() => {
    cargar();
    if (!claseId) return;
    const ch = supabase.channel(`clase-${claseId}-inscripciones`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'clase_inscripciones',
        filter: `clase_id=eq.${claseId}`,
      }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [claseId, cargar]);

  const eliminar = useCallback(async (id) => {
    const { error } = await supabase.from('clase_inscripciones').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { items, loading, eliminar, recargar: cargar };
}

window.useClasesAbiertas = useClasesAbiertas;
window.useInscripcionesClase = useInscripcionesClase;
