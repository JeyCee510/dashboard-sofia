import React from 'react';
import { supabase } from './lib/supabase.js';
import { cleanPhone, cleanInstagram, buildWaUrl, buildIgUrl } from './lib/wa.js';
import { useComprobanteToken } from './hooks/useComprobanteToken.js';
import { usePreinscripcion } from './hooks/usePreinscripcion.js';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Modal / Sheet primitives + form fields
// ──────────────────────────────────────────

const Sheet = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(42, 33, 26, 0.42)',
        animation: 'fadeIn 0.18s ease both',
      }} />
      <div style={{ flex: 1 }} />
      <div style={{
        position: 'relative',
        background: 'var(--bg)',
        borderRadius: '28px 28px 0 0',
        maxHeight: '88%',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.05) both',
        willChange: 'transform',
      }}>
        <div style={{
          padding: '10px 0 0',
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)' }} />
        </div>
        <div style={{
          padding: '14px 22px 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--line-soft)',
          paddingBottom: 14,
        }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{title}</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-warm)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Icon name="x" size={16} stroke="var(--ink-soft)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 24px' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: '12px 22px 30px',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--bg)',
          }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

const Field = ({ label, children, hint }) => (
  <label style={{ display: 'block', marginBottom: 14 }}>
    <div style={{
      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--ink-mute)', fontWeight: 500, marginBottom: 6,
    }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4, fontStyle: 'italic' }}>{hint}</div>}
  </label>
);

const TextInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%',
      background: 'var(--surface)',
      border: '1px solid var(--line-soft)',
      borderRadius: 12,
      padding: '12px 14px',
      fontFamily: 'inherit',
      fontSize: 14,
      color: 'var(--ink)',
      outline: 'none',
    }}
    onFocus={e => e.target.style.borderColor = 'var(--terracota)'}
    onBlur={e => e.target.style.borderColor = 'var(--line-soft)'}
  />
);

// ──────────────────────────────────────────
// InstaInput — @ fijo a la izquierda. El user solo escribe el handle.
// Sanitiza si pegan @usuario, https://instagram.com/usuario, espacios, etc.
// El value persistido es SIN @.
// ──────────────────────────────────────────
const InstaInput = ({ value, onChange, placeholder = 'usuario' }) => {
  // Limpia lo que el user pegue / escriba
  const sanitize = (raw) => {
    if (!raw) return '';
    let s = String(raw).trim();
    s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
    s = s.replace(/^@+/, '');           // remueve @s al inicio
    s = s.split(/[/?#\s]/)[0];          // remueve path y espacios
    return s;
  };
  return (
    <div
      style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 12, overflow: 'hidden',
      }}
    >
      <span style={{
        padding: '12px 0 12px 14px', color: 'var(--ink-mute)',
        fontSize: 14, userSelect: 'none', fontFamily: 'inherit',
      }}>@</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(sanitize(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const txt = e.clipboardData.getData('text');
          onChange(sanitize(txt));
        }}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none',
          padding: '12px 14px 12px 4px', fontFamily: 'inherit', fontSize: 14,
          color: 'var(--ink)', outline: 'none',
        }}
      />
    </div>
  );
};

// ──────────────────────────────────────────
// TelInput — Prefijo "+" fijo, el resto se escribe libre.
// El value persistido es "+" seguido de lo que escribió Sofía
// (ej "+593 99 234 5678"). Sin toggle internacional.
// ──────────────────────────────────────────
const TelInput = ({ value, onChange, placeholder = 'código país + número' }) => {
  // Lo que mostramos: lo que viene después del primer "+". Si no hay "+",
  // mostramos el value tal cual.
  const display = React.useMemo(() => {
    if (!value) return '';
    return value.startsWith('+') ? value.slice(1) : value;
  }, [value]);

  const onTyped = (raw) => {
    // Persistimos siempre con "+" al inicio. Si Sofía borra todo, value = ''.
    const trimmed = raw.replace(/^\++/, ''); // por si pegó "+593" — quitamos los + redundantes
    onChange(trimmed ? `+${trimmed}` : '');
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 12, overflow: 'hidden',
      }}
    >
      <span style={{
        padding: '12px 0 12px 14px', color: 'var(--ink-mute)',
        fontSize: 14, userSelect: 'none', fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}>+</span>
      <input
        type="tel"
        inputMode="tel"
        value={display}
        onChange={(e) => onTyped(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none',
          padding: '12px 14px 12px 6px',
          fontFamily: 'inherit', fontSize: 14,
          color: 'var(--ink)', outline: 'none',
        }}
      />
    </div>
  );
};

const TextArea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: '100%',
      background: 'var(--surface)',
      border: '1px solid var(--line-soft)',
      borderRadius: 12,
      padding: '12px 14px',
      fontFamily: 'inherit',
      fontSize: 14,
      color: 'var(--ink)',
      outline: 'none',
      resize: 'vertical',
      lineHeight: 1.4,
    }}
  />
);

const NumberInput = ({ value, onChange, prefix, suffix, min, max }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--line-soft)',
    borderRadius: 12,
    padding: '0 14px',
  }}>
    {prefix && <span style={{ color: 'var(--ink-mute)', fontSize: 14, marginRight: 4 }}>{prefix}</span>}
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      min={min} max={max}
      style={{
        flex: 1, border: 'none', outline: 'none', background: 'transparent',
        padding: '12px 0', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)',
      }}
    />
    {suffix && <span style={{ color: 'var(--ink-mute)', fontSize: 13, marginLeft: 4 }}>{suffix}</span>}
  </div>
);

const SelectChips = ({ value, onChange, options }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {options.map(opt => {
      const v = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      const isActive = value === v;
      return (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            background: isActive ? 'var(--ink)' : 'var(--surface)',
            color: isActive ? 'var(--bg)' : 'var(--ink-soft)',
            padding: '8px 14px',
            borderRadius: 999,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            border: isActive ? '1px solid transparent' : '1px solid var(--line-soft)',
          }}
        >{label}</button>
      );
    })}
  </div>
);

const SwitchToggle = ({ value, onChange, label, hint }) => (
  <div onClick={() => onChange(!value)} style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    background: 'var(--surface)',
    border: '1px solid var(--line-soft)',
    borderRadius: 12,
    cursor: 'pointer',
    marginBottom: 14,
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{hint}</div>}
    </div>
    <div style={{
      width: 44, height: 26, borderRadius: 999,
      background: value ? 'var(--oliva)' : 'var(--line)',
      position: 'relative',
      transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute',
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff', top: 2, left: value ? 20 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  </div>
);

window.Sheet = Sheet;
window.Field = Field;
// ──────────────────────────────────────────
// ContactPanel — botones WhatsApp + Instagram + Plantillas
// ──────────────────────────────────────────

// Helpers WhatsApp/IG centralizados en src/lib/wa.js (antes vivían acá).

// Instagram NO soporta texto pre-cargado en deep link (limitación de Meta).
// Workaround: copiar el mensaje al clipboard ANTES de abrir IG, para que
// Sofía pegue manualmente con un toque.
async function copyAndOpenIg(handle, mensaje) {
  const url = buildIgUrl(handle);
  if (!url) return false;
  try {
    if (mensaje) {
      await navigator.clipboard.writeText(mensaje);
    }
  } catch (e) {
    // Fallback con textarea
    if (mensaje) {
      const ta = document.createElement('textarea');
      ta.value = mensaje;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
  }
  window.open(url, '_blank');
  return true;
}

const ContactPanel = ({ tel, instagram, plantillas, nombre }) => {
  const [showPlantillas, setShowPlantillas] = React.useState(false);
  const [igCopiado, setIgCopiado] = React.useState(false);
  const waUrl = buildWaUrl(tel);
  const igUrl = buildIgUrl(instagram);
  const firstName = (nombre || '').split(' ')[0] || '';

  const onIgClick = async (e) => {
    e.preventDefault();
    // Mensaje genérico copiado para que Sofía solo pegue al abrir IG
    const msg = firstName
      ? `Hola ${firstName}! Te escribo de Sofía Lira Yoga 🌿`
      : 'Hola! Te escribo de Sofía Lira Yoga 🌿';
    await copyAndOpenIg(instagram, msg);
    setIgCopiado(true);
    setTimeout(() => setIgCopiado(false), 2500);
  };

  // Personaliza la plantilla con el primer nombre si aplica.
  // Si la plantilla tiene imagen_url, la anexa al final del cuerpo para
  // que WhatsApp/Instagram muestren preview de la imagen automáticamente.
  const personalizar = (plantilla) => {
    const cuerpo = typeof plantilla === 'string' ? plantilla : plantilla?.cuerpo || '';
    const imagenUrl = typeof plantilla === 'object' ? plantilla?.imagen_url : null;
    let texto = cuerpo;
    if (firstName) {
      texto = texto.replace(/^Hola!?,?/i, `Hola ${firstName}!`);
    }
    if (imagenUrl) texto = `${texto}\n\n${imagenUrl}`;
    return texto;
  };

  if (!tel && !instagram) {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-warm)', border: '1px dashed var(--line-soft)',
        fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center',
      }}>
        Sin contacto. Agrega teléfono o Instagram para escribirle.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {waUrl && (
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 12,
              background: '#25D366', color: '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Icon name="whatsapp" size={16} stroke="#fff" />
            WhatsApp
          </a>
        )}
        {igUrl && (
          <a
            href={igUrl} target="_blank" rel="noopener noreferrer"
            onClick={onIgClick}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 12,
              background: 'linear-gradient(45deg, #F09433, #E6683C, #DC2743, #CC2366, #BC1888)',
              color: '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            <Icon name="instagram" size={16} stroke="#fff" />
            Instagram
          </a>
        )}
      </div>
      {igCopiado && (
        <div style={{
          padding: '8px 12px', borderRadius: 10, background: 'rgba(220, 39, 67, 0.1)',
          border: '1px solid rgba(220, 39, 67, 0.25)', fontSize: 11, color: '#BC1888',
          textAlign: 'center', lineHeight: 1.4,
        }}>
          📋 Mensaje copiado. Cuando se abra Instagram, pega con tocar y mantener.
        </div>
      )}

      {(waUrl || igUrl) && plantillas && plantillas.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPlantillas(s => !s)}
            style={{
              padding: '10px 14px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--line-soft)',
              fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="note" size={14} stroke="var(--terracota)" />
              Enviar plantilla
            </span>
            <Icon name="chevronD" size={14} stroke="var(--ink-mute)" />
          </button>
          {showPlantillas && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 6 }}>
              {plantillas.map(p => {
                // Pasamos el objeto completo para que personalizar() pueda
                // anexar la imagen_url si la plantilla la tiene.
                const personalizado = personalizar(p);
                const waPlantillaUrl = buildWaUrl(tel, personalizado);
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink)' }}>{p.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {personalizado}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {waPlantillaUrl && (
                        <a href={waPlantillaUrl} target="_blank" rel="noopener noreferrer"
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8,
                            background: '#25D366', color: '#fff',
                            fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                            textDecoration: 'none', textAlign: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}>
                          <Icon name="whatsapp" size={11} stroke="#fff" />
                          WhatsApp
                        </a>
                      )}
                      {igUrl && (
                        <button
                          type="button"
                          onClick={async () => {
                            await copyAndOpenIg(instagram, personalizado);
                            setIgCopiado(true);
                            setTimeout(() => setIgCopiado(false), 2500);
                          }}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8,
                            background: 'linear-gradient(45deg, #F09433, #E6683C, #DC2743, #CC2366, #BC1888)',
                            color: '#fff', border: 'none',
                            fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}>
                          <Icon name="instagram" size={11} stroke="#fff" />
                          Instagram
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ──────────────────────────────────────────
// PreinscripcionAdminPanel — para Sofía dentro de LeadForm/FichaAlumna
// ──────────────────────────────────────────

const PREGUNTAS_LABELS = {
  edad: 'Edad',
  ciudad: 'Zona / barrio',
  practica_yoga: '¿Practica yoga actualmente?',
  tiempo_practica: 'Hace cuánto practica',
  estilos: 'Estilos practicados',
  formaciones: 'Formaciones previas',
  'enseñado_antes': '¿Ha enseñado yoga antes?',
  donde_ensena: 'Dónde da clases',
  motivacion: 'Motivación',
  lesiones: 'Lesiones / afecciones físicas o psicológicas',
  alergias: 'Alergias',
  contacto_emergencia: 'Contacto de emergencia',
  expectativas: 'Expectativas',
  algo_mas: 'Algo más',
};

const PreinscripcionAdminPanel = ({ leadId, alumnaId, leadNombre, leadTel, plantillas }) => {
  const { pre, loading, generar } = usePreinscripcion(leadId || null, alumnaId || null);
  const [link, setLink] = React.useState('');
  const [copiado, setCopiado] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  // Default colapsado: el formulario completo es largo (14 preguntas).
  // Click en el header expande/contrae.
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (pre?.token) setLink(`${window.location.origin}/preinscripcion/${pre.token}`);
  }, [pre]);

  const onGenerar = async () => {
    setGenerando(true);
    const token = await generar();
    setGenerando(false);
    if (token) setLink(`${window.location.origin}/preinscripcion/${token}`);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };

  // Plantilla automática para enviar el link por WhatsApp
  const mensajeWa = `Hola ${(leadNombre || '').split(' ')[0]}! Para conocernos un poco antes de empezar la formación, te paso una preinscripción rápida (5 min):\n\n${link}\n\nCualquier duda, por aquí 🌿`;
  const waUrl = leadTel && link ? buildWaUrl(leadTel, mensajeWa) : null;

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: 8 }}>Cargando preinscripción…</div>;
  }

  // Caso: alumna ya inscrita pero sin preinscripción registrada → solo info
  if (!pre && alumnaId && !leadId) {
    return (
      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-warm)', border: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic', lineHeight: 1.4 }}>
          Sin preinscripción registrada para esta persona.
        </div>
      </div>
    );
  }

  if (!pre) {
    return (
      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-warm)', border: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.4 }}>
          Genera un link único de preinscripción. El cliente lo abre sin cuenta y llena un formulario que queda vinculado a su ficha.
        </div>
        <button
          type="button" onClick={onGenerar} disabled={generando}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'var(--terracota)', color: '#fff', border: 'none',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            opacity: generando ? 0.6 : 1,
          }}
        >
          {generando ? 'Generando…' : 'Generar link de preinscripción'}
        </button>
      </div>
    );
  }

  if (pre.estado === 'completada') {
    const data = pre.data || {};
    const respuestasCount = Object.entries(PREGUNTAS_LABELS).filter(([k]) => data[k]).length;
    return (
      <div style={{ padding: expanded ? 14 : '12px 14px', borderRadius: 12, background: '#DDE0CC', border: '1px solid transparent' }}>
        <button
          type="button"
          onClick={() => setExpanded(s => !s)}
          style={{
            width: '100%', background: 'transparent', border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4D5230', fontWeight: 600 }}>
            ✓ Preinscripción · {respuestasCount} {respuestasCount === 1 ? 'respuesta' : 'respuestas'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#4D5230' }}>
              {pre.completed_at ? new Date(pre.completed_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : ''}
            </span>
            <span style={{ fontSize: 11, color: '#4D5230', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▾
            </span>
          </div>
        </button>
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {Object.entries(PREGUNTAS_LABELS).map(([k, label]) => {
              const v = data[k];
              if (!v) return null;
              return (
                <div key={k} style={{ paddingTop: 8, borderTop: '1px solid rgba(77,82,48,0.15)' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4D5230', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{v}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Pendiente — mostrar link y compartir
  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'var(--terracota-tint)', border: '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A3D26', fontWeight: 600 }}>
          Preinscripción pendiente
        </div>
        <div style={{ fontSize: 11, color: '#8A3D26' }}>
          {pre.created_at ? new Date(pre.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : ''}
        </div>
      </div>
      <div style={{
        background: 'var(--surface)', padding: '8px 12px', borderRadius: 8,
        fontSize: 11, color: 'var(--ink)', wordBreak: 'break-all',
        fontFamily: 'monospace',
      }}>
        {link}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          type="button" onClick={copiar}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 10,
            background: copiado ? 'var(--oliva)' : 'var(--surface)',
            color: copiado ? '#fff' : 'var(--ink)',
            border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {copiado ? 'Copiado ✓' : 'Copiar link'}
        </button>
        {waUrl && (
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: '#25D366', color: '#fff',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            Enviar por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// ComprobanteTokenAdminPanel — botón para generar el link único de
// comprobantes para esta persona, copiarlo o mandarlo por WhatsApp.
// ──────────────────────────────────────────
const ComprobanteTokenAdminPanel = ({ leadId, alumnaId, nombre, tel }) => {
  const { token, loading, generar } = useComprobanteToken({ leadId, alumnaId });
  const [link, setLink] = React.useState('');
  const [copiado, setCopiado] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  const triedRef = React.useRef(false);

  // Subida manual por Sofía: caso cuando la persona manda el comprobante
  // por WA/IG y no usa el link. Inserta directo a comprobantes_pago en
  // estado 'pendiente' para que Sofía lo valide después como cualquier otro.
  const fileRefManual = React.useRef(null);
  const [subiendoManual, setSubiendoManual] = React.useState(false);
  const [errorManual, setErrorManual] = React.useState('');
  const [okManual, setOkManual] = React.useState(false);

  const subirManual = async (file) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setErrorManual('El archivo supera los 12 MB.');
      return;
    }
    setSubiendoManual(true);
    setErrorManual('');
    setOkManual(false);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      // path único — random + timestamp
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('comprobantes')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      // Insert directo (admin tiene RLS FOR ALL)
      const insertRow = {
        nombre_cliente: nombre || 'Sin nombre',
        contacto: tel || '',
        storage_path: path,
        archivo_nombre: file.name,
        archivo_tipo: file.type,
        estado: 'pendiente',
      };
      if (alumnaId) insertRow.alumna_id = alumnaId;
      if (leadId) insertRow.lead_id = leadId;
      const { error: insErr } = await supabase.from('comprobantes_pago').insert(insertRow);
      if (insErr) throw insErr;
      setOkManual(true);
      setTimeout(() => setOkManual(false), 3000);
    } catch (e) {
      console.error('[comprobante manual]', e);
      setErrorManual(e.message || 'Error al subir el archivo.');
    } finally {
      setSubiendoManual(false);
    }
  };

  React.useEffect(() => {
    if (token) setLink(`${window.location.origin}/comprobante/${token}`);
    else setLink('');
  }, [token]);

  // Auto-generar el token la primera vez que se carga el panel sin uno existente
  React.useEffect(() => {
    if (loading || token || triedRef.current) return;
    if (!leadId && !alumnaId) return;
    triedRef.current = true;
    setGenerando(true);
    generar().then(t => {
      if (t) setLink(`${window.location.origin}/comprobante/${t}`);
      setGenerando(false);
    }).catch(() => setGenerando(false));
  }, [loading, token, leadId, alumnaId, generar]);

  const onGenerar = async () => {
    setGenerando(true);
    const t = await generar();
    setGenerando(false);
    if (t) setLink(`${window.location.origin}/comprobante/${t}`);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };

  const firstName = (nombre || '').split(' ')[0];
  // Mensaje 2-en-1: datos de transferencia + link personal de comprobantes.
  // Sofía manda esto y el cliente tiene todo lo que necesita para pagar y registrar el comprobante.
  const mensajeWa =
`Hola ${firstName}! Te paso los datos para tu pago:

📌 Transferencia a:
Sofía Lira
Produbanco Ahorro #12054049429
Cédula #1709369225
sofilira@gmail.com

📎 Cuando tengas el comprobante, súbelo en tu link personal:
${link}

Es seguro, sólo Sofía lo ve. Puedes subir varios si haces más de un pago 🌿`;
  const waUrl = tel && link ? buildWaUrl(tel, mensajeWa) : null;

  if (loading || (!token && generando)) {
    return (
      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-warm)', border: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center' }}>
        Preparando link de comprobantes…
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-warm)', border: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.4 }}>
          Link personal para que esta persona suba sus comprobantes.
        </div>
        <button
          type="button" onClick={onGenerar} disabled={generando}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'var(--terracota)', color: '#fff', border: 'none',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            opacity: generando ? 0.6 : 1,
          }}
        >
          {generando ? 'Generando…' : 'Reintentar'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 14, borderRadius: 12, background: '#F2E2C2', border: '1px solid transparent' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: 8 }}>
        Link personal de comprobantes
      </div>
      <div style={{
        background: 'var(--surface)', padding: '8px 12px', borderRadius: 8,
        fontSize: 11, color: 'var(--ink)', wordBreak: 'break-all',
        fontFamily: 'monospace',
      }}>
        {link}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          type="button" onClick={copiar}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 10,
            background: copiado ? 'var(--oliva)' : 'var(--surface)',
            color: copiado ? '#fff' : 'var(--ink)',
            border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {copiado ? 'Copiado ✓' : 'Copiar link'}
        </button>
        {waUrl && (
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: '#25D366', color: '#fff',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            Enviar por WhatsApp
          </a>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-mute)', fontStyle: 'italic', lineHeight: 1.4 }}>
        Reusable: la persona puede subir cuantos comprobantes necesite con el mismo link.
      </div>

      {/* Subida manual: caso cuando mandan el comprobante por WA/IG */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(212,138,110,0.3)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, lineHeight: 1.4 }}>
          ¿Te mandó el comprobante por otro canal? Súbelo aquí:
        </div>
        <button
          type="button"
          onClick={() => fileRefManual.current?.click()}
          disabled={subiendoManual}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 10,
            background: okManual ? 'var(--oliva)' : 'var(--surface)',
            color: okManual ? '#fff' : 'var(--ink)',
            border: '1px solid ' + (okManual ? 'transparent' : 'var(--line-soft)'),
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
            cursor: subiendoManual ? 'not-allowed' : 'pointer',
            opacity: subiendoManual ? 0.6 : 1,
          }}
        >
          {subiendoManual ? 'Subiendo…' :
           okManual ? 'Comprobante subido ✓ — pendiente de validar' :
           'Subir comprobante manual'}
        </button>
        {errorManual && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--rojo)' }}>{errorManual}</div>
        )}
        <input
          ref={fileRefManual}
          type="file"
          accept="image/*,application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => { subirManual(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// ClaseAbiertaPanel — para Sofía dentro de LeadForm o FichaAlumna.
// Soporta dos modos: lead (prop leadId) o alumna (prop alumnaId).
// Tabla de tracking: leads.clase_link_enviada_at o alumnas.clase_link_enviada_at.
// Si la persona se inscribió a la clase (match por nombre fuzzy), lo refleja.
// ──────────────────────────────────────────
const ClaseAbiertaPanel = ({ leadId, alumnaId, leadNombre, leadTel, fechaProntoPago }) => {
  // Modo: alumna si recibimos alumnaId; sino, lead.
  const tabla = alumnaId ? 'alumnas' : 'leads';
  const personaId = alumnaId || leadId;
  const [activa, setActiva] = React.useState(null);
  const [inscrito, setInscrito] = React.useState(false);
  const [linkEnviadoAt, setLinkEnviadoAt] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  // Estado de la acción "inscribir manualmente". DEBE estar antes de los
  // early returns para no violar las Rules of Hooks (sin esto la pantalla
  // se va a negro al abrir cualquier lead).
  const [manualBusy, setManualBusy] = React.useState(false);
  const [manualError, setManualError] = React.useState('');

  React.useEffect(() => {
    if (!personaId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // 1) Clase activa
      const { data: clases } = await supabase
        .from('clases_abiertas').select('*').eq('activa', true).order('fecha', { ascending: true }).limit(1);
      const clase = clases?.[0] || null;
      // 2) Estado de envío del link a la persona (lead o alumna)
      const { data: persona } = await supabase
        .from(tabla).select('clase_link_enviada_at').eq('id', personaId).single();
      // 3) Match por nombre fuzzy: si se inscribió, lo encontramos
      let yaInscrito = false;
      if (clase && leadNombre) {
        const { data: insc } = await supabase
          .from('clase_inscripciones').select('nombre, email').eq('clase_id', clase.id);
        const norm = (s) => (s || '').toLowerCase().trim();
        const lN = norm(leadNombre);
        yaInscrito = (insc || []).some(i => {
          const iN = norm(i.nombre);
          // match si el primer nombre coincide y al menos otra palabra
          const lParts = lN.split(/\s+/).filter(Boolean);
          const iParts = iN.split(/\s+/).filter(Boolean);
          if (lParts.length === 0 || iParts.length === 0) return false;
          if (iN === lN) return true;
          const overlap = lParts.filter(p => iParts.some(q => q.startsWith(p) || p.startsWith(q))).length;
          return overlap >= 2;
        });
      }
      if (cancelled) return;
      setActiva(clase);
      setInscrito(yaInscrito);
      setLinkEnviadoAt(persona?.clase_link_enviada_at || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [personaId, tabla, leadNombre]);

  if (loading) return null;
  if (!activa) return null;

  // Pasamos ?n=<nombre> al link para que el form público no le pida el nombre
  // al lead (ya lo tenemos). Si el lead reenvía el link a otra persona, esa
  // persona puede tocar "Cambiar" para reescribirlo.
  const linkBase = `${window.location.origin}/clase/${activa.slug}`;
  const link = leadNombre ? `${linkBase}?n=${encodeURIComponent(leadNombre)}` : linkBase;
  const firstName = (leadNombre || '').split(' ')[0];
  const fechaFmt = activa.fecha
    ? new Date(activa.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long' })
    : '';
  const fechaPP = fechaProntoPago || '10 mayo';
  const mensaje = `Hola querida(o) ${firstName}! 🌿 Vamos a tener una clase (gratuita) para quienes están interesados / inscritos en el entrenamiento de junio.\nEs el ${fechaFmt}, ${activa.hora_inicio?.slice(0,5)}–${activa.hora_fin?.slice(0,5)}. Es para que nos conozcamos un poco antes de empezar — espero nos acompañes! Inscríbete en este link y queda tu cupo guardado:\n\n${link}\n\nPS · Recuerda por favor que la fecha máxima para reservar tu cupo con descuento PRONTO PAGO es el ${fechaPP}. Quedan sillas para los próximos 2 inscritos ;)\nNos vemos en el mat!`;
  const waUrl = leadTel ? buildWaUrl(leadTel, mensaje) : null;

  const marcarEnviado = async () => {
    const ahora = new Date().toISOString();
    await supabase.from(tabla).update({ clase_link_enviada_at: ahora }).eq('id', personaId);
    setLinkEnviadoAt(ahora);
  };

  // Inscripción manual (bypass del cierre público). Sofía la usa cuando ya
  // pasó la hora de cierre o cuando quiere inscribir sin pasar por el form.
  const inscribirManual = async () => {
    if (!leadNombre) return;
    if (!confirm(`¿Inscribir manualmente a ${leadNombre} a la clase del ${fechaFmt}?`)) return;
    setManualBusy(true);
    setManualError('');
    const { data, error } = await supabase.rpc('inscribir_lead_a_clase_manual', {
      p_slug: activa.slug,
      p_nombre: leadNombre,
      p_telefono: leadTel || '',
    });
    setManualBusy(false);
    if (error) { setManualError(error.message); return; }
    if (data?.error) { setManualError(data.error); return; }
    setInscrito(true);
  };

  // Inscrito → verde
  if (inscrito) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: '#DDE0CC', border: '1px solid transparent' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4D5230', fontWeight: 600 }}>
          ✓ Confirmó asistencia
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, lineHeight: 1.4 }}>
          Se inscribió a la clase del {fechaFmt}.
        </div>
      </div>
    );
  }

  // Link ya enviado → amarillo "esperando respuesta"
  if (linkEnviadoAt) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: '#F2E2C2', border: '1px solid transparent' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>
          Link enviado · esperando respuesta
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, lineHeight: 1.4 }}>
          {new Date(linkEnviadoAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} · clase del {fechaFmt}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '6px 12px', borderRadius: 999,
                background: 'var(--surface)', color: 'var(--ink)', textDecoration: 'none',
                fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                border: '1px solid var(--line-soft)',
              }}
            >Reenviar link</a>
          )}
          <button
            type="button"
            onClick={inscribirManual}
            disabled={manualBusy}
            style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'transparent', color: 'var(--terracota)',
              border: '1px dashed var(--terracota-soft)',
              fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >{manualBusy ? 'Inscribiendo…' : '+ Inscribir ya'}</button>
        </div>
        {manualError && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--rojo)' }}>{manualError}</div>
        )}
      </div>
    );
  }

  // Default: aún no se le envió el link
  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg-warm)', border: '1px solid var(--line-soft)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 500, marginBottom: 6 }}>
        Clase abierta · {fechaFmt}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4, marginBottom: 10 }}>
        Mándale el link para que se inscriba antes de que se llenen los cupos.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {waUrl ? (
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            onClick={marcarEnviado}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: '#25D366', color: '#fff',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500, textDecoration: 'none', textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icon name="whatsapp" size={13} stroke="#fff" /> Mandar link por WA
          </a>
        ) : (
          <button
            type="button" onClick={marcarEnviado}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: 'var(--surface)', color: 'var(--ink)',
              border: '1px solid var(--line-soft)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >Marcar como enviado</button>
        )}
      </div>
      {/* Botón secundario: inscripción manual (bypass cierre) */}
      <button
        type="button"
        onClick={inscribirManual}
        disabled={manualBusy}
        style={{
          marginTop: 8, width: '100%', padding: '7px 10px', borderRadius: 999,
          background: 'transparent', color: 'var(--terracota)',
          border: '1px dashed var(--terracota-soft)',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer',
        }}
      >{manualBusy ? 'Inscribiendo…' : '+ Inscribir manualmente a la clase'}</button>
      {manualError && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--rojo)' }}>{manualError}</div>
      )}
    </div>
  );
};
window.ClaseAbiertaPanel = ClaseAbiertaPanel;

window.TextInput = TextInput;
window.InstaInput = InstaInput;
window.TelInput = TelInput;
window.TextArea = TextArea;
window.NumberInput = NumberInput;
window.SelectChips = SelectChips;
window.SwitchToggle = SwitchToggle;
window.ContactPanel = ContactPanel;
window.PreinscripcionAdminPanel = PreinscripcionAdminPanel;
window.ComprobanteTokenAdminPanel = ComprobanteTokenAdminPanel;
window.cleanPhone = cleanPhone;
window.cleanInstagram = cleanInstagram;
window.buildWaUrl = buildWaUrl;

// Exports reales para consumidores que necesitan referencia confiable
// (en producción Vite minifica/optimiza y el patrón window.X puede no quedar registrado)
export { ContactPanel, PreinscripcionAdminPanel, ComprobanteTokenAdminPanel, InstaInput, TelInput, ClaseAbiertaPanel };
