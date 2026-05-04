import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useRef } = React;

// ─────────────────────────────────────────────────────────────────
// useEstudiantesEstudio — estudiantes del módulo Estudio
//
// Espejo de useAlumnas pero apuntando a `estudiantes_estudio`.
// Mismas convenciones: iniciales auto, avatar OKLCH, optimistic UI.
// Soft-archive vía `archivada=true` (no borra datos).
// ─────────────────────────────────────────────────────────────────

function calcularIniciales(nombre) {
  return (nombre || '').split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0].toUpperCase()).join('');
}

function fromDb(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    iniciales: row.iniciales || calcularIniciales(row.nombre),
    tel: row.tel || '',
    instagram: row.instagram || '',
    email: row.email || '',
    fechaNacimiento: row.fecha_nacimiento || null,
    notas: row.notas || '',
    fechaAlta: row.fecha_alta || null,
    archivada: !!row.archivada,
    avatar: row.avatar || `oklch(0.74 0.07 ${Math.floor(Math.random() * 90) + 20})`,
  };
}

function toDb(patch) {
  const out = {};
  if ('nombre' in patch) out.nombre = patch.nombre;
  if ('iniciales' in patch) out.iniciales = patch.iniciales;
  if ('tel' in patch) out.tel = patch.tel;
  if ('instagram' in patch) out.instagram = patch.instagram;
  if ('email' in patch) out.email = patch.email;
  if ('fechaNacimiento' in patch) out.fecha_nacimiento = patch.fechaNacimiento;
  if ('notas' in patch) out.notas = patch.notas;
  if ('archivada' in patch) out.archivada = patch.archivada;
  if ('avatar' in patch) out.avatar = patch.avatar;
  return out;
}

export function useEstudiantesEstudio() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ref para acceso síncrono tras crear (igual patrón useAlumnas)
  const estudiantesRef = useRef(estudiantes);
  useEffect(() => { estudiantesRef.current = estudiantes; }, [estudiantes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('estudiantes_estudio')
        .select('*')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('[estudiantes] load', error);
      else setEstudiantes((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('estudiantes-estudio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estudiantes_estudio' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setEstudiantes(prev => prev.filter(e => e.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setEstudiantes(prev => {
          const exists = prev.some(e => e.id === fila.id);
          return exists
            ? prev.map(e => e.id === fila.id ? fila : e)
            : [...prev, fila];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // addEstudiante: crea solo el estudiante. Para crear con membresía + pago
  // de un solo round-trip, usar `crearEstudianteConMembresia` (RPC).
  const addEstudiante = useCallback(async (data) => {
    const iniciales = calcularIniciales(data.nombre);
    const hue = Math.floor(Math.random() * 90) + 20;
    const row = {
      nombre: data.nombre,
      iniciales,
      tel: data.tel || '',
      instagram: data.instagram || '',
      email: data.email || '',
      fecha_nacimiento: data.fechaNacimiento || null,
      notas: data.notas || '',
      avatar: `oklch(0.74 0.07 ${hue})`,
    };
    const { data: inserted, error } = await supabase
      .from('estudiantes_estudio').insert(row).select().single();
    if (error) { console.error('[estudiantes] add', error); throw error; }
    if (inserted) {
      const fila = fromDb(inserted);
      setEstudiantes(prev => prev.some(e => e.id === fila.id) ? prev : [...prev, fila]);
      estudiantesRef.current = estudiantesRef.current.some(e => e.id === fila.id)
        ? estudiantesRef.current
        : [...estudiantesRef.current, fila];
    }
    return inserted?.id;
  }, []);

  // RPC atómica: crea estudiante + membresía + (opcional) pago en un solo round-trip.
  // Devuelve { estudianteId, membresiaId, pagoId }.
  const crearEstudianteConMembresia = useCallback(async ({
    nombre, tel, instagram, email, notas,
    planId, fechaInicio, pagoMonto, pagoForma,
  }) => {
    const hue = Math.floor(Math.random() * 90) + 20;
    const avatar = `oklch(0.74 0.07 ${hue})`;
    const { data, error } = await supabase.rpc('crear_estudiante_con_membresia', {
      p_nombre: nombre,
      p_tel: tel || null,
      p_instagram: instagram || null,
      p_email: email || null,
      p_notas: notas || '',
      p_avatar: avatar,
      p_plan_id: planId || null,
      p_fecha_inicio: fechaInicio || new Date().toISOString().slice(0, 10),
      p_pago_monto: pagoMonto || null,
      p_pago_forma: pagoForma || 'transferencia',
    });
    if (error) { console.error('[estudiantes] crearEstudianteConMembresia', error); throw error; }
    return {
      estudianteId: data?.estudiante_id,
      membresiaId: data?.membresia_id,
      pagoId: data?.pago_id,
    };
  }, []);

  const updateEstudiante = useCallback(async (id, patch) => {
    setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    const dbPatch = toDb(patch);
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('estudiantes_estudio').update(dbPatch).eq('id', id);
    if (error) console.error('[estudiantes] update', error);
  }, []);

  const archivarEstudiante = useCallback((id) => updateEstudiante(id, { archivada: true }), [updateEstudiante]);
  const restaurarEstudiante = useCallback((id) => updateEstudiante(id, { archivada: false }), [updateEstudiante]);

  // Hard-delete (cascade borra membresías y pagos por FK ON DELETE CASCADE).
  // Usar con cuidado.
  const deleteEstudiante = useCallback(async (id) => {
    setEstudiantes(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('estudiantes_estudio').delete().eq('id', id);
    if (error) console.error('[estudiantes] delete', error);
  }, []);

  const estudiantesActivas = estudiantes.filter(e => !e.archivada);

  return {
    estudiantes,
    estudiantesActivas,
    loading,
    addEstudiante,
    crearEstudianteConMembresia,
    updateEstudiante,
    archivarEstudiante,
    restaurarEstudiante,
    deleteEstudiante,
  };
}
