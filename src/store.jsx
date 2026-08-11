import React from 'react';
import { useAlumnas } from './hooks/useAlumnas.js';
import { useLeads } from './hooks/useLeads.js';
import { useAsistencia } from './hooks/useAsistencia.js';
import { useAjustes, DEFAULT_AJUSTES } from './hooks/useAjustes.js';
import { useMensajes } from './hooks/useMensajes.js';
import { usePreinscripcion } from './hooks/usePreinscripcion.js';
import { useComprobanteToken } from './hooks/useComprobanteToken.js';
import { useComprobantesPendientes } from './hooks/useComprobantesPendientes.js';
// Módulo Estudio (paralelo al de formación, sin acoplamiento)
import { usePlanes } from './hooks/usePlanes.js';
import { useEstudiantesEstudio } from './hooks/useEstudiantesEstudio.js';
import { useMembresias } from './hooks/useMembresias.js';
import { usePagosEstudio } from './hooks/usePagosEstudio.js';
import { useComprobantesEstudio } from './hooks/useComprobantesEstudio.js';
import { useClasesEstudio } from './hooks/useClasesEstudio.js';
import { useAsistenciaEstudio } from './hooks/useAsistenciaEstudio.js';
import { supabase } from './lib/supabase.js';

// Exponer hooks que necesitan acceder componentes que viven en window.X
window.usePreinscripcion = usePreinscripcion;
window.useComprobanteToken = useComprobanteToken;

// ─────────────────────────────────────────────────────────────────────
// Estado central — todo en Supabase: alumnas, leads, pagos, asistencia,
// ajustes, mensajes. Cada hook maneja su realtime + optimistic UI.
// ─────────────────────────────────────────────────────────────────────

// proyectoId por defecto = 2 (formación junio 2026). Los hooks filtran por
// proyecto_id; para la formación es no-op (todas sus filas ya tienen id=2).
// Para el taller (proyectoId=1) corre el MISMO motor con los datos del taller.
function useStore(proyectoId = 2) {
  const esFormacion = proyectoId === 2;
  const alumnasHook = useAlumnas(proyectoId);
  const leadsHook = useLeads(proyectoId);
  const asistenciaHook = useAsistencia(proyectoId);
  const ajustesHook = useAjustes({ proyectoId, esFormacion });
  const mensajesHook = useMensajes(proyectoId);
  const comprobantesPendientesHook = useComprobantesPendientes();

  // ── Módulo Estudio ──
  const planesHook = usePlanes();
  const estudiantesEstudioHook = useEstudiantesEstudio();
  const membresiasHook = useMembresias();
  const pagosEstudioHook = usePagosEstudio();
  const comprobantesEstudioHook = useComprobantesEstudio();
  const clasesEstudioHook = useClasesEstudio();
  const asistenciaEstudioHook = useAsistenciaEstudio();

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
    proyectoId,
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
  const registrarPago = (alumnaId, monto, tipo, forma, extraOpts = {}) => alumnasHook.registrarPago(
    alumnaId, monto, tipo,
    { sillasMax: state.ajustes.bonoSillaCupos || 6, forma: forma || 'transferencia', ...extraOpts }
  );

  // Descuento al renunciar a silla = $40 en todos los tipos de inscripción.
  // Pronto-pago es la única excepción: precio fijo, no baja al renunciar.
  const DIFERENCIAL_SILLA = 40;

  // Pronto pago se detecta por precio (total === precioProntoPago en completa).
  // No por etiqueta a.pago — esa ya no existe como fuente de verdad.
  const esProntoPagoProducto = (a) => {
    const pp = Number(state.ajustes.precioProntoPago) || 484;
    return a?.tipo_inscripcion === 'completa' && Number(a?.total) === pp;
  };

  // Renunciar a silla: descuenta del total.
  // Sobrepago queda como crédito (pagado puede quedar > total).
  const renunciarSilla = async (alumnaId) => {
    const a = state.alumnas.find(x => x.id === alumnaId);
    if (!a || !a.bonoSilla) return;
    const esPP = esProntoPagoProducto(a);
    const descuento = esPP ? 0 : DIFERENCIAL_SILLA;
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

  // Ajustar precio (precio especial). Guarda el nuevo total + registra
  // evento en timeline con motivo. El home/dashboard suma alumnas.total,
  // así que el reflejo es inmediato.
  const ajustarPrecioAlumna = async (alumnaId, nuevoTotal, motivo, totalAnterior) => {
    const nuevo = Number(nuevoTotal) || 0;
    const anterior = Number(totalAnterior) || 0;
    if (nuevo <= 0) return { error: 'Precio debe ser mayor a $0' };
    if (!motivo || !motivo.trim()) return { error: 'Falta el motivo del ajuste' };
    const delta = nuevo - anterior;
    await alumnasHook.updateAlumna(alumnaId, { total: nuevo });
    await supabase.from('eventos_alumna').insert({
      alumna_id: alumnaId,
      tipo: 'ajuste_precio',
      titulo: 'Precio especial',
      subtitulo: `De $${anterior} a $${nuevo} · ${motivo.trim()}`,
      monto: delta,
    });
    return { ok: true };
  };

  // Asignar silla manualmente (Sofía override)
  const asignarSilla = async (alumnaId) => {
    const a = state.alumnas.find(x => x.id === alumnaId);
    if (!a || a.bonoSilla) return;
    const esPP = esProntoPagoProducto(a);
    const aumento = esPP ? 0 : DIFERENCIAL_SILLA;
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
  const asignarLead = (id, persona) => leadsHook.asignarLead(id, persona);
  // Convertir lead → alumna SIN asumir pago. Caller debe pasar `pagado` en extra
  // (puede ser 0 si "convertir sin pago aún"). El PagoForm es quien maneja
  // los flujos con pago. Esta función queda como helper bajo nivel.
  const convertLeadToAlumna = async (leadId, extra = {}) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;
    const pagado = typeof extra.pagado === 'number' ? extra.pagado : 0;
    const totalEstimado = Number(extra.total) || 0;
    const pago = extra.pago || (
      totalEstimado > 0 && pagado >= totalEstimado ? 'completo'
        : pagado > 0 ? 'parcial'
        : 'pendiente'
    );
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
    // Transferir preinscripción del lead a la nueva alumna (si existe).
    // Sin esto, la respuesta del cliente al formulario quedaba huérfana
    // tras la conversión (lead borrado → preinscripcion.lead_id=NULL via FK).
    if (nuevaId) {
      await supabase
        .from('preinscripcion')
        .update({ alumna_id: nuevaId })
        .eq('lead_id', leadId);
    }
    await deleteLead(leadId);
    return nuevaId;
  };

  // ── Asistencia ──
  const toggleAsistencia = (diaIdx, alumnaId) => asistenciaHook.toggleAsistencia(diaIdx, alumnaId);
  const marcarTodosDia = (diaIdx) => asistenciaHook.marcarTodosDia(diaIdx, state.alumnas.map(a => a.id));

  // ── Ajustes ──
  const updateAjustes = (patch) => ajustesHook.updateAjustes(patch);

  // ─────────────────────────────────────────────────────────────────
  // Módulo Estudio — datos y acciones agrupadas en `estudio`.
  // Mantiene el módulo de formación intacto. Todo lo nuevo queda bajo
  // store.estudio.* para que sea fácil aislar.
  // ─────────────────────────────────────────────────────────────────
  const estudio = {
    // Datos
    estudiantes: estudiantesEstudioHook.estudiantes,
    estudiantesActivas: estudiantesEstudioHook.estudiantesActivas,
    planes: planesHook.planes,
    planesActivos: planesHook.planesActivos,
    membresias: membresiasHook.membresias,
    congelaciones: membresiasHook.congelaciones,
    pagos: pagosEstudioHook.pagos,
    comprobantes: comprobantesEstudioHook.comprobantes,
    comprobantesPendientes: comprobantesEstudioHook.pendientes,
    countComprobantesPendientes: comprobantesEstudioHook.countPendientes,
    clases: clasesEstudioHook.clases,
    asistencia: asistenciaEstudioHook.asistencia,
    loading:
      planesHook.loading ||
      estudiantesEstudioHook.loading ||
      membresiasHook.loading ||
      pagosEstudioHook.loading ||
      comprobantesEstudioHook.loading ||
      clasesEstudioHook.loading ||
      asistenciaEstudioHook.loading,

    // Selectores derivados
    getMembresiaActiva: membresiasHook.getMembresiaActiva,
    estaVencida: membresiasHook.estaVencida,
    estaCongelada: membresiasHook.estaCongelada,
    diasParaVencer: membresiasHook.diasParaVencer,
    clasesRestantes: membresiasHook.clasesRestantes,
    congelacionesDeMembresia: membresiasHook.congelacionesDeMembresia,
    pagosPorEstudiante: pagosEstudioHook.porEstudiante,
    sumarPagosPorForma: pagosEstudioHook.sumarPorForma,
    asistenciaPorClase: asistenciaEstudioHook.porClase,
    asistenciaPorEstudiante: asistenciaEstudioHook.porEstudiante,

    // Acciones — Estudiantes
    addEstudiante: estudiantesEstudioHook.addEstudiante,
    crearEstudianteConMembresia: estudiantesEstudioHook.crearEstudianteConMembresia,
    updateEstudiante: estudiantesEstudioHook.updateEstudiante,
    archivarEstudiante: estudiantesEstudioHook.archivarEstudiante,
    restaurarEstudiante: estudiantesEstudioHook.restaurarEstudiante,
    deleteEstudiante: estudiantesEstudioHook.deleteEstudiante,

    // Acciones — Planes
    addPlan: planesHook.addPlan,
    updatePlan: planesHook.updatePlan,
    archivarPlan: planesHook.archivarPlan,
    reactivarPlan: planesHook.reactivarPlan,
    deletePlan: planesHook.deletePlan,

    // Acciones — Membresías
    addMembresia: membresiasHook.addMembresia,
    renovarMembresia: membresiasHook.renovarMembresia,
    updateMembresia: membresiasHook.updateMembresia,
    registrarClaseUsada: membresiasHook.registrarClaseUsada,
    cancelarMembresia: membresiasHook.cancelarMembresia,
    deleteMembresia: membresiasHook.deleteMembresia,
    congelarMembresia: membresiasHook.congelarMembresia,
    descongelarMembresia: membresiasHook.descongelarMembresia,

    // Acciones — Pagos del estudio (4 formas: transferencia/efectivo/payphone/canje)
    registrarPagoEstudio: pagosEstudioHook.registrarPago,
    updatePagoEstudio: pagosEstudioHook.updatePago,
    deletePagoEstudio: pagosEstudioHook.deletePago,

    // Acciones — Comprobantes del estudio
    subirComprobanteEstudioAdmin: comprobantesEstudioHook.subirComprobanteAdmin,
    validarComprobanteEstudio: comprobantesEstudioHook.validarComprobante,
    rechazarComprobanteEstudio: comprobantesEstudioHook.rechazarComprobante,
    deleteComprobanteEstudio: comprobantesEstudioHook.deleteComprobante,
    firmarUrlComprobanteEstudio: comprobantesEstudioHook.firmarUrl,

    // Acciones — Clases y asistencia
    addClase: clasesEstudioHook.addClase,
    updateClase: clasesEstudioHook.updateClase,
    deleteClase: clasesEstudioHook.deleteClase,
    marcarAsistencia: asistenciaEstudioHook.marcar,
    borrarAsistencia: asistenciaEstudioHook.borrarAsistencia,
  };

  return {
    state,
    loading,
    addAlumna, updateAlumna, deleteAlumna,
    addLead, updateLead, deleteLead, asignarLead, convertLeadToAlumna,
    registrarPago,
    asignarSilla, renunciarSilla, ajustarPrecioAlumna,
    toggleAsistencia, marcarTodosDia,
    updateAjustes,
    // Módulo Estudio (datos + acciones)
    estudio,
  };
}

window.useStore = useStore;
window.DEFAULT_AJUSTES = DEFAULT_AJUSTES;
export { useStore, DEFAULT_AJUSTES };
