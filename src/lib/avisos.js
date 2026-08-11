import { buildWaUrl } from './wa.js';

// ──────────────────────────────────────────────────────────────
// Avisos al equipo por WhatsApp.
//
// Caso Seminario Angelo: Sofía hace el primer contacto y crea el lead;
// Micaela retoma pagos y logística. Este helper arma el mensaje del traspaso
// y abre WhatsApp con el texto listo (no envía solo: eso requeriría la API
// de WhatsApp Business).
//
// Los destinatarios viven en `proyectos.config.avisos` para no hardcodear
// números en el código:
//   avisos: { equipo: [ { nombre:'Micaela', tel:'09xxxxxxx', rol:'gestion' } ] }
// ──────────────────────────────────────────────────────────────

export function destinatariosAviso(ajustes) {
  const eq = ajustes?.avisos?.equipo;
  return Array.isArray(eq) ? eq.filter(p => p && p.tel) : [];
}

// Nombres legibles de las sedes que le interesan al lead ("Quito · Acción").
// `interesSedes` son los números de `proyectos.config.sedes[].n`.
export function etiquetasInteres(interesSedes, ajustes) {
  const nums = Array.isArray(interesSedes) ? interesSedes : [];
  if (!nums.length) return [];
  const sedes = ajustes?.sedes || [];
  return nums
    .slice()
    .sort((a, b) => a - b)
    .map(n => {
      const s = sedes.find(x => x?.n === n);
      return s ? (s.nombre || `Sede ${n}`) : `Encuentro ${n}`;
    });
}

// Mensaje de traspaso de un lead
export function mensajeTraspasoLead(lead, ajustes) {
  const proyecto = ajustes?.studioName || 'el proyecto';
  const partes = [
    `Hola! Te paso un lead de ${proyecto} 🌿`,
    '',
    `· Nombre: ${lead?.nombre || '—'}`,
  ];
  if (lead?.tel) partes.push(`· WhatsApp: ${lead.tel}`);
  if (lead?.instagram) partes.push(`· Instagram: ${lead.instagram}`);
  if (lead?.fuente) partes.push(`· Llegó por: ${lead.fuente}`);
  const interes = etiquetasInteres(lead?.interesSedes, ajustes);
  if (interes.length) partes.push(`· Le interesa: ${interes.join(' · ')}`);
  if (lead?.estado) partes.push(`· Estado: ${lead.estado}`);
  if (lead?.mensaje) partes.push('', `Contexto: ${lead.mensaje}`);
  partes.push('', '¿Lo tomas desde aquí? Cualquier cosa me dices 🙏');
  return partes.join('\n');
}

// Abre WhatsApp con el aviso listo para enviar.
// Devuelve false si el destinatario no tiene teléfono configurado.
export function abrirAvisoWhatsApp(persona, mensaje) {
  const url = buildWaUrl(persona?.tel, mensaje);
  if (!url) return false;
  // Ventana abierta de forma SÍNCRONA: iOS/PWA bloquea window.open tras un await.
  window.open(url, '_blank');
  return true;
}
