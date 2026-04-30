import React from 'react';
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
      animation: 'fadeUp 0.25s ease both',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(42, 33, 26, 0.42)',
      }} />
      <div style={{ flex: 1 }} />
      <div style={{
        position: 'relative',
        background: 'var(--bg)',
        borderRadius: '28px 28px 0 0',
        maxHeight: '88%',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.1) both',
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

// Limpia un teléfono a solo dígitos (ej "+593 99 234 5678" → "593992345678")
function cleanPhone(tel) {
  return (tel || '').replace(/[^\d]/g, '');
}

// Limpia un handle de IG: quita @, espacios, https://instagram.com/, etc.
function cleanInstagram(h) {
  if (!h) return '';
  let s = h.trim();
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  s = s.replace(/^@/, '');
  s = s.split(/[/?#]/)[0]; // por si pegan URL completa con path
  return s;
}

function buildWaUrl(tel, mensaje) {
  const phone = cleanPhone(tel);
  if (!phone) return null;
  const text = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${phone}${text}`;
}

function buildIgUrl(handle) {
  const h = cleanInstagram(handle);
  if (!h) return null;
  // ig.me/m/<handle> abre DM en la app si el handle es correcto; fallback al perfil
  return `https://ig.me/m/${h}`;
}

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
      ? `Hola ${firstName}! Te escribo de Yoga Sofía Lira 🌿`
      : 'Hola! Te escribo de Yoga Sofía Lira 🌿';
    await copyAndOpenIg(instagram, msg);
    setIgCopiado(true);
    setTimeout(() => setIgCopiado(false), 2500);
  };

  // Personaliza la plantilla con el primer nombre si aplica
  const personalizar = (cuerpo) => {
    if (!firstName) return cuerpo;
    // Si la plantilla empieza con "Hola!" o "Hola," → reemplazar por "Hola <nombre>!"
    return cuerpo.replace(/^Hola!?,?/i, `Hola ${firstName}!`);
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
      </div>

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
                const personalizado = personalizar(p.cuerpo);
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

const PreinscripcionAdminPanel = ({ leadId, leadNombre, leadTel, plantillas }) => {
  const { pre, loading, generar } = usePreinscripcion(leadId, null);
  const [link, setLink] = React.useState('');
  const [copiado, setCopiado] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);

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
    return (
      <div style={{ padding: 14, borderRadius: 12, background: '#DDE0CC', border: '1px solid transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4D5230', fontWeight: 600 }}>
            Preinscripción completada
          </div>
          <div style={{ fontSize: 11, color: '#4D5230' }}>
            {pre.completed_at ? new Date(pre.completed_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
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
  const mensajeWa = `Hola ${firstName}! Te paso tu link personal para subir comprobantes de pago. Es seguro y solo Sofía ve tus datos. Puedes subir varios:\n\n${link}\n\n🌿`;
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
    </div>
  );
};

window.TextInput = TextInput;
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
export { ContactPanel, PreinscripcionAdminPanel, ComprobanteTokenAdminPanel };
