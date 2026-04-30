import React from 'react';
import { useComprobantes } from './hooks/useComprobantes.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// ComprobantesScreen — overlay donde Sofía ve comprobantes subidos por
// clientes vía /comprobante. Puede ver el archivo, asociarlo a una
// estudiante y validar (lo cual registra el pago) o rechazar.
// ─────────────────────────────────────────────────────────────────────

const ComprobantesScreen = ({ store, onClose }) => {
  const { items, loading, obtenerUrl, validar, rechazar, eliminar } = useComprobantes();
  const [filter, setFilter] = useState('pendiente');
  const [active, setActive] = useState(null);  // comprobante seleccionado para validar

  const filtrados = items.filter(c => filter === 'todos' || c.estado === filter);
  const counts = {
    pendiente: items.filter(c => c.estado === 'pendiente').length,
    validado: items.filter(c => c.estado === 'validado').length,
    rechazado: items.filter(c => c.estado === 'rechazado').length,
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Volver
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">Banco · validar pagos</div>
          <h1>Comprobantes</h1>
        </div>

        <div style={{ padding: '0 22px 14px' }}>
          <div className="segmented">
            <button className={filter === 'pendiente' ? 'active' : ''} onClick={() => setFilter('pendiente')}>
              Pendientes · {counts.pendiente}
            </button>
            <button className={filter === 'validado' ? 'active' : ''} onClick={() => setFilter('validado')}>
              Validados · {counts.validado}
            </button>
            <button className={filter === 'rechazado' ? 'active' : ''} onClick={() => setFilter('rechazado')}>
              Rechazados · {counts.rechazado}
            </button>
            <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          </div>
        </div>

        <div style={{ padding: '0 22px' }}>
          {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>}
          {!loading && filtrados.length === 0 && (
            <div className="card flat" style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              No hay comprobantes en esta categoría.
            </div>
          )}
          {!loading && filtrados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrados.map(c => (
                <ComprobanteCard
                  key={c.id} c={c}
                  alumnas={store.state.alumnas}
                  obtenerUrl={obtenerUrl}
                  onValidar={() => setActive(c)}
                  onRechazar={async () => {
                    if (!confirm(`¿Rechazar el comprobante de ${c.nombre_cliente}?`)) return;
                    try { await rechazar(c.id, ''); } catch (e) { alert(e.message); }
                  }}
                  onEliminar={async () => {
                    const msg = `⚠ Eliminar comprobante de ${c.nombre_cliente}?\n\nEsto borra el archivo y el registro permanentemente.\n${c.estado === 'validado' ? '\nEste comprobante ESTÁ VALIDADO. Si tiene un pago asociado, debes borrarlo manualmente desde la ficha de la alumna ANTES de eliminar el comprobante para mantener consistencia.\n' : ''}\nEsta acción no se puede deshacer.`;
                    if (!confirm(msg)) return;
                    try { await eliminar(c.id); } catch (e) { alert(e.message); }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 30 }} />
      </div>

      {active && (
        <ValidarSheet
          comprobante={active}
          alumnas={store.state.alumnas}
          onClose={() => setActive(null)}
          onConfirm={async ({ alumna_id, monto, tipo, notas }) => {
            try {
              await validar(active.id, { alumna_id, monto, tipo, notas });
              setActive(null);
            } catch (e) { alert(e.message); }
          }}
        />
      )}
    </div>
  );
};

const ComprobanteCard = ({ c, obtenerUrl, onValidar, onRechazar, onEliminar }) => {
  const [url, setUrl] = useState(null);

  const verArchivo = async () => {
    if (url) { window.open(url, '_blank'); return; }
    const u = await obtenerUrl(c.storage_path);
    if (u) {
      setUrl(u);
      window.open(u, '_blank');
    }
  };

  const estadoColor = {
    pendiente: { bg: 'var(--terracota-tint)', fg: '#8A3D26', label: 'Pendiente' },
    validado: { bg: '#DDE0CC', fg: '#4D5230', label: 'Validado ✓' },
    rechazado: { bg: '#F0D5CE', fg: 'var(--rojo)', label: 'Rechazado' },
  }[c.estado] || { bg: 'var(--bg-warm)', fg: 'var(--ink-mute)', label: c.estado };

  return (
    <div className="card flat" style={{ padding: 14, position: 'relative' }}>
      {/* TEMP-PRE-PROD-DELETE: botón eliminar comprobante. Quitar antes
          de producción real con alumnas reales (registrar antes en pagos). */}
      {onEliminar && (
        <button
          onClick={onEliminar}
          aria-label="Eliminar comprobante"
          title="Eliminar comprobante (TEMPORAL pre-prod)"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 24, height: 24, borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-mute)', fontSize: 16, lineHeight: 1,
            opacity: 0.5,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--rojo)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--ink-mute)'; }}
        >×</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingRight: 22 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.nombre_cliente}</div>
          {c.contacto && (
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{c.contacto}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
            {c.monto ? <>${c.monto} · </> : null}
            {c.fecha_pago ? <>Pagó {new Date(c.fecha_pago + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} · </> : null}
            Subido {new Date(c.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          {c.notas && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic' }}>"{c.notas}"</div>
          )}
        </div>
        <span className="pill" style={{ background: estadoColor.bg, color: estadoColor.fg, border: 'none' }}>{estadoColor.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={verArchivo} style={{
          flex: 1, padding: '9px 12px', borderRadius: 10,
          background: 'var(--surface)', border: '1px solid var(--line-soft)',
          fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="search" size={13} />
          Ver archivo
        </button>
        {c.estado === 'pendiente' && (
          <>
            <button onClick={onRechazar} style={{
              padding: '9px 12px', borderRadius: 10,
              background: 'transparent', color: 'var(--rojo)',
              border: '1px solid #E5C8C0', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
            }}>Rechazar</button>
            <button onClick={onValidar} style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: 'var(--oliva)', color: '#fff',
              border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>Validar</button>
          </>
        )}
      </div>
    </div>
  );
};

const ValidarSheet = ({ comprobante, alumnas, onClose, onConfirm }) => {
  const [alumnaId, setAlumnaId] = useState('');
  const [monto, setMonto] = useState(comprobante.monto || '');
  const [tipo, setTipo] = useState('parcial');
  const [notas, setNotas] = useState('');

  const ok = !!alumnaId && Number(monto) > 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', background: 'var(--bg)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '20px 22px 32px', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--line-soft)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div className="serif" style={{ fontSize: 22, marginBottom: 14, color: 'var(--ink)' }}>
          Validar pago de <em style={{ color: 'var(--terracota)' }}>{comprobante.nombre_cliente}</em>
        </div>
        <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          Asocia este comprobante a una estudiante inscrita y registra el pago. El monto se sumará a su total pagado.
        </div>

        <Field label="Estudiante" required>
          <select value={alumnaId} onChange={e => setAlumnaId(Number(e.target.value))} style={inputStyle}>
            <option value="">— Selecciona —</option>
            {alumnas.map(a => (
              <option key={a.id} value={a.id}>{a.nombre} · ${a.pagado}/${a.total}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Field label="Monto USD" style={{ flex: 1 }} required>
            <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={inputStyle} placeholder="200" />
          </Field>
          <Field label="Tipo" style={{ flex: 1 }}>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
              <option value="reserva">Reserva</option>
              <option value="parcial">Parcial</option>
              <option value="pronto-pago">Pronto pago</option>
              <option value="saldo">Saldo</option>
            </select>
          </Field>
        </div>

        <Field label="Notas (opcional)" style={{ marginTop: 12 }}>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Confirmación del banco, nº de transferencia…" />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 16px', borderRadius: 999,
            background: 'transparent', border: '1px solid var(--line-soft)',
            fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={() => onConfirm({ alumna_id: alumnaId, monto: Number(monto), tipo, notas })}
            disabled={!ok}
            style={{
              flex: 2, padding: '12px 16px', borderRadius: 999,
              background: 'var(--oliva)', color: '#fff', border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: ok ? 'pointer' : 'not-allowed',
              opacity: ok ? 1 : 0.5,
            }}>
            Validar y registrar pago
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, required, children, style }) => (
  <div style={style}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--terracota)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1px solid var(--line-soft)', borderRadius: 12,
  fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
};

window.ComprobantesScreen = ComprobantesScreen;
export { ComprobantesScreen };
