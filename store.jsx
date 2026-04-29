// ──────────────────────────────────────────
// Estado central (CRUD) — alumnas, leads, pagos, asistencia, ajustes
// Persiste en localStorage. Cuando pase a backend → reemplazar por Supabase queries.
// ──────────────────────────────────────────

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

const SEED = {
  alumnas: window.MOCK_ALUMNAS || [],
  leads: window.MOCK_LEADS || [],
  // asistencia[diaIdx][alumnaId] = true|false|undefined
  asistencia: (() => {
    const m = {};
    (window.MOCK_ALUMNAS || []).forEach(a => {
      a.asistencia.forEach((v, i) => {
        if (v === 1) {
          if (!m[i]) m[i] = {};
          m[i][a.id] = true;
        } else if (v === 0 && i < 2) {
          // ausente solo en días pasados (no marcamos futuros como ausentes)
        }
      });
    });
    return m;
  })(),
  ajustes: DEFAULT_AJUSTES,
  mensajes: window.MENSAJES_RECIENTES || [],
};

function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return {
      alumnas: parsed.alumnas || SEED.alumnas,
      leads: parsed.leads || SEED.leads,
      asistencia: parsed.asistencia || SEED.asistencia,
      ajustes: { ...DEFAULT_AJUSTES, ...(parsed.ajustes || {}) },
      mensajes: parsed.mensajes || SEED.mensajes,
    };
  } catch (e) {
    return SEED;
  }
}

function useStore() {
  const [state, setState] = React.useState(() => loadStore());

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }, [state]);

  // ── Alumnas ──
  const addAlumna = (data) => {
    const id = Date.now();
    const iniciales = data.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    const hue = Math.floor(Math.random() * 90) + 20;
    const nueva = {
      id, iniciales,
      avatar: `oklch(0.74 0.07 ${hue})`,
      asistencia: [0, 0, 0, 0, 0, 0],
      pagado: 0,
      total: state.ajustes.precioRegular,
      pago: 'pendiente',
      bonoSilla: false,
      notas: '',
      inscrita: new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }),
      tel: '',
      ...data,
    };
    setState(s => ({ ...s, alumnas: [...s.alumnas, nueva] }));
    return id;
  };
  const updateAlumna = (id, patch) => {
    setState(s => ({ ...s, alumnas: s.alumnas.map(a => a.id === id ? { ...a, ...patch } : a) }));
  };
  const deleteAlumna = (id) => {
    setState(s => {
      const newAsis = { ...s.asistencia };
      Object.keys(newAsis).forEach(d => { if (newAsis[d][id] !== undefined) { delete newAsis[d][id]; } });
      return { ...s, alumnas: s.alumnas.filter(a => a.id !== id), asistencia: newAsis };
    });
  };

  // ── Leads ──
  const addLead = (data) => {
    const id = Date.now();
    setState(s => ({ ...s, leads: [{ id, estado: 'nuevo', tiempo: 'ahora', mensaje: '', ...data }, ...s.leads] }));
    return id;
  };
  const updateLead = (id, patch) => {
    setState(s => ({ ...s, leads: s.leads.map(l => l.id === id ? { ...l, ...patch } : l) }));
  };
  const deleteLead = (id) => {
    setState(s => ({ ...s, leads: s.leads.filter(l => l.id !== id) }));
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

  // ── Pagos / monto pagado ──
  const registrarPago = (alumnaId, monto, tipo) => {
    setState(s => {
      const alumnas = s.alumnas.map(a => {
        if (a.id !== alumnaId) return a;
        const nuevoPagado = (a.pagado || 0) + monto;
        let nuevoEstado = 'parcial';
        if (nuevoPagado >= a.total) nuevoEstado = tipo === 'pronto-pago' ? 'pronto-pago' : 'completo';
        else if (nuevoPagado === 0) nuevoEstado = 'pendiente';
        return { ...a, pagado: nuevoPagado, pago: nuevoEstado };
      });
      return { ...s, alumnas };
    });
  };

  // ── Asistencia ──
  const toggleAsistencia = (diaIdx, alumnaId) => {
    setState(s => {
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
    setState(s => {
      const newA = { ...s.asistencia };
      newA[diaIdx] = {};
      s.alumnas.forEach(a => { newA[diaIdx][a.id] = true; });
      return { ...s, asistencia: newA };
    });
  };

  // ── Ajustes ──
  const updateAjustes = (patch) => {
    setState(s => ({ ...s, ajustes: { ...s.ajustes, ...patch } }));
  };
  const resetTodo = () => {
    if (!confirm('¿Borrar todo y volver a los datos de demo? No se puede deshacer.')) return;
    localStorage.removeItem(LS_KEY);
    setState(SEED);
  };

  return {
    state,
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
