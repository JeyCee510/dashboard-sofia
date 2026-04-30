import React from 'react';
import { supabase } from './lib/supabase.js';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// Hook local: trae estado de preinscripción de cada lead.
// Devuelve Map<lead_id, { estado, completed_at, created_at }>.
function usePreinscripcionesPorLead() {
  const [map, setMap] = useState(new Map());
  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('preinscripcion')
      .select('lead_id, estado, completed_at, created_at')
      .not('lead_id', 'is', null)
      .order('created_at', { ascending: false });
    if (error) { console.error('[preinscripciones por lead]', error); return; }
    // Por cada lead, dejar la más reciente
    const m = new Map();
    (data || []).forEach(row => {
      if (!m.has(row.lead_id)) m.set(row.lead_id, row);
    });
    setMap(m);
  }, []);
  useEffect(() => {
    cargar();
    const ch = supabase.channel('preinscripcion-by-lead-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preinscripcion' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);
  return map;
}

// ──────────────────────────────────────────
// Marketing / Leads + CRM screens
// ──────────────────────────────────────────

const fuenteIcon = {
  instagram: 'instagram',
  whatsapp: 'whatsapp',
  referido: 'users',
};
const fuenteLabel = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referido: 'Referido',
};
const estadoColor = {
  nuevo: { bg: 'var(--terracota-tint)', fg: '#8A3D26', label: 'Nuevo' },
  interesado: { bg: '#F2E2C2', fg: 'var(--gold)', label: 'Interesado' },
  reservado: { bg: '#DDE0CC', fg: '#4D5230', label: 'Reservó' },
  'frío': { bg: 'var(--bg-warm)', fg: 'var(--ink-mute)', label: 'Frío' },
};

// Tiempo relativo en español: "hace 5 min", "ayer", "hace 3 días", "12 abr".
function fmtTiempoRelativo(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const ahora = new Date();
    const diffMs = ahora - d;
    const min = Math.floor(diffMs / 60000);
    const horas = Math.floor(min / 60);
    const dias = Math.floor(horas / 24);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min} min`;
    if (horas < 24) return `${horas} h`;
    if (dias === 1) return 'ayer';
    if (dias < 7) return `${dias} días`;
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
}

// Badge compacto que muestra estado de preinscripción del lead.
//   - Sin pre: nada (no contamina la fila)
//   - Pendiente: "📋 Link enviado" terracota suave
//   - Completada: "📋 Respondida ✓" oliva
const PreBadge = ({ pre }) => {
  if (!pre) return null;
  const completada = pre.estado === 'completada' || !!pre.completed_at;
  const bg = completada ? 'rgba(116, 142, 78, 0.14)' : 'rgba(212, 138, 110, 0.14)';
  const fg = completada ? '#5C6F3C' : '#8A3D26';
  const txt = completada ? 'Preinscripción ✓' : 'Link enviado';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      marginTop: 4, padding: '2px 8px', borderRadius: 999,
      background: bg, color: fg,
      fontSize: 10, letterSpacing: '0.04em', fontWeight: 500,
    }}>
      {txt}
    </div>
  );
};

const MarketingScreen = ({ onOpenLead, onNavigate }) => {
  const [filter, setFilter] = React.useState('todos');
  const [search, setSearch] = React.useState('');
  const preMap = usePreinscripcionesPorLead();

  const counts = {
    nuevo: MOCK_LEADS.filter(l => l.estado === 'nuevo').length,
    interesado: MOCK_LEADS.filter(l => l.estado === 'interesado').length,
    reservado: MOCK_LEADS.filter(l => l.estado === 'reservado').length,
  };

  // Pipeline: filtro por estado → búsqueda → orden alfabético
  let leads = MOCK_LEADS;
  if (filter !== 'todos') leads = leads.filter(l => l.estado === filter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    leads = leads.filter(l =>
      (l.nombre || '').toLowerCase().includes(q) ||
      (l.tel || '').toLowerCase().includes(q) ||
      (l.instagram || '').toLowerCase().includes(q) ||
      (l.mensaje || '').toLowerCase().includes(q)
    );
  }
  leads = [...leads].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="eyebrow">Embudo</div>
            <h1>Leads</h1>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('papelera-leads')}
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 999,
                background: 'var(--bg-warm)',
                border: '1px solid var(--line-soft)',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-soft)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="x" size={12} stroke="var(--ink-mute)" />
              Borrados
            </button>
          )}
        </div>
      </div>

      {/* Embudo visual */}
      <div style={{ padding: '0 22px', display: 'flex', gap: 8, marginTop: 6 }}>
        <FunnelStep n={counts.nuevo} label="Nuevos" tint="terracota" />
        <FunnelStep n={counts.interesado} label="Interesados" tint="gold" />
        <FunnelStep n={counts.reservado} label="Reservados" tint="oliva" />
      </div>

      <div className="section-title">
        <h2>Por fuente</h2>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: '14px 16px', display: 'flex', gap: 16 }}>
          {['instagram', 'whatsapp', 'referido'].map(f => {
            const n = MOCK_LEADS.filter(l => l.fuente === f).length;
            return (
              <div key={f} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'var(--bg-warm)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)',
                }}>
                  <Icon name={fuenteIcon[f]} size={16} />
                </div>
                <div>
                  <div className="serif" style={{ fontSize: 18, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.04em', marginTop: 2 }}>
                    {fuenteLabel[f]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '20px 22px 10px' }}>
        <div className="segmented">
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          <button className={filter === 'nuevo' ? 'active' : ''} onClick={() => setFilter('nuevo')}>Nuevos</button>
          <button className={filter === 'interesado' ? 'active' : ''} onClick={() => setFilter('interesado')}>Interesados</button>
          <button className={filter === 'reservado' ? 'active' : ''} onClick={() => setFilter('reservado')}>Reservados</button>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ padding: '0 22px 10px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, IG, teléfono o mensaje…"
            style={{
              width: '100%', padding: '10px 14px 10px 36px',
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              borderRadius: 12,
              fontFamily: 'inherit', fontSize: 13,
              color: 'var(--ink)', outline: 'none',
            }}
          />
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-mute)', pointerEvents: 'none',
          }}>
            <Icon name="search" size={14} />
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--ink-mute)', padding: 4, fontSize: 16, lineHeight: 1,
              }}
            >×</button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {leads.length === 0 ? (
            <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              {search ? `Sin resultados para "${search}".` : 'No hay leads aún.'}
            </div>
          ) : leads.map(l => {
            const e = estadoColor[l.estado];
            const pre = preMap.get(l.id);
            return (
              <div key={l.id} className="row" onClick={() => onOpenLead && onOpenLead(l.id)} style={{ cursor: 'pointer' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: e.bg, color: e.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={fuenteIcon[l.fuente]} size={16} />
                </div>
                <div className="body">
                  <div className="t1">{l.nombre}</div>
                  {l.mensaje && l.mensaje.trim() && (
                    <div className="t2" style={{ fontStyle: 'italic' }}>"{l.mensaje}"</div>
                  )}
                  <PreBadge pre={pre} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="pill" style={{ background: e.bg, color: e.fg, border: 'none' }}>{e.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>{fmtTiempoRelativo(l.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 22px' }}>
        <button className="btn btn-ghost btn-block" onClick={() => onOpenLead && onOpenLead(null)}>
          <Icon name="plus" size={15} />
          Registrar lead manual
        </button>
      </div>

      <div style={{ height: 30 }} />
    </div>
  );
};

const FunnelStep = ({ n, label, tint }) => {
  const colors = {
    terracota: { bg: 'var(--terracota-tint)', fg: '#8A3D26' },
    gold: { bg: '#F2E2C2', fg: 'var(--gold)' },
    oliva: { bg: '#DDE0CC', fg: '#4D5230' },
  }[tint];
  return (
    <div className="card flat" style={{ flex: 1, padding: 14, background: colors.bg, borderColor: 'transparent', textAlign: 'center' }}>
      <div className="serif" style={{ fontSize: 28, color: colors.fg, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 10, color: colors.fg, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
};

window.MarketingScreen = MarketingScreen;
