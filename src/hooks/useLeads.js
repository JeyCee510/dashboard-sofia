import React from 'react';
import { supabase } from '../lib/supabase.js';
import { registrarActividad, actorActividad } from '../lib/actividad.js';
import { enviarAvisoPush } from '../lib/push.js';

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
    claseLinkEnviadaAt: row.clase_link_enviada_at || null,
    followupClaseEnviadoAt: row.followup_clase_enviado_at || null,
    // Seminario: a qué sedes/encuentros quiere venir (números 1..3)
    interesSedes: row.interes_sedes || [],
    // Quién lo trajo y quién lo tiene hoy (traspaso Sofía → Micaela)
    creadoPorEmail: row.creado_por_email || null,
    creadoPorNombre: row.creado_por_nombre || null,
    asignadoAEmail: row.asignado_a_email || null,
    asignadoANombre: row.asignado_a_nombre || null,
    asignadoAt: row.asignado_at || null,
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
  if ('interesSedes' in patch) {
    // [] se guarda como NULL: "sin definir" y "no le interesa ninguna" son
    // lo mismo para efectos prácticos, y NULL evita arrays vacíos sueltos.
    const v = Array.isArray(patch.interesSedes) ? patch.interesSedes : [];
    out.interes_sedes = v.length ? v : null;
  }
  if ('asignadoAEmail' in patch) out.asignado_a_email = patch.asignadoAEmail || null;
  if ('asignadoANombre' in patch) out.asignado_a_nombre = patch.asignadoANombre || null;
  if ('asignadoAt' in patch) out.asignado_at = patch.asignadoAt || null;
  return out;
}

export function useLeads(proyectoId = 2) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('proyecto_id', proyectoId).order('created_at', { ascending: false });
      if (!cancelled) {
        if (error) console.error('[leads] load', error);
        setLeads((data || []).map(fromDb));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [proyectoId]);

  useEffect(() => {
    const ch = supabase.channel('leads-changes-' + proyectoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `proyecto_id=eq.${proyectoId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          return;
        }
        // INSERT o UPDATE → upsert defensivo. Necesario porque RPCs con
        // INSERT ... ON CONFLICT DO UPDATE pueden emitir el evento como
        // UPDATE; si la fila no estaba en el state local (caso restaurar
        // desde papelera), un .map() puro no la agregaría.
        const fila = fromDb(payload.new);
        setLeads(prev => {
          const exists = prev.some(l => l.id === fila.id);
          return exists
            ? prev.map(l => l.id === fila.id ? fila : l)
            : [fila, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId]);

  const addLead = useCallback(async (data) => {
    // toDb() filtra: el form trae claves de UI (createdAt, asignadoANombre…)
    // que no son columnas y harían fallar el insert.
    const actor = actorActividad();
    const row = {
      estado: 'nuevo', tiempo: 'ahora', mensaje: '',
      ...toDb(data),
      proyecto_id: proyectoId,
      // Queda sellado quién trajo el lead (antes sólo vivía en la bitácora)
      creado_por_email: actor.email,
      creado_por_nombre: actor.nombre,
    };
    const { data: inserted, error } = await supabase.from('leads').insert(row).select().single();
    if (error) { console.error('[leads] add', error); throw error; }
    // Optimistic local update: no esperamos al realtime
    if (inserted) {
      setLeads(prev => prev.some(l => l.id === inserted.id) ? prev : [fromDb(inserted), ...prev]);
      registrarActividad({
        proyectoId, entidad: 'lead', entidadId: inserted.id, accion: 'creo',
        titulo: `Creó el lead ${inserted.nombre || ''}`.trim(),
        detalle: { fuente: inserted.fuente || null },
      });
      // Aviso push al resto del equipo (a quien lo creó no se le notifica)
      enviarAvisoPush({
        titulo: 'Nuevo lead 🌿',
        cuerpo: `${inserted.nombre || 'Alguien'}${inserted.fuente ? ` · vía ${inserted.fuente}` : ''}`,
        proyectoId, tag: 'lead',
      });
    }
    return inserted.id;
  }, [proyectoId]);

  const updateLead = useCallback(async (id, patch) => {
    const antes = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const dbPatch = toDb(patch);
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('leads').update(dbPatch).eq('id', id);
    if (error) { console.error('[leads] update', error); return; }
    // Bitácora: distinguir cambio de estado (lo que Sofía quiere ver) de una
    // edición cualquiera, y guardar la nota/mensaje si cambió.
    const nombre = antes?.nombre || '';
    if ('estado' in patch && antes && patch.estado !== antes.estado) {
      registrarActividad({
        proyectoId, entidad: 'lead', entidadId: id, accion: 'cambio_estado',
        titulo: `${nombre}: ${antes.estado || '—'} → ${patch.estado}`,
        detalle: { de: antes.estado, a: patch.estado },
      });
    } else if ('mensaje' in patch && patch.mensaje && patch.mensaje !== antes?.mensaje) {
      registrarActividad({
        proyectoId, entidad: 'lead', entidadId: id, accion: 'nota',
        titulo: `Nota sobre ${nombre}`.trim(),
        detalle: { nota: patch.mensaje },
      });
    } else {
      registrarActividad({
        proyectoId, entidad: 'lead', entidadId: id, accion: 'actualizo',
        titulo: `Actualizó ${nombre}`.trim(),
        detalle: { campos: Object.keys(patch) },
      });
    }
  }, [leads, proyectoId]);

  // Pasar la posta: deja constancia de quién queda a cargo del lead y le
  // avisa por push. El WhatsApp del traspaso lo abre la UI aparte (avisos.js);
  // esto es lo que persiste y lo que se ve después en la ficha.
  const asignarLead = useCallback(async (id, persona) => {
    const lead = leads.find(l => l.id === id);
    const patch = {
      asignadoAEmail: persona?.email || null,
      asignadoANombre: persona?.nombre || null,
      asignadoAt: new Date().toISOString(),
    };
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const { error } = await supabase.from('leads').update(toDb(patch)).eq('id', id);
    if (error) { console.error('[leads] asignar', error); return false; }

    const quien = actorActividad();
    registrarActividad({
      proyectoId, entidad: 'lead', entidadId: id, accion: 'asigno',
      titulo: `Pasó ${lead?.nombre || 'el lead'} a ${persona?.nombre || 'alguien'}`,
      detalle: { para: persona?.nombre || null, para_email: persona?.email || null, de: quien.nombre || quien.email || null },
    });

    if (persona?.email) {
      enviarAvisoPush({
        titulo: `Te pasaron un lead 🌿`,
        cuerpo: `${lead?.nombre || 'Un lead'}${quien.nombre ? ` · de ${quien.nombre}` : ''}`,
        paraEmail: persona.email,
        proyectoId, tag: 'traspaso',
      });
    }
    return true;
  }, [leads, proyectoId]);

  const deleteLead = useCallback(async (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) console.error('[leads] delete', error);
  }, []);

  return { leads, loading, addLead, updateLead, deleteLead, asignarLead };
}
