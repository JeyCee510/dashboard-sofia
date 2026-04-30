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
    let pagoId = null;
    // 1. Si hay alumna asociada, registrar el pago en pagos + actualizar acumulado
    if (alumna_id && monto) {
      const { data: pagoInsertado, error: ePago } = await supabase
        .from('pagos').insert({ alumna_id, monto, tipo: tipo || 'parcial' })
        .select().single();
      if (ePago) throw ePago;
      pagoId = pagoInsertado?.id || null;
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

    // 2. Marcar comprobante como validado + guardar pago_id (vínculo formal)
    const { error: e1 } = await supabase
      .from('comprobantes_pago')
      .update({
        estado: 'validado',
        alumna_id,
        pago_id: pagoId,
        validado_at: new Date().toISOString(),
        validado_notas: notas || '',
      })
      .eq('id', id);
    if (e1) throw e1;

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
  // Si el comprobante estaba validado y tiene pago_id (vínculo formal),
  // primero reverte el pago: borra la fila de `pagos` y descuenta el monto
  // de `alumnas.pagado`. Después borra el archivo del Storage y la fila.
  // Esto garantiza consistencia financiera sin doble paso manual.
  const eliminar = useCallback(async (id) => {
    // 1. Leer datos del comprobante antes de borrar
    const { data: row } = await supabase
      .from('comprobantes_pago')
      .select('storage_path, pago_id, alumna_id, monto, estado')
      .eq('id', id).single();

    // 2. Si está validado y tiene pago vinculado → reverso atómico
    if (row?.estado === 'validado' && row.pago_id && row.alumna_id) {
      // 2a. Leer el pago para conocer el monto exacto (defensivo)
      const { data: pago } = await supabase
        .from('pagos').select('monto').eq('id', row.pago_id).single();
      const montoPago = Number(pago?.monto || row.monto || 0);
      // 2b. Restar al pagado de la alumna y recalcular estado
      if (montoPago > 0) {
        const { data: a } = await supabase
          .from('alumnas').select('pagado, total').eq('id', row.alumna_id).single();
        if (a) {
          const nuevoPagado = Math.max(0, Number(a.pagado || 0) - montoPago);
          let nuevoEstado;
          if (nuevoPagado === 0) nuevoEstado = 'pendiente';
          else if (nuevoPagado >= Number(a.total || 0)) nuevoEstado = 'completo';
          else nuevoEstado = 'parcial';
          await supabase.from('alumnas').update({
            pagado: nuevoPagado, pago: nuevoEstado,
          }).eq('id', row.alumna_id);
        }
      }
      // 2c. Borrar el pago. ON DELETE SET NULL deja comprobante.pago_id=null,
      // pero ya estamos a punto de borrar el comprobante igualmente.
      await supabase.from('pagos').delete().eq('id', row.pago_id);
    }

    // 3. Borrar archivo del Storage (si existe)
    if (row?.storage_path) {
      await supabase.storage.from('comprobantes').remove([row.storage_path]);
    }
    // 4. Borrar la fila del comprobante
    const { error } = await supabase.from('comprobantes_pago').delete().eq('id', id);
    if (error) throw error;
    await cargar();
  }, [cargar]);

  return { items, loading, cargar, obtenerUrl, validar, rechazar, eliminar };
}
