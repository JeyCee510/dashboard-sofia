import React from 'react';
const { useMemo } = React;

// ──────────────────────────────────────────────────────────────
// Launcher — Home provisional (selector de proyectos)
//
// Pantalla de entrada que muestra las "casas" de Sofía como tarjetas:
//   · Estudio              → módulo Estudio (membresías / clases continuas)
//   · Formación 50h junio  → el dashboard de la formación, ya ARCHIVADA
//   · Nuevo proyecto       → abre el wizard para definir el próximo producto
//
// Es deliberadamente simple y aditivo: NO toca las tablas ni el flujo
// existente. Solo decide a qué módulo entrar (app.jsx maneja moduloActivo).
// ──────────────────────────────────────────────────────────────

const ProjectCard = ({ icon, accent, eyebrow, title, subtitle, badge, onClick }) => {
  const Icon = window.Icon;
  const accents = {
    oliva:    { fg: 'var(--oliva)',     bg: 'var(--oliva-soft)' },
    terracota:{ fg: 'var(--terracota)', bg: 'var(--terracota-tint)' },
    gold:     { fg: 'var(--gold)',      bg: '#F0E2C6' },
  };
  const a = accents[accent] || accents.terracota;
  return (
    <button
      onClick={onClick}
      className="card lift"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', textAlign: 'left',
        padding: '18px 18px',
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        marginBottom: 14,
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
        background: a.bg, color: a.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {Icon ? <Icon name={icon} size={24} strokeWidth={1.6} /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--ink-mute)', marginBottom: 3,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {eyebrow}
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
              padding: '1px 7px', borderRadius: 999,
              background: 'var(--bg-warm)', color: 'var(--ink-soft)',
              border: '1px solid var(--line)',
            }}>{badge}</span>
          )}
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22, lineHeight: 1.1, color: 'var(--ink)', fontWeight: 600,
        }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>{subtitle}</div>
      </div>
      {Icon ? <Icon name="chevronR" size={20} stroke="var(--ink-mute)" /> : null}
    </button>
  );
};

const LauncherScreen = ({ ownerName = 'Sofía', onEstudio, onFormacion, onTaller, onNuevoProyecto }) => {
  const saludo = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  return (
    <div className="app-scroll fade-in" style={{ padding: '0' }}>
      <div style={{ padding: '64px 22px 22px' }}>
        {/* Encabezado cálido */}
        <div style={{
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ink-mute)', marginBottom: 6,
        }}>
          {saludo}, {ownerName}
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 34, lineHeight: 1.05, margin: '0 0 6px',
          color: 'var(--ink)', fontWeight: 600,
        }}>
          Tus proyectos
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px', maxWidth: 320 }}>
          Elige dónde quieres trabajar hoy, o define un proyecto nuevo.
        </p>

        {/* Tarjetas */}
        <ProjectCard
          icon="sparkle"
          accent="oliva"
          eyebrow="En curso"
          title="Estudio"
          subtitle="Membresías, clases y asistencia del día a día"
          onClick={onEstudio}
        />
        <ProjectCard
          icon="users"
          accent="terracota"
          eyebrow="Taller · jul–nov 2026"
          badge="Activo"
          title="Refinar la Práctica"
          subtitle="6 sábados de práctica profunda · drop-in modular"
          onClick={onTaller}
        />
        <ProjectCard
          icon="users"
          accent="terracota"
          eyebrow="Formación · jun 2026"
          badge="Archivada"
          title="El Arte de Enseñar Yoga"
          subtitle="50h · consulta inscritos, pagos e historial"
          onClick={onFormacion}
        />
        <ProjectCard
          icon="plus"
          accent="gold"
          eyebrow="Empezar algo"
          title="Nuevo proyecto"
          subtitle="Define el alcance y obtén un camino a seguir"
          onClick={onNuevoProyecto}
        />

        <div style={{
          marginTop: 18, textAlign: 'center',
          fontSize: 11, color: 'var(--ink-mute)',
          fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
        }}>
          Sofía Lira · Yoga
        </div>
      </div>
    </div>
  );
};

window.LauncherScreen = LauncherScreen;
export { LauncherScreen };
