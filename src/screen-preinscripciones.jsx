import React from 'react';
import { usePreinscripciones } from './hooks/usePreinscripciones.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// PreinscripcionesScreen — overlay accesible desde Leads. Muestra
// TODAS las preinscripciones (de leads y alumnas) con filtro y búsqueda.
// Click en una abre la ficha (lead o alumna según corresponda).
// ─────────────────────────────────────────────────────────────────────

const PREGUNTAS_LABELS = {
  edad: 'Edad',
  ciudad: 'Zona / barrio',
  practica_yoga: '¿Practica yoga?',
  tiempo_practica: 'Hace cuánto practica',
  estilos: 'Estilos',
  formaciones: 'Formaciones previas',
  'enseñado_antes': '¿Ha enseñado antes?',
  donde_ensena: 'Dónde da clases',
  motivacion: 'Motivación',
  lesiones: 'Lesiones',
  alergias: 'Alergias',
  contacto_emergencia: 'Contacto emergencia',
  expectativas: 'Expectativas',
  algo_mas: 'Algo más',
};

const PreinscripcionesScreen = ({ onClose, onOpenLead, onOpenAlumna }) => {
  const { items, loading } = usePreinscripciones();
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const counts = {
    completadas: items.filter(i => i.estado === 'completada').length,
    pendientes: items.filter(i => i.estado === 'pendiente').length,
  };

  let filtradas = items;
  if (filter === 'completadas') filtradas = filtradas.filter(i => i.estado === 'completada');
  if (filter === 'pendientes') filtradas = filtradas.filter(i => i.estado === 'pendiente');
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtradas = filtradas.filter(i => (i.nombre || '').toLowerCase().includes(q));
  }

  const abrir = (item) => {
    if (item.kind === 'alumna' && onOpenAlumna) onOpenAlumna(item.ref_id);
    else if (item.kind === 'lead' && onOpenLead) onOpenLead(item.ref_id);
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Leads
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">Formularios</div>
          <h1>Preinscripciones</h1>
        </div>

        <div style={{ padding: '0 22px 14px', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.45 }}>
          Todos los formularios de preinscripción enviados (a leads e inscritos). Toca uno para ver respuestas o ir a su ficha.
        </div>

        {/* Segmented filter */}
        <div style={{ padding: '0 22px 10px' }}>
          <div className="segmented">
            <button className={filter === 'todas' ? 'active' : ''} onClick={() => setFilter('todas')}>
              Todas · {items.length}
            </button>
            <button className={filter === 'completadas' ? 'active' : ''} onClick={() => setFilter('completadas')}>
              Completadas · {counts.completadas}
            </button>
            <button className={filter === 'pendientes' ? 'active' : ''} onClick={() => setFilter('pendientes')}>
              Pendientes · {counts.pendientes}
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div style={{ padding: '0 22px 10px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
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

        <div style={{ padding: '4px 22px 24px' }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && filtradas.length === 0 && (
            <div className="card flat" style={{ padding: 26, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              {search ? `Sin resultados para "${search}".` : 'No hay preinscripciones en esta categoría.'}
            </div>
          )}
          {!loading && filtradas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtradas.map(item => {
                const completada = item.estado === 'completada';
                const isExpanded = expandedId === item.id;
                const data = item.data || {};
                const respuestasCount = Object.entries(PREGUNTAS_LABELS).filter(([k]) => data[k]).length;
                const bg = completada ? '#DDE0CC' : 'var(--terracota-tint)';
                const fg = completada ? '#4D5230' : '#8A3D26';
                return (
                  <div key={item.id} className="card flat" style={{ padding: 0, background: bg, borderColor: 'transparent', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.nombre}</span>
                            {item.kind !== 'huerfana' && (
                              <span style={{
                                fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
                                padding: '2px 6px', borderRadius: 999,
                                background: item.kind === 'alumna' ? 'rgba(77,82,48,0.15)' : 'rgba(138,61,38,0.15)',
                                color: item.kind === 'alumna' ? '#4D5230' : '#8A3D26',
                              }}>{item.kind === 'alumna' ? 'Estudiante' : 'Lead'}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: fg, fontWeight: 500 }}>
                            {completada ? `✓ ${respuestasCount} respuestas` : '⏳ Pendiente de respuesta'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: fg }}>
                            {completada
                              ? (item.completed_at ? new Date(item.completed_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : '')
                              : (item.created_at ? new Date(item.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : '')}
                          </div>
                          <span style={{ fontSize: 11, color: fg, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            ▾
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '0 16px 14px' }}>
                        {completada ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            {Object.entries(PREGUNTAS_LABELS).map(([k, label]) => {
                              const v = data[k];
                              if (!v) return null;
                              return (
                                <div key={k} style={{ paddingTop: 8, borderTop: '1px solid rgba(77,82,48,0.15)' }}>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: fg, fontWeight: 500 }}>{label}</div>
                                  <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{v}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: fg, fontStyle: 'italic', paddingTop: 8, borderTop: '1px solid rgba(138,61,38,0.15)' }}>
                            Esta persona aún no ha respondido el formulario.
                          </div>
                        )}
                        {item.kind !== 'huerfana' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrir(item); }}
                            style={{
                              marginTop: 12, padding: '8px 14px', borderRadius: 999,
                              background: 'var(--surface)', border: '1px solid var(--line-soft)',
                              fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)',
                              cursor: 'pointer', fontWeight: 500,
                            }}
                          >
                            Ir a ficha de {item.kind === 'alumna' ? 'estudiante' : 'lead'} →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

window.PreinscripcionesScreen = PreinscripcionesScreen;
export { PreinscripcionesScreen };
