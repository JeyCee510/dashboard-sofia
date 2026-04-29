import React from 'react';
import { useAlumnas } from './hooks/useAlumnas.js';
import { useLeads } from './hooks/useLeads.js';
import { useAsistencia } from './hooks/useAsistencia.js';
import { useAjustes, DEFAULT_AJUSTES } from './hooks/useAjustes.js';
import { useMensajes } from './hooks/useMensajes.js';
import { usePreinscripcion } from './hooks/usePreinscripcion.js';

// Exponer hooks que necesitan acceder componentes que viven en window.X
window.usePreinscripcion = usePreinscripcion;

// ─────────────────────────────────────────────────────────────────────
// Estado central — todo en Supabase: alumnas, leads, pagos, asistencia,
// ajustes, mensajes. Cada hook maneja su realtime + optimistic UI.
// ─────────────────────────────────────────────────────────────────────

function useStore() {
  const alumnasHook = useAlumnas();
  const leadsHook = useLeads();
  const asistenciaHook = useAsistencia();
  const ajustesHook = useAjustes();
  const mensajesHook = useMensajes();

  const state = {
    alumnas: alumnasHook.alumnas,
    leads: leadsHook.leads,
    asistencia: asistenciaHook.asistencia,
    ajustes: ajustesHook.ajustes,
    mensajes: mensajesHook.mensajes,
  };

  const loading =
    alumnasHook.loading ||
    leadsHook.loading ||
    asistenciaHook.loading ||
    ajustesHook.loading ||
    mensajesHook.loading;

  // ── Alumnas ──
  const addAlumna = async (data) => {
    const merged = { total: state.ajustes.precioRegular, ...data };
    return await alumnasHook.addAlumna(merged);
  };
  const updateAlumna = (id, patch) => alumnasHook.updateAlumna(id, patch);
  const deleteAlumna = (id) => alumnasHook.deleteAlumna(id);
  const registrarPago = (alumnaId, monto, tipo) => alumnasHook.registrarPago(alumnaId, monto, tipo);

  // ── Leads ──
  const addLead = (data) => leadsHook.addLead(data);
  const updateLead = (id, patch) => leadsHook.updateLead(id, patch);
  const deleteLead = (id) => leadsHook.deleteLead(id);
  const convertLeadToAlumna = async (leadId, extra = {}) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;
    await addAlumna({
      nombre: lead.nombre,
      tel: lead.tel,
      pagado: state.ajustes.precioReserva,
      pago: 'pendiente',
      total: state.ajustes.precioRegular,
      ...extra,
    });
    await deleteLead(leadId);
  };

  // ── Asistencia ──
  const toggleAsistencia = (diaIdx, alumnaId) => asistenciaHook.toggleAsistencia(diaIdx, alumnaId);
  const marcarTodosDia = (diaIdx) => asistenciaHook.marcarTodosDia(diaIdx, state.alumnas.map(a => a.id));

  // ── Ajustes ──
  const updateAjustes = (patch) => ajustesHook.updateAjustes(patch);

  return {
    state,
    loading,
    addAlumna, updateAlumna, deleteAlumna,
    addLead, updateLead, deleteLead, convertLeadToAlumna,
    registrarPago,
    toggleAsistencia, marcarTodosDia,
    updateAjustes,
  };
}

window.useStore = useStore;
window.DEFAULT_AJUSTES = DEFAULT_AJUSTES;
export { useStore, DEFAULT_AJUSTES };
