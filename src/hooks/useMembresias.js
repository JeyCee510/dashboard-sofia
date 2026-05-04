import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// useMembresias — instancias de plan asignadas a estudiantes
//
// Carga TODAS (volumen <50 estudiantes × ~5 renovaciones c/u = <250
// filas, totalmente manejable). Realtime + optimistic UI.
//
// Helpers expuestos:
//   - getMembresiaActiva(estudianteId) → la más reciente por fecha_inicio
//   - estaVencida(membresia) → fecha_fin < hoy O clases_usadas >= clases_totales
//   - diasParaVencer(membresia) → entero, negativo si vencida
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    estudianteId: row.estudiante_id,
    planId: row.plan_id,
    planSnapshot: row.plan_snapshot || {},
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    clasesTotales: row.clases_totales == null ? null : Number(row.clases_totales),
    clasesUsadas: Number(row.clases_usadas) || 0,
    estado: row.estado || 'activa', // activa | cancelada
    notas: row.notas || '',
    createdAt: row.created_at,
  };
}

// ── Helpers (puros, exportados también) ──
export function estaVencida(m) {
  if (!m || m.estado === 'cancelada') return true;
  const hoyStr = new Date().toISOString().slice(0, 10);
  if (m.fechaFin && m.fechaFin < hoyStr) return true;
  if (m.clasesTotales != null && m.clasesUsadas >= m.clasesTotales) return true;
  return false;
}

export function diasParaVencer(m) {
  if (!m?.fechaFin) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(m.fechaFin + 'T00:00:00');
  return Math.round((fin - hoy) / (1000 * 60 * 60 * 24));
}

export function clasesRestantes(m) {
  if (!m || m.clasesTotales == null) return null; // ilimitado
  return Math.max(0, m.clasesTotales - m.clasesUsadas);
}

export function useMembresias() {
  const [membresias, setMembresias] = useState([]);
  const [congelaciones, setCongelaciones] = useState([]); // historial de pausas
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [resMem, resCon] = await Promise.all([
        supabase.from('membresias').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('congelaciones_membresia').select('*').order('desde', { ascending: false }),
      ]);
      if (cancelled) return;
      if (resMem.error) console.error('[membresias] load', resMem.error);
      else setMembresias((resMem.data || []).map(fromDb));
      if (resCon.error) console.error('[congelaciones] load', resCon.error);
      else setCongelaciones((resCon.data || []).map(c => ({
        id: c.id, membresiaId: c.membresia_id, desde: c.desde, hasta: c.hasta,
        diasExtension: c.dias_extension, notas: c.notas || '', createdAt: c.created_at,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime de congelaciones
  useEffect(() => {
    const ch = supabase
      .channel('congelaciones-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'congelaciones_membresia' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCongelaciones(prev => prev.filter(c => c.id !== payload.old.id));
          return;
        }
        const c = payload.new;
        const fila = {
          id: c.id, membresiaId: c.membresia_id, desde: c.desde, hasta: c.hasta,
          diasExtension: c.dias_extension, notas: c.notas || '', createdAt: c.created_at,
        };
        setCongelaciones(prev => {
          const exists = prev.some(x => x.id === fila.id);
          return exists ? prev.map(x => x.id === fila.id ? fila : x) : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('membresias-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membresias' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setMembresias(prev => prev.filter(m => m.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setMembresias(prev => {
          const exists = prev.some(m => m.id === fila.id);
          return exists
            ? prev.map(m => m.id === fila.id ? fila : m)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Crear membresía manualmente (sin RPC). Útil cuando ya existe la
  // estudiante. Para renovación con plan, preferir `renovarMembresia` (RPC).
  const addMembresia = useCallback(async ({ estudianteId, planId, planSnapshot, fechaInicio, fechaFin, clasesTotales, notas }) => {
    const row = {
      estudiante_id: estudianteId,
      plan_id: planId || null,
      plan_snapshot: planSnapshot || {},
      fecha_inicio: fechaInicio || new Date().toISOString().slice(0, 10),
      fecha_fin: fechaFin,
      clases_totales: clasesTotales ?? null,
      clases_usadas: 0,
      estado: 'activa',
      notas: notas || '',
    };
    const { data, error } = await supabase
      .from('membresias').insert(row).select().single();
    if (error) { console.error('[membresias] add', error); throw error; }
    if (data) {
      const fila = fromDb(data);
      setMembresias(prev => [fila, ...prev.filter(m => m.id !== fila.id)]);
    }
    return data?.id;
  }, []);

  // RPC: renovar (crea NUEVA membresía con snapshot del plan + opcional pago)
  const renovarMembresia = useCallback(async ({ estudianteId, planId, fechaInicio, pagoMonto, pagoForma }) => {
    const { data, error } = await supabase.rpc('renovar_membresia', {
      p_estudiante_id: estudianteId,
      p_plan_id: planId,
      p_fecha_inicio: fechaInicio || new Date().toISOString().slice(0, 10),
      p_pago_monto: pagoMonto || null,
      p_pago_forma: pagoForma || 'transferencia',
    });
    if (error) { console.error('[membresias] renovar', error); throw error; }
    return { membresiaId: data?.membresia_id, pagoId: data?.pago_id };
  }, []);

  // Incrementa clases usadas (cuando se marca asistencia a una clase del estudio).
  // Read-modify-write contra estado local para no necesitar una RPC.
  // No bloquea pasarse — el frontend muestra "vencida por clases" cuando pasa el tope.
  const registrarClaseUsada = useCallback(async (membresiaId) => {
    const m = membresias.find(x => x.id === membresiaId);
    if (!m) return;
    const nueva = (m.clasesUsadas || 0) + 1;
    setMembresias(prev => prev.map(x => x.id === membresiaId ? { ...x, clasesUsadas: nueva } : x));
    const { error } = await supabase.from('membresias').update({ clases_usadas: nueva }).eq('id', membresiaId);
    if (error) console.error('[membresias] registrarClaseUsada', error);
  }, [membresias]);

  const cancelarMembresia = useCallback(async (id, notas = '') => {
    setMembresias(prev => prev.map(m => m.id === id ? { ...m, estado: 'cancelada', notas } : m));
    const { error } = await supabase.from('membresias').update({ estado: 'cancelada', notas }).eq('id', id);
    if (error) console.error('[membresias] cancelar', error);
  }, []);

  const updateMembresia = useCallback(async (id, patch) => {
    setMembresias(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    const dbPatch = {};
    if ('fechaInicio' in patch) dbPatch.fecha_inicio = patch.fechaInicio;
    if ('fechaFin' in patch) dbPatch.fecha_fin = patch.fechaFin;
    if ('clasesTotales' in patch) dbPatch.clases_totales = patch.clasesTotales;
    if ('clasesUsadas' in patch) dbPatch.clases_usadas = patch.clasesUsadas;
    if ('estado' in patch) dbPatch.estado = patch.estado;
    if ('notas' in patch) dbPatch.notas = patch.notas;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('membresias').update(dbPatch).eq('id', id);
    if (error) console.error('[membresias] update', error);
  }, []);

  const deleteMembresia = useCallback(async (id) => {
    setMembresias(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from('membresias').delete().eq('id', id);
    if (error) console.error('[membresias] delete', error);
  }, []);

  // ── Congelar / Descongelar ──
  const congelarMembresia = useCallback(async ({ membresiaId, desde, notas = '' }) => {
    const { data, error } = await supabase.rpc('congelar_membresia', {
      p_membresia_id: membresiaId,
      p_desde: desde || null,
      p_notas: notas,
    });
    if (error) { console.error('[membresias] congelar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    return { id: data?.id, desde: data?.desde };
  }, []);

  const descongelarMembresia = useCallback(async ({ membresiaId, hasta }) => {
    const { data, error } = await supabase.rpc('descongelar_membresia', {
      p_membresia_id: membresiaId,
      p_hasta: hasta || null,
    });
    if (error) { console.error('[membresias] descongelar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    return { dias: data?.dias, nuevaFechaFin: data?.nueva_fecha_fin };
  }, []);

  // Helper: ¿está congelada? = tiene una congelación con hasta=NULL
  const estaCongelada = useCallback((membresiaId) => {
    return congelaciones.some(c => c.membresiaId === membresiaId && c.hasta == null);
  }, [congelaciones]);

  const congelacionesDeMembresia = useCallback((membresiaId) => {
    return congelaciones.filter(c => c.membresiaId === membresiaId);
  }, [congelaciones]);

  // ── Helpers de selección ──
  const porEstudiante = useMemo(() => {
    const idx = new Map();
    for (const m of membresias) {
      const arr = idx.get(m.estudianteId) || [];
      arr.push(m);
      idx.set(m.estudianteId, arr);
    }
    // Ordenar cada lista por fecha_inicio DESC
    for (const [, arr] of idx) arr.sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
    return idx;
  }, [membresias]);

  const getMembresiaActiva = useCallback((estudianteId) => {
    const arr = porEstudiante.get(estudianteId) || [];
    return arr[0] || null; // la más reciente por fecha_inicio
  }, [porEstudiante]);

  return {
    membresias,
    congelaciones,
    loading,
    porEstudiante,
    getMembresiaActiva,
    addMembresia,
    renovarMembresia,
    updateMembresia,
    registrarClaseUsada,
    cancelarMembresia,
    deleteMembresia,
    // congelaciones
    congelarMembresia,
    descongelarMembresia,
    estaCongelada,
    congelacionesDeMembresia,
    // helpers puros
    estaVencida,
    diasParaVencer,
    clasesRestantes,
  };
}
