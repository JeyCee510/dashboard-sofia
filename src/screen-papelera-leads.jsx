import React from 'react';
import { useLeadsArchive } from './hooks/useLeadsArchive.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// PapeleraLeadsScreen — overlay con leads borrados. Permite restaurar
// (vuelven al embudo) o purgar definitivamente.
// ─────────────────────────────────────────────────────────────────────

const PapeleraLeadsScreen = ({ onClose }) => {
  const { items, loading, restaurar, purgarDefinitivo } = useLeadsArchive();
  const [busy, setBusy] = useState(null);

  const onRestaurar = async (id) => {
    setBusy(id);
    try { await restaurar(id); } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  const onPurgar = async (id, nombre) => {
    if (!confirm(`¿Borrar definitivamente a "${nombre}" del archivo? No se puede recuperar.`)) return;
    setBusy(id);
    try { await purgarDefinitivo(id); } catch (e) { alert('Error: ' + e.message); }
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
          <h1>Leads borrados</h1>
        </div>

        <div style={{ padding: '0 22px 8px', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.45 }}>
          Aquí quedan los leads que se borraron (manualmente, por voz, o al convertirse en estudiantes). Puedes restaurarlos al embudo o eliminarlos definitivamente.
        </div>

        <div style={{ padding: '14px 22px' }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="card flat" style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              No hay leads borrados.
            </div>
          )}
          {!loading && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(l => (
                <div key={l.id} className="card flat" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{l.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                        {l.tel || l.instagram || 'sin contacto'} · {l.fuente || 'otro'} · {l.estado || 'nuevo'}
                      </div>
                      {l.mensaje && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          "{l.mensaje}"
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', flexShrink: 0 }}>
                      Borrado<br/>
                      {l.deleted_at ? new Date(l.deleted_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onRestaurar(l.id)}
                      disabled={busy === l.id}
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: 10,
                        background: 'var(--oliva)', color: '#fff',
                        border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', opacity: busy === l.id ? 0.5 : 1,
                      }}
                    >
                      {busy === l.id ? '…' : 'Restaurar al embudo'}
                    </button>
                    <button
                      onClick={() => onPurgar(l.id, l.nombre)}
                      disabled={busy === l.id}
                      style={{
                        padding: '9px 12px', borderRadius: 10,
                        background: 'transparent', color: 'var(--rojo)',
                        border: '1px solid #E5C8C0', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', opacity: busy === l.id ? 0.5 : 1,
                      }}
                    >
                      Purgar
                    </button>
                  </div>
                </div>
              ))}
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
