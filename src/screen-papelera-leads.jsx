import React from 'react';
import { useArchive } from './hooks/useArchive.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// PapeleraLeadsScreen — overlay con leads Y alumnas borradas en una
// sola lista. Cada fila muestra badge "lead" o "estudiante". Al
// restaurar, ambos casos terminan como leads en el embudo.
// ─────────────────────────────────────────────────────────────────────

const PapeleraLeadsScreen = ({ onClose }) => {
  const { items, loading, restaurar, purgar } = useArchive();
  const [busy, setBusy] = useState(null);

  const onRestaurar = async (item) => {
    setBusy(item._kind + ':' + item.id);
    try { await restaurar(item); } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  const onPurgar = async (item) => {
    if (!confirm(`¿Borrar definitivamente a "${item.nombre}" del archivo? No se puede recuperar.`)) return;
    setBusy(item._kind + ':' + item.id);
    try { await purgar(item); } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
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
          <div className="eyebrow">Papelera</div>
          <h1>Borrados</h1>
        </div>

        <div style={{ padding: '0 22px 8px', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.45 }}>
          Aquí quedan leads y estudiantes borrados (manualmente, por voz, o al convertirse). Al restaurar, vuelven al embudo como lead.
        </div>

        <div style={{ padding: '14px 22px' }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="card flat" style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              La papelera está vacía.
            </div>
          )}
          {!loading && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => {
                const key = item._kind + ':' + item.id;
                const esAlumna = item._kind === 'alumna';
                return (
                  <div key={key} className="card flat" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.nombre}</span>
                          <span style={{
                            fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
                            padding: '2px 7px', borderRadius: 999,
                            background: esAlumna ? '#DDE0CC' : 'var(--terracota-tint)',
                            color: esAlumna ? '#4D5230' : '#8A3D26',
                          }}>
                            {esAlumna ? 'Estudiante' : 'Lead'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                          {item.tel || item.instagram || 'sin contacto'}
                          {!esAlumna && item.fuente ? ` · ${item.fuente}` : ''}
                          {!esAlumna && item.estado ? ` · ${item.estado}` : ''}
                          {esAlumna && item.pagado != null ? ` · pagó $${item.pagado}/${item.total || 0}` : ''}
                        </div>
                        {item.mensaje && (
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic',
                            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            "{item.mensaje}"
                          </div>
                        )}
                        {esAlumna && item.notas && (
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic',
                            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            Notas: {item.notas}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-mute)', flexShrink: 0, textAlign: 'right' }}>
                        Borrado<br/>
                        {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => onRestaurar(item)}
                        disabled={busy === key}
                        style={{
                          flex: 1, padding: '9px 12px', borderRadius: 10,
                          background: 'var(--oliva)', color: '#fff',
                          border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', opacity: busy === key ? 0.5 : 1,
                        }}
                      >
                        {busy === key ? '…' : esAlumna ? 'Restaurar como lead' : 'Restaurar al embudo'}
                      </button>
                      <button
                        onClick={() => onPurgar(item)}
                        disabled={busy === key}
                        style={{
                          padding: '9px 12px', borderRadius: 10,
                          background: 'transparent', color: 'var(--rojo)',
                          border: '1px solid #E5C8C0', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', opacity: busy === key ? 0.5 : 1,
                        }}
                      >
                        Purgar
                      </button>
                    </div>
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

window.PapeleraLeadsScreen = PapeleraLeadsScreen;
export { PapeleraLeadsScreen };
