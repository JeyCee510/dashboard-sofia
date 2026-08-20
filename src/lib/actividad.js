import { supabase } from './supabase.js';

// ──────────────────────────────────────────────────────────────
// Bitácora de actividad (tabla `actividad`, migración 037)
//
// Registra QUIÉN hizo QUÉ en cada proyecto, para que Sofía pueda revisar el
// trabajo del equipo (ej. la gestión de Micaela en el Seminario Angelo).
//
// Es deliberadamente "best effort": si falla el registro NO debe romper la
// acción del usuario (registrar un pago es más importante que su bitácora).
// ──────────────────────────────────────────────────────────────

let _actor = { email: null, nombre: null };

// app.jsx / useAuth setean esto al iniciar sesión
export function setActorActividad({ email, nombre } = {}) {
  _actor = { email: email || null, nombre: nombre || null };
}

// Quién está operando la app ahora mismo. Lo usan los hooks para sellar
// `creado_por` / `asignado_a` en los leads (no sólo la bitácora).
export function actorActividad() {
  return { ..._actor };
}

/**
 * Registra un evento en la bitácora.
 * @param {object} p
 * @param {number} p.proyectoId  proyecto al que pertenece la acción
 * @param {string} p.entidad     'lead' | 'alumna' | 'pago' | 'comprobante' | 'proyecto'
 * @param {number} [p.entidadId] id de la fila afectada (para el historial por ficha)
 * @param {string} p.accion      'creo' | 'actualizo' | 'nota' | 'cambio_estado' | 'pago' | 'mensaje' | 'elimino'
 * @param {string} [p.titulo]    texto legible: "Registró pago de $80"
 * @param {object} [p.detalle]   datos extra (jsonb)
 */
export async function registrarActividad({ proyectoId, entidad, entidadId, accion, titulo, detalle }) {
  try {
    if (!proyectoId || !accion) return;
    await supabase.from('actividad').insert({
      proyecto_id: proyectoId,
      actor_email: _actor.email,
      actor_nombre: _actor.nombre,
      entidad: entidad || null,
      entidad_id: entidadId || null,
      accion,
      titulo: titulo || null,
      detalle: detalle || {},
    });
  } catch (e) {
    // Nunca propagar: la bitácora no debe bloquear la operación real.
    console.warn('[actividad] no se pudo registrar', e);
  }
}

/**
 * Atajo para registrar un movimiento sobre una persona desde una pantalla que
 * no tiene el store a mano (paneles de la ficha). Toma el proyecto del global
 * que setea app.jsx.
 *
 * Existe porque el 11-ago no pudimos reconstruir qué había hecho Sofía: los
 * links generados y los WhatsApp enviados no dejaban ningún rastro, y hubo que
 * deducirlo cruzando timestamps de tablas que no eran para eso.
 */
export function registrarMovimiento({ leadId, alumnaId, accion, titulo, detalle }) {
  return registrarActividad({
    proyectoId: window.PROYECTO_ID || 2,
    entidad: alumnaId ? 'alumna' : 'lead',
    entidadId: alumnaId || leadId || null,
    accion,
    titulo,
    detalle,
  });
}

// Texto legible por acción (para la UI)
export const ETIQUETA_ACCION = {
  creo: 'creó',
  actualizo: 'actualizó',
  nota: 'anotó',
  cambio_estado: 'cambió el estado de',
  pago: 'registró un pago de',
  mensaje: 'contactó a',
  asigno: 'pasó la posta de',
  link_inscripcion: 'generó el link de inscripción de',
  link_pago: 'generó el link de pago de',
  envio_wa: 'le escribió a',
  verifico: 'verificó en la cuenta',
  elimino: 'eliminó',
};
