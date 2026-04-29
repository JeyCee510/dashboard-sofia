import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Estructura interna: asistencia[diaIdx][alumnaId] = true | false
// Internamente usamos un Map serializable {`${diaIdx}:${alumnaId}` -> {presente, rowId}}
// pero exponemos al store la forma de objeto anidado para no romper screens.

export function useAsistencia() {
  const [asistencia, setAsistencia] = useState({}); // { 0: { 12: true, 15: false }, ... }
  const [rowMap, setRowMap] = useState({});         // { '0:12': rowId }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('asistencia').select('*');
      if (cancelled) return;
      if (error) {
        console.error('[asistencia] load', error);
        setLoading(false);
        return;
      }
      const obj = {};
      const rmap = {};
      (data || []).forEach(r => {
        if (!obj[r.dia_idx]) obj[r.dia_idx] = {};
        obj[r.dia_idx][r.alumna_id] = r.presente;
        rmap[`${r.dia_idx}:${r.alumna_id}`] = r.id;
      });
      setAsistencia(obj);
      setRowMap(rmap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('asistencia-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, (payload) => {
        const r = payload.new || payload.old;
        const key = `${r.dia_idx}:${r.alumna_id}`;
        if (payload.eventType === 'DELETE') {
          setAsistencia(prev => {
            const next = { ...prev };
            if (next[r.dia_idx]) {
              const dia = { ...next[r.dia_idx] };
              delete dia[r.alumna_id];
              next[r.dia_idx] = dia;
            }
            return next;
          });
          setRowMap(prev => { const n = { ...prev }; delete n[key]; return n; });
        } else {
          setAsistencia(prev => ({
            ...prev,
            [r.dia_idx]: { ...(prev[r.dia_idx] || {}), [r.alumna_id]: r.presente },
          }));
          setRowMap(prev => ({ ...prev, [key]: r.id }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Ciclo de toggle: undefined → true → false → undefined (igual que antes)
  const toggleAsistencia = useCallback(async (diaIdx, alumnaId) => {
    const key = `${diaIdx}:${alumnaId}`;
    const cur = asistencia[diaIdx]?.[alumnaId];
    const rowId = rowMap[key];

    if (cur === undefined) {
      // INSERT presente=true (optimistic)
      setAsistencia(prev => ({ ...prev, [diaIdx]: { ...(prev[diaIdx] || {}), [alumnaId]: true } }));
      const { data, error } = await supabase.from('asistencia').insert({ dia_idx: diaIdx, alumna_id: alumnaId, presente: true }).select().single();
      if (!error && data) setRowMap(prev => ({ ...prev, [key]: data.id }));
      else if (error) console.error('[asistencia] insert', error);
    } else if (cur === true) {
      // UPDATE presente=false
      setAsistencia(prev => ({ ...prev, [diaIdx]: { ...(prev[diaIdx] || {}), [alumnaId]: false } }));
      const { error } = await supabase.from('asistencia').update({ presente: false }).eq('id', rowId);
      if (error) console.error('[asistencia] update→false', error);
    } else {
      // DELETE
      setAsistencia(prev => {
        const next = { ...prev };
        if (next[diaIdx]) {
          const dia = { ...next[diaIdx] };
          delete dia[alumnaId];
          next[diaIdx] = dia;
        }
        return next;
      });
      setRowMap(prev => { const n = { ...prev }; delete n[key]; return n; });
      const { error } = await supabase.from('asistencia').delete().eq('id', rowId);
      if (error) console.error('[asistencia] delete', error);
    }
  }, [asistencia, rowMap]);

  // Marcar todas las alumnas como presente para un día
  const marcarTodosDia = useCallback(async (diaIdx, alumnasIds) => {
    // Optimistic
    setAsistencia(prev => {
      const map = { ...(prev[diaIdx] || {}) };
      alumnasIds.forEach(id => { map[id] = true; });
      return { ...prev, [diaIdx]: map };
    });
    // Upsert por (alumna_id, dia_idx) único
    const rows = alumnasIds.map(id => ({ dia_idx: diaIdx, alumna_id: id, presente: true }));
    const { data, error } = await supabase.from('asistencia').upsert(rows, { onConflict: 'alumna_id,dia_idx' }).select();
    if (error) { console.error('[asistencia] marcarTodos', error); return; }
    if (data) {
      setRowMap(prev => {
        const next = { ...prev };
        data.forEach(r => { next[`${r.dia_idx}:${r.alumna_id}`] = r.id; });
        return next;
      });
    }
  }, []);

  return { asistencia, loading, toggleAsistencia, marcarTodosDia };
}
