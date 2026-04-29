import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// CRM / WhatsApp screen
// ──────────────────────────────────────────

const CRMScreen = ({ plantillas = [], mensajes }) => {
  const [filter, setFilter] = React.useState('todos');
  const [copiada, setCopiada] = React.useState(null);
  const fuente = mensajes || MENSAJES_RECIENTES || [];
  let msgs = fuente;
  if (filter === 'sinleer') msgs = msgs.filter(m => m.sinLeer);
  if (filter === 'leads') msgs = msgs.filter(m => m.esLead);

  const conversaciones = msgs;

  const copiarPlantilla = async (p) => {
    try {
      await navigator.clipboard.writeText(p.cuerpo);
      setCopiada(p.id);
      setTimeout(() => setCopiada(null), 1800);
    } catch (e) {
      // Fallback para mobile sin permiso
      const ta = document.createElement('textarea');
      ta.value = p.cuerpo;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiada(p.id);
      setTimeout(() => setCopiada(null), 1800);
    }
  };

  const sinLeer = MENSAJES_RECIENTES.filter(m => m.sinLeer).length;

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">Mensajería · {sinLeer} sin leer</div>
        <h1>Conversaciones</h1>
      </div>

      {/* Plantillas rápidas */}
      <div className="section-title">
        <h2>Respuestas rápidas</h2>
      </div>
      <div style={{ padding: '0 22px 4px', fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Toca una plantilla para copiarla y pégala donde quieras
      </div>
      <div style={{ padding: '8px 22px', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {plantillas.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '10px 0' }}>
            Aún no tienes plantillas. Edítalas en Ajustes.
          </div>
        ) : plantillas.map(p => (
          <button
            key={p.id}
            onClick={() => copiarPlantilla(p)}
            className="card flat"
            style={{
              flexShrink: 0, padding: '10px 14px', display: 'flex', gap: 8,
              alignItems: 'center', fontFamily: 'inherit', fontSize: 12,
              fontWeight: 500, color: 'var(--ink)', cursor: 'pointer',
              background: copiada === p.id ? 'var(--oliva)' : 'var(--surface)',
              borderColor: copiada === p.id ? 'transparent' : 'var(--line-soft)',
              transition: 'background 0.18s',
            }}
          >
            <Icon name={copiada === p.id ? 'check' : 'note'} size={14} stroke={copiada === p.id ? '#fff' : 'var(--terracota)'} />
            <span style={{ color: copiada === p.id ? '#fff' : 'var(--ink)' }}>
              {copiada === p.id ? 'Copiada ✓' : p.titulo}
            </span>
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 22px 10px' }}>
        <div className="segmented">
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          <button className={filter === 'sinleer' ? 'active' : ''} onClick={() => setFilter('sinleer')}>Sin leer</button>
          <button className={filter === 'leads' ? 'active' : ''} onClick={() => setFilter('leads')}>Leads</button>
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        {conversaciones.length === 0 ? (
          <div className="card flat" style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, lineHeight: 1.5 }}>
            Aún no hay conversaciones registradas.<br/>
            Cuando llegue un mensaje por WhatsApp o Instagram, aparecerá aquí.
          </div>
        ) : (
          <div className="card flat" style={{ padding: '4px 16px' }}>
            {conversaciones.map(m => (
              <div key={m.id} className="row" style={{ cursor: 'pointer' }}>
                <div className="avatar" style={{ background: m.esLead ? 'var(--terracota-soft)' : 'oklch(0.74 0.06 45)' }}>
                  {m.alumna.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div className="body">
                  <div className="t1" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.alumna}
                    <Icon name="whatsapp" size={11} stroke="var(--whatsapp)" />
                    {m.esLead && <span style={{ fontSize: 10, color: 'var(--terracota)', fontWeight: 500 }}>· lead</span>}
                  </div>
                  <div className="t2">{m.preview}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{m.tiempo}</span>
                  {m.sinLeer && <span className="dot" style={{ background: 'var(--terracota)' }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px' }}>
        <button className="btn btn-secondary btn-block">
          <Icon name="bullhorn" size={14} />
          Difusión a inscritos
        </button>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
};

window.CRMScreen = CRMScreen;
