import React from 'react';
import { useActividad } from './hooks/useActividad.js';
import { ETIQUETA_ACCION } from './lib/actividad.js';

const { useMemo } = React;

// ──────────────────────────────────────────────────────────────
// Bitácora — quién hizo qué en el proyecto.
//
// Dos usos:
//   · Global  (Sofía revisa el trabajo del equipo, ej. Micaela en el Seminario)
//   · Por ficha (historial de un lead concreto), pasando entidad/entidadId.
// ──────────────────────────────────────────────────────────────

const COLOR_ACCION = {
  creo: 'var(--oliva)',
  pago: 'var(--whatsapp)',
  cambio_estado: 'var(--gold)',
  nota: 'var(--ink-soft)',
  actualizo: 'var(--ink-mute)',
  elimino: 'var(--rojo)',
  mensaje: 'var(--terracota)',
  asigno: 'var(--terracota)',
  link_inscripcion: 'var(--gold)',
  link_pago: 'var(--gold)',
  envio_wa: 'var(--whatsapp)',
  verifico: 'var(--oliva)',
};

const fechaCorta = (iso) => {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    if (mismoDia) return `hoy ${hora}`;
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) + ' ' + hora;
  } catch { return ''; }
};

const primerNombre = (ev) => {
  const n = ev.actor_nombre || ev.actor_email || 'Alguien';
  return String(n).split(/[\s@]/)[0];
};

// Lista compacta reutilizable (se usa dentro de la ficha de un lead)
const ListaActividad = ({ eventos, vacio = 'Sin actividad todavía.' }) => {
  if (!eventos.length) {
    return <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', padding: '10px 0' }}>{vacio}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {eventos.map(ev => (
        <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
            background: COLOR_ACCION[ev.accion] || 'var(--line)',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.35 }}>
              <strong style={{ fontWeight: 600 }}>{primerNombre(ev)}</strong>{' '}
              {ev.titulo || `${ETIQUETA_ACCION[ev.accion] || ev.accion} ${ev.entidad || ''}`}
            </div>
            {ev.detalle?.nota && (
              <div style={{
                fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3,
                background: 'var(--bg-warm)', borderRadius: 8, padding: '6px 9px',
              }}>
                {ev.detalle.nota}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{fechaCorta(ev.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Historial embebido de UNA ficha (lead / inscrita)
const ActividadDeFicha = ({ proyectoId, entidad, entidadId }) => {
  const { eventos, loading } = useActividad({ proyectoId, entidad, entidadId, limit: 30 });
  if (loading) return <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Cargando…</div>;
  return <ListaActividad eventos={eventos} vacio="Sin movimientos registrados." />;
};

// Pantalla completa: registro del proyecto
const ActividadScreen = ({ proyectoId, nombreProyecto = 'este proyecto', onClose }) => {
  const Icon = window.Icon;
  // Vista global: sólo lo relevante (notas, pagos, estados, altas). Las
  // ediciones menores viven dentro de cada ficha.
  const { eventos, loading } = useActividad({ proyectoId, limit: 150, soloRelevantes: true });

  // Agrupar por día para que se lea como un diario
  const grupos = useMemo(() => {
    const out = [];
    let actual = null;
    eventos.forEach(ev => {
      const dia = new Date(ev.created_at).toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long' });
      if (!actual || actual.dia !== dia) { actual = { dia, items: [] }; out.push(actual); }
      actual.items.push(ev);
    });
    return out;
  }, [eventos]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', borderBottom: '1px solid var(--line-soft)' }}>
        <button onClick={onClose} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: 'var(--ink-mute)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 10,
        }}>
          {Icon ? <Icon name="chevronL" size={16} /> : '‹'} Volver
        </button>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, margin: 0, color: 'var(--ink)', fontWeight: 600 }}>
          Actividad
        </h1>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
          Todo lo que ha pasado en {nombreProyecto}
        </div>
      </div>

      <div className="app-scroll" style={{ flex: 1, padding: '16px 20px 40px' }}>
        {loading && <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Cargando…</div>}
        {!loading && !eventos.length && (
          <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
            Todavía no hay movimientos. Cuando el equipo cree leads, registre pagos o deje notas, aparecerán aquí.
          </div>
        )}
        {grupos.map(g => (
          <div key={g.dia} style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--ink-mute)', marginBottom: 10,
            }}>{g.dia}</div>
            <ListaActividad eventos={g.items} />
          </div>
        ))}
      </div>
    </div>
  );
};

window.ActividadScreen = ActividadScreen;
window.ActividadDeFicha = ActividadDeFicha;
export { ActividadScreen, ActividadDeFicha };
