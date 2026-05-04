import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// useAsistenciaEstudio — registro de asistencias del estudio
//
// El trigger AFTER INSERT / AFTER DELETE en BD se encarga de
// incrementar/decrementar `clases_usadas` en la membresía asignada.
// El hook solo orquesta la UI.
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    estudianteId: row.estudiante_id,
    claseRealizadaId: row.clase_realizada_id,
    membresiaId: row.membresia_id,
    presente: !!row.presente,
    notas: row.notas || '',
    createdAt: row.created_at,
  };
}

export function useAsistenciaEstudio() {
  const [asistencia, setAsistencia] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('asistencia_estudio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) console.error('[asistencia_estudio] load', error);
      else setAsistencia((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('asistencia-estudio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia_estudio' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setAsistencia(prev => prev.filter(a => a.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setAsistencia(prev => {
          const exists = prev.some(a => a.id === fila.id);
          return exists
            ? prev.map(a => a.id === fila.id ? fila : a)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Marcar asistencia vía RPC (idempotente: si ya existe la actualiza,
  // si no la inserta y autodetecta la membresía activa).
  const marcar = useCallback(async ({ estudianteId, claseRealizadaId, membresiaId, presente = true, notas = '' }) => {
    const { data, error } = await supabase.rpc('marcar_asistencia_estudio', {
      p_estudiante_id: estudianteId,
      p_clase_realizada_id: claseRealizadaId,
      p_membresia_id: membresiaId || null,
      p_presente: presente,
      p_notas: notas,
    });
    if (error) { console.error('[asistencia_estudio] marcar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    return { id: data?.id, membresiaId: data?.membresia_id };
  }, []);

  // Borrar asistencia (revierte el contador de la membresía vía trigger AFTER DELETE)
  const borrarAsistencia = useCallback(async (id) => {
    setAsistencia(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('asistencia_estudio').delete().eq('id', id);
    if (error) console.error('[asistencia_estudio] delete', error);
  }, []);

  // ── Indexes útiles para la UI ──
  const porClase = useMemo(() => {
    const idx = new Map();
    for (const a of asistencia) {
      const arr = idx.get(a.claseRealizadaId) || [];
      arr.push(a);
      idx.set(a.claseRealizadaId, arr);
    }
    return idx;
  }, [asistencia]);

  const porEstudiante = useMemo(() => {
    const idx = new Map();
    for (const a of asistencia) {
      const arr = idx.get(a.estudianteId) || [];
      arr.push(a);
      idx.set(a.estudianteId, arr);
    }
    return idx;
  }, [asistencia]);

  return { asistencia, loading, porClase, porEstudiante, marcar, borrarAsistencia };
}
