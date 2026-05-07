import React from 'react';
import { useClasesAbiertas, useInscripcionesClase } from './hooks/useClasesAbiertas.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// ClaseInscripcionesScreen — admin de inscripciones a una clase abierta.
// Muestra cupos disponibles, lista de inscritos, botón copiar link.
// ─────────────────────────────────────────────────────────────────────

const ClaseInscripcionesScreen = ({ onClose }) => {
  const { activa, loading: loadingClase } = useClasesAbiertas();
  const { items, loading: loadingInsc, eliminar } = useInscripcionesClase(activa?.id);
  const [copiado, setCopiado] = useState(false);
  const [busy, setBusy] = useState(null);

  const link = activa ? `${window.location.origin}/clase/${activa.slug}` : '';
  const cuposDisponibles = activa ? Math.max(0, activa.cupos_max - items.length) : 0;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };

  const onEliminar = async (item) => {
    if (!confirm(`¿Sacar a ${item.nombre} de la lista? Su cupo queda libre para otra persona.`)) return;
    setBusy(item.id);
    try { await eliminar(item.id); } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Atrás
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">Evento</div>
          <h1>Clase abierta</h1>
        </div>

        {(loadingClase || !activa) ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            {loadingClase ? 'Cargando…' : 'No hay clase activa.'}
          </div>
        ) : (
          <>
            {/* Datos de la clase */}
            <div style={{ padding: '0 22px 14px' }}>
              <div className="card flat" style={{ padding: 16 }}>
                <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.2 }}>
                  {activa.titulo}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  📅 {fmtFecha(activa.fecha)}<br/>
                  🕗 {activa.hora_inicio?.slice(0,5)}–{activa.hora_fin?.slice(0,5)}<br/>
                  📍 {activa.ubicacion}
                </div>
              </div>
            </div>

            {/* Cupos */}
            <div style={{ padding: '0 22px 14px', display: 'flex', gap: 10 }}>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
                <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', lineHeight: 1 }}>
                  {items.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Inscritos
                </div>
              </div>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center', background: cuposDisponibles === 0 ? '#F0D5CE' : 'var(--terracota-tint)', borderColor: 'transparent' }}>
                <div className="serif" style={{ fontSize: 28, color: cuposDisponibles === 0 ? 'var(--rojo)' : '#8A3D26', lineHeight: 1 }}>
                  {cuposDisponibles}
                </div>
                <div style={{ fontSize: 10, color: cuposDisponibles === 0 ? 'var(--rojo)' : '#8A3D26', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Cupos libres
                </div>
              </div>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
                <div className="serif" style={{ fontSize: 28, color: 'var(--ink-mute)', lineHeight: 1 }}>
                  {activa.cupos_max}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Cupos máx
                </div>
              </div>
            </div>

            {/* Link compartible */}
            <div style={{ padding: '0 22px 14px' }}>
              <div className="card flat" style={{ padding: 14, background: '#F2E2C2', borderColor: 'transparent' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: 8 }}>
                  Link público de la clase
                </div>
                <div style={{
                  background: 'var(--surface)', padding: '8px 12px', borderRadius: 8,
                  fontSize: 11, fontFamily: 'monospace', color: 'var(--ink)', wordBreak: 'break-all',
                }}>{link}</div>
                <button
                  type="button" onClick={copiar}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px 12px', borderRadius: 10,
                    background: copiado ? 'var(--oliva)' : 'var(--surface)',
                    color: copiado ? '#fff' : 'var(--ink)',
                    border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
              </div>
            </div>

            {/* Lista de inscritos */}
            <div className="section-title">
              <h2>Inscritos · {items.length}</h2>
            </div>
            <div style={{ padding: '0 22px 24px' }}>
              {loadingInsc ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
              ) : items.length === 0 ? (
                <div className="card flat" style={{ padding: 22, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
                  Aún nadie se ha inscrito.
                </div>
              ) : (
                <div className="card flat" style={{ padding: '4px 16px' }}>
                  {items.map(item => (
                    <div key={item.id} className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="body">
                        <div className="t1">{item.nombre}</div>
                        <div className="t2">{item.email}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>
                          {new Date(item.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={() => onEliminar(item)}
                        disabled={busy === item.id}
                        title="Sacar de la lista"
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--ink-mute)', padding: 4, fontSize: 16, opacity: 0.5,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

function fmtFecha(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

window.ClaseInscripcionesScreen = ClaseInscripcionesScreen;
export { ClaseInscripcionesScreen };
