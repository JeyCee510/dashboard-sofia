import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Pagos screen
// ──────────────────────────────────────────

const PagosScreen = ({ tweaks, store, onOpenAlumna, onNewPago, onNavigate }) => {
  const [filter, setFilter] = React.useState('pendientes');
  // Sub-vista: 'cobros' | 'comprobantes'. Auto-arranca en comprobantes
  // cuando hay pendientes (más útil para Sofía); persiste mientras la
  // pantalla esté montada.
  const pendientes = store?.state?.comprobantesPendientes || 0;
  const [subview, setSubview] = React.useState(null);
  // Setear el valor inicial UNA VEZ cuando el realtime de pendientes haya
  // cargado (puede llegar después del primer render). useState() inicial
  // no se re-evalúa, por eso el useEffect.
  React.useEffect(() => {
    if (subview === null) {
      setSubview(pendientes > 0 ? 'comprobantes' : 'cobros');
    }
  }, [pendientes, subview]);
  // Evitar flash mientras determina vista inicial
  if (subview === null) return null;

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="eyebrow">Junio · USD</div>
            <h1>Pagos</h1>
          </div>
        </div>
      </div>

      {/* Segmented Cobros / Comprobantes */}
      <div style={{ padding: '6px 22px 14px' }}>
        <div className="segmented">
          <button
            className={subview === 'cobros' ? 'active' : ''}
            onClick={() => setSubview('cobros')}
          >
            Cobros
          </button>
          <button
            className={subview === 'comprobantes' ? 'active' : ''}
            onClick={() => setSubview('comprobantes')}
            style={{ position: 'relative' }}
          >
            Comprobantes
            {pendientes > 0 && (
              <span style={{
                marginLeft: 6, padding: '1px 6px', borderRadius: 999,
                background: 'var(--terracota)', color: '#fff',
                fontSize: 10, fontWeight: 700, minWidth: 16, display: 'inline-block',
              }}>
                {pendientes > 9 ? '9+' : pendientes}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Render condicional de la sub-vista */}
      {subview === 'comprobantes' && store ? (
        <ComprobantesScreen store={store} asTab={true} hideHeader={true} />
      ) : (
        <CobrosView
          tweaks={tweaks}
          totalCobrado={totalCobrado}
          totalEsperado={totalEsperado}
          totalPendiente={totalPendiente}
          alumnas={alumnas}
          filter={filter}
          setFilter={setFilter}
          onOpenAlumna={onOpenAlumna}
          onNewPago={onNewPago}
        />
      )}
    </div>
  );
};

// Vista "Cobros" (lo que era todo antes): KPIs + listado de alumnas con saldo
const CobrosView = ({ tweaks, totalCobrado, totalEsperado, totalPendiente, alumnas, filter, setFilter, onOpenAlumna, onNewPago }) => {
  return (
    <div>

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
          <button className={filter === 'pagadas' ? 'active' : ''} onClick={() => setFilter('pagadas')}>Pagados</button>
          <button className={filter === 'todas' ? 'active' : ''} onClick={() => setFilter('todas')}>Todos</button>
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
window.CobrosView = CobrosView;
