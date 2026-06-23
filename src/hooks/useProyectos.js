import React from 'react';
import { supabase } from '../lib/supabase.js';
const { useState, useEffect, useCallback, useRef } = React;

// ──────────────────────────────────────────────────────────────
// Hooks del modelo convergido (ver docs/arquitectura-multiproyecto.md)
//
//   useProyectos()          → lista de proyectos (tabla `proyectos`)
//   useProyectoData(id)     → participaciones (inscritos + leads) + personas
//                             de UN proyecto, con acciones (alta, pago, etc.)
//
// Leen de `proyectos` / `participaciones` / `personas`. NO tocan los hooks
// legacy (useAlumnas/useLeads/useEstudio), que siguen sirviendo a la
// formación y al estudio sin cambios.
// ──────────────────────────────────────────────────────────────

// Normalización de claves de match (espejo de la función SQL persona_match_key)
const norm = {
  tel:   (v) => (v || '').replace(/[^0-9]/g, '').slice(-9) || null,
  ig:    (v) => ((v || '').toLowerCase().replace(/[@ ]/g, '')) || null,
  email: (v) => ((v || '').trim().toLowerCase()) || null,
};
const matchKey = (nombre, tel, ig, email) =>
  norm.tel(tel) || norm.ig(ig) || norm.email(email) || ('name:' + (nombre || '').trim().toLowerCase());

const iniciales = (nombre) => {
  const p = (nombre || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
};

// ── Lista de proyectos ──
export function useProyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false });
    if (!error) setProyectos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel('proyectos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  return { proyectos, loading, recargar: cargar };
}

// ── Datos de un proyecto (participaciones + personas) ──
export function useProyectoData(proyectoId) {
  const [inscritos, setInscritos] = useState([]); // participaciones rol=inscrito + persona
  const [leads, setLeads] = useState([]);         // participaciones rol=lead (pool compartido)
  const [encuentros, setEncuentros] = useState([]); // sesiones del proyecto (taller_encuentros)
  const [loading, setLoading] = useState(true);
  const idRef = useRef(proyectoId);
  idRef.current = proyectoId;

  const cargar = useCallback(async () => {
    if (!proyectoId) { setLoading(false); return; }
    // Inscritos de ESTE proyecto
    const insc = supabase
      .from('participaciones')
      .select('*, persona:personas(*)')
      .eq('proyecto_id', proyectoId)
      .eq('rol', 'inscrito')
      .order('created_at', { ascending: false });
    // Leads = pool COMPARTIDO (todos los proyectos), no se filtra por proyecto
    const lds = supabase
      .from('participaciones')
      .select('*, persona:personas(*)')
      .eq('rol', 'lead')
      .order('created_at', { ascending: false });
    // Encuentros/sesiones del proyecto (si los tiene; tabla genérica taller_encuentros)
    const enc = supabase
      .from('taller_encuentros')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('numero', { ascending: true });
    const [{ data: di }, { data: dl }, encRes] = await Promise.all([insc, lds, enc]);
    setInscritos(di || []);
    setLeads(dl || []);
    setEncuentros((encRes && !encRes.error && encRes.data) ? encRes.data : []);
    setLoading(false);
  }, [proyectoId]);

  useEffect(() => {
    setLoading(true);
    cargar();
    const ch = supabase
      .channel('participaciones-changes-' + proyectoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personas' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar, proyectoId]);

  // Buscar persona existente por clave (tel/ig/email) o crear una nueva
  const buscarOcrearPersona = useCallback(async ({ nombre, tel, instagram, email }) => {
    const telN = norm.tel(tel), igN = norm.ig(instagram), emN = norm.email(email);
    // Intentar match por la clave más fuerte disponible
    let q = supabase.from('personas').select('*');
    if (telN) q = q.eq('tel_norm', telN);
    else if (igN) q = q.eq('ig_norm', igN);
    else if (emN) q = q.eq('email_norm', emN);
    else q = q.ilike('nombre', (nombre || '').trim());
    const { data: hit } = await q.limit(1);
    if (hit && hit.length) return hit[0];

    const { data: nueva, error } = await supabase.from('personas').insert({
      nombre: (nombre || '').trim(),
      tel: tel || null, instagram: instagram || null, email: email || null,
      iniciales: iniciales(nombre),
      tel_norm: telN, ig_norm: igN, email_norm: emN,
    }).select().single();
    if (error) throw error;
    return nueva;
  }, []);

  // Alta de inscrito en este proyecto (find-or-create persona + participación)
  const agregarInscrito = useCallback(async ({ nombre, tel, instagram, email, total, tipo_inscripcion, notas }) => {
    const persona = await buscarOcrearPersona({ nombre, tel, instagram, email });
    const { error } = await supabase.from('participaciones').upsert({
      persona_id: persona.id, proyecto_id: idRef.current, rol: 'inscrito',
      estado: 'pendiente', total: total ?? null, pagado: 0,
      tipo_inscripcion: tipo_inscripcion || null, notas: notas || null,
      fecha_inscripcion: new Date().toISOString(),
    }, { onConflict: 'persona_id,proyecto_id,rol' });
    if (error) throw error;
    await cargar();
  }, [buscarOcrearPersona, cargar]);

  // Registrar pago: incrementa pagado y deriva estado de pagado vs total
  const registrarPago = useCallback(async (participacionId, monto) => {
    const p = inscritos.find(x => x.id === participacionId);
    if (!p) throw new Error('Participación no encontrada');
    const nuevoPagado = Number(p.pagado || 0) + Number(monto || 0);
    const total = Number(p.total || 0);
    const estado = total > 0 && nuevoPagado >= total ? 'completo' : (nuevoPagado > 0 ? 'parcial' : 'pendiente');
    const { error } = await supabase.from('participaciones')
      .update({ pagado: nuevoPagado, estado }).eq('id', participacionId);
    if (error) throw error;
    await cargar();
  }, [inscritos, cargar]);

  // Alta de lead (pool compartido) — se asocia al proyecto como interés de origen
  const agregarLead = useCallback(async ({ nombre, tel, instagram, email, fuente, notas }) => {
    const persona = await buscarOcrearPersona({ nombre, tel, instagram, email });
    const { error } = await supabase.from('participaciones').upsert({
      persona_id: persona.id, proyecto_id: idRef.current, rol: 'lead',
      estado: 'nuevo', fuente: fuente || null, notas: notas || null,
      fecha_inscripcion: new Date().toISOString(),
    }, { onConflict: 'persona_id,proyecto_id,rol' });
    if (error) throw error;
    await cargar();
  }, [buscarOcrearPersona, cargar]);

  // Convertir lead → inscrito en este proyecto
  const convertirLead = useCallback(async (personaId, { total, tipo_inscripcion } = {}) => {
    const { error } = await supabase.from('participaciones').upsert({
      persona_id: personaId, proyecto_id: idRef.current, rol: 'inscrito',
      estado: 'pendiente', total: total ?? null, pagado: 0,
      tipo_inscripcion: tipo_inscripcion || null,
      fecha_inscripcion: new Date().toISOString(),
    }, { onConflict: 'persona_id,proyecto_id,rol' });
    if (error) throw error;
    await cargar();
  }, [cargar]);

  return { inscritos, leads, encuentros, loading, recargar: cargar, agregarInscrito, registrarPago, agregarLead, convertirLead };
}

window.useProyectos = useProyectos;
window.useProyectoData = useProyectoData;
