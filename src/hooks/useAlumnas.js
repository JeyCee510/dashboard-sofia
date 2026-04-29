import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Convierte una fila de Supabase (snake_case) al shape que el resto de la app espera (camelCase)
function fromDb(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    iniciales: row.iniciales || (row.nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join(''),
    tel: row.tel || '',
    instagram: row.instagram || '',
    pago: row.pago || 'pendiente',
    pagado: Number(row.pagado) || 0,
    total: Number(row.total) || 640,
    bonoSilla: !!row.bono_silla,
    notas: row.notas || '',
    inscrita: row.inscrita || '',
    avatar: row.avatar || `oklch(0.74 0.07 ${Math.floor(Math.random() * 90) + 20})`,
    asistencia: [0, 0, 0, 0, 0, 0], // se hidrata desde tabla `asistencia` aparte
  };
}

function toDb(patch) {
  const out = {};
  if ('nombre' in patch) out.nombre = patch.nombre;
  if ('iniciales' in patch) out.iniciales = patch.iniciales;
  if ('tel' in patch) out.tel = patch.tel;
  if ('instagram' in patch) out.instagram = patch.instagram;
  if ('pago' in patch) out.pago = patch.pago;
  if ('pagado' in patch) out.pagado = patch.pagado;
  if ('total' in patch) out.total = patch.total;
  if ('bonoSilla' in patch) out.bono_silla = patch.bonoSilla;
  if ('notas' in patch) out.notas = patch.notas;
  if ('inscrita' in patch) out.inscrita = patch.inscrita;
  if ('avatar' in patch) out.avatar = patch.avatar;
  return out;
}

export function useAlumnas() {
  const [alumnas, setAlumnas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('alumnas')
        .select('*')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[alumnas] load error', error);
        setError(error);
      } else {
        setAlumnas((data || []).map(fromDb));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: si Sofía o Juan editan desde otra pestaña, se sincroniza
  useEffect(() => {
    const ch = supabase
      .channel('alumnas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumnas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAlumnas(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev, fromDb(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          setAlumnas(prev => prev.map(a => a.id === payload.new.id ? fromDb(payload.new) : a));
        } else if (payload.eventType === 'DELETE') {
          setAlumnas(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addAlumna = useCallback(async (data) => {
    const iniciales = (data.nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    const hue = Math.floor(Math.random() * 90) + 20;
    const inscrita = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
    const row = {
      nombre: data.nombre,
      iniciales,
      tel: data.tel || '',
      instagram: data.instagram || '',
      pago: data.pago || 'pendiente',
      pagado: data.pagado || 0,
      total: data.total || 640,
      bono_silla: !!data.bonoSilla,
      notas: data.notas || '',
      inscrita,
      avatar: `oklch(0.74 0.07 ${hue})`,
    };
    const { data: inserted, error } = await supabase
      .from('alumnas')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[alumnas] add', error); throw error; }
    return inserted.id;
  }, []);

  const updateAlumna = useCallback(async (id, patch) => {
    // Optimistic update
    setAlumnas(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    const dbPatch = toDb(patch);
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('alumnas').update(dbPatch).eq('id', id);
    if (error) { console.error('[alumnas] update', error); }
  }, []);

  const deleteAlumna = useCallback(async (id) => {
    setAlumnas(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('alumnas').delete().eq('id', id);
    if (error) { console.error('[alumnas] delete', error); }
  }, []);

  const registrarPago = useCallback(async (alumnaId, monto, tipo) => {
    const a = alumnas.find(x => x.id === alumnaId);
    if (!a) return;
    const nuevoPagado = (a.pagado || 0) + Number(monto);
    let nuevoEstado = 'parcial';
    if (nuevoPagado >= a.total) nuevoEstado = tipo === 'pronto-pago' ? 'pronto-pago' : 'completo';
    else if (nuevoPagado === 0) nuevoEstado = 'pendiente';

    // Optimistic
    setAlumnas(prev => prev.map(x => x.id === alumnaId ? { ...x, pagado: nuevoPagado, pago: nuevoEstado } : x));

    // 1. Insertar registro en `pagos` (audit trail)
    await supabase.from('pagos').insert({ alumna_id: alumnaId, monto, tipo });
    // 2. Actualizar acumulado en `alumnas`
    await supabase.from('alumnas').update({ pagado: nuevoPagado, pago: nuevoEstado }).eq('id', alumnaId);
  }, [alumnas]);

  return { alumnas, loading, error, addAlumna, updateAlumna, deleteAlumna, registrarPago };
}
