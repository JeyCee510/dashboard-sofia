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
            border: 'none',
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
window.TextInput = TextInput;
window.TextArea = TextArea;
window.NumberInput = NumberInput;
window.SelectChips = SelectChips;
window.SwitchToggle = SwitchToggle;
