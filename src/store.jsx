import React from 'react';
import { useAlumnas } from './hooks/useAlumnas.js';

const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────────
// Estado central — versión Supabase para alumnas, localStorage para
// leads/asistencia/ajustes (estos se migrarán en una próxima iteración).
// ─────────────────────────────────────────────────────────────────────

const LS_KEY = 'sofia-dashboard-v1';

const DEFAULT_AJUSTES = {
  capacidad: 25,
  precioRegular: 640,
  precioProntoPago: 484,
  precioReserva: 200,
  fechaProntoPago: '10 mayo',
  ownerName: 'Sofía Lira',
  studioName: 'Yoga Sofía Lira',
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
    { id: 'rsv', titulo: 'Cómo reservar $200', cuerpo: 'Para apartar tu cupo: transferencia de $200 a cuenta XXXX. Apenas tengas el comprobante mándamelo y reservamos 🌿' },
    { id: 'ub', titulo: 'Ubicación', cuerpo: 'Domo Soulspace, calle Alfredo Donoso, La Morita, Tumbaco. Te paso ubicación de Maps: ' },
    { id: 'crn', titulo: 'Cronograma', cuerpo: 'Cronograma del día:\n7:30-11:30 práctica y teoría\n11:30-14:00 almuerzo\n14:00-16:30 laboratorio técnico\n16:30-18:00 yogasana' },
  ],
};

const SEED_LOCAL = {
  leads: [],
  asistencia: {},
  ajustes: DEFAULT_AJUSTES,
  mensajes: [],
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED_LOCAL;
    const parsed = JSON.parse(raw);
    return {
      leads: parsed.leads || [],
      asistencia: parsed.asistencia || {},
      ajustes: { ...DEFAULT_AJUSTES, ...(parsed.ajustes || {}) },
      mensajes: parsed.mensajes || [],
    };
  } catch (e) { return SEED_LOCAL; }
}

function useStore() {
  // ── Alumnas: Supabase ──
  const alumnasHook = useAlumnas();

  // ── Resto: localStorage por ahora ──
  const [local, setLocal] = useState(() => loadLocal());
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(local)); } catch (e) {}
  }, [local]);

  const state = {
    alumnas: alumnasHook.alumnas,
    leads: local.leads,
    asistencia: local.asistencia,
    ajustes: local.ajustes,
    mensajes: local.mensajes,
  };

  // ── Alumnas (Supabase) ──
  const addAlumna = async (data) => {
    const merged = { total: state.ajustes.precioRegular, ...data };
    return await alumnasHook.addAlumna(merged);
  };
  const updateAlumna = (id, patch) => alumnasHook.updateAlumna(id, patch);
  const deleteAlumna = (id) => {
    // Limpiar también la asistencia local (cuando migremos asistencia, esto irá a Supabase)
    setLocal(s => {
      const newAsis = { ...s.asistencia };
      Object.keys(newAsis).forEach(d => {
        if (newAsis[d][id] !== undefined) delete newAsis[d][id];
      });
      return { ...s, asistencia: newAsis };
    });
    return alumnasHook.deleteAlumna(id);
  };
  const registrarPago = (alumnaId, monto, tipo) => alumnasHook.registrarPago(alumnaId, monto, tipo);

  // ── Leads (localStorage) ──
  const addLead = (data) => {
    const id = Date.now();
    setLocal(s => ({ ...s, leads: [{ id, estado: 'nuevo', tiempo: 'ahora', mensaje: '', ...data }, ...s.leads] }));
    return id;
  };
  const updateLead = (id, patch) => {
    setLocal(s => ({ ...s, leads: s.leads.map(l => l.id === id ? { ...l, ...patch } : l) }));
  };
  const deleteLead = (id) => {
    setLocal(s => ({ ...s, leads: s.leads.filter(l => l.id !== id) }));
  };
  const convertLeadToAlumna = (leadId, extra = {}) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;
    addAlumna({
      nombre: lead.nombre,
      tel: lead.tel,
      pagado: state.ajustes.precioReserva,
      pago: 'pendiente',
      total: state.ajustes.precioRegular,
      ...extra,
    });
    deleteLead(leadId);
  };

  // ── Asistencia (localStorage) ──
  const toggleAsistencia = (diaIdx, alumnaId) => {
    setLocal(s => {
      const newA = { ...s.asistencia };
      if (!newA[diaIdx]) newA[diaIdx] = {};
      else newA[diaIdx] = { ...newA[diaIdx] };
      const cur = newA[diaIdx][alumnaId];
      if (cur === undefined) newA[diaIdx][alumnaId] = true;
      else if (cur === true) newA[diaIdx][alumnaId] = false;
      else delete newA[diaIdx][alumnaId];
      return { ...s, asistencia: newA };
    });
  };
  const marcarTodosDia = (diaIdx) => {
    setLocal(s => {
      const newA = { ...s.asistencia };
      newA[diaIdx] = {};
      state.alumnas.forEach(a => { newA[diaIdx][a.id] = true; });
      return { ...s, asistencia: newA };
    });
  };

  // ── Ajustes (localStorage) ──
  const updateAjustes = (patch) => {
    setLocal(s => ({ ...s, ajustes: { ...s.ajustes, ...patch } }));
  };
  const resetTodo = () => {
    if (!confirm('¿Borrar datos locales (leads, asistencia, ajustes) y volver a defaults?\n\nEsto NO toca a las alumnas en Supabase.')) return;
    localStorage.removeItem(LS_KEY);
    setLocal(SEED_LOCAL);
  };

  return {
    state,
    loading: alumnasHook.loading,
    addAlumna, updateAlumna, deleteAlumna,
    addLead, updateLead, deleteLead, convertLeadToAlumna,
    registrarPago,
    toggleAsistencia, marcarTodosDia,
    updateAjustes,
    resetTodo,
  };
}

window.useStore = useStore;
window.DEFAULT_AJUSTES = DEFAULT_AJUSTES;
export { useStore, DEFAULT_AJUSTES };
