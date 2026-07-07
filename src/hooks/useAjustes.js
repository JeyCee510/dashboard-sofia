import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useEffect, useCallback } = React;

const DEFAULT_AJUSTES = {
  capacidad: 25,
  precioRegular: 640,
  precioProntoPago: 484,
  precioReserva: 200,
  fechaProntoPago: '10 mayo',
  ownerName: 'Sofía Lira',
  studioName: 'Sofía Lira Yoga',
  lugar: 'Domo Soulspace · Tumbaco',
  diasFormacion: [
    { idx: 0, fecha: '6 jun', label: 'Día 1', encuentro: 1 },
    { idx: 1, fecha: '7 jun', label: 'Día 2', encuentro: 1 },
    { idx: 2, fecha: '13 jun', label: 'Día 3', encuentro: 2 },
    { idx: 3, fecha: '14 jun', label: 'Día 4', encuentro: 2 },
    { idx: 4, fecha: '20 jun', label: 'Día 5', encuentro: 3 },
    { idx: 5, fecha: '21 jun', label: 'Día 6', encuentro: 3 },
  ],
  bonoSillaCupos: 6,
  plantillasWA: [
    { id: 'pgrm', titulo: 'Datos del programa', cuerpo: 'Hola! Te paso los detalles de la formación: 50 horas, 6-21 junio, sáb y dom de 7:30 a 18:00 en Domo Soulspace, Tumbaco. ¿Quieres que te llame? 🙏' },
    { id: 'tr', titulo: 'Datos de transferencia', cuerpo: 'Transferencias a:\nSofía Lira\nProdubanco Ahorro #12054049429\nCédula #1709369225\nsofilira@gmail.com\n\nApenas tengas el comprobante mándamelo y reservamos 🌿' },
    { id: 'ub', titulo: 'Ubicación', cuerpo: 'Domo Soulspace, calle Alfredo Donoso, La Morita, Tumbaco.\nUbicación en Maps: https://maps.app.goo.gl/WrauzvKJot5NbNZF7' },
    { id: 'crn', titulo: 'Cronograma', cuerpo: 'Cronograma del día:\n7:30-11:30 práctica y teoría\n11:30-14:00 almuerzo\n14:00-16:30 laboratorio técnico\n16:30-18:00 yogasana' },
  ],
  // ── Módulo Estudio (namespace separado) ──
  estudio: {
    info: {
      direccion: 'Domo Soulspace · Tumbaco',
      mapsUrl: 'https://maps.app.goo.gl/WrauzvKJot5NbNZF7',
      bio: '',
    },
    vencimientos: {
      ventanaDias: 7,
      alertaPaqueteCerca: true,
      mensajeBanner: 'A {nombre} le quedan {dias} días',
    },
    plantillasWA: [
      { id: 'bienv', titulo: 'Bienvenida', cuerpo: 'Hola {nombre} 🌿 Te doy la bienvenida al estudio. Tu plan {plan} está activo hasta el {vence}. Cualquier duda me escribes. Sofía.' },
      { id: 'venc_pronto', titulo: 'Vence pronto', cuerpo: 'Hola {nombre} 🌿 Te recuerdo que tu plan {plan} vence en {dias} días (el {vence}). Avísame si quieres renovar y te paso datos. Un abrazo.' },
      { id: 'vencido', titulo: 'Plan vencido', cuerpo: 'Hola {nombre} 🌿 Tu plan {plan} venció el {vence}. ¿Renovamos? Cuando quieras te paso los datos.' },
      { id: 'pago_ok', titulo: 'Confirmación de pago', cuerpo: 'Recibí tu pago de ${monto} 🙏 Tu plan está activo hasta el {vence}. ¡Nos vemos en clase!' },
    ],
  },
  // Datos de transferencia compartidos con formación
  transferencia: {
    banco: 'Produbanco',
    tipoCuenta: 'Ahorro',
    cuenta: '12054049429',
    cedula: '1709369225',
    email: 'sofilira@gmail.com',
    titular: 'Sofía Lira',
  },
};

// Pequeño debounce para no spamear writes mientras se edita
function useDebounced(fn, delay = 700) {
  const tref = React.useRef(null);
  return React.useCallback((...args) => {
    if (tref.current) clearTimeout(tref.current);
    tref.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// Deep merge: mezcla patches anidados sin perder campos existentes.
// Necesario para editar `estudio.info.direccion` sin borrar el resto de `estudio.*`.
function deepMerge(target, source) {
  if (source == null) return target;
  if (Array.isArray(source)) return source; // arrays se reemplazan completos
  if (typeof source !== 'object') return source;
  const out = { ...target };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target?.[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      out[k] = deepMerge(tv, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

// Formación (default): ajustes viven en la tabla singleton `ajustes` (id=1).
// Otros proyectos (taller, etc.): ajustes viven en `proyectos.config` de ese
// proyecto (la tabla `ajustes` tiene constraint only_one_row). Misma forma.
export function useAjustes({ proyectoId = 2, esFormacion = true } = {}) {
  const [ajustes, setAjustes] = useState(DEFAULT_AJUSTES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cfg = null;
      if (esFormacion) {
        const { data, error } = await supabase.from('ajustes').select('data').eq('id', 1).single();
        if (error) console.error('[ajustes] load', error); else cfg = data?.data;
      } else {
        const { data, error } = await supabase.from('proyectos').select('config').eq('id', proyectoId).single();
        if (error) console.error('[ajustes] load proyecto', error); else cfg = data?.config;
      }
      if (cancelled) return;
      if (cfg) setAjustes(deepMerge(DEFAULT_AJUSTES, cfg));
      else setAjustes(DEFAULT_AJUSTES);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [esFormacion, proyectoId]);

  // Realtime: sincronizar si se editan los ajustes desde otra pestaña
  useEffect(() => {
    const ch = esFormacion
      ? supabase.channel('ajustes-changes')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ajustes' }, (payload) => {
            if (payload.new?.data) setAjustes(deepMerge(DEFAULT_AJUSTES, payload.new.data));
          })
      : supabase.channel('proyecto-ajustes-' + proyectoId)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos', filter: `id=eq.${proyectoId}` }, (payload) => {
            if (payload.new?.config) setAjustes(deepMerge(DEFAULT_AJUSTES, payload.new.config));
          });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [esFormacion, proyectoId]);

  const persist = useCallback(async (full) => {
    if (esFormacion) {
      const { error } = await supabase.from('ajustes').update({ data: full }).eq('id', 1);
      if (error) console.error('[ajustes] update', error);
    } else {
      const { error } = await supabase.from('proyectos').update({ config: full }).eq('id', proyectoId);
      if (error) console.error('[ajustes] update proyecto', error);
    }
  }, [esFormacion, proyectoId]);

  const persistDebounced = useDebounced(persist, 700);

  const updateAjustes = useCallback((patch) => {
    setAjustes(prev => {
      // Deep merge para que editar `estudio.info.direccion` no borre el resto de `estudio.*`
      const next = deepMerge(prev, patch);
      persistDebounced(next);
      return next;
    });
  }, [persistDebounced]);

  return { ajustes, loading, updateAjustes };
}

export { DEFAULT_AJUSTES };
