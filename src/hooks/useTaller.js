import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────
// useProyectos — proyectos activos / archivados (genérico, multi-tipo).
// Realtime para que cambios desde el wizard o admin se vean al instante.
// ─────────────────────────────────────────────────────────────────────
export function useProyectos(filtro = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    let q = supabase.from('proyectos').select('*').order('created_at', { ascending: false });
    if (filtro.tipo)   q = q.eq('tipo', filtro.tipo);
    if (filtro.estado) q = q.eq('estado', filtro.estado);
    if (filtro.slug)   q = q.eq('slug', filtro.slug);
    const { data, error } = await q;
    if (error) console.error('[proyectos]', error);
    setItems(data || []);
    setLoading(false);
  }, [filtro.tipo, filtro.estado, filtro.slug]);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('proyectos-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  return { items, loading, recargar: cargar };
}

// ─────────────────────────────────────────────────────────────────────
// useTaller(proyectoId) — el dataset completo de un taller: encuentros +
// inscritos + relaciones + pagos + eventos. Se carga todo paralelo y
// se mantiene fresco con realtime por tabla.
// ─────────────────────────────────────────────────────────────────────
export function useTaller(proyectoId) {
  const [proyecto,    setProyecto]    = useState(null);
  const [encuentros,  setEncuentros]  = useState([]);
  const [inscritos,   setInscritos]   = useState([]);
  const [relaciones,  setRelaciones]  = useState([]);  // taller_inscripciones_encuentros
  const [pagos,       setPagos]       = useState([]);
  const [loading,     setLoading]     = useState(true);

  const cargar = useCallback(async () => {
    if (!proyectoId) { setLoading(false); return; }
    setLoading(true);
    const [p, e, i, pg] = await Promise.all([
      supabase.from('proyectos').select('*').eq('id', proyectoId).single(),
      supabase.from('taller_encuentros').select('*').eq('proyecto_id', proyectoId).order('numero'),
      supabase.from('taller_inscritos').select('*').eq('proyecto_id', proyectoId).order('created_at', { ascending: false }),
      // Pagos: filtramos por inscritos del proyecto via join indirecto (cargamos todos y filtramos en JS, son pocos)
      supabase.from('taller_pagos').select('*').order('fecha', { ascending: false }),
    ]);
    if (p.error)  console.error('[taller proyecto]', p.error);
    if (e.error)  console.error('[taller encuentros]', e.error);
    if (i.error)  console.error('[taller inscritos]', i.error);
    if (pg.error) console.error('[taller pagos]', pg.error);

    setProyecto(p.data || null);
    setEncuentros(e.data || []);
    setInscritos(i.data || []);
    const inscritosIds = new Set((i.data || []).map(x => x.id));
    setPagos((pg.data || []).filter(x => inscritosIds.has(x.inscrito_id)));

    // Cargar relaciones de los inscritos del proyecto
    if (inscritosIds.size > 0) {
      const { data: relData, error: relErr } = await supabase
        .from('taller_inscripciones_encuentros')
        .select('*')
        .in('inscrito_id', Array.from(inscritosIds));
      if (relErr) console.error('[taller relaciones]', relErr);
      setRelaciones(relData || []);
    } else {
      setRelaciones([]);
    }
    setLoading(false);
  }, [proyectoId]);

  useEffect(() => {
    cargar();
    if (!proyectoId) return;
    const ch = supabase.channel(`taller-${proyectoId}-all`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_encuentros',  filter: `proyecto_id=eq.${proyectoId}` }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_inscritos',   filter: `proyecto_id=eq.${proyectoId}` }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_inscripciones_encuentros' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_pagos' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId, cargar]);

  // Derivados
  const inscritosEnriquecidos = useMemo(() => {
    return inscritos.map(i => {
      const misEnc = relaciones
        .filter(r => r.inscrito_id === i.id)
        .map(r => encuentros.find(e => e.id === r.encuentro_id))
        .filter(Boolean)
        .sort((a, b) => a.numero - b.numero);
      const misPagos = pagos.filter(p => p.inscrito_id === i.id);
      const pagado   = misPagos.filter(p => p.validado).reduce((s, p) => s + Number(p.monto || 0), 0);
      const pendiente = misPagos.filter(p => !p.validado).reduce((s, p) => s + Number(p.monto || 0), 0);
      const total = Number(i.total_calculado || 0);
      return {
        ...i,
        encuentros: misEnc,
        pagos: misPagos,
        pagado,
        pendiente,
        total,
        saldo: Math.max(0, total - pagado),
      };
    });
  }, [inscritos, relaciones, encuentros, pagos]);

  const encuentrosConCupos = useMemo(() => {
    return encuentros.map(e => {
      const ocupados = relaciones.filter(r => r.encuentro_id === e.id).length;
      return { ...e, ocupados, disponibles: Math.max(0, e.cupos - ocupados) };
    });
  }, [encuentros, relaciones]);

  // Mutaciones
  const agregarInscritoManual = useCallback(async ({ nombre, tel, instagram, email, encuentroIds, totalManual, precioEspecial, precioMotivo, notas }) => {
    if (!proyectoId) throw new Error('Falta proyecto');
    if (!nombre?.trim()) throw new Error('Falta el nombre');
    if (!encuentroIds || encuentroIds.length === 0) throw new Error('Elige al menos un encuentro');

    // Validar cupos en cliente (defensivo; el RPC público lo refuerza)
    for (const eid of encuentroIds) {
      const e = encuentrosConCupos.find(x => x.id === eid);
      if (e && e.disponibles <= 0) throw new Error(`Encuentro #${e.numero} sin cupos`);
    }

    // Token comprobante
    const compToken = crypto.randomUUID().replace(/-/g, '');

    // Calcular total si no se pasó manual
    let total = Number(totalManual);
    if (!total || Number.isNaN(total)) {
      const tiers = proyecto?.config?.tiers || {};
      total = Number(tiers[String(encuentroIds.length)] ?? tiers.default * encuentroIds.length ?? 0);
    }

    const { data: ins, error: insErr } = await supabase.from('taller_inscritos').insert({
      proyecto_id: proyectoId,
      nombre: nombre.trim(),
      tel: tel || null,
      instagram: instagram || null,
      email: email || null,
      notas: notas || null,
      comprobante_token: compToken,
      total_calculado: total,
      precio_especial: !!precioEspecial,
      precio_motivo: precioEspecial ? (precioMotivo || null) : null,
    }).select().single();
    if (insErr) throw insErr;

    const { error: relErr } = await supabase.from('taller_inscripciones_encuentros').insert(
      encuentroIds.map(encuentro_id => ({ inscrito_id: ins.id, encuentro_id, fuente: 'manual' }))
    );
    if (relErr) throw relErr;

    // Evento
    await supabase.from('taller_eventos').insert({
      inscrito_id: ins.id,
      tipo: 'inscripcion_manual',
      payload: { encuentros: encuentroIds, total, precio_especial: !!precioEspecial },
    });

    return ins;
  }, [proyectoId, encuentrosConCupos, proyecto]);

  const eliminarInscrito = useCallback(async (id) => {
    const { error } = await supabase.from('taller_inscritos').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const actualizarInscrito = useCallback(async (id, patch) => {
    const { error } = await supabase.from('taller_inscritos').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }, []);

  const toggleAsistencia = useCallback(async (relacionId, asistio) => {
    const { error } = await supabase.from('taller_inscripciones_encuentros').update({ asistio }).eq('id', relacionId);
    if (error) throw error;
  }, []);

  const registrarPago = useCallback(async ({ inscritoId, monto, formaPago, comprobanteUrl, validado = false, notas }) => {
    if (!inscritoId) throw new Error('Falta inscrito');
    const m = Number(monto);
    if (!m || m <= 0) throw new Error('Monto inválido');
    const { data, error } = await supabase.from('taller_pagos').insert({
      inscrito_id: inscritoId,
      monto: m,
      forma_pago: formaPago || null,
      comprobante_url: comprobanteUrl || null,
      validado: !!validado,
      validado_at: validado ? new Date().toISOString() : null,
      notas: notas || null,
    }).select().single();
    if (error) throw error;
    await supabase.from('taller_eventos').insert({
      inscrito_id: inscritoId,
      tipo: 'pago_registrado',
      payload: { monto: m, forma_pago: formaPago, validado: !!validado, pago_id: data.id },
    });
    return data;
  }, []);

  const validarPago = useCallback(async (pagoId) => {
    const { error } = await supabase.from('taller_pagos').update({
      validado: true,
      validado_at: new Date().toISOString(),
    }).eq('id', pagoId);
    if (error) throw error;
    const pg = pagos.find(p => p.id === pagoId);
    if (pg) {
      await supabase.from('taller_eventos').insert({
        inscrito_id: pg.inscrito_id,
        tipo: 'comprobante_validado',
        payload: { pago_id: pagoId, monto: pg.monto },
      });
    }
  }, [pagos]);

  const eliminarPago = useCallback(async (pagoId) => {
    const { error } = await supabase.from('taller_pagos').delete().eq('id', pagoId);
    if (error) throw error;
  }, []);

  // Crear link personalizado (RPC) — devuelve el token; la URL la arma el caller.
  const crearLinkPersonalizado = useCallback(async ({ nombre, tel, instagram, leadId }) => {
    if (!proyectoId) throw new Error('Falta proyecto');
    const { data, error } = await supabase.rpc('taller_crear_preinscripcion', {
      p_proyecto_id: proyectoId,
      p_lead_id: leadId || null,
      p_nombre: nombre || null,
      p_tel: tel || null,
      p_instagram: instagram || null,
    });
    if (error) throw error;
    return data; // token
  }, [proyectoId]);

  return {
    proyecto,
    encuentros: encuentrosConCupos,
    inscritos: inscritosEnriquecidos,
    pagos,
    loading,
    recargar: cargar,
    // Mutaciones
    agregarInscritoManual,
    eliminarInscrito,
    actualizarInscrito,
    toggleAsistencia,
    registrarPago,
    validarPago,
    eliminarPago,
    crearLinkPersonalizado,
  };
}

window.useProyectos = useProyectos;
window.useTaller = useTaller;
