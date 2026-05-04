import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// usePagosEstudio — audit trail de pagos del estudio
//
// Patrón: lista completa con realtime. Las 4 formas son las mismas
// que en formación: transferencia | efectivo | payphone | canje.
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    estudianteId: row.estudiante_id,
    membresiaId: row.membresia_id,
    monto: Number(row.monto) || 0,
    forma: row.forma || 'transferencia', // transferencia | efectivo | payphone | canje
    fecha: row.fecha,
    comprobanteUrl: row.comprobante_url || null,
    notas: row.notas || '',
    createdAt: row.created_at,
  };
}

export function usePagosEstudio() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('pagos_estudio')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[pagos_estudio] load', error);
      else setPagos((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('pagos-estudio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_estudio' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setPagos(prev => prev.filter(p => p.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setPagos(prev => {
          const exists = prev.some(p => p.id === fila.id);
          return exists
            ? prev.map(p => p.id === fila.id ? fila : p)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Registrar un pago. Campos:
  //   estudianteId (req), monto (req), forma (req: transferencia/efectivo/payphone/canje),
  //   membresiaId (opc), fecha (opc, default hoy), notas (opc), comprobanteUrl (opc)
  const registrarPago = useCallback(async ({ estudianteId, membresiaId, monto, forma, fecha, notas, comprobanteUrl }) => {
    const row = {
      estudiante_id: estudianteId,
      membresia_id: membresiaId || null,
      monto: Number(monto),
      forma: forma || 'transferencia',
      fecha: fecha || new Date().toISOString().slice(0, 10),
      notas: notas || '',
      comprobante_url: comprobanteUrl || null,
    };
    const { data, error } = await supabase.from('pagos_estudio').insert(row).select().single();
    if (error) { console.error('[pagos_estudio] registrarPago', error); throw error; }
    if (data) {
      const fila = fromDb(data);
      setPagos(prev => [fila, ...prev.filter(p => p.id !== fila.id)]);
    }
    return data?.id;
  }, []);

  const updatePago = useCallback(async (id, patch) => {
    setPagos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    const dbPatch = {};
    if ('monto' in patch) dbPatch.monto = patch.monto;
    if ('forma' in patch) dbPatch.forma = patch.forma;
    if ('fecha' in patch) dbPatch.fecha = patch.fecha;
    if ('notas' in patch) dbPatch.notas = patch.notas;
    if ('membresiaId' in patch) dbPatch.membresia_id = patch.membresiaId;
    if ('comprobanteUrl' in patch) dbPatch.comprobante_url = patch.comprobanteUrl;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('pagos_estudio').update(dbPatch).eq('id', id);
    if (error) console.error('[pagos_estudio] update', error);
  }, []);

  const deletePago = useCallback(async (id) => {
    setPagos(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('pagos_estudio').delete().eq('id', id);
    if (error) console.error('[pagos_estudio] delete', error);
  }, []);

  // ── Agregaciones útiles para la home ──
  const porEstudiante = useMemo(() => {
    const idx = new Map();
    for (const p of pagos) {
      const arr = idx.get(p.estudianteId) || [];
      arr.push(p);
      idx.set(p.estudianteId, arr);
    }
    return idx;
  }, [pagos]);

  // Devuelve { transferencia, efectivo, payphone, canje, total } sumas en $
  const sumarPorForma = useCallback((desde, hasta) => {
    const out = { transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0 };
    for (const p of pagos) {
      if (desde && p.fecha < desde) continue;
      if (hasta && p.fecha > hasta) continue;
      out[p.forma] = (out[p.forma] || 0) + (p.monto || 0);
      out.total += p.monto || 0;
    }
    return out;
  }, [pagos]);

  return {
    pagos,
    loading,
    porEstudiante,
    registrarPago,
    updatePago,
    deletePago,
    sumarPorForma,
  };
}
