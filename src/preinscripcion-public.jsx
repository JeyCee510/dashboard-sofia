import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect } = React;

// ──────────────────────────────────────────
// Preinscripción pública — accesible vía /preinscripcion/<token> SIN login.
// El cliente llena el form y se guarda vinculado al lead.
// ──────────────────────────────────────────

const PREGUNTAS = [
  {
    id: 'edad',
    label: '¿Cuántos años tienes?',
    type: 'number',
    required: true,
    placeholder: '32',
  },
  {
    id: 'ciudad',
    label: '¿En qué parte de la ciudad vives?',
    type: 'text',
    required: true,
    placeholder: 'Ej. Cumbayá, La Floresta, Tumbaco…',
  },
  {
    id: 'practica_yoga',
    label: '¿Practicas yoga actualmente?',
    type: 'chips',
    required: true,
    options: [
      'Sí, tomo clases',
      'Sí, tengo práctica regular',
      'Practico de repente y no estoy tomando clases',
    ],
  },
  {
    id: 'tiempo_practica',
    label: '¿Hace cuánto practicas?',
    type: 'textarea',
    required: false,
    placeholder: 'Cuéntame tu historia con la práctica',
  },
  {
    id: 'estilos',
    label: '¿Qué estilos has practicado?',
    type: 'textarea',
    required: false,
    placeholder: 'Hatha, vinyasa, restaurativo, etc.',
  },
  {
    id: 'formaciones',
    label: '¿Qué formaciones de yoga has hecho?',
    type: 'textarea',
    required: false,
    placeholder: 'Nombre de la formación, escuela, año, horas. Déjalo en blanco si no has hecho ninguna.',
  },
  {
    id: 'enseñado_antes',
    label: '¿Has enseñado yoga antes (formal o informalmente)?',
    type: 'chips',
    required: true,
    options: [
      'Sí, profesionalmente',
      'Sí, a amigos/familia',
      'No, todavía no me animo',
    ],
  },
  {
    id: 'donde_ensena',
    label: 'Si das clases, ¿dónde?',
    type: 'textarea',
    required: false,
    placeholder: 'Estudio, centro, online, casa, etc. Déjalo en blanco si no aplica.',
  },
  {
    id: 'motivacion',
    label: '¿Por qué te interesa esta formación de 50h?',
    type: 'textarea',
    required: true,
    placeholder: 'Lo que te mueve, qué buscas, qué esperas vivir...',
  },
  {
    id: 'lesiones',
    label: 'Lesiones, afecciones físicas o psicológicas',
    type: 'textarea',
    required: false,
    placeholder: 'Cualquier condición de la que debería estar al tanto para poder acompañarte en este proceso. Déjalo en blanco si no aplica.',
  },
  {
    id: 'alergias',
    label: 'Alergias',
    type: 'textarea',
    required: false,
    placeholder: 'Alimenticias, ambientales, medicamentos…',
  },
  {
    id: 'contacto_emergencia',
    label: 'Contacto de emergencia',
    type: 'textarea',
    required: true,
    placeholder: 'Nombre, parentesco y número de teléfono',
  },
  {
    id: 'expectativas',
    label: '¿Qué te gustaría llevarte de esta experiencia?',
    type: 'textarea',
    required: false,
    placeholder: 'Tu intención personal',
  },
  {
    id: 'algo_mas',
    label: '¿Algo más que Sofía deba saber sobre ti?',
    type: 'textarea',
    required: false,
    placeholder: 'Opcional',
  },
];

export const PreinscripcionPublic = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('obtener_preinscripcion', { p_token: token });
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError('Link inválido o expirado.');
      } else {
        setMeta(data);
        if (data.estado === 'completada') setSubmitted(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const set = (id, val) => setRespuestas(r => ({ ...r, [id]: val }));

  const submit = async () => {
    // Validar requeridos
    for (const p of PREGUNTAS) {
      if (p.required && !respuestas[p.id]) {
        setError(`Falta responder: ${p.label}`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.rpc('enviar_preinscripcion', {
      p_token: token,
      p_data: respuestas,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data && data.error) {
      setError(data.error);
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', padding: 60 }}>
          Cargando…
        </div>
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 32, color: 'var(--terracota)' }}>Hmm</div>
          <p style={{ color: 'var(--ink-soft)', marginTop: 14 }}>{error}</p>
          <p style={{ color: 'var(--ink-mute)', fontSize: 13, marginTop: 8 }}>Pídele a Sofía un nuevo link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>🌿</div>
          <h1 className="serif" style={{ fontSize: 32, marginTop: 18, color: 'var(--ink)' }}>
            Recibido, gracias.
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 14, lineHeight: 1.5 }}>
            Sofía revisará tus respuestas y te escribirá pronto para los próximos pasos.
          </p>
          <p style={{ color: 'var(--ink-mute)', fontSize: 13, marginTop: 22, fontStyle: 'italic' }}>
            Puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ padding: '32px 24px 100px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="serif" style={{ fontSize: 44, color: 'var(--terracota)', fontWeight: 500 }}>S</div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginTop: 8 }}>
            Yoga Sofía Lira
          </div>
          <h1 className="serif" style={{ fontSize: 30, marginTop: 18, fontWeight: 500, lineHeight: 1.15 }}>
            Hola{meta?.lead_nombre ? ` ${meta.lead_nombre.split(' ')[0]}` : ''},<br/>
            <em style={{ color: 'var(--terracota-soft)' }}>cuéntame de ti</em>
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 14, fontSize: 14, lineHeight: 1.55 }}>
            Esta preinscripción me ayuda a conocerte antes de que empecemos juntos. Toma 5 minutos y todo es opcional excepto lo marcado con <span style={{ color: 'var(--terracota)' }}>*</span>.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {PREGUNTAS.map(p => (
            <FieldPublic key={p.id} pregunta={p} value={respuestas[p.id]} onChange={v => set(p.id, v)} />
          ))}
        </div>

        {error && (
          <div style={{
            marginTop: 22, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(181, 86, 58, 0.10)', border: '1px solid rgba(181, 86, 58, 0.3)',
            color: 'var(--terracota)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            marginTop: 28, width: '100%',
            background: 'var(--terracota)', color: '#FBF7F0',
            border: 'none', borderRadius: 999, padding: '16px 18px',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Enviando…' : 'Enviar preinscripción'}
        </button>
      </div>
    </div>
  );
};

const FieldPublic = ({ pregunta: p, value, onChange }) => (
  <div>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
      {p.label}
      {p.required && <span style={{ color: 'var(--terracota)', marginLeft: 4 }}>*</span>}
    </label>
    {p.type === 'textarea' ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={p.placeholder}
        rows={3}
        style={inputStyle}
      />
    ) : p.type === 'chips' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {p.options.map(opt => (
          <button
            key={opt} type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '9px 14px', borderRadius: 999,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              background: value === opt ? 'var(--ink)' : 'var(--surface)',
              color: value === opt ? 'var(--bg)' : 'var(--ink-soft)',
              border: value === opt ? '1px solid transparent' : '1px solid var(--line-soft)',
            }}
          >{opt}</button>
        ))}
      </div>
    ) : (
      <input
        type={p.type === 'number' ? 'number' : 'text'}
        value={value || ''}
        onChange={e => onChange(p.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)}
        placeholder={p.placeholder}
        style={inputStyle}
      />
    )}
  </div>
);

const containerStyle = {
  minHeight: '100vh',
  background: '#FBF7F0',
  color: 'var(--ink)',
  fontFamily: 'Inter Tight, -apple-system, system-ui, sans-serif',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--line-soft)',
  borderRadius: 12,
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
};

window.PreinscripcionPublic = PreinscripcionPublic;
