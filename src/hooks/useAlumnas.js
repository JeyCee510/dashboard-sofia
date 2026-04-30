import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback, useRef } = React;

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
    tipo_inscripcion: row.tipo_inscripcion || 'completa',
    encuentros_asistir: Array.isArray(row.encuentros_asistir) ? row.encuentros_asistir : [1, 2, 3],
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
  if ('tipo_inscripcion' in patch) out.tipo_inscripcion = patch.tipo_inscripcion;
  if ('encuentros_asistir' in patch) out.encuentros_asistir = patch.encuentros_asistir;
  return out;
}

export function useAlumnas() {
  const [alumnas, setAlumnas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref siempre apunta al array más reciente. Lo necesitamos en `registrarPago`
  // porque cuando convertimos lead → alumna, llamamos addAlumna+registrarPago
  // sincrónicamente y el closure de `alumnas` aún no incluye la recién creada.
  const alumnasRef = useRef(alumnas);
  useEffect(() => { alumnasRef.current = alumnas; }, [alumnas]);

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

  // Realtime: si Sofía o Juan editan desde otra pestaña, se sincroniza.
  // Usamos upsert defensivo (INSERT y UPDATE comparten path) para que los
  // restauraciones desde papelera (que vienen como INSERT/ON CONFLICT) no
  // se pierdan si el evento llega como UPDATE.
  useEffect(() => {
    const ch = supabase
      .channel('alumnas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumnas' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setAlumnas(prev => prev.filter(a => a.id !== payload.old.id));
          return;
        }
        const fila = fromDb(payload.new);
        setAlumnas(prev => {
          const exists = prev.some(a => a.id === fila.id);
          return exists
            ? prev.map(a => a.id === fila.id ? fila : a)
            : [...prev, fila];
        });
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
      tipo_inscripcion: data.tipo_inscripcion || 'completa',
      encuentros_asistir: data.encuentros_asistir || [1, 2, 3],
    };
    const { data: inserted, error } = await supabase
      .from('alumnas')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[alumnas] add', error); throw error; }
    // Optimistic local update: no esperamos al realtime.
    // ALSO: actualizamos el ref inmediatamente para que un registrarPago()
    // llamado en el mismo tick (ej. tras convertir lead) encuentre la alumna.
    if (inserted) {
      const fila = fromDb(inserted);
      setAlumnas(prev => prev.some(a => a.id === inserted.id) ? prev : [...prev, fila]);
      alumnasRef.current = alumnasRef.current.some(a => a.id === inserted.id)
        ? alumnasRef.current
        : [...alumnasRef.current, fila];
      // Evento de inscripción
      const desdeLead = !!data._desdeLead;
      await supabase.from('eventos_alumna').insert({
        alumna_id: inserted.id,
        tipo: desdeLead ? 'inscrita_desde_lead' : 'inscrita',
        titulo: desdeLead ? 'Convertida desde lead' : 'Se inscribió',
        subtitulo: data.tipo_inscripcion === 'completa' ? 'Formación completa' :
                   data.tipo_inscripcion === 'dos_encuentros' ? '2 encuentros' :
                   data.tipo_inscripcion === 'un_encuentro' ? '1 encuentro' : '',
      });
    }
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

  // ─────────────────────────────────────────────────────────────────
  // registrarPago(alumnaId, monto, tipo)
  //
  // Lógica por tipo:
  //   • 'pronto-pago' → precio FINAL fijo. Congela total = pagado ya + monto
  //                     (en el form, monto = 484 - pagado_actual). Estado = 'pronto-pago'.
  //   • 'completo'    → suma al pagado, estado = 'completo'. Total NO cambia
  //                     (queda en regular con/sin silla).
  //   • 'reserva' / 'parcial' / 'saldo' → acumulan. Estado se infiere.
  //
  // Bonus: asignación automática de silla
  //   Si la alumna es tipo_inscripcion='completa' y aún no tiene silla
  //   y hay cupos (< bonoSillaCupos), se le asigna automáticamente.
  //   Esto pasa apenas se registra cualquier pago (incluso reserva $200).
  // ─────────────────────────────────────────────────────────────────
  const registrarPago = useCallback(async (alumnaId, monto, tipo, opts = {}) => {
    // Usar ref en vez de closure para que funcione tras un addAlumna
    // sincrónico (caso conversión lead → alumna).
    const lista = alumnasRef.current;
    const a = lista.find(x => x.id === alumnaId);
    if (!a) {
      console.warn('[registrarPago] alumna no encontrada en local state, leyendo de DB', alumnaId);
      const { data, error } = await supabase.from('alumnas').select('*').eq('id', alumnaId).single();
      if (error || !data) {
        console.error('[registrarPago] tampoco existe en DB', error);
        return;
      }
      // Hidratar y reintentar
      const fila = fromDb(data);
      alumnasRef.current = [...lista.filter(x => x.id !== alumnaId), fila];
      setAlumnas(prev => prev.some(x => x.id === alumnaId) ? prev : [...prev, fila]);
      return registrarPago(alumnaId, monto, tipo, opts);
    }
    const m = Number(monto) || 0;

    let nuevoTotal = a.total;
    let nuevoPagado = (a.pagado || 0) + m;
    let nuevoEstado;

    if (tipo === 'pronto-pago') {
      // Pronto pago = precio final. Total se congela en lo que termina pagado.
      nuevoTotal = nuevoPagado;
      nuevoEstado = 'pronto-pago';
    } else if (tipo === 'completo') {
      // Pago completo regular. Total queda como esté (con/sin silla).
      nuevoEstado = 'completo';
    } else {
      // Reserva, parcial, saldo
      if (nuevoPagado >= a.total) nuevoEstado = 'completo';
      else if (nuevoPagado === 0) nuevoEstado = 'pendiente';
      else nuevoEstado = 'parcial';
    }

    // Asignación automática de silla:
    //   - solo aplica a tipo_inscripcion='completa'
    //   - solo si la alumna aún no tiene silla
    //   - solo si quedan cupos (< sillasMax)
    //   - se ejecuta apenas hay cualquier pago (incluso reserva)
    let asignarSilla = false;
    const sillasMax = Number(opts.sillasMax) || 6;
    if (
      a.tipo_inscripcion === 'completa' &&
      !a.bonoSilla &&
      nuevoPagado >= 200 // mínimo reserva
    ) {
      const sillasOtorgadas = lista.filter(x => x.bonoSilla).length;
      if (sillasOtorgadas < sillasMax) asignarSilla = true;
    }

    const dbPatch = {
      pagado: nuevoPagado,
      pago: nuevoEstado,
      total: nuevoTotal,
    };
    const localPatch = { ...dbPatch };
    if (asignarSilla) {
      dbPatch.bono_silla = true;
      localPatch.bonoSilla = true;
    }

    // Optimistic
    setAlumnas(prev => prev.map(x => x.id === alumnaId ? { ...x, ...localPatch } : x));

    // 1. Insertar registro en `pagos` (audit trail) — solo si monto > 0
    if (m > 0) {
      await supabase.from('pagos').insert({ alumna_id: alumnaId, monto: m, tipo });
    }
    // 2. Actualizar acumulado + total + (eventualmente) silla en `alumnas`
    await supabase.from('alumnas').update(dbPatch).eq('id', alumnaId);
    // 3. Si se asignó silla automáticamente, registrar evento
    if (asignarSilla) {
      await supabase.from('eventos_alumna').insert({
        alumna_id: alumnaId,
        tipo: 'silla_asignada_auto',
        titulo: 'Silla asignada automáticamente',
        subtitulo: `Por pagar reserva o más (formación completa)`,
      });
    }

    return { asignoSilla: asignarSilla, nuevoTotal, nuevoPagado, nuevoEstado };
  }, [alumnas]);

  return { alumnas, loading, error, addAlumna, updateAlumna, deleteAlumna, registrarPago };
}
