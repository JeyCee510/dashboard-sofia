import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

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

const MarketingScreen = ({ onOpenLead, onNavigate }) => {
  const [filter, setFilter] = React.useState('todos');
  let leads = MOCK_LEADS;
  if (filter !== 'todos') leads = leads.filter(l => l.estado === filter);

  const counts = {
    nuevo: MOCK_LEADS.filter(l => l.estado === 'nuevo').length,
    interesado: MOCK_LEADS.filter(l => l.estado === 'interesado').length,
    reservado: MOCK_LEADS.filter(l => l.estado === 'reservado').length,
  };

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

      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {leads.map(l => {
            const e = estadoColor[l.estado];
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
                  <div className="t2" style={{ fontStyle: 'italic' }}>"{l.mensaje}"</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="pill" style={{ background: e.bg, color: e.fg, border: 'none' }}>{e.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>{l.tiempo}</span>
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
