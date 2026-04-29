import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Home — Resumen del día (pantalla principal)
// ──────────────────────────────────────────

// Fechas absolutas de los 6 días de formación (junio 2026)
// Mes en JS: 0-indexed; junio = 5
const DIAS_FECHAS = [
  { idx: 0, date: new Date(2026, 5, 6),  label: 'Día 1', encuentro: 1, fechaCorta: '6 jun' },
  { idx: 1, date: new Date(2026, 5, 7),  label: 'Día 2', encuentro: 1, fechaCorta: '7 jun' },
  { idx: 2, date: new Date(2026, 5, 13), label: 'Día 3', encuentro: 2, fechaCorta: '13 jun' },
  { idx: 3, date: new Date(2026, 5, 14), label: 'Día 4', encuentro: 2, fechaCorta: '14 jun' },
  { idx: 4, date: new Date(2026, 5, 20), label: 'Día 5', encuentro: 3, fechaCorta: '20 jun' },
  { idx: 5, date: new Date(2026, 5, 21), label: 'Día 6', encuentro: 3, fechaCorta: '21 jun' },
];

function getFormationContext() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = DIAS_FECHAS[0].date;
  const lastDay = DIAS_FECHAS[5].date;
  const todayDia = DIAS_FECHAS.find(d => d.date.getTime() === today.getTime());
  const nextDia = DIAS_FECHAS.find(d => d.date >= today);
  const diffDays = Math.round((firstDay - today) / (1000 * 60 * 60 * 24));
  const dayDiff = (d) => Math.round((d - today) / (1000 * 60 * 60 * 24));

  if (todayDia) {
    return {
      phase: 'today',
      currentDia: todayDia,
      heroEyebrow: `Encuentro ${todayDia.encuentro} · ${todayDia.label} de 6`,
      heroTitle: 'Hoy es',
      heroEmphasis: todayDia.label,
      showSchedule: true,
    };
  }
  if (today < firstDay) {
    return {
      phase: 'before',
      daysToStart: diffDays,
      nextDia,
      heroEyebrow: diffDays === 1 ? 'Mañana empieza' : `Faltan ${diffDays} días`,
      heroTitle: 'Pronto empieza',
      heroEmphasis: 'la formación',
      showSchedule: false,
    };
  }
  if (today > firstDay && today <= lastDay && nextDia) {
    const dd = dayDiff(nextDia.date);
    return {
      phase: 'during',
      nextDia,
      heroEyebrow: `Encuentro ${nextDia.encuentro} · ${nextDia.label} de 6`,
      heroTitle: dd === 1 ? 'Mañana toca' : `En ${dd} días`,
      heroEmphasis: nextDia.label,
      showSchedule: false,
    };
  }
  // after
  return {
    phase: 'after',
    heroEyebrow: 'Formación completa',
    heroTitle: 'Hasta la',
    heroEmphasis: 'próxima edición',
    showSchedule: false,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatTodayLong() {
  // Ej: "Sábado · 6 de junio"
  const now = new Date();
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[now.getDay()]} · ${now.getDate()} de ${meses[now.getMonth()]}`;
}

const HomeScreen = ({ tweaks, onNavigate, asistenciaHoy, onMarkAttendance }) => {
  const totalAlumnas = MOCK_ALUMNAS.length;
  const cupos = tweaks.capacidad - totalAlumnas;
  const ctx = getFormationContext();
  const greeting = getGreeting();
  const todayStr = formatTodayLong();

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
            <div className="eyebrow">{todayStr}</div>
            <h1>{greeting},<br/><em>Sofía</em></h1>
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
              {ctx.heroEyebrow}
            </div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 6, fontWeight: 400 }}>
              {ctx.heroTitle}<br/><em style={{ color: 'var(--terracota-soft)', fontStyle: 'italic' }}>{ctx.heroEmphasis}</em>
            </div>
          </div>
          <div style={{
            background: 'rgba(251,247,240,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(251,247,240,0.18)',
            borderRadius: 14, padding: '8px 12px',
            textAlign: 'center',
            minWidth: 76,
          }}>
            {ctx.phase === 'today' ? (
              <>
                <div className="serif" style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }}>{HORARIO_HOY[0].hora}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>empieza</div>
              </>
            ) : ctx.phase === 'before' ? (
              <>
                <div className="serif" style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }}>{ctx.daysToStart}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>{ctx.daysToStart === 1 ? 'día' : 'días'}</div>
              </>
            ) : ctx.phase === 'during' && ctx.nextDia ? (
              <>
                <div className="serif" style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>{ctx.nextDia.fechaCorta}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>próximo</div>
              </>
            ) : (
              <>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400 }}>✨</div>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>fin</div>
              </>
            )}
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
          onClick={() => onNavigate(ctx.phase === 'today' ? 'asistencia' : 'reservas')}
          style={{
            marginTop: 18, width: '100%',
            background: 'var(--terracota)', color: '#FBF7F0',
            border: 'none', borderRadius: 999, padding: '13px 18px',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Icon name={ctx.phase === 'today' ? 'check' : 'users'} size={16} />
          {ctx.phase === 'today' ? 'Tomar asistencia de hoy'
            : ctx.phase === 'before' ? 'Ver inscritas'
            : ctx.phase === 'during' ? 'Ver inscritas'
            : 'Ver resumen'}
        </button>
      </div>

      {/* ───── Cronograma de hoy ───── */}
      {ctx.showSchedule && (
        <>
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
        </>
      )}

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
