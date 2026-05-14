import React from 'react';
import { useDesglosePagos } from './hooks/useDesglosePagos.js';
import { estadoPago, esProntoPagoProducto } from './lib/precios.js';
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
  // "Pendiente" = cualquiera que debe plata (incluye pronto-pago a medio pagar).
  // "Pagadas" = pagado >= total. "Reservas" se queda igual.
  if (filter === 'pendientes') alumnas = alumnas.filter(a => (Number(a.total) || 0) > (Number(a.pagado) || 0));
  if (filter === 'pagadas') alumnas = alumnas.filter(a => (Number(a.total) || 0) > 0 && (Number(a.pagado) || 0) >= (Number(a.total) || 0));
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
  const { desglose } = useDesglosePagos();
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
            {MOCK_ALUMNAS.filter(a => esProntoPagoProducto(a, tweaks.precioProntoPago)).length}
          </div>
        </div>
      </div>

      {/* Desglose por forma de pago */}
      {desglose.count > 0 && (
        <div style={{ padding: '14px 22px 0' }}>
          <div className="card flat" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 500 }}>
                Cobrado por forma
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                {desglose.count} {desglose.count === 1 ? 'pago' : 'pagos'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'transferencia', label: 'Transferencia', color: 'var(--ink)' },
                { key: 'efectivo', label: 'Efectivo', color: 'var(--oliva)' },
                { key: 'payphone', label: 'Payphone', color: 'var(--terracota)' },
                { key: 'canje', label: 'Canje', color: 'var(--gold)' },
              ].map(f => {
                const monto = desglose[f.key] || 0;
                const pct = desglose.total > 0 ? (monto / desglose.total) * 100 : 0;
                if (monto === 0 && pct === 0) return (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, color: 'var(--ink-mute)', opacity: 0.5 }}>
                    <span>{f.label}</span>
                    <span>—</span>
                  </div>
                );
                return (
                  <div key={f.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{f.label}</span>
                      <span style={{ color: f.color, fontWeight: 500 }}>
                        ${Math.round(monto).toLocaleString('en-US')}
                        <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 6, fontWeight: 400 }}>
                          {Math.round(pct)}%
                        </span>
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-warm)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: f.color, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                    Pagó ${a.pagado} · {
                      esProntoPagoProducto(a, tweaks.precioProntoPago)
                        ? 'pronto pago'
                        : estadoPago(a) === 'completo' ? 'completo'
                        : estadoPago(a) === 'parcial' ? 'pago parcial'
                        : 'pendiente'
                    }
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
