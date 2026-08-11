import React from 'react';
import { estadoPago, esProntoPagoProducto } from './lib/precios.js';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Reservas / Inscritos screen
// ──────────────────────────────────────────

const ReservasScreen = ({ tweaks, onNavigate, onOpenAlumna }) => {
  const [filter, setFilter] = React.useState('todas');
  const [search, setSearch] = React.useState('');

  let alumnas = MOCK_ALUMNAS;
  if (filter === 'pendientes') alumnas = alumnas.filter(a => (Number(a.total) || 0) > (Number(a.pagado) || 0));
  if (filter === 'silla') alumnas = alumnas.filter(a => a.bonoSilla);
  if (search) alumnas = alumnas.filter(a => a.nombre.toLowerCase().includes(search.toLowerCase()));

  const total = MOCK_ALUMNAS.length;
  const cupos = tweaks.capacidad - total;
  const sillas = MOCK_ALUMNAS.filter(a => a.bonoSilla).length;
  // El bono silla es exclusivo de la formación: si el proyecto tiene 0 cupos
  // de silla (taller, seminario), la tarjeta no se muestra.
  const sillasMax = Number(tweaks.bonoSillaCupos ?? 6);
  const usaSilla = sillasMax > 0;
  // Proyectos con sedes (Seminario): los cupos son POR SEDE, no un total.
  const sedesCfg = Array.isArray(window.AJUSTES_PROYECTO?.sedes) ? window.AJUSTES_PROYECTO.sedes : [];
  const cuposPorSede = window.AJUSTES_PROYECTO?.cuposPorSede || null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="eyebrow">{window.PROYECTO_NOMBRE || 'Proyecto'}</div>
            <h1>Inscritos</h1>
          </div>
          {total > 0 && onNavigate && (
            <button
              onClick={() => onNavigate('difusion')}
              style={{
                marginTop: 8,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'var(--bg-warm)',
                border: '1px solid var(--line-soft)',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="bullhorn" size={13} stroke="var(--terracota)" />
              Difundir
            </button>
          )}
        </div>
      </div>

      {/* Capacidad */}
      {sedesCfg.length > 0 ? (
        /* Proyecto con sedes: ocupación POR SEDE (no hay un cupo global) */
        <div style={{ padding: '0 22px', marginTop: 8 }}>
          <div className="card flat" style={{ padding: 16 }}>
            <div className="kpi-num">{total}</div>
            <div className="kpi-label" style={{ marginTop: 4 }}>Personas inscritas</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sedesCfg.map(s => {
                const n = MOCK_ALUMNAS.filter(a =>
                  (a.encuentros_asistir || a.encuentrosAsistir || []).includes(s.n)
                ).length;
                const max = cuposPorSede ? Number(cuposPorSede[String(s.n)] || 0) : 0;
                return (
                  <div key={s.n}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{s.nombre}</span>
                      <span style={{ color: 'var(--ink-mute)' }}>
                        {n}{max ? <span style={{ opacity: 0.7 }}>/{max}</span> : null}
                      </span>
                    </div>
                    <div className="progress" style={{ marginTop: 6 }}>
                      <div style={{ width: `${max ? Math.min(100, (n / max) * 100) : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 22px', display: 'flex', gap: 10, marginTop: 8 }}>
          <div className="card flat" style={{ flex: 1, padding: 16 }}>
            <div className="kpi-num">{total}<span style={{ fontSize: 18, color: 'var(--ink-mute)' }}>/{tweaks.capacidad}</span></div>
            <div className="kpi-label" style={{ marginTop: 4 }}>Inscritos</div>
            <div className="progress" style={{ marginTop: 10 }}>
              <div style={{ width: `${tweaks.capacidad ? (total / tweaks.capacidad) * 100 : 0}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
              Quedan <strong style={{ color: 'var(--ink)' }}>{cupos} cupos</strong>
            </div>
          </div>
          {usaSilla && (
            <div className="card flat" style={{ flex: 1, padding: 16 }}>
              <div className="kpi-num" style={{ color: 'var(--gold)' }}>{sillas}<span style={{ fontSize: 18, color: 'var(--ink-mute)' }}>/{sillasMax}</span></div>
              <div className="kpi-label" style={{ marginTop: 4 }}>Bono silla</div>
              <div className="progress" style={{ marginTop: 10 }}>
                <div style={{ width: `${(sillas / sillasMax) * 100}%`, background: 'var(--gold)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
                {sillas >= sillasMax ? 'Bono cerrado' : `${sillasMax - sillas} sillas disponibles`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ padding: '20px 22px 10px' }}>
        <div className="search">
          <Icon name="search" size={15} stroke="var(--ink-mute)" />
          <input placeholder="Buscar estudiante…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="segmented">
          <button className={filter === 'todas' ? 'active' : ''} onClick={() => setFilter('todas')}>Todos · {MOCK_ALUMNAS.length}</button>
          <button className={filter === 'pendientes' ? 'active' : ''} onClick={() => setFilter('pendientes')}>Pendientes · {MOCK_ALUMNAS.filter(a => (Number(a.total) || 0) > (Number(a.pagado) || 0)).length}</button>
          <button className={filter === 'silla' ? 'active' : ''} onClick={() => setFilter('silla')}>Silla · {sillas}</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {filter === 'todas' && 'Todos los inscritos, sin importar estado de pago.'}
          {filter === 'pendientes' && 'Solo quienes aún deben algo (estado parcial o pendiente).'}
          {filter === 'silla' && 'Solo quienes recibieron bono silla (auto a los primeros 6 con tarifa completa).'}
        </div>
      </div>

      <div style={{ padding: '14px 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {alumnas.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              Sin resultados
            </div>
          )}
          {alumnas.map(a => {
            const restante = Math.max(0, (a.total || 0) - (a.pagado || 0));
            const precioPP = tweaks.precioProntoPago || 484;
            // Paquete = lo que compró Sofía. Derivado de tipo_inscripcion + total.
            const esPP = esProntoPagoProducto(a, precioPP);
            // En proyectos por sedes (Seminario) el paquete son los encuentros
            // que tomó: se nombran por sede en vez de "completo / 2 / 1".
            const sedesProy = (window.AJUSTES_PROYECTO && window.AJUSTES_PROYECTO.sedes) || [];
            const paqueteLabel =
              a.tipo_inscripcion === 'taller'
                ? (a.encuentros_asistir || [])
                    .map(n => {
                      const s = sedesProy.find(x => x && x.n === n);
                      return s ? String(s.nombre || `Sede ${n}`).split(' ')[0] : `E${n}`;
                    })
                    .join(' · ')
                : esPP ? 'Pronto pago' :
                  a.tipo_inscripcion === 'completa' ? 'Completo' :
                  a.tipo_inscripcion === 'dos_encuentros' ? '2 encuentros' :
                  a.tipo_inscripcion === 'un_encuentro' ? '1 encuentro' : '';
            return (
              <div key={a.id} className="row" onClick={() => onOpenAlumna(a.id)} style={{ cursor: 'pointer' }}>
                <div className="avatar" style={{ background: a.avatar }}>{a.iniciales}</div>
                <div className="body">
                  <div className="t1">{a.nombre}</div>
                  <div className="t2" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>Se inscribió {a.inscrita}</span>
                    {a.bonoSilla && <span style={{ color: 'var(--gold)' }}>· silla</span>}
                  </div>
                  <div className="t2" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {paqueteLabel && (
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{paqueteLabel}</span>
                    )}
                    {a.total ? (
                      <span style={{ color: 'var(--ink-soft)' }}>· ${a.total}</span>
                    ) : null}
                    {restante > 0 ? (
                      <span style={{ color: 'var(--rojo)' }}>· falta ${restante}</span>
                    ) : a.total ? (
                      <span style={{ color: 'var(--oliva)' }}>· pagado</span>
                    ) : null}
                  </div>
                </div>
                <PagoPill pago={estadoPago(a)} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
};

const PagoPill = ({ pago }) => {
  const cfg = {
    'completo': { label: 'Pagado', cls: 'oliva' },
    'parcial':  { label: 'Parcial', cls: 'gold' },
    'pendiente':{ label: 'Pendiente', cls: 'alert' },
  }[pago] || { label: 'Pendiente', cls: 'alert' };
  return <span className={`pill ${cfg.cls}`}>{cfg.label}</span>;
};

window.ReservasScreen = ReservasScreen;
window.PagoPill = PagoPill;
