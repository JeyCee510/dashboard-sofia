import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────
// useComprobantesEstudio — comprobantes de pago del módulo Estudio
//
// Carga la lista completa (volumen bajo: <500 comprobantes proyectados
// el primer año). Realtime + helpers para validar/rechazar.
//
// Reusa el bucket Storage 'comprobantes' (ya existente desde migración 008).
// ─────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    nombreCliente: row.nombre_cliente,
    contacto: row.contacto || '',
    monto: row.monto == null ? null : Number(row.monto),
    fechaPago: row.fecha_pago,
    forma: row.forma || 'transferencia',
    notas: row.notas || '',
    storagePath: row.storage_path,
    archivoNombre: row.archivo_nombre || '',
    archivoTipo: row.archivo_tipo || '',
    estudianteId: row.estudiante_id,
    membresiaId: row.membresia_id,
    pagoId: row.pago_id,
    estado: row.estado || 'pendiente', // pendiente | validado | rechazado
    validadoAt: row.validado_at,
    validadoNotas: row.validado_notas || '',
    createdAt: row.created_at,
  };
}

export function useComprobantesEstudio() {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('comprobantes_pago_estudio')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[comprobantes_estudio] load', error);
      else setComprobantes((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('comprobantes-estudio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comprobantes_pago_estudio' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setComprobantes(prev => prev.filter(c => c.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setComprobantes(prev => {
          const exists = prev.some(c => c.id === fila.id);
          return exists
            ? prev.map(c => c.id === fila.id ? fila : c)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ─── Subir comprobante (admin desde dentro de la app) ───
  // 1. sube al bucket 'comprobantes'  →  storage_path = 'estudio/<uuid>.<ext>'
  // 2. inserta fila en comprobantes_pago_estudio (pendiente)
  // Para el formulario público anónimo se usa la RPC `subir_comprobante_estudio`
  // (la define la migración 018) — esa la veremos cuando construyamos el form
  // público en una iteración posterior.
  const subirComprobanteAdmin = useCallback(async ({ archivo, nombreCliente, contacto, monto, fechaPago, forma, notas }) => {
    if (!archivo) throw new Error('Falta archivo');
    const ext = (archivo.name || 'archivo').split('.').pop() || 'bin';
    const filename = `estudio/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('comprobantes')
      .upload(filename, archivo, { contentType: archivo.type, upsert: false });
    if (upErr) { console.error('[comprobantes_estudio] upload', upErr); throw upErr; }

    const row = {
      nombre_cliente: nombreCliente,
      contacto: contacto || '',
      monto: monto == null ? null : Number(monto),
      fecha_pago: fechaPago || new Date().toISOString().slice(0, 10),
      forma: forma || 'transferencia',
      notas: notas || '',
      storage_path: filename,
      archivo_nombre: archivo.name || '',
      archivo_tipo: archivo.type || '',
    };
    const { data, error } = await supabase
      .from('comprobantes_pago_estudio').insert(row).select().single();
    if (error) { console.error('[comprobantes_estudio] insert', error); throw error; }
    return data?.id;
  }, []);

  // ─── Validar comprobante (RPC) ───
  // Crea un pago_estudio asociado. Si admin no pasa monto/forma/fecha,
  // usa los valores que vinieron en el upload.
  const validarComprobante = useCallback(async ({ comprobanteId, estudianteId, membresiaId, monto, forma, fechaPago, notas }) => {
    const { data, error } = await supabase.rpc('validar_comprobante_estudio', {
      p_id: comprobanteId,
      p_estudiante_id: estudianteId,
      p_membresia_id: membresiaId || null,
      p_monto: monto ?? null,
      p_forma: forma || null,
      p_fecha_pago: fechaPago || null,
      p_notas: notas || null,
    });
    if (error) { console.error('[comprobantes_estudio] validar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    return { pagoId: data?.pago_id };
  }, []);

  const rechazarComprobante = useCallback(async ({ comprobanteId, notas }) => {
    const { data, error } = await supabase.rpc('rechazar_comprobante_estudio', {
      p_id: comprobanteId,
      p_notas: notas || null,
    });
    if (error) { console.error('[comprobantes_estudio] rechazar', error); throw error; }
    if (data?.error) throw new Error(data.error);
    return true;
  }, []);

  // Borrar comprobante (auto-reverso del pago vía trigger BEFORE DELETE).
  const deleteComprobante = useCallback(async (id) => {
    setComprobantes(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('comprobantes_pago_estudio').delete().eq('id', id);
    if (error) console.error('[comprobantes_estudio] delete', error);
  }, []);

  // URL firmada para mostrar el archivo en la UI (bucket privado)
  const firmarUrl = useCallback(async (storagePath, segundos = 3600) => {
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(storagePath, segundos);
    if (error) { console.error('[comprobantes_estudio] sign', error); return null; }
    return data?.signedUrl || null;
  }, []);

  const pendientes = comprobantes.filter(c => c.estado === 'pendiente');
  const countPendientes = pendientes.length;

  return {
    comprobantes,
    pendientes,
    countPendientes,
    loading,
    subirComprobanteAdmin,
    validarComprobante,
    rechazarComprobante,
    deleteComprobante,
    firmarUrl,
  };
}
