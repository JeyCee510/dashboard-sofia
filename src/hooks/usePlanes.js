import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────
// usePlanes — catálogo de planes que ofrece el estudio
//
// Patrón estándar: realtime + optimistic UI. Soft-delete vía
// `activo = false` (preserva membresías históricas que apuntan al plan).
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo, // mensualidad | paquete | drop_in | trimestral | semestral
    precio: Number(row.precio) || 0,
    duracionDias: Number(row.duracion_dias) || 30,
    numClases: row.num_clases == null ? null : Number(row.num_clases),
    descripcion: row.descripcion || '',
    activo: !!row.activo,
    orden: Number(row.orden) || 100,
  };
}

function toDb(patch) {
  const out = {};
  if ('nombre' in patch) out.nombre = patch.nombre;
  if ('tipo' in patch) out.tipo = patch.tipo;
  if ('precio' in patch) out.precio = patch.precio;
  if ('duracionDias' in patch) out.duracion_dias = patch.duracionDias;
  if ('numClases' in patch) out.num_clases = patch.numClases;
  if ('descripcion' in patch) out.descripcion = patch.descripcion;
  if ('activo' in patch) out.activo = patch.activo;
  if ('orden' in patch) out.orden = patch.orden;
  return out;
}

export function usePlanes() {
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('planes_catalogo')
        .select('*')
        .order('orden', { ascending: true });
      if (cancelled) return;
      if (error) console.error('[planes] load', error);
      else setPlanes((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('planes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planes_catalogo' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setPlanes(prev => prev.filter(p => p.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setPlanes(prev => {
          const exists = prev.some(p => p.id === fila.id);
          return exists
            ? prev.map(p => p.id === fila.id ? fila : p).sort((a, b) => a.orden - b.orden)
            : [...prev, fila].sort((a, b) => a.orden - b.orden);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addPlan = useCallback(async (data) => {
    const row = {
      nombre: data.nombre,
      tipo: data.tipo || 'mensualidad',
      precio: Number(data.precio) || 0,
      duracion_dias: Number(data.duracionDias) || 30,
      num_clases: data.numClases ?? null,
      descripcion: data.descripcion || '',
      activo: data.activo !== false,
      orden: Number(data.orden) || 100,
    };
    const { data: inserted, error } = await supabase
      .from('planes_catalogo').insert(row).select().single();
    if (error) { console.error('[planes] add', error); throw error; }
    if (inserted) {
      const fila = fromDb(inserted);
      setPlanes(prev => prev.some(p => p.id === fila.id) ? prev : [...prev, fila].sort((a, b) => a.orden - b.orden));
    }
    return inserted?.id;
  }, []);

  const updatePlan = useCallback(async (id, patch) => {
    setPlanes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    const dbPatch = toDb(patch);
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('planes_catalogo').update(dbPatch).eq('id', id);
    if (error) console.error('[planes] update', error);
  }, []);

  // Soft-delete: marca activo=false. Las membresías históricas siguen
  // refiriendo al plan vía plan_snapshot.
  const archivarPlan = useCallback(async (id) => {
    return updatePlan(id, { activo: false });
  }, [updatePlan]);

  const reactivarPlan = useCallback(async (id) => {
    return updatePlan(id, { activo: true });
  }, [updatePlan]);

  // Hard-delete (solo si Sofía está segura — la usamos rara vez)
  const deletePlan = useCallback(async (id) => {
    setPlanes(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('planes_catalogo').delete().eq('id', id);
    if (error) console.error('[planes] delete', error);
  }, []);

  const planesActivos = planes.filter(p => p.activo);

  return { planes, planesActivos, loading, addPlan, updatePlan, archivarPlan, reactivarPlan, deletePlan };
}
