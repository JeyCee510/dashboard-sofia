import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────────
// TallerComprobante — link personalizado (por comprobante_token) para
// que una inscrita al taller suba comprobantes de pago.
// Ruta: /taller-comprobante/<comprobante_token>
//
// Reutiliza el bucket Storage 'comprobantes'.
// Inserta directamente en taller_pagos (validado=false) gracias a la
// RLS policy `pagos_insert_publico` que valida comprobante_token.
// ─────────────────────────────────────────────────────────────────────

const MAX_SIZE_MB = 10;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const money = (n) => `$${Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;

export const TallerComprobante = ({ token }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errCarga, setErrCarga] = useState(null);

  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState('transferencia');
  const [notas, setNotas] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!token) { setErrCarga('Falta token'); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc('taller_obtener_por_comprobante_token', { p_token: token });
      if (error || !data) { setErrCarga(error?.message || 'Link inválido'); setLoading(false); return; }
      setInfo(data);
      setLoading(false);
      // Prefill monto con saldo restante si hay
      const saldo = Math.max(0, Number(data.inscrito?.total_calculado || 0) - Number(data.pagado || 0));
      if (saldo > 0) setMonto(String(saldo));
    })();
  }, [token]);

  // Realtime: si admin valida un pago mientras la persona tiene el link abierto
  useEffect(() => {
    if (!info?.inscrito?.id) return;
    const ch = supabase.channel(`taller-comp-${info.inscrito.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_pagos', filter: `inscrito_id=eq.${info.inscrito.id}` }, async () => {
        const { data } = await supabase.rpc('taller_obtener_por_comprobante_token', { p_token: token });
        if (data) setInfo(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [info?.inscrito?.id, token]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) { setErr(`Archivo muy grande (máx ${MAX_SIZE_MB} MB)`); return; }
    setErr(null);
    setFile(f);
  };

  const submit = async () => {
    setErr(null);
    if (!monto || Number(monto) <= 0) { setErr('Pon un monto válido'); return; }
    if (!file) { setErr('Sube foto o PDF del comprobante'); return; }
    setSubmitting(true);
    try {
      // 1. Storage
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `taller/${info.inscrito.proyecto.slug}/${uuid()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('comprobantes').getPublicUrl(path);

      // 2. Insertar pago (validado=false)
      const { error: insErr } = await supabase.from('taller_pagos').insert({
        inscrito_id: info.inscrito.id,
        monto: Number(monto),
        forma_pago: formaPago,
        comprobante_url: pub.publicUrl,
        notas: notas || null,
        validado: false,
      });
      if (insErr) throw insErr;

      setSubmitted(true);
      setFile(null);
      setNotas('');
      // Refresh info
      const { data } = await supabase.rpc('taller_obtener_por_comprobante_token', { p_token: token });
      if (data) setInfo(data);
    } catch (e) {
      console.error(e);
      setErr('No pudimos subir el comprobante. Intenta de nuevo o avísale a Sofía.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>Cargando...</div>;
  if (errCarga) return (
    <div style={{ padding: 60, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--terracota)', fontFamily: "'Cormorant Garamond', serif" }}>Link inválido</h2>
      <p style={{ color: 'var(--ink-soft)' }}>{errCarga}</p>
    </div>
  );

  const total = Number(info.inscrito.total_calculado || 0);
  const pagado = Number(info.pagado || 0);
  const saldo = Math.max(0, total - pagado);
  const completo = saldo === 0 && total > 0;

  return (
    <div style={{ padding: '24px 18px 60px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Sofía Lira · Yoga
      </div>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28, lineHeight: 1.1, margin: '4px 0 4px', fontWeight: 600,
      }}>
        Comprobantes — {info.inscrito.proyecto.nombre}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>
        Hola <b>{info.inscrito.nombre}</b>, esta es tu página privada para subir comprobantes de pago.
      </p>

      {/* Resumen */}
      <div style={{
        padding: 14, marginBottom: 20, borderRadius: 'var(--r-md)',
        background: completo ? 'var(--oliva-soft)' : 'var(--bg-warm)',
        border: `1px solid ${completo ? 'var(--oliva)' : 'var(--line)'}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{money(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pagado</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--oliva)' }}>{money(pagado)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saldo</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: saldo > 0 ? 'var(--terracota)' : 'var(--oliva)' }}>{money(saldo)}</div>
          </div>
        </div>
        {completo && (
          <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--oliva)', fontWeight: 600, fontSize: 13 }}>
            ✓ Tu pago está completo
          </div>
        )}
      </div>

      {submitted && (
        <div style={{ padding: 12, marginBottom: 14, background: 'var(--oliva-soft)', border: '1px solid var(--oliva)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
          <div style={{ fontWeight: 600, color: 'var(--oliva)' }}>✓ Comprobante subido</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            Sofía lo revisará y validará pronto. Puedes seguir subiendo si tienes más pagos.
          </div>
        </div>
      )}

      {!completo && (
        <>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, margin: '20px 0 12px', fontWeight: 600 }}>
            Subir nuevo comprobante
          </h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Monto pagado</label>
            <input type="number" value={monto} onChange={e => setMonto(e.target.value)} className="input" style={{ width: '100%' }} placeholder="$" inputMode="decimal" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Forma de pago</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className="input" style={{ width: '100%' }}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="payphone">Payphone</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Foto o PDF del comprobante</label>
            <input type="file" accept="image/*,application/pdf" onChange={onFile} className="input" style={{ width: '100%' }} />
            {file && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Nota (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="input" style={{ width: '100%', resize: 'vertical' }} />
          </div>

          {err && <div style={{ padding: 10, marginBottom: 12, color: 'var(--terracota)', background: 'var(--terracota-tint)', borderRadius: 'var(--r-md)', fontSize: 13 }}>{err}</div>}

          <button onClick={submit} disabled={submitting || !file || !monto} className="btn btn-primary" style={{ width: '100%', padding: 14 }}>
            {submitting ? 'Subiendo...' : 'Enviar comprobante'}
          </button>
        </>
      )}

      {/* Historial de pagos */}
      {info.pagos.length > 0 && (
        <>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, margin: '28px 0 10px', fontWeight: 600 }}>
            Tus pagos
          </h3>
          {info.pagos.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 10, marginBottom: 6,
              background: p.validado ? 'var(--oliva-soft)' : 'var(--bg-warm)',
              border: `1px solid ${p.validado ? 'var(--oliva)' : 'var(--line)'}`,
              borderRadius: 'var(--r-md)',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{money(p.monto)}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {p.forma_pago} · {new Date(p.fecha).toLocaleDateString('es-EC')}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: p.validado ? 'var(--oliva)' : 'var(--ink-mute)' }}>
                {p.validado ? '✓ Validado' : 'Pendiente'}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

window.TallerComprobante = TallerComprobante;
