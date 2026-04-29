// ─────────────────────────────────────────────────────────────────────
// Ejecutor de comandos de voz: traduce {tool_name, parameters} a
// llamadas al store del dashboard.
// Devuelve una promesa que resuelve a { ok, message, navigate?, openSheet?, openOverlay? }
// El componente App interpreta esos extras para cambiar UI según corresponda.
// ─────────────────────────────────────────────────────────────────────

// Match aproximado de nombre dentro de una lista de personas
function findByName(items, query) {
  if (!query || !items) return [];
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
  // Match exacto primero
  let m = items.filter(p => (p.nombre || '').toLowerCase() === q);
  if (m.length) return m;
  // Match por inicio
  m = items.filter(p => (p.nombre || '').toLowerCase().startsWith(q));
  if (m.length) return m;
  // Match por palabras (ej "Mari Fer" → "María Fernanda Castro")
  const qParts = q.split(' ').filter(Boolean);
  m = items.filter(p => {
    const lower = (p.nombre || '').toLowerCase();
    return qParts.every(part => lower.includes(part.slice(0, Math.max(3, part.length - 1))));
  });
  if (m.length) return m;
  // Substring
  return items.filter(p => (p.nombre || '').toLowerCase().includes(q));
}

const RESPUESTAS_CONSULTA = {
  cupos_disponibles: (state, ajustes) => {
    const total = state.alumnas.length;
    const cap = ajustes.capacidad || 25;
    return `${cap - total} cupos libres de ${cap}.`;
  },
  pagos_pendientes: (state) => {
    const list = state.alumnas.filter(a => a.pago === 'pendiente' || a.pago === 'parcial');
    if (!list.length) return 'No hay pagos pendientes.';
    const total = list.reduce((s, a) => s + (a.total - a.pagado), 0);
    return `${list.length} pagos pendientes, total $${total}: ${list.slice(0, 5).map(a => a.nombre.split(' ')[0]).join(', ')}${list.length > 5 ? '…' : ''}.`;
  },
  leads_nuevos: (state) => {
    const list = state.leads.filter(l => l.estado === 'nuevo');
    if (!list.length) return 'No hay leads nuevos.';
    return `${list.length} leads nuevos: ${list.slice(0, 5).map(l => l.nombre.split(' ')[0]).join(', ')}${list.length > 5 ? '…' : ''}.`;
  },
  total_inscritos: (state) => `${state.alumnas.length} estudiantes inscritos.`,
  asistencia_hoy: (state) => {
    const hoy = state.asistencia[0] || {};
    const presentes = Object.values(hoy).filter(v => v === true).length;
    return `${presentes} presentes registrados hoy.`;
  },
  bono_silla_estado: (state, ajustes) => {
    const dados = state.alumnas.filter(a => a.bonoSilla).length;
    const max = ajustes.bonoSillaCupos || 6;
    return `${dados} bonos silla entregados de ${max}.`;
  },
};

export async function executeVoiceCommand(toolName, params, store, ui) {
  const { state, ajustes } = { state: store.state, ajustes: store.state.ajustes };

  switch (toolName) {
    case 'crear_lead': {
      await store.addLead({
        nombre: params.nombre,
        tel: params.tel || '',
        instagram: params.instagram || '',
        fuente: params.fuente || 'otro',
        estado: params.estado || 'nuevo',
        mensaje: params.mensaje || '',
      });
      return { ok: true, message: `Lead "${params.nombre}" creado.`, navigate: 'marketing' };
    }

    case 'crear_estudiante': {
      const id = await store.addAlumna({
        nombre: params.nombre,
        tel: params.tel || '',
        instagram: params.instagram || '',
        bonoSilla: !!params.bonoSilla,
        notas: params.notas || '',
      });
      return { ok: true, message: `Estudiante "${params.nombre}" inscrito.`, navigate: 'reservas', openAlumna: id };
    }

    case 'registrar_pago': {
      const matches = findByName(state.alumnas, params.nombre_alumna);
      if (matches.length === 0) {
        return { ok: false, message: `No encuentro a "${params.nombre_alumna}" en estudiantes.` };
      }
      if (matches.length > 1) {
        return { ok: false, message: `Encontré varios: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}. Sé más específica.` };
      }
      const a = matches[0];
      await store.registrarPago(a.id, params.monto, params.tipo || 'parcial');
      return { ok: true, message: `Pago de $${params.monto} registrado a ${a.nombre.split(' ')[0]}.`, navigate: 'pagos' };
    }

    case 'cambiar_estado_lead': {
      const matches = findByName(state.leads, params.nombre_lead);
      if (matches.length === 0) return { ok: false, message: `No encuentro lead "${params.nombre_lead}".` };
      if (matches.length > 1) return { ok: false, message: `Hay varios leads: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}.` };
      await store.updateLead(matches[0].id, { estado: params.nuevo_estado });
      return { ok: true, message: `${matches[0].nombre.split(' ')[0]} ahora está como ${params.nuevo_estado}.`, navigate: 'marketing' };
    }

    case 'convertir_lead_a_estudiante': {
      const matches = findByName(state.leads, params.nombre_lead);
      if (matches.length === 0) return { ok: false, message: `No encuentro lead "${params.nombre_lead}".` };
      if (matches.length > 1) return { ok: false, message: `Hay varios leads: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}.` };
      await store.convertLeadToAlumna(matches[0].id);
      return { ok: true, message: `${matches[0].nombre.split(' ')[0]} convertido en estudiante.`, navigate: 'reservas' };
    }

    case 'marcar_asistencia': {
      const matches = findByName(state.alumnas, params.nombre_alumna);
      if (matches.length === 0) return { ok: false, message: `No encuentro estudiante "${params.nombre_alumna}".` };
      if (matches.length > 1) return { ok: false, message: `Hay varios: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}.` };

      // Resolver día (default = primer día que aún no ha pasado, o día 1)
      let diaIdx = 0;
      const diaText = (params.dia || '').toLowerCase();
      const m = diaText.match(/d[ií]a\s*(\d)/);
      if (m) diaIdx = parseInt(m[1], 10) - 1;
      else if (/hoy|today/.test(diaText)) diaIdx = 0; // simplificación: hoy = día 1 si no está dentro de la formación
      diaIdx = Math.max(0, Math.min(5, diaIdx));

      // Si ya está como queremos, no toca; si no, toggle
      const cur = state.asistencia[diaIdx]?.[matches[0].id];
      const desired = params.presente !== false;
      if (cur === desired) {
        return { ok: true, message: `${matches[0].nombre.split(' ')[0]} ya está marcado.`, navigate: 'home' };
      }
      // Hacer toggle hasta llegar al estado deseado
      await store.toggleAsistencia(diaIdx, matches[0].id);
      // Si quedó en ausente y queríamos presente, otro toggle
      if (cur === false && desired === true) {
        await store.toggleAsistencia(diaIdx, matches[0].id);
      }
      return { ok: true, message: `${matches[0].nombre.split(' ')[0]} ${desired ? 'presente' : 'ausente'} en día ${diaIdx + 1}.` };
    }

    case 'eliminar_registro': {
      const list = params.tipo === 'lead' ? state.leads : state.alumnas;
      const matches = findByName(list, params.nombre);
      if (matches.length === 0) return { ok: false, message: `No encuentro a "${params.nombre}".` };
      if (matches.length > 1) return { ok: false, message: `Hay varios: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}. Sé más específica.` };
      if (params.tipo === 'lead') await store.deleteLead(matches[0].id);
      else await store.deleteAlumna(matches[0].id);
      return { ok: true, message: `Registro de ${matches[0].nombre.split(' ')[0]} eliminado.` };
    }

    case 'generar_preinscripcion': {
      const matches = findByName(state.leads, params.nombre_lead);
      if (matches.length === 0) return { ok: false, message: `No encuentro lead "${params.nombre_lead}".` };
      if (matches.length > 1) return { ok: false, message: `Hay varios leads: ${matches.map(m => m.nombre).slice(0, 4).join(', ')}.` };
      // Abrir el form del lead, donde está el panel de preinscripción
      return {
        ok: true,
        message: `Abriendo ficha de ${matches[0].nombre.split(' ')[0]} para enviar preinscripción.`,
        openSheet: { type: 'edit-lead', id: matches[0].id },
      };
    }

    case 'abrir_ficha': {
      // Intentar primero estudiantes, si no encuentra y tipo=lead o no especificado, leads
      let matches = findByName(state.alumnas, params.nombre);
      if (matches.length === 1 && params.tipo !== 'lead') {
        return { ok: true, message: `Abriendo ficha de ${matches[0].nombre.split(' ')[0]}.`, openAlumna: matches[0].id };
      }
      const leadMatches = findByName(state.leads, params.nombre);
      if (leadMatches.length === 1 && (params.tipo === 'lead' || matches.length === 0)) {
        return { ok: true, message: `Abriendo lead ${leadMatches[0].nombre.split(' ')[0]}.`, openSheet: { type: 'edit-lead', id: leadMatches[0].id } };
      }
      if (matches.length > 1 || leadMatches.length > 1) {
        const all = [...matches, ...leadMatches];
        return { ok: false, message: `Hay varios: ${all.slice(0, 4).map(m => m.nombre).join(', ')}.` };
      }
      return { ok: false, message: `No encuentro a "${params.nombre}".` };
    }

    case 'consultar': {
      const fn = RESPUESTAS_CONSULTA[params.pregunta];
      if (!fn) return { ok: false, message: `No sé responder esa consulta.` };
      return { ok: true, message: fn(state, ajustes) };
    }

    case 'preguntar_clarificacion': {
      return { ok: false, message: params.pregunta || 'No te entendí bien.' };
    }

    default:
      return { ok: false, message: `No conozco la acción "${toolName}".` };
  }
}
