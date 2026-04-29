import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Home — Resumen del día (pantalla principal)
// ──────────────────────────────────────────

const HomeScreen = ({ tweaks, onNavigate, asistenciaHoy, onMarkAttendance }) => {
  const totalAlumnas = MOCK_ALUMNAS.length;
  const cupos = tweaks.capacidad - totalAlumnas;

  // Today's stats
  const presentesHoy = Object.values(asistenciaHoy).filter(v => v === true).length;
  const ausentesHoy = Object.values(asistenciaHoy).filter(v => v === false).length;
  const sinMarcar = totalAlumnas - presentesHoy - ausentesHoy;

  // Pagos
  const pagosPendientes = MOCK_ALUMNAS.filter(a => a.pago === 'pendiente' || a.pago === 'parcial');
  const totalPendiente = pagosPendientes.reduce((s, a) => s + (a.total - a.pagado), 0);

  // Leads nuevos
  const leadsNuevos = MOCK_LEADS.filter(l => l.estado === 'nuevo');
  const sinLeer = MENSAJES_RECIENTES.filter(m => m.sinLeer).length;

  // Pronto pago deadline countdown — assume hoy = sábado 6 jun (día de inicio)
  const prontoPagoVencido = true; // 10 mayo ya pasó

  return (
    <div>
      {/* ───── Greeting + date ───── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">Sábado · 6 de junio</div>
            <h1>Buenos días,<br/><em>Sofía</em></h1>
          </div>
          <button onClick={() => onNavigate('settings')} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--line-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
          }}>
            <span className="serif" style={{ fontSize: 16, color: 'var(--terracota)' }}>S</span>
            {sinLeer > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--terracota)', color: '#fff',
                fontSize: 10, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{sinLeer}</span>
            )}
          </button>
        </div>
      </div>

      {/* ───── Hero: Día 1 de la formación ───── */}
      <div className="hero fade-in">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
              Encuentro 1 · Día 1 de 6
            </div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 6, fontWeight: 400 }}>
              Hoy empieza<br/><em style={{ color: 'var(--terracota-soft)', fontStyle: 'italic' }}>la formación</em>
            </div>
          </div>
          <div style={{
            background: 'rgba(251,247,240,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(251,247,240,0.18)',
            borderRadius: 14, padding: '8px 12px',
            textAlign: 'center',
          }}>
            <div className="serif" style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }}>{HORARIO_HOY[0].hora}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>
              empieza
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 10, marginTop: 20, paddingTop: 16,
          borderTop: '1px solid rgba(251,247,240,0.14)',
        }}>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, fontWeight: 400 }}>
              {totalAlumnas}<span style={{ fontSize: 14, opacity: 0.5 }}>/{tweaks.capacidad}</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              inscritas
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(251,247,240,0.14)' }} />
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, fontWeight: 400 }}>{cupos}</div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              cupos libres
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(251,247,240,0.14)' }} />
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, fontWeight: 400 }}>50 h</div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              programa
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('asistencia')}
          style={{
            marginTop: 18, width: '100%',
            background: 'var(--terracota)', color: '#FBF7F0',
            border: 'none', borderRadius: 999, padding: '13px 18px',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Icon name="check" size={16} />
          Tomar asistencia de hoy
        </button>
      </div>

      {/* ───── Cronograma de hoy ───── */}
      <div className="section-title">
        <h2>Hoy</h2>
        <span className="link">Domo Soulspace · Tumbaco</span>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: 4 }}>
          {HORARIO_HOY.map((bloque, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 14px',
              borderBottom: i < HORARIO_HOY.length - 1 ? '1px solid var(--line-soft)' : 'none',
              opacity: bloque.tipoPausa ? 0.55 : 1,
            }}>
              <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', minWidth: 50 }}>
                {bloque.hora}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{bloque.tipo}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{bloque.dur}</div>
              </div>
              {bloque.estado === 'siguiente' && (
                <span className="pill terracota">siguiente</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ───── Pendientes del día (acciones) ───── */}
      <div className="section-title">
        <h2>Para ti hoy</h2>
      </div>
      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ActionRow
          icon="cash"
          accent="rojo"
          title={`${pagosPendientes.length} pagos por confirmar`}
          subtitle={`$${totalPendiente} pendientes de cobrar`}
          onClick={() => onNavigate('pagos')}
        />
        <ActionRow
          icon="chat"
          accent="terracota"
          title={`${leadsNuevos.length} leads nuevos`}
          subtitle={leadsNuevos[0] ? `Más reciente: ${leadsNuevos[0].nombre}` : 'Sin nuevos'}
          onClick={() => onNavigate('marketing')}
        />
        <ActionRow
          icon="whatsapp"
          accent="oliva"
          title={`${sinLeer} mensajes sin leer`}
          subtitle="WhatsApp e Instagram"
          onClick={() => onNavigate('crm')}
        />
        <ActionRow
          icon="chair"
          accent="gold"
          title="Bono silla — 6 de 6 entregados"
          subtitle="Recuérdales traerla mañana"
          onClick={() => onNavigate('reservas')}
        />
      </div>

      {/* ───── Mensajes recientes ───── */}
      <div className="section-title">
        <h2>Conversaciones</h2>
        <span className="link" onClick={() => onNavigate('crm')} style={{ cursor: 'pointer' }}>Ver todas →</span>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {MENSAJES_RECIENTES.slice(0, 3).map(m => (
            <div key={m.id} className="row" onClick={() => onNavigate('crm')} style={{ cursor: 'pointer' }}>
              <div className="avatar" style={{ background: m.esLead ? 'var(--terracota-soft)' : 'oklch(0.74 0.06 45)' }}>
                {m.alumna.split(' ').map(p => p[0]).slice(0, 2).join('')}
              </div>
              <div className="body">
                <div className="t1" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.alumna}
                  {m.esLead && <span style={{ fontSize: 10, color: 'var(--terracota)', fontWeight: 500 }}>· lead</span>}
                </div>
                <div className="t2">{m.preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{m.tiempo}</span>
                {m.sinLeer && <span className="dot" style={{ background: 'var(--terracota)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── 3 Encuentros ───── */}
      <div className="section-title">
        <h2>Los 3 encuentros</h2>
      </div>
      <div style={{ padding: '0 22px', display: 'flex', gap: 10 }}>
        {ENCUENTROS.map(e => (
          <div key={e.num} className="card flat" style={{
            flex: 1, padding: '14px 12px',
            background: e.estado === 'hoy' ? 'var(--terracota-tint)' : 'var(--surface)',
            borderColor: e.estado === 'hoy' ? 'transparent' : undefined,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: e.estado === 'hoy' ? '#8A3D26' : 'var(--ink-mute)', fontWeight: 500 }}>
              Encuentro {e.num}
            </div>
            <div className="serif" style={{ fontSize: 18, marginTop: 4, color: e.estado === 'hoy' ? '#8A3D26' : 'var(--ink)' }}>
              {e.sabado}
            </div>
            <div style={{ fontSize: 11, color: e.estado === 'hoy' ? '#8A3D26' : 'var(--ink-mute)', marginTop: 1 }}>
              y {e.domingo}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 30 }} />
    </div>
  );
};

const ActionRow = ({ icon, accent, title, subtitle, onClick }) => {
  const accentColors = {
    rojo: 'var(--rojo)',
    terracota: 'var(--terracota)',
    oliva: 'var(--oliva)',
    gold: 'var(--gold)',
  };
  const accentBgs = {
    rojo: '#F0D5CE',
    terracota: 'var(--terracota-tint)',
    oliva: '#DDE0CC',
    gold: '#F2E2C2',
  };
  return (
    <button onClick={onClick} className="card flat" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 14, textAlign: 'left',
      border: '1px solid var(--line-soft)', cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: accentBgs[accent], color: accentColors[accent],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={18} strokeWidth={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 1 }}>{subtitle}</div>
      </div>
      <Icon name="chevronR" size={18} stroke="var(--ink-mute)" />
    </button>
  );
};

window.HomeScreen = HomeScreen;
window.ActionRow = ActionRow;
