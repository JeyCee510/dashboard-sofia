import React from 'react';
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

const ContactPanel = ({ tel, instagram, plantillas, nombre }) => {
  const [showPlantillas, setShowPlantillas] = React.useState(false);
  const waUrl = buildWaUrl(tel);
  const igUrl = buildIgUrl(instagram);
  const firstName = (nombre || '').split(' ')[0] || '';

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
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 12,
              background: 'linear-gradient(45deg, #F09433, #E6683C, #DC2743, #CC2366, #BC1888)',
              color: '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Icon name="instagram" size={16} stroke="#fff" />
            Instagram
          </a>
        )}
      </div>

      {waUrl && plantillas && plantillas.length > 0 && (
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
              Enviar plantilla por WhatsApp
            </span>
            <Icon name="chevronD" size={14} stroke="var(--ink-mute)" />
          </button>
          {showPlantillas && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 6 }}>
              {plantillas.map(p => {
                const url = buildWaUrl(tel, personalizar(p.cuerpo));
                return (
                  <a
                    key={p.id} href={url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
                      fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)',
                      textDecoration: 'none', display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink)' }}>{p.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {personalizar(p.cuerpo)}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

window.TextInput = TextInput;
window.TextArea = TextArea;
window.NumberInput = NumberInput;
window.SelectChips = SelectChips;
window.SwitchToggle = SwitchToggle;
window.ContactPanel = ContactPanel;
window.cleanPhone = cleanPhone;
window.cleanInstagram = cleanInstagram;
window.buildWaUrl = buildWaUrl;
