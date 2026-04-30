import React from 'react';
import { useAlumnas } from './hooks/useAlumnas.js';
import { useLeads } from './hooks/useLeads.js';
import { useAsistencia } from './hooks/useAsistencia.js';
import { useAjustes, DEFAULT_AJUSTES } from './hooks/useAjustes.js';
import { useMensajes } from './hooks/useMensajes.js';
import { usePreinscripcion } from './hooks/usePreinscripcion.js';
import { useComprobanteToken } from './hooks/useComprobanteToken.js';
import { useComprobantesPendientes } from './hooks/useComprobantesPendientes.js';
import { supabase } from './lib/supabase.js';

// Exponer hooks que necesitan acceder componentes que viven en window.X
window.usePreinscripcion = usePreinscripcion;
window.useComprobanteToken = useComprobanteToken;

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
  const comprobantesPendientesHook = useComprobantesPendientes();

  // Inyectar plantilla virtual "Programa PDF" si hay un PDF cargado.
  // Las plantillas virtuales tienen id que empieza con '__' y NO se persisten
  // ni se pueden editar desde Ajustes (filtradas en screen-ajustes).
  const ajustesEnriquecidos = React.useMemo(() => {
    const base = ajustesHook.ajustes;
    const url = base.materialProgramaUrl;
    const baseTpl = base.plantillasWA || [];
    if (!url) return base;
    const virtual = {
      id: '__pdf_programa__',
      titulo: 'Programa PDF',
      cuerpo: `Te paso el PDF con el programa completo de la formación 🙏\n\n${url}`,
    };
    // Si ya existe (re-cómputo), reemplazar; si no, agregar al final.
    const sinVirtual = baseTpl.filter(p => p.id !== '__pdf_programa__');
    return { ...base, plantillasWA: [...sinVirtual, virtual] };
  }, [ajustesHook.ajustes]);

  const state = {
    alumnas: alumnasHook.alumnas,
    leads: leadsHook.leads,
    asistencia: asistenciaHook.asistencia,
    ajustes: ajustesEnriquecidos,
    mensajes: mensajesHook.mensajes,
    comprobantesPendientes: comprobantesPendientesHook.count,
    comprobantePendienteLatest: comprobantesPendientesHook.latest,
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
  const registrarPago = (alumnaId, monto, tipo) => alumnasHook.registrarPago(
    alumnaId, monto, tipo,
    { sillasMax: state.ajustes.bonoSillaCupos || 6 }
  );

  // Descuento al renunciar a silla = $30 en todos los tipos de inscripción.
  // Pronto-pago es la única excepción: precio fijo, no baja al renunciar.
  const DIFERENCIAL_SILLA = 30;

  // Renunciar a silla: descuenta del total.
  // Sobrepago queda como crédito (pagado puede quedar > total).
  const renunciarSilla = async (alumnaId) => {
    const a = state.alumnas.find(x => x.id === alumnaId);
    if (!a || !a.bonoSilla) return;
    const esProntoPago = a.pago === 'pronto-pago';
    const descuento = esProntoPago ? 0 : DIFERENCIAL_SILLA;
    const nuevoTotal = Math.max(0, (a.total || 0) - descuento);
    await alumnasHook.updateAlumna(alumnaId, { bonoSilla: false, total: nuevoTotal });
    await supabase.from('eventos_alumna').insert({
      alumna_id: alumnaId,
      tipo: 'silla_renunciada',
      titulo: 'Renunció a silla',
      subtitulo: descuento > 0 ? `Total bajó $${descuento}` : 'Pronto pago: precio fijo, no baja',
      monto: descuento > 0 ? -descuento : null,
    });
  };

  // Asignar silla manualmente (Sofía override)
  const asignarSilla = async (alumnaId) => {
    const a = state.alumnas.find(x => x.id === alumnaId);
    if (!a || a.bonoSilla) return;
    const esProntoPago = a.pago === 'pronto-pago';
    const aumento = esProntoPago ? 0 : DIFERENCIAL_SILLA;
    const nuevoTotal = (a.total || 0) + aumento;
    await alumnasHook.updateAlumna(alumnaId, { bonoSilla: true, total: nuevoTotal });
    await supabase.from('eventos_alumna').insert({
      alumna_id: alumnaId,
      tipo: 'silla_asignada_manual',
      titulo: 'Silla asignada manualmente',
      subtitulo: aumento > 0 ? `Total subió $${aumento}` : 'Pronto pago: total no cambia',
      monto: aumento > 0 ? aumento : null,
    });
  };

  // ── Leads ──
  const addLead = (data) => leadsHook.addLead(data);
  const updateLead = (id, patch) => leadsHook.updateLead(id, patch);
  const deleteLead = (id) => leadsHook.deleteLead(id);
  // Convertir lead → alumna SIN asumir pago. Caller debe pasar `pagado` en extra
  // (puede ser 0 si "convertir sin pago aún"). El PagoForm es quien maneja
  // los flujos con pago. Esta función queda como helper bajo nivel.
  const convertLeadToAlumna = async (leadId, extra = {}) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;
    const pagado = typeof extra.pagado === 'number' ? extra.pagado : 0;
    const pago = extra.pago || (pagado > 0 ? 'parcial' : 'pendiente');
    const nuevaId = await addAlumna({
      nombre: lead.nombre,
      tel: lead.tel,
      instagram: lead.instagram || '',
      pagado,
      pago,
      total: state.ajustes.precioRegular,
      ...extra,
      _desdeLead: true, // marca para que addAlumna registre el evento correcto
    });
    await deleteLead(leadId);
    return nuevaId;
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
    asignarSilla, renunciarSilla,
    toggleAsistencia, marcarTodosDia,
    updateAjustes,
  };
}

window.useStore = useStore;
window.DEFAULT_AJUSTES = DEFAULT_AJUSTES;
export { useStore, DEFAULT_AJUSTES };
