import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// ComprobantePublic — link reusable accesible vía /comprobante (sin login).
// Cliente sube foto/PDF de su comprobante de pago + datos básicos.
// El archivo va a Supabase Storage bucket 'comprobantes'.
// La metadata va a la tabla `comprobantes_pago`.
// ─────────────────────────────────────────────────────────────────────

const MAX_SIZE_MB = 10;
const ACCEPTED = 'image/*,application/pdf';

function uuid() {
  // RFC4122 v4 simple
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ComprobantePublic = () => {
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [notas, setNotas] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo es muy grande (máx ${MAX_SIZE_MB} MB).`);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    if (!nombre.trim()) { setError('Pon tu nombre.'); return; }
    if (!file) { setError('Sube una foto o PDF del comprobante.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      // 1. Subir archivo a Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${uuid()}.${ext.toLowerCase()}`;
      const { error: upErr } = await supabase.storage
        .from('comprobantes')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) throw upErr;

      // 2. Crear registro vía RPC
      const { data, error: rpcErr } = await supabase.rpc('subir_comprobante', {
        p_nombre_cliente: nombre,
        p_contacto: contacto,
        p_monto: monto ? Number(monto) : null,
        p_fecha_pago: fechaPago || null,
        p_notas: notas,
        p_storage_path: path,
        p_archivo_nombre: file.name,
        p_archivo_tipo: file.type,
      });
      if (rpcErr) throw rpcErr;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setError('No pudimos subir el comprobante. Intenta de nuevo o avísale a Sofía.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setNombre(''); setContacto(''); setMonto(''); setFechaPago(''); setNotas('');
    setFile(null); setSubmitted(false); setError(null);
  };

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 40, textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ fontSize: 56 }}>🌿</div>
          <h1 className="serif" style={{ fontSize: 32, marginTop: 18, color: 'var(--ink)' }}>
            Comprobante recibido
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 14, lineHeight: 1.55 }}>
            Sofía revisará el pago en el banco y lo confirmará pronto. Si tienes otro comprobante por cargar, puedes hacerlo a continuación.
          </p>
          <button onClick={reset} style={{
            marginTop: 24, padding: '12px 22px', borderRadius: 999,
            background: 'var(--ink)', color: '#fff', border: 'none',
            fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
          }}>
            Subir otro comprobante
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ padding: '32px 24px 80px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="serif" style={{ fontSize: 44, color: 'var(--terracota)', fontWeight: 500 }}>S</div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginTop: 8 }}>
            Yoga Sofía Lira
          </div>
          <h1 className="serif" style={{ fontSize: 30, marginTop: 18, fontWeight: 500, lineHeight: 1.15 }}>
            Subir comprobante<br/>
            <em style={{ color: 'var(--terracota-soft)' }}>de pago</em>
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 14, fontSize: 14, lineHeight: 1.55 }}>
            Sube la foto o PDF de tu transferencia/depósito. Sofía lo revisará en el banco y confirmará tu pago.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Tu nombre" required>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
          </Field>
          <Field label="Tu WhatsApp o Instagram">
            <input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="+593 99... o @usuario" style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Monto (USD)" style={{ flex: 1 }}>
              <input type="number" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} placeholder="200" style={inputStyle} />
            </Field>
            <Field label="Fecha del pago" style={{ flex: 1 }}>
              <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Comprobante (foto o PDF)" required>
            <label style={{
              display: 'block', padding: 18,
              border: '2px dashed ' + (file ? 'var(--oliva)' : 'var(--line-soft)'),
              borderRadius: 14, textAlign: 'center',
              background: file ? '#DDE0CC55' : 'var(--surface)',
              cursor: 'pointer', transition: 'all 0.18s',
            }}>
              <input type="file" accept={ACCEPTED} onChange={onFile} style={{ display: 'none' }} />
              {file ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>✓ {file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                    {(file.size / 1024).toFixed(0)} KB · toca para cambiar
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>Toca para seleccionar archivo</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>JPG, PNG o PDF · máx {MAX_SIZE_MB} MB</div>
                </>
              )}
            </label>
          </Field>

          <Field label="Notas (opcional)">
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              placeholder="Algo que Sofía deba saber sobre este pago"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>

        {error && (
          <div style={{
            marginTop: 18, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(181, 86, 58, 0.10)', border: '1px solid rgba(181, 86, 58, 0.3)',
            color: 'var(--terracota)', fontSize: 13,
          }}>{error}</div>
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
          {submitting ? 'Subiendo…' : 'Enviar comprobante'}
        </button>
      </div>
    </div>
  );
};

const Field = ({ label, required, children, style }) => (
  <div style={style}>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--terracota)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
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
  boxSizing: 'border-box',
};

window.ComprobantePublic = ComprobantePublic;
