import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Nueva Asistencia — estructura por alumna con sus 6 días
// ──────────────────────────────────────────

const AsistenciaV2 = ({ store, onClose }) => {
  const { state, toggleAsistencia, marcarTodosDia } = store;
  const [search, setSearch] = React.useState('');
  const dias = state.ajustes.diasFormacion;

  const alumnas = state.alumnas.filter(a =>
    !search || a.nombre.toLowerCase().includes(search.toLowerCase())
  );

  // count attended days per alumna
  const countDias = (id) => {
    let n = 0;
    Object.values(state.asistencia).forEach(d => { if (d[id] === true) n++; });
    return n;
  };

  // Día de hoy = primero hoy
  const hoyIdx = 0;

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Inicio
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => marcarTodosDia(hoyIdx)} style={{
          background: 'var(--bg-warm)', border: 'none',
          padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)',
        }}>Marcar día 1</button>
      </div>
      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header" style={{ paddingTop: 6 }}>
          <div className="eyebrow">Programa · 6 días</div>
          <h1>Asistencia</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
            Toca un día para marcar presente. Toca de nuevo para borrar.
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 22px 0' }}>
          <div className="search">
            <Icon name="search" size={15} stroke="var(--ink-mute)" />
            <input placeholder="Buscar estudiante…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Lista de alumnas con sus 6 días */}
        <div style={{ padding: '14px 22px 90px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alumnas.map(a => {
            const total = countDias(a.id);
            return (
              <div key={a.id} className="card flat" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <div className="avatar" style={{ background: a.avatar, width: 26, height: 26, fontSize: 11 }}>
                      {a.iniciales}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>
                      {a.nombre}
                    </div>
                  </div>
                  <div className="serif" style={{ fontSize: 14, color: total > 0 ? 'var(--oliva)' : 'var(--ink-mute)', flexShrink: 0, marginLeft: 8 }}>
                    {total}<span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>/{dias.length}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {dias.map(d => {
                    const status = state.asistencia[d.idx]?.[a.id];
                    const present = status === true;
                    const absent = status === false;
                    return (
                      <button
                        key={d.idx}
                        onClick={() => toggleAsistencia(d.idx, a.id)}
                        style={{
                          flex: 1,
                          aspectRatio: '1 / 1.05',
                          minHeight: 0,
                          border: 'none',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          background: present ? 'var(--ink)' : absent ? 'var(--terracota-tint)' : 'var(--bg-warm)',
                          color: present ? 'var(--bg)' : absent ? '#8A3D26' : 'var(--ink-mute)',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.18s, color 0.18s',
                          padding: '6px 2px',
                          gap: 1,
                        }}
                      >
                        <span className="serif" style={{ fontSize: 14, lineHeight: 1, fontWeight: 500 }}>
                          {d.fecha.split(' ')[0]}
                        </span>
                        <span style={{ fontSize: 9, letterSpacing: '0.06em', opacity: 0.7 }}>
                          {d.fecha.split(' ')[1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {alumnas.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              Sin estudiantes registrados. Ve a Inscritos para agregar el primero.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.AsistenciaV2 = AsistenciaV2;
