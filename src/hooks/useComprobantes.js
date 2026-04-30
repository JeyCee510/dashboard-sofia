import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// Hook admin para listar comprobantes, generar URL firmada del archivo,
// validar (asocia con alumna + registra pago) o rechazar.
export function useComprobantes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comprobantes_pago')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) console.error('[comprobantes] load', error);
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Realtime: si entra uno nuevo desde el form público, aparece sin recargar
  useEffect(() => {
    const ch = supabase.channel('comprobantes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comprobantes_pago' }, () => {
        cargar();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  // URL firmada (60 min) para ver el archivo dado su storage_path
  const obtenerUrl = useCallback(async (storagePath) => {
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(storagePath, 3600);
    if (error) { console.error('[comprobantes] signed url', error); return null; }
    return data?.signedUrl || null;
  }, []);

  const validar = useCallback(async (id, { alumna_id, monto, tipo, notas }) => {
    // 1. Marcar comprobante como validado
    const { error: e1 } = await supabase
      .from('comprobantes_pago')
      .update({ estado: 'validado', alumna_id, validado_at: new Date().toISOString(), validado_notas: notas || '' })
      .eq('id', id);
    if (e1) throw e1;

    // 2. Si hay alumna asociada, registrar el pago en pagos + actualizar acumulado en alumnas
    if (alumna_id && monto) {
      await supabase.from('pagos').insert({ alumna_id, monto, tipo: tipo || 'parcial' });
      // Actualizar el pagado de la alumna
      const { data: a } = await supabase.from('alumnas').select('pagado, total').eq('id', alumna_id).single();
      if (a) {
        const nuevoPagado = (Number(a.pagado) || 0) + Number(monto);
        let nuevoEstado = 'parcial';
        if (nuevoPagado >= a.total) nuevoEstado = (tipo === 'pronto-pago') ? 'pronto-pago' : 'completo';
        else if (nuevoPagado === 0) nuevoEstado = 'pendiente';
        await supabase.from('alumnas').update({ pagado: nuevoPagado, pago: nuevoEstado }).eq('id', alumna_id);
      }
    }
    await cargar();
  }, [cargar]);

  const rechazar = useCallback(async (id, notas) => {
    const { error } = await supabase
      .from('comprobantes_pago')
      .update({ estado: 'rechazado', validado_at: new Date().toISOString(), validado_notas: notas || '' })
      .eq('id', id);
    if (error) throw error;
    await cargar();
  }, [cargar]);

  // ⚠ TEMPORAL pre-prod — para limpiar comprobantes de prueba.
  // Borra el archivo del Storage y la fila de la DB. Si estaba validado,
  // NO reverte el pago insertado (eso requiere paso manual desde el
  // timeline de la alumna). El admin debería borrar primero el pago
  // desde la ficha si quiere consistencia financiera.
  const eliminar = useCallback(async (id) => {
    // 1. Leer storage_path antes de borrar la fila
    const { data: row } = await supabase
      .from('comprobantes_pago').select('storage_path').eq('id', id).single();
    // 2. Borrar archivo del Storage (si existe)
    if (row?.storage_path) {
      await supabase.storage.from('comprobantes').remove([row.storage_path]);
    }
    // 3. Borrar la fila
    const { error } = await supabase.from('comprobantes_pago').delete().eq('id', id);
    if (error) throw error;
    await cargar();
  }, [cargar]);

  return { items, loading, cargar, obtenerUrl, validar, rechazar, eliminar };
}
