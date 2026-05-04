import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────
// useClasesEstudio — clases puntuales del estudio (asistencia ad-hoc)
//
// MVP simple: una "clase realizada" es una instancia puntual con
// fecha + hora + nombre. Sin horarios recurrentes (los añadimos en
// iteración 2 si Sofía los pide).
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    horaInicio: row.hora_inicio,
    nombre: row.nombre || '',
    capacidad: row.capacidad,
    notas: row.notas || '',
    createdAt: row.created_at,
  };
}

export function useClasesEstudio() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('clases_realizadas')
        .select('*')
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: false })
        .limit(500); // suficiente histórico para el MVP
      if (cancelled) return;
      if (error) console.error('[clases_realizadas] load', error);
      else setClases((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('clases-realizadas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clases_realizadas' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setClases(prev => prev.filter(c => c.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setClases(prev => {
          const exists = prev.some(c => c.id === fila.id);
          return exists
            ? prev.map(c => c.id === fila.id ? fila : c)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addClase = useCallback(async ({ fecha, horaInicio, nombre, capacidad, notas }) => {
    const row = {
      fecha: fecha || new Date().toISOString().slice(0, 10),
      hora_inicio: horaInicio || null,
      nombre: nombre || '',
      capacidad: capacidad || null,
      notas: notas || '',
    };
    const { data, error } = await supabase.from('clases_realizadas').insert(row).select().single();
    if (error) { console.error('[clases_realizadas] add', error); throw error; }
    if (data) {
      const fila = fromDb(data);
      setClases(prev => [fila, ...prev.filter(c => c.id !== fila.id)]);
    }
    return data?.id;
  }, []);

  const updateClase = useCallback(async (id, patch) => {
    setClases(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    const dbPatch = {};
    if ('fecha' in patch) dbPatch.fecha = patch.fecha;
    if ('horaInicio' in patch) dbPatch.hora_inicio = patch.horaInicio;
    if ('nombre' in patch) dbPatch.nombre = patch.nombre;
    if ('capacidad' in patch) dbPatch.capacidad = patch.capacidad;
    if ('notas' in patch) dbPatch.notas = patch.notas;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('clases_realizadas').update(dbPatch).eq('id', id);
    if (error) console.error('[clases_realizadas] update', error);
  }, []);

  const deleteClase = useCallback(async (id) => {
    setClases(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('clases_realizadas').delete().eq('id', id);
    if (error) console.error('[clases_realizadas] delete', error);
  }, []);

  return { clases, loading, addClase, updateClase, deleteClase };
}
