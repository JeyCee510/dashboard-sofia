import React from 'react';
import { supabase } from './lib/supabase.js';
import { ALLOWED_EMAILS } from './lib/supabase.js';
const { useState, useMemo } = React;

// ──────────────────────────────────────────────────────────────
// Wizard de nuevo proyecto
//
// Pantalla interactiva donde Sofía define el ALCANCE de su próximo
// producto. Al final, calcula un "camino a seguir" (qué módulos del
// dashboard necesitará + próximos pasos) y guarda todo en la tabla
// `proyectos_borradores` (migración 031).
//
// Es 100% aditivo: no toca alumnas/leads/pagos ni el flujo actual.
// ──────────────────────────────────────────────────────────────

const TIPOS = [
  { id: 'formacion', label: 'Formación', hint: 'Programa intensivo con certificación' },
  { id: 'taller',    label: 'Taller',    hint: 'Sesión o pocas sesiones sobre un tema' },
  { id: 'retiro',    label: 'Retiro',    hint: 'Experiencia inmersiva de varios días' },
  { id: 'intensivo', label: 'Intensivo', hint: 'Bloque concentrado de práctica' },
  { id: 'programa',  label: 'Programa continuo', hint: 'Clases recurrentes con membresía' },
  { id: 'clases',    label: 'Clases sueltas', hint: 'Clases ad-hoc o por paquete' },
  { id: 'otro',      label: 'Otro',      hint: 'Algo distinto' },
];

const RECURRENTE = new Set(['programa', 'clases']);

// ── Campo de entrada con etiqueta ──
const Field = ({ label, children, hint }) => (
  <label style={{ display: 'block', marginBottom: 18 }}>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{label}</div>
    {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginBottom: 8 }}>{hint}</div>}
    {children}
  </label>
);

const inputStyle = {
  width: '100%', padding: '11px 13px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
  background: 'var(--surface)', color: 'var(--ink)',
  fontFamily: 'inherit', outline: 'none',
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '8px 13px', fontSize: 13, borderRadius: 999, cursor: 'pointer',
      border: '1px solid ' + (active ? 'var(--terracota)' : 'var(--line)'),
      background: active ? 'var(--terracota)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--ink-soft)',
      fontWeight: active ? 600 : 400,
    }}
  >
    {children}
  </button>
);

// ── Cálculo del "camino a seguir" ──
function construirPlan(d) {
  const recurrente = RECURRENTE.has(d.tipo);
  const cupos = parseInt(d.cupos, 10) || 0;
  const precio = parseFloat(d.precioBase) || 0;
  const varias = (parseInt(d.sesiones, 10) || 1) > 1 || d.frecuencia === 'recurrente';

  const modulos = [];
  const add = (nombre, motivo) => modulos.push({ nombre, motivo });

  add('Inscritos / participantes', 'Para registrar a quién se apunta y su estado.');
  add('Pagos', precio > 0 ? `Cobros del proyecto (base $${precio}).` : 'Para registrar aportes aunque sea por confirmar.');

  if (recurrente) {
    add('Membresías y asistencia continua', 'Es recurrente: conviene el modelo del módulo Estudio (planes + asistencia por clase).');
  } else {
    add('Asistencia por encuentro', varias ? 'Tiene varios encuentros: control de asistencia por día.' : 'Aunque sea puntual, deja constancia de quién asistió.');
  }

  add('Leads / difusión', 'Para captar interesados y darles seguimiento por WhatsApp/Instagram.');

  if (precio > 0) add('Comprobantes de pago', 'Recibir y validar transferencias.');
  if (cupos > 1) add('Inscripción pública (link)', `Cupos limitados (${cupos}): un link de inscripción ayuda a llenar y controlar el aforo.`);
  if (precio >= 200) add('Plan de pagos', 'El precio permite ofrecer pagos en cuotas / pronto pago.');

  const pasos = [
    'Validar este alcance con Juan Cristóbal.',
    recurrente
      ? 'Reutilizar el módulo Estudio (membresías) como base.'
      : 'Clonar el patrón de la formación (cohorte con inscritos) como base.',
    'Definir precios y fechas finales.',
    cupos > 1 ? 'Preparar el link de inscripción pública.' : 'Definir cómo se confirma cada cupo.',
    'Activar el proyecto en el home cuando esté listo.',
  ];

  return { recurrente, modulos, pasos };
}

const ProyectoWizard = ({ onClose }) => {
  const Icon = window.Icon;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [d, setD] = useState({
    nombre: '', descripcion: '', tipo: '',
    frecuencia: '', sesiones: '', duracion: '', fechas: '',
    modalidad: '', ubicacion: '', cupos: '',
    publico: '', nivel: '',
    precioBase: '', tiers: '',
  });
  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));

  const plan = useMemo(() => construirPlan(d), [d]);

  const STEPS = ['¿Qué es?', 'Formato', 'Lugar y cupos', 'Público', 'Precio', 'Tu camino'];
  const last = STEPS.length - 1;
  const puedeAvanzar = step === 0 ? (d.nombre.trim() && d.tipo) : true;

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email || (ALLOWED_EMAILS[0] || null);
      const { error: err } = await supabase.from('proyectos_borradores').insert({
        nombre: d.nombre.trim() || 'Proyecto sin nombre',
        tipo: d.tipo || null,
        estado: 'borrador',
        descripcion: d.descripcion || null,
        scope: {
          frecuencia: d.frecuencia, sesiones: d.sesiones, duracion: d.duracion, fechas: d.fechas,
          modalidad: d.modalidad, ubicacion: d.ubicacion, cupos: d.cupos,
          publico: d.publico, nivel: d.nivel,
          precioBase: d.precioBase, tiers: d.tiers,
        },
        plan: plan,
        creado_por: email,
      });
      if (err) throw err;
      setSaved(true);
    } catch (e) {
      console.error('[wizard] guardar', e);
      setError(e.message || 'No se pudo guardar. Revisa tu conexión.');
    } finally {
      setSaving(false);
    }
  }

  // ── Pantalla de éxito ──
  if (saved) {
    return (
      <div className="app-scroll fade-in" style={{ padding: '64px 22px 40px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
          background: 'var(--oliva-soft)', color: 'var(--oliva)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon ? <Icon name="check" size={30} strokeWidth={2} /> : '✓'}
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, margin: '0 0 8px', color: 'var(--ink)' }}>
          Guardado
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 300, margin: '0 auto 28px' }}>
          El borrador de <strong>{d.nombre || 'tu proyecto'}</strong> quedó registrado. Juan Cristóbal ya lo puede ver y empezar a estructurarlo.
        </p>
        <button className="btn btn-primary btn-block" onClick={onClose} style={{ maxWidth: 280, margin: '0 auto' }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="app-scroll fade-in" style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ padding: '52px 22px 0' }}>
        <button
          onClick={onClose}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14 }}
        >
          {Icon ? <Icon name="chevronL" size={16} /> : '‹'} Inicio
        </button>

        {/* Progreso */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i <= step ? 'var(--terracota)' : 'var(--line)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>
          Paso {step + 1} de {STEPS.length}
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, lineHeight: 1.05, margin: '0 0 20px', color: 'var(--ink)', fontWeight: 600 }}>
          {STEPS[step]}
        </h1>
      </div>

      <div style={{ padding: '0 22px 32px' }}>
        {/* Paso 0 · Qué es */}
        {step === 0 && (
          <>
            <Field label="Nombre del proyecto">
              <input style={inputStyle} value={d.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Retiro de Luna Llena" />
            </Field>
            <Field label="¿Qué es? Descríbelo en tus palabras">
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={d.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="¿De qué trata? ¿Qué viven las personas?" />
            </Field>
            <Field label="Tipo de proyecto">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TIPOS.map(t => (
                  <Chip key={t.id} active={d.tipo === t.id} onClick={() => set('tipo', t.id)}>{t.label}</Chip>
                ))}
              </div>
              {d.tipo && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 8 }}>
                  {TIPOS.find(t => t.id === d.tipo)?.hint}
                </div>
              )}
            </Field>
          </>
        )}

        {/* Paso 1 · Formato */}
        {step === 1 && (
          <>
            <Field label="¿Con qué frecuencia se realiza?">
              <div style={{ display: 'flex', gap: 8 }}>
                <Chip active={d.frecuencia === 'puntual'} onClick={() => set('frecuencia', 'puntual')}>Puntual (una vez)</Chip>
                <Chip active={d.frecuencia === 'recurrente'} onClick={() => set('frecuencia', 'recurrente')}>Recurrente</Chip>
              </div>
            </Field>
            <Field label="¿Cuántas sesiones / encuentros?">
              <input style={inputStyle} type="number" inputMode="numeric" value={d.sesiones} onChange={e => set('sesiones', e.target.value)} placeholder="Ej: 6" />
            </Field>
            <Field label="Duración total" hint="Horas, días o semanas">
              <input style={inputStyle} value={d.duracion} onChange={e => set('duracion', e.target.value)} placeholder="Ej: 50 horas en 3 fines de semana" />
            </Field>
            <Field label="Fechas tentativas">
              <input style={inputStyle} value={d.fechas} onChange={e => set('fechas', e.target.value)} placeholder="Ej: octubre 2026" />
            </Field>
          </>
        )}

        {/* Paso 2 · Lugar y cupos */}
        {step === 2 && (
          <>
            <Field label="Modalidad">
              <div style={{ display: 'flex', gap: 8 }}>
                <Chip active={d.modalidad === 'presencial'} onClick={() => set('modalidad', 'presencial')}>Presencial</Chip>
                <Chip active={d.modalidad === 'online'} onClick={() => set('modalidad', 'online')}>Online</Chip>
                <Chip active={d.modalidad === 'hibrido'} onClick={() => set('modalidad', 'hibrido')}>Híbrido</Chip>
              </div>
            </Field>
            <Field label="¿Dónde será?">
              <input style={inputStyle} value={d.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Ej: Domo Soulspace, Tumbaco" />
            </Field>
            <Field label="¿Para cuántas personas? (cupos)">
              <input style={inputStyle} type="number" inputMode="numeric" value={d.cupos} onChange={e => set('cupos', e.target.value)} placeholder="Ej: 25" />
            </Field>
          </>
        )}

        {/* Paso 3 · Público */}
        {step === 3 && (
          <>
            <Field label="¿A quién está dirigida?">
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={d.publico} onChange={e => set('publico', e.target.value)} placeholder="Ej: practicantes que quieren enseñar, principiantes curiosos, profes que buscan profundizar…" />
            </Field>
            <Field label="Nivel">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Todos', 'Principiante', 'Intermedio', 'Avanzado', 'Profes'].map(n => (
                  <Chip key={n} active={d.nivel === n} onClick={() => set('nivel', n)}>{n}</Chip>
                ))}
              </div>
            </Field>
          </>
        )}

        {/* Paso 4 · Precio */}
        {step === 4 && (
          <>
            <Field label="Precio base" hint="El valor regular por persona, en USD">
              <input style={inputStyle} type="number" inputMode="decimal" value={d.precioBase} onChange={e => set('precioBase', e.target.value)} placeholder="Ej: 640" />
            </Field>
            <Field label="¿Modalidades de precio?" hint="Opcional: pronto pago, reserva, paquetes, becas…">
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={d.tiers} onChange={e => set('tiers', e.target.value)} placeholder="Ej: pronto pago $484, reserva $200" />
            </Field>
          </>
        )}

        {/* Paso 5 · Resumen + camino */}
        {step === 5 && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>Resumen</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>
                {d.nombre || 'Proyecto sin nombre'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {[
                  TIPOS.find(t => t.id === d.tipo)?.label,
                  d.cupos && `${d.cupos} cupos`,
                  d.modalidad,
                  d.ubicacion,
                  d.precioBase && `$${d.precioBase}`,
                ].filter(Boolean).join(' · ') || 'Sin detalles aún'}
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Camino a seguir</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 0, marginBottom: 12 }}>
              Según lo que definiste, este proyecto necesitaría:
            </p>

            {plan.modulos.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: 'var(--oliva-soft)', color: 'var(--oliva)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {Icon ? <Icon name="check" size={12} strokeWidth={2.4} /> : '✓'}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{m.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{m.motivo}</div>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '20px 0 8px' }}>Próximos pasos</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.6 }}>
              {plan.pasos.map((p, i) => <li key={i}>{p}</li>)}
            </ol>

            {error && (
              <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--terracota-tint)', color: 'var(--rojo)', fontSize: 12.5 }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra de navegación */}
      <div style={{ position: 'sticky', bottom: 0, padding: '14px 22px calc(14px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 70%, transparent)', display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ flex: '0 0 auto' }}>
            Atrás
          </button>
        )}
        {step < last && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => puedeAvanzar && setStep(s => s + 1)}
            disabled={!puedeAvanzar}
            style={{ flex: 1, opacity: puedeAvanzar ? 1 : 0.5 }}
          >
            Continuar
          </button>
        )}
        {step === last && (
          <button className="btn btn-primary btn-block" onClick={guardar} disabled={saving} style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
        )}
      </div>
    </div>
  );
};

window.ProyectoWizard = ProyectoWizard;
export { ProyectoWizard };
