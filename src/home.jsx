import React from 'react';
import { alumnaAsisteDia, PRECIOS_DEFAULT } from './lib/precios.js';
import { supabase as sbClient } from './lib/supabase.js';
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

// Convierte los días configurados del proyecto (ajustes.diasFormacion) en el
// mismo shape que DIAS_FECHAS. Así el home sirve para CUALQUIER proyecto
// (formación, taller, seminario) y no sólo para junio 2026.
// Acepta fecha ISO ('2026-11-20') o texto ('20–22 nov'); si no hay fecha
// parseable, el día simplemente no dispara cuenta regresiva.
const MESES_ES = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
function parseFechaDia(f, anioRef) {
  if (!f) return null;
  const iso = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  // '20–22 nov' o '3–6 dic' → toma el primer número y el mes
  const m = String(f).toLowerCase().match(/(\d{1,2})\s*[–\-—]?\s*\d{0,2}\s*([a-záéíóú]{3})/);
  if (m && MESES_ES[m[2]] !== undefined) return new Date(anioRef, MESES_ES[m[2]], Number(m[1]));
  return null;
}

function diasDeAjustes(ajustesDias) {
  if (!Array.isArray(ajustesDias) || !ajustesDias.length) return DIAS_FECHAS;
  const anio = new Date().getFullYear();
  return ajustesDias.map((d, i) => ({
    idx: d.idx ?? i,
    date: parseFechaDia(d.fechaISO || d.fecha, anio) || new Date(2100, 0, 1),
    label: d.label || `Día ${i + 1}`,
    encuentro: d.encuentro ?? (i + 1),
    fechaCorta: d.fecha || '',
  }));
}

function getFormationContext(dias = DIAS_FECHAS) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = dias[0].date;
  const lastDay = dias[dias.length - 1].date;
  const todayDia = dias.find(d => d.date.getTime() === today.getTime());
  const nextDia = dias.find(d => d.date >= today);
  const DIAS_FECHAS = dias; // el resto de la función usa este nombre
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

const HomeScreen = ({ tweaks, onNavigate, asistenciaHoy, alumnas, leads, mensajes, comprobantesPendientes = 0, comprobantePendienteLatest = null }) => {
  // Icon viene de window (registrado por icons.jsx). Leerlo en render-time
  // para evitar race condition con el Promise.all paralelo de main.jsx.
  const Icon = window.Icon;
  // alumnas/leads/mensajes vienen del store via props (reactivos).
  // MOCK_ALUMNAS/MOCK_LEADS/MENSAJES_RECIENTES siguen sincronizados como fallback.
  const safeAlumnas = alumnas || MOCK_ALUMNAS || [];
  const safeLeads = leads || MOCK_LEADS || [];
  const safeMensajes = mensajes || MENSAJES_RECIENTES || [];

  // Clase abierta activa + count de inscripciones a formación post-follow-up.
  // Fetch directo (sin canal realtime aquí para no colisionar con el que usa
  // screen-clase-inscripciones cuando abre el overlay). Refresh on focus.
  const [claseActiva, setClaseActiva] = useState(null);
  const [claseInscritos, setClaseInscritos] = useState(0);
  // Count de leads con followup enviado que YA respondieron el form de
  // inscripción a la formación. Sirve para alert rojo en home.
  const [respuestasFormCount, setRespuestasFormCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      const { data: clases } = await sbClient.from('clases_abiertas').select('*').eq('activa', true).order('fecha', { ascending: true }).limit(1);
      const clase = clases?.[0] || null;
      if (cancelled) return;
      setClaseActiva(clase);
      if (clase) {
        const { count } = await sbClient.from('clase_inscripciones').select('*', { count: 'exact', head: true }).eq('clase_id', clase.id);
        if (!cancelled) setClaseInscritos(count || 0);
      }
      // Cuenta de respuestas al form de inscripción desde leads con followup:
      // 1) IDs de leads que recibieron follow-up
      const { data: leadsFu } = await sbClient.from('leads').select('id').not('followup_clase_enviado_at', 'is', null);
      const ids = (leadsFu || []).map(l => l.id);
      if (ids.length === 0) {
        if (!cancelled) setRespuestasFormCount(0);
      } else {
        const { count: respCount } = await sbClient.from('preinscripcion')
          .select('id', { count: 'exact', head: true })
          .in('lead_id', ids)
          .eq('estado', 'completada');
        if (!cancelled) setRespuestasFormCount(respCount || 0);
      }
    };
    cargar();
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, []);
  const claseCupos = claseActiva ? Math.max(0, claseActiva.cupos_max - claseInscritos) : 0;
  const totalAlumnas = safeAlumnas.length;
  const cupos = tweaks.capacidad - totalAlumnas;
  // Días/encuentros del PROYECTO activo (formación, taller o seminario)
  const diasProyecto = React.useMemo(
    () => diasDeAjustes(window.DIAS_FORMACION),
    [window.DIAS_FORMACION]
  );
  const ctx = getFormationContext(diasProyecto);
  const greeting = getGreeting();
  const todayStr = formatTodayLong();

  // Today's stats — solo cuenta a las que asisten hoy según su tipo de inscripción
  const diaHoyIdx = ctx.currentDia ? ctx.currentDia.idx : 0;
  const alumnasHoy = safeAlumnas.filter(a => alumnaAsisteDia(a, diaHoyIdx));
  const presentesHoy = Object.entries(asistenciaHoy).filter(([id, v]) => v === true && alumnasHoy.some(a => String(a.id) === String(id))).length;
  const ausentesHoy = Object.entries(asistenciaHoy).filter(([id, v]) => v === false && alumnasHoy.some(a => String(a.id) === String(id))).length;
  const sinMarcar = alumnasHoy.length - presentesHoy - ausentesHoy;

  // Pagos
  // Pendiente = cualquiera que debe plata (pagado < total). Incluye alumnas
  // con pago='pronto-pago' parcial (Alejandra-style: producto pronto pago
  // pero aún no terminó de pagar el total $484).
  const pagosPendientes = safeAlumnas.filter(a => (Number(a.total) || 0) > (Number(a.pagado) || 0));
  const totalPendiente = pagosPendientes.reduce((s, a) => s + (a.total - a.pagado), 0);

  // Leads nuevos
  const leadsNuevos = safeLeads.filter(l => l.estado === 'nuevo');
  const sinLeer = safeMensajes.filter(m => m.sinLeer).length;

  // Bono silla — sólo existe en la formación. Si el proyecto tiene
  // bonoSillaCupos = 0 (taller, seminario), no se muestra nada de silla.
  const sillasOtorgadas = safeAlumnas.filter(a => a.bonoSilla).length;
  const sillasMax = Number(tweaks.bonoSillaCupos ?? 6);
  const usaSilla = sillasMax > 0;

  // Config del proyecto activo (sedes, matriz de precios, reservas).
  // Si el proyecto define sedes (Seminario Angelo), el home muestra ESAS y no
  // los precios de la formación.
  const ajustesProy = (window.AJUSTES_PROYECTO || {});
  const sedesCfg = Array.isArray(ajustesProy.sedes) ? ajustesProy.sedes : [];
  const matriz = ajustesProy.matrizPrecios || null;
  const reservasCfg = ajustesProy.reservaPorSede || null;

  // Consolidado financiero
  const totalVendido = safeAlumnas.reduce((s, a) => s + (Number(a.total) || 0), 0);
  const totalRecibido = safeAlumnas.reduce((s, a) => s + (Number(a.pagado) || 0), 0);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

  // Pronto pago deadline countdown — assume hoy = sábado 6 jun (día de inicio)
  const prontoPagoVencido = true; // 10 mayo ya pasó

  return (
    <div>
      {/* ───── Greeting + date ───── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">{todayStr}</div>
            <h1>{greeting},<br/><em>{(tweaks.ownerName || 'Sofía').split(' ')[0]}</em></h1>
          </div>
          <button onClick={() => onNavigate('ajustes')} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--line-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
          }}>
            <Icon name="settings" size={16} stroke="var(--ink-soft)" />
          </button>
        </div>
      </div>

      {/* ───── Hero: Día 1 de la formación ───── */}
      <div className="hero fade-in">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
              {sedesCfg.length
                ? (ctx.phase === 'before'
                    ? `Faltan ${ctx.daysToStart} días para empezar`
                    : ctx.phase === 'after' ? 'Seminario finalizado' : 'En curso')
                : ctx.heroEyebrow}
            </div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 6, fontWeight: 400 }}>
              {sedesCfg.length ? (
                <>
                  {tweaks.studioName || 'Seminario'}
                  <br />
                  <em style={{ color: 'var(--terracota-soft)', fontStyle: 'italic', fontSize: 20 }}>
                    {(ajustesProy.profesores || []).map(p => p.nombre).join(' · ') || tweaks.lugar}
                  </em>
                </>
              ) : (
                <>{ctx.heroTitle}<br/><em style={{ color: 'var(--terracota-soft)', fontStyle: 'italic' }}>{ctx.heroEmphasis}</em></>
              )}
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
              inscritos
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
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, fontWeight: 400 }}>
              {sedesCfg.length ? sedesCfg.length : '50 h'}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              {sedesCfg.length ? 'encuentros' : 'programa'}
            </div>
          </div>
        </div>

        {/* Los encuentros/sedes del proyecto dentro del hero (Seminario Angelo) */}
        {sedesCfg.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(251,247,240,0.14)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sedesCfg.map(s => {
              // Inscritos que eligieron esta sede
              const inscritosSede = safeAlumnas.filter(a =>
                (a.encuentros_asistir || a.encuentrosAsistir || []).includes(s.n)
              ).length;
              const cuposSede = (ajustesProy.cuposPorSede || {})[String(s.n)] || null;
              return (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(251,247,240,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                  }}>{s.n}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.nombre}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.6 }}>
                      {[s.fechas, s.lugar].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="serif" style={{ fontSize: 16, lineHeight: 1 }}>
                      {inscritosSede}{cuposSede ? <span style={{ fontSize: 11, opacity: 0.5 }}>/{cuposSede}</span> : null}
                    </div>
                    <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, marginTop: 2 }}>
                      inscritos
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Consolidado financiero */}
        <div style={{
          display: 'flex', gap: 10, marginTop: 14, paddingTop: 14,
          borderTop: '1px solid rgba(251,247,240,0.14)',
        }}>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400, color: 'var(--terracota-soft)' }}>
              {fmt(totalRecibido)}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              recibido
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(251,247,240,0.14)' }} />
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400 }}>
              {fmt(totalVendido)}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              vendido
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(251,247,240,0.14)' }} />
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400, opacity: totalVendido > 0 ? 1 : 0.4 }}>
              {totalVendido > 0 ? Math.round((totalRecibido / totalVendido) * 100) : 0}<span style={{ fontSize: 14, opacity: 0.5 }}>%</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginTop: 4 }}>
              cobrado
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
            : ctx.phase === 'before' ? 'Ver inscritos'
            : ctx.phase === 'during' ? 'Ver inscritos'
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
        {claseActiva && (() => {
          // ¿Ya pasó la clase? Si pasó, NO mostramos nada acá (el archivo de
          // inscritos sigue accesible desde Leads → botón Inscripciones).
          // Solo renderizamos cuando la clase aún no pasa.
          const yaPaso = (() => {
            if (!claseActiva?.fecha) return false;
            if (claseActiva.hora_fin) {
              const claseFin = new Date(`${claseActiva.fecha}T${claseActiva.hora_fin}-05:00`).getTime();
              if (!isNaN(claseFin)) return Date.now() > claseFin;
            }
            const hoyStr = new Date().toISOString().slice(0, 10);
            return claseActiva.fecha < hoyStr;
          })();
          if (yaPaso) return null;
          return (
          <ActionRow
            icon="sparkle"
            accent="terracota"
            title={`Clase de prueba · ${
              claseActiva.fecha
                ? new Date(claseActiva.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'short' })
                : ''
            }`}
            subtitle={
              claseInscritos === 0
                ? `${claseActiva.cupos_max} cupos disponibles · sin inscritos aún`
                : claseCupos === 0
                ? `Lleno · ${claseInscritos} inscritos`
                : `${claseInscritos} inscrito${claseInscritos === 1 ? '' : 's'} · quedan ${claseCupos} cupo${claseCupos === 1 ? '' : 's'}`
            }
            onClick={() => onNavigate('clase-inscripciones')}
          />
          );
        })()}
        {comprobantesPendientes > 0 && (
          <ActionRow
            icon="cash"
            accent="rojo"
            title={`${comprobantesPendientes} comprobante${comprobantesPendientes > 1 ? 's' : ''} por validar`}
            subtitle={
              comprobantePendienteLatest
                ? `Más reciente: ${comprobantePendienteLatest.nombre_cliente}${comprobantePendienteLatest.monto ? ` · $${comprobantePendienteLatest.monto}` : ''}`
                : 'Revisa el banco y valida'
            }
            onClick={() => onNavigate('pagos')}
          />
        )}
        <ActionRow
          icon="cash"
          accent="rojo"
          title={`${pagosPendientes.length} pagos por recibir`}
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
        {/* Mensajes WA/IG removidos: sin integración API, no hay forma de detectarlos */}
        {usaSilla && sillasOtorgadas > 0 && (
          <ActionRow
            icon="chair"
            accent="gold"
            title={`Bono silla — ${sillasOtorgadas} de ${sillasMax} entregados`}
            subtitle={
              sillasOtorgadas >= sillasMax ? 'Bono cerrado' :
              `Quedan ${sillasMax - sillasOtorgadas} ${sillasMax - sillasOtorgadas === 1 ? 'cupo' : 'cupos'}`
            }
            onClick={() => onNavigate('reservas')}
          />
        )}
      </div>

      {/* ───── Política de precios ───── */}
      <div className="section-title">
        <h2>Precios</h2>
        <span className="link" onClick={() => onNavigate('ajustes')} style={{ cursor: 'pointer' }}>Editar →</span>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: 16 }}>
          {sedesCfg.length > 0 ? (
            <>
              {/* Proyecto con SEDES (Seminario Angelo): precio por sede y por combinación */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                {sedesCfg.map(s => (
                  <React.Fragment key={s.n}>
                    <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                      {s.nombre}
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-mute)', fontWeight: 400 }}>
                        {[s.fechas, s.lugar].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', textAlign: 'right' }}>
                      ${s.prontoPago || s.regular}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {matriz && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                  <div style={{ color: 'var(--terracota)', fontWeight: 500 }}>Los 3 encuentros</div>
                  <div className="serif" style={{ fontSize: 18, color: 'var(--terracota)', textAlign: 'right' }}>
                    ${Object.values(matriz['3'] || {}).reduce((a, b) => a + Number(b || 0), 0)}
                  </div>
                  <div style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Pronto pago</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'right' }}>
                    hasta {tweaks.fechaProntoPago || '13 de septiembre'}
                  </div>
                </div>
              )}
              {reservasCfg && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                  Apartar cupo (solo retiros):{' '}
                  {Object.entries(reservasCfg).filter(([, v]) => v).map(([k, v]) => {
                    const s = sedesCfg.find(x => String(x.n) === k);
                    return `${s ? s.nombre.split('·')[0].trim() : k} $${v}`;
                  }).join(' · ')}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Formación clásica */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  Completa <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 400 }}>· 50h · 3 encuentros</span>
                </div>
                <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', textAlign: 'right' }}>${PRECIOS_DEFAULT.completa.con_silla}</div>

                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>2 encuentros</div>
                <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', textAlign: 'right' }}>${PRECIOS_DEFAULT.dos_encuentros.con_silla}</div>

                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>1 encuentro</div>
                <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', textAlign: 'right' }}>${PRECIOS_DEFAULT.un_encuentro.con_silla}</div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                <div style={{ color: 'var(--terracota)', fontWeight: 500 }}>
                  Pronto pago <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 400 }}>· hasta {tweaks.fechaProntoPago || '10 mayo'}</span>
                </div>
                <div className="serif" style={{ fontSize: 18, color: 'var(--terracota)', textAlign: 'right' }}>${tweaks.precioProntoPago || 484}</div>

                <div style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Reserva (aparta cupo)</div>
                <div className="serif" style={{ fontSize: 14, color: 'var(--ink-soft)', textAlign: 'right' }}>${tweaks.precioReserva || 200}</div>
              </div>

              {usaSilla && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>Bono silla</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      <strong style={{ color: 'var(--ink)' }}>{sillasOtorgadas}</strong>/{sillasMax} asignadas
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                    Las primeras {sillasMax} personas que se inscriben a la formación completa y pagan reserva o más reciben silla automáticamente. El precio ya la incluye.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.45 }}>
                    Si renuncian: <strong>−$30</strong> al total · pronto pago <strong>sin descuento</strong> (precio fijo).
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ───── Mensajes recientes ───── */}
      {safeMensajes.length > 0 && (
        <>
          <div className="section-title">
            <h2>Conversaciones</h2>
            <span className="link" onClick={() => onNavigate('crm')} style={{ cursor: 'pointer' }}>Ver todas →</span>
          </div>
          <div style={{ padding: '0 22px' }}>
            <div className="card flat" style={{ padding: '4px 16px' }}>
              {safeMensajes.slice(0, 3).map(m => (
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
        </>
      )}

      <div style={{ height: 40 }} />
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
