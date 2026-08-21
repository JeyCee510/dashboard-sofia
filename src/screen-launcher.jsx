import React from 'react';
import { versionLegible, versionCompleta } from './lib/version.js';
import { useProyectos } from './hooks/useProyectos.js';
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

// Presentación de cada proyecto según su shell/estado
const presentar = (p) => {
  const archivado = p.estado === 'archivado';
  if (p.shell === 'estudio') return { icon: 'sparkle', accent: 'oliva', eyebrow: 'En curso', badge: null, subtitle: 'Membresías, clases y asistencia del día a día' };
  return {
    icon: 'users',
    accent: archivado ? 'terracota' : 'terracota',
    eyebrow: (p.tipo ? p.tipo[0].toUpperCase() + p.tipo.slice(1) : 'Proyecto'),
    badge: archivado ? 'Archivada' : (p.estado === 'activo' ? 'Activo' : null),
    subtitle: p.descripcion || 'Inscritos, pagos y leads',
  };
};

const LauncherScreen = ({ ownerName = 'Sofía', esAdmin = true, onAbrirProyecto, onNuevoProyecto, onEstudio, onFormacion, onTaller }) => {
  const { proyectos, loading } = useProyectos();
  const saludo = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // Fallback ESTÁTICO: si la base aún no respondió (Supabase frío), el inicio
  // igual se ve y es usable al instante. Los slugs deben coincidir con el
  // routing de app.jsx para que las tarjetas funcionen sin la base.
  const FALLBACK = [
    { id: 'fb-estudio',  slug: 'estudio',              nombre: 'Estudio',                shell: 'estudio',   estado: 'activo',    orden: 20, descripcion: 'Membresías, clases y asistencia del día a día' },
    { id: 'fb-refinar',  slug: 'refinar-la-practica',  nombre: 'Refinar la Práctica',    shell: 'formacion', estado: 'activo',    tipo: 'taller', orden: 10 },
    { id: 'fb-formacion',slug: 'formacion-junio-2026', nombre: 'El Arte de Enseñar Yoga', shell: 'formacion', estado: 'archivado', tipo: 'formacion', orden: 30 },
  ];

  // Orden: activos primero, archivados al final. Usa fallback si no hay datos.
  // Se ocultan los proyectos marcados con config.oculto (ej. la formación de
  // junio, ya cerrada). Siguen existiendo en la base y se pueden reactivar.
  const ordenados = useMemo(() => {
    // El fallback estático SOLO se usa mientras carga y únicamente para admins.
    // Un colaborador (ej. Micaela) jamás debe ver tarjetas de proyectos a los
    // que no tiene acceso: para ella la lista viene siempre de la base (RLS).
    const usarFallback = !proyectos.length && esAdmin;
    const base = (usarFallback ? FALLBACK : proyectos)
      .filter(p => !(p.config && p.config.oculto));
    const peso = (p) => (p.estado === 'archivado' ? 100 : 0) + (p.orden || 0);
    return [...base].sort((a, b) => peso(a) - peso(b));
  }, [proyectos, esAdmin]);

  return (
    <div className="app-scroll fade-in" style={{ padding: '0' }}>
      <div style={{ padding: '64px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
              {saludo}, {ownerName}
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, lineHeight: 1.05, margin: '0 0 6px', color: 'var(--ink)', fontWeight: 600 }}>
              Tus proyectos
            </h1>
          </div>
          {/* Campana de novedades (leads, pagos, notas del equipo) */}
          {window.NotifBell ? <window.NotifBell /> : null}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px', maxWidth: 320 }}>
          Elige dónde quieres trabajar hoy, o define un proyecto nuevo.
        </p>

        {/* Aviso para activar notificaciones (se auto-oculta si ya están
            activas, si las bloquearon o si la persona lo descarta) */}
        {window.PushBanner ? <window.PushBanner /> : null}

        {ordenados.map(p => {
          const v = presentar(p);
          return (
            <ProjectCard
              key={p.id}
              icon={v.icon} accent={v.accent} eyebrow={v.eyebrow} badge={v.badge}
              title={p.nombre} subtitle={v.subtitle}
              onClick={() => onAbrirProyecto && onAbrirProyecto(p)}
            />
          );
        })}

        {/* La tarjeta "Nuevo proyecto" se ocultó del home a pedido de JC.
            El wizard sigue disponible desde el panel de ajustes (tweaks). */}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: 'var(--ink-mute)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
          Sofía Lira · Yoga
        </div>
        {/* Versión visible: si algo "no aparece", lo primero es saber si el
            dispositivo tiene la última o una copia cacheada por la PWA.
            Al tocarla muestra el commit, para reportar con precisión. */}
        <div
          onClick={() => alert(versionCompleta())}
          title="Toca para ver el detalle"
          style={{
            marginTop: 6, textAlign: 'center', fontSize: 10,
            color: 'var(--ink-mute)', opacity: 0.65, cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {versionLegible()}
        </div>
      </div>
    </div>
  );
};

window.LauncherScreen = LauncherScreen;
export { LauncherScreen };
