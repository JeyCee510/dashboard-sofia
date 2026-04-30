import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

function fromDb(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tel: row.tel || '',
    instagram: row.instagram || '',
    fuente: row.fuente || 'otro',
    estado: row.estado || 'nuevo',
    mensaje: row.mensaje || '',
    tiempo: row.tiempo || 'ahora', // legacy, se va a deprecar
    createdAt: row.created_at,     // ISO timestamp real
  };
}

function toDb(patch) {
  const out = {};
  if ('nombre' in patch) out.nombre = patch.nombre;
  if ('tel' in patch) out.tel = patch.tel;
  if ('instagram' in patch) out.instagram = patch.instagram;
  if ('fuente' in patch) out.fuente = patch.fuente;
  if ('estado' in patch) out.estado = patch.estado;
  if ('mensaje' in patch) out.mensaje = patch.mensaje;
  if ('tiempo' in patch) out.tiempo = patch.tiempo;
  return out;
}

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (!cancelled) {
        if (error) console.error('[leads] load', error);
        setLeads((data || []).map(fromDb));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase.channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => prev.some(l => l.id === payload.new.id) ? prev : [fromDb(payload.new), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? fromDb(payload.new) : l));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addLead = useCallback(async (data) => {
    const row = { estado: 'nuevo', tiempo: 'ahora', mensaje: '', ...data };
    const { data: inserted, error } = await supabase.from('leads').insert(row).select().single();
    if (error) { console.error('[leads] add', error); throw error; }
    // Optimistic local update: no esperamos al realtime
    if (inserted) {
      setLeads(prev => prev.some(l => l.id === inserted.id) ? prev : [fromDb(inserted), ...prev]);
    }
    return inserted.id;
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const dbPatch = toDb(patch);
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('leads').update(dbPatch).eq('id', id);
    if (error) console.error('[leads] update', error);
  }, []);

  const deleteLead = useCallback(async (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) console.error('[leads] delete', error);
  }, []);

  return { leads, loading, addLead, updateLead, deleteLead };
}
