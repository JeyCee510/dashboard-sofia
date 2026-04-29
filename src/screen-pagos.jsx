import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Pagos screen
// ──────────────────────────────────────────

const PagosScreen = ({ tweaks, onOpenAlumna, onNewPago }) => {
  const [filter, setFilter] = React.useState('pendientes');

  const totalCobrado = MOCK_ALUMNAS.reduce((s, a) => s + a.pagado, 0);
  const totalEsperado = MOCK_ALUMNAS.reduce((s, a) => s + a.total, 0);
  const totalPendiente = totalEsperado - totalCobrado;

  let alumnas = MOCK_ALUMNAS;
  if (filter === 'pendientes') alumnas = alumnas.filter(a => a.pago === 'pendiente' || a.pago === 'parcial');
  if (filter === 'pagadas') alumnas = alumnas.filter(a => a.pago === 'pronto-pago' || a.pago === 'completo');
  if (filter === 'reservas') alumnas = alumnas.filter(a => a.pagado === 200);

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">Junio · USD</div>
        <h1>Pagos</h1>
      </div>

      {/* Total card */}
      <div style={{ padding: '0 22px' }}>
        <div className="hero" style={{ padding: 22, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
            Cobrado este ciclo
          </div>
          <div className="serif" style={{ fontSize: 44, fontWeight: 400, marginTop: 6, lineHeight: 1 }}>
            ${totalCobrado.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            de ${totalEsperado.toLocaleString()} esperados · {Math.round((totalCobrado / totalEsperado) * 100)}%
          </div>
          <div style={{
            height: 4, background: 'rgba(251,247,240,0.18)', borderRadius: 999,
            marginTop: 14, overflow: 'hidden',
          }}>
            <div style={{ height: '100%', width: `${(totalCobrado / totalEsperado) * 100}%`, background: 'var(--terracota-soft)' }} />
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ padding: '14px 22px 0', display: 'flex', gap: 10 }}>
        <div className="card flat" style={{ flex: 1, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Por cobrar</div>
          <div className="serif" style={{ fontSize: 24, color: 'var(--rojo)', marginTop: 4 }}>${totalPendiente.toLocaleString()}</div>
        </div>
        <div className="card flat" style={{ flex: 1, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pronto pago</div>
          <div className="serif" style={{ fontSize: 24, color: 'var(--oliva)', marginTop: 4 }}>
            {MOCK_ALUMNAS.filter(a => a.pago === 'pronto-pago').length}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <div className="segmented">
          <button className={filter === 'pendientes' ? 'active' : ''} onClick={() => setFilter('pendientes')}>Pendientes</button>
          <button className={filter === 'pagadas' ? 'active' : ''} onClick={() => setFilter('pagadas')}>Pagadas</button>
          <button className={filter === 'todas' ? 'active' : ''} onClick={() => setFilter('todas')}>Todas</button>
        </div>
      </div>

      <div style={{ padding: '14px 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {alumnas.map(a => {
            const restante = a.total - a.pagado;
            return (
              <div key={a.id} className="row" onClick={() => onOpenAlumna(a.id)} style={{ cursor: 'pointer' }}>
                <div className="avatar" style={{ background: a.avatar }}>{a.iniciales}</div>
                <div className="body">
                  <div className="t1">{a.nombre}</div>
                  <div className="t2">
                    Pagó ${a.pagado} · {a.pago === 'pronto-pago' ? 'pronto pago' : a.pago === 'pendiente' ? 'solo reserva' : a.pago === 'parcial' ? 'pago parcial' : 'completo'}
                  </div>
                </div>
                {restante > 0 ? (
                  <div style={{ textAlign: 'right' }}>
                    <div className="serif" style={{ fontSize: 16, color: 'var(--rojo)' }}>${restante}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>falta</div>
                  </div>
                ) : (
                  <span className="pill oliva">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <button className="btn btn-primary btn-block" onClick={onNewPago}>
          <Icon name="plus" size={16} />
          Registrar pago manual
        </button>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
};

window.PagosScreen = PagosScreen;
