import React from 'react';

// ─────────────────────────────────────────────────────────────────
// EstudioPlaceholder — pantalla provisional del módulo Estudio
//
// Este componente se reemplaza progresivamente en los pasos 4-6 del
// MVP por las pantallas reales (home estudio, estudiantes, pagos,
// vencimientos, asistencia, config). Mientras tanto muestra:
//   - Estado de carga de las tablas nuevas
//   - KPIs básicos (cuántos estudiantes, planes, comprobantes)
//   - Confirmación visual de que la BD está conectada
// ─────────────────────────────────────────────────────────────────

function EstudioPlaceholder({ store, onSwitch }) {
  const e = store.estudio || {};
  const Icon = window.Icon;

  // KPIs derivados (cálculo barato in-memory)
  const totalActivas = (e.estudiantesActivas || []).length;
  const totalPlanes = (e.planesActivos || []).length;
  const pendientes = e.countComprobantesPendientes || 0;

  // Vencimientos próximos (7 días)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
  const enHoyStr = hoy.toISOString().slice(0, 10);
  const en7Str = en7.toISOString().slice(0, 10);

  const porVencer = (e.estudiantesActivas || [])
    .map(est => ({ est, m: e.getMembresiaActiva ? e.getMembresiaActiva(est.id) : null }))
    .filter(x => x.m && x.m.fechaFin >= enHoyStr && x.m.fechaFin <= en7Str && x.m.estado === 'activa')
    .sort((a, b) => (a.m.fechaFin || '').localeCompare(b.m.fechaFin || ''));

  return (
    <div className="app-scroll" style={{ padding: '24px 18px 100px' }}>
      {/* Header con switch a Formación */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Módulo
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 22, fontFamily: 'Cormorant Garamond, serif' }}>
            Estudio
          </h1>
        </div>
        <button
          onClick={onSwitch}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999,
            background: 'var(--bg-soft)', border: '1px solid var(--line)',
            fontSize: 12, color: 'var(--ink)',
            cursor: 'pointer',
          }}
          aria-label="Cambiar a módulo Formación"
        >
          Formación →
        </button>
      </header>

      {/* Banner de bienvenida */}
      <div style={{
        padding: 16, borderRadius: 14,
        background: 'var(--bg-soft)',
        border: '1px solid var(--line)',
        marginBottom: 18,
      }}>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>
          Bienvenida al estudio
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          Las tablas están listas. En las próximas iteraciones llegan las pantallas
          de estudiantes, pagos, vencimientos, asistencia y config.
        </div>
      </div>

      {/* KPIs básicos */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        marginBottom: 18,
      }}>
        {[
          { label: 'Activas', value: totalActivas, sub: 'estudiantes' },
          { label: 'Vencen 7d', value: porVencer.length, sub: 'membresías' },
          { label: 'Compr. pend.', value: pendientes, sub: 'por validar' },
        ].map((k, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--line)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-softer, var(--ink-soft))', marginTop: 1, opacity: 0.7 }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Vencimientos próximos */}
      {porVencer.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Vencen en los próximos 7 días
          </h2>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {porVencer.map(({ est, m }, i) => (
              <div key={est.id} style={{
                padding: '10px 12px',
                borderBottom: i < porVencer.length - 1 ? '1px solid var(--line)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{est.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    {m.planSnapshot?.nombre || 'Sin plan'} · vence {m.fechaFin}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catálogo de planes (vista simple) */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Planes activos ({totalPlanes})
        </h2>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
          {(e.planesActivos || []).map((p, i, arr) => (
            <div key={p.id} style={{
              padding: '10px 12px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {p.tipo} · {p.duracionDias}d{p.numClases ? ` · ${p.numClases} clases` : ' · ilimitado'}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--terracota)' }}>
                ${p.precio.toFixed(2)}
              </div>
            </div>
          ))}
          {totalPlanes === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Cargando planes…
            </div>
          )}
        </div>
      </section>

      {/* Estado de la BD */}
      <div style={{
        padding: 12, borderRadius: 10,
        background: e.loading ? 'var(--bg-soft)' : '#f3f8f4',
        fontSize: 11, color: 'var(--ink-soft)',
        textAlign: 'center',
      }}>
        {e.loading ? 'Cargando datos del estudio…' : '✓ Conectado a Supabase · 8 tablas activas'}
      </div>
    </div>
  );
}

window.EstudioPlaceholder = EstudioPlaceholder;
export { EstudioPlaceholder };
