import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Hook que devuelve el timeline trazable de una alumna específica:
// pagos (tabla `pagos`) + eventos administrativos (tabla `eventos_alumna`),
// fusionados y ordenados cronológicamente (más reciente primero).
//
// También expone acciones para revertir:
//  - eliminarPago(pagoId): borra del audit y descuenta el monto del pagado
//  - eliminarEvento(evtId): borra el evento (no afecta otros datos)
// ─────────────────────────────────────────────────────────────────────
export function useEventosAlumna(alumnaId) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!alumnaId) return;
    // OJO: tabla `pagos` usa columna `fecha`, no `created_at` (ver schema.sql).
    const [pagosRes, evsRes] = await Promise.all([
      supabase.from('pagos').select('*').eq('alumna_id', alumnaId).order('fecha', { ascending: false }),
      supabase.from('eventos_alumna').select('*').eq('alumna_id', alumnaId).order('created_at', { ascending: false }),
    ]);
    if (pagosRes.error) console.error('[eventos] pagos', pagosRes.error);
    if (evsRes.error) console.error('[eventos] eventos_alumna', evsRes.error);
    const pagos = pagosRes.data || [];
    const evs = evsRes.data || [];

    const merged = [
      ...pagos.map(p => ({
        id: `pago-${p.id}`,
        source: 'pago',
        rawId: p.id,
        tipo: 'pago',
        titulo: `Pagó $${Number(p.monto).toLocaleString('en-US')}`,
        subtitulo: p.tipo,
        monto: Number(p.monto) || 0,
        created_at: p.fecha,  // normalizar a created_at para el sort + render
      })),
      ...evs.map(e => ({
        id: `evt-${e.id}`,
        source: 'evento',
        rawId: e.id,
        tipo: e.tipo,
        titulo: e.titulo,
        subtitulo: e.subtitulo,
        monto: e.monto,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setEventos(merged);
    setLoading(false);
  }, [alumnaId]);

  useEffect(() => {
    if (!alumnaId) { setEventos([]); setLoading(false); return; }
    setLoading(true);
    cargar();

    const ch = supabase
      .channel(`eventos-alumna-${alumnaId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pagos',
        filter: `alumna_id=eq.${alumnaId}`,
      }, cargar)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'eventos_alumna',
        filter: `alumna_id=eq.${alumnaId}`,
      }, cargar)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [alumnaId, cargar]);

  // Borra un pago del audit y descuenta el monto del `alumnas.pagado`.
  // El estado de pago se recalcula. NO toca total ni silla — si hay que
  // ajustarlos, el usuario lo edita manualmente desde el form.
  const eliminarPago = useCallback(async (pagoId) => {
    // 1. Leer el pago primero para saber el monto
    const { data: pago, error: ePago } = await supabase
      .from('pagos').select('*').eq('id', pagoId).single();
    if (ePago || !pago) {
      console.error('[eliminarPago] no encontrado', ePago);
      return;
    }
    // 2. Leer alumna actual
    const { data: alumna } = await supabase
      .from('alumnas').select('pagado, total').eq('id', pago.alumna_id).single();
    if (!alumna) return;
    const nuevoPagado = Math.max(0, Number(alumna.pagado || 0) - Number(pago.monto || 0));
    let nuevoEstado;
    if (nuevoPagado === 0) nuevoEstado = 'pendiente';
    else if (nuevoPagado >= Number(alumna.total || 0)) nuevoEstado = 'completo';
    else nuevoEstado = 'parcial';

    // 3. Borrar el pago + actualizar la alumna
    await supabase.from('pagos').delete().eq('id', pagoId);
    await supabase.from('alumnas').update({
      pagado: nuevoPagado,
      pago: nuevoEstado,
    }).eq('id', pago.alumna_id);
  }, []);

  const eliminarEvento = useCallback(async (eventoId) => {
    await supabase.from('eventos_alumna').delete().eq('id', eventoId);
  }, []);

  return { eventos, loading, eliminarPago, eliminarEvento };
}

window.useEventosAlumna = useEventosAlumna;
