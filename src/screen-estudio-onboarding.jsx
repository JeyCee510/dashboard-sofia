import React from 'react';

const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioOnboarding — sheet wizard para registrar una estudiante nueva
//
// 1 sola pantalla con todos los campos. Optimizado para Sofía cargando
// las ~30 estudiantes que tiene "en la cabeza" — meta <30s por persona.
//
// Usa la RPC `crear_estudiante_con_membresia` (atómica: estudiante +
// membresía + primer pago en un solo round-trip).
// ─────────────────────────────────────────────────────────────────

function EstudioOnboarding({ open, onClose, store, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [instagram, setInstagram] = useState('');
  const [planId, setPlanId] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoForma, setPagoForma] = useState('transferencia');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setNombre(''); setTel(''); setInstagram('');
      setPlanId(null);
      setFechaInicio(new Date().toISOString().slice(0, 10));
      setPagoMonto(''); setPagoForma('transferencia');
      setError(null); setEnviando(false);
    }
  }, [open]);

  // Auto-completar el monto del pago al elegir plan
  useEffect(() => {
    if (planId) {
      const plan = (store.estudio.planesActivos || []).find(p => p.id === planId);
      if (plan && !pagoMonto) {
        setPagoMonto(String(plan.precio));
      }
    }
  }, [planId]);

  if (!open) return null;

  const planes = store.estudio.planesActivos || [];
  const valido = nombre.trim().length > 1;

  const handleGuardar = async () => {
    if (!valido) return;
    setEnviando(true); setError(null);
    try {
      const { estudianteId } = await store.estudio.crearEstudianteConMembresia({
        nombre: nombre.trim(),
        tel: telCompleto(tel),
        instagram: instagram ? '@' + instagram.replace(/^@/, '') : null,
        planId: planId || null,
        fechaInicio,
        pagoMonto: pagoMonto ? Number(pagoMonto) : null,
        pagoForma,
      });
      if (onCreado) onCreado(estudianteId);
      onClose();
    } catch (e) {
      console.error('[onboarding] error', e);
      setError(e.message || 'Error al crear estudiante');
      setEnviando(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} style={sheetBackdrop}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
            Nueva estudiante
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>×</button>
        </div>

        {/* Nombre */}
        <Field label="Nombre *">
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: María Salazar" autoFocus style={input} />
        </Field>

        {/* Tel + IG en fila */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="WhatsApp">
            <div style={{ position: 'relative' }}>
              <span style={prefijoTel}>+593</span>
              <input type="tel" value={tel} onChange={e => setTel(e.target.value)}
                placeholder="9 1234 5678" style={{ ...input, paddingLeft: 50 }} />
            </div>
          </Field>
          <Field label="Instagram">
            <div style={{ position: 'relative' }}>
              <span style={prefijoTel}>@</span>
              <input type="text" value={instagram} onChange={e => setInstagram(e.target.value.replace(/^@/, ''))}
                placeholder="usuario" style={{ ...input, paddingLeft: 30 }} />
            </div>
          </Field>
        </div>

        {/* Plan */}
        <Field label="Plan">
          <div style={{ display: 'grid', gap: 6 }}>
            {planes.map(p => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id === planId ? null : p.id)}
                style={{
                  padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${planId === p.id ? 'var(--terracota)' : 'var(--line)'}`,
                  background: planId === p.id ? '#fff7ed' : '#fff',
                  textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                    {p.duracionDias}d{p.numClases ? ` · ${p.numClases} clases` : ' · ilimitado'}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--terracota)' }}>${p.precio}</div>
              </button>
            ))}
            <button onClick={() => setPlanId(null)} style={{
              padding: '8px', borderRadius: 10, border: '1px dashed var(--line)',
              background: planId === null ? 'var(--bg-soft)' : 'transparent',
              fontSize: 11, color: 'var(--ink-soft)', cursor: 'pointer',
            }}>
              Sin plan por ahora
            </button>
          </div>
        </Field>

        {/* Fecha inicio (solo si hay plan) */}
        {planId && (
          <Field label="Fecha inicio">
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={input} />
          </Field>
        )}

        {/* Pago (opcional) */}
        {planId && (
          <Field label={`Primer pago ${pagoMonto ? `($${pagoMonto})` : '(opcional)'}`}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <input type="number" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)}
                placeholder="0" style={input} />
              <div style={{ display: 'flex', gap: 4 }}>
                {['transferencia','efectivo','payphone','canje'].map(f => (
                  <button key={f} onClick={() => setPagoForma(f)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 8,
                    background: pagoForma === f ? 'var(--ink)' : 'var(--bg-soft)',
                    color: pagoForma === f ? '#fff' : 'var(--ink-soft)',
                    border: '1px solid var(--line)', fontSize: 9, cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}>
                    {f === 'transferencia' ? 'Trans.' : f === 'payphone' ? 'P.phone' : f}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4 }}>
              Deja vacío si todavía no pagó
            </div>
          </Field>
        )}

        {error && (
          <div style={{
            padding: 10, borderRadius: 8, background: '#fee2e2',
            color: '#b91c1c', fontSize: 12, marginBottom: 10,
          }}>{error}</div>
        )}

        <button onClick={handleGuardar} disabled={!valido || enviando} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: valido && !enviando ? 'var(--terracota)' : 'var(--bg-soft)',
          color: valido && !enviando ? '#fff' : 'var(--ink-soft)',
          border: 'none', fontSize: 14, fontWeight: 500,
          cursor: valido && !enviando ? 'pointer' : 'default',
          marginTop: 6,
        }}>
          {enviando ? 'Guardando…' : 'Crear estudiante'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function telCompleto(tel) {
  const limpio = (tel || '').replace(/\D/g, '');
  if (!limpio) return null;
  if (limpio.startsWith('593')) return '+' + limpio;
  if (limpio.startsWith('0')) return '+593' + limpio.slice(1);
  return '+593' + limpio;
}

const sheetBackdrop = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)', zIndex: 100,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const sheet = {
  background: '#fff', width: '100%', maxWidth: 720,
  borderTopLeftRadius: 20, borderTopRightRadius: 20,
  padding: '20px 18px 24px',
  maxHeight: '92vh', overflowY: 'auto',
  boxShadow: '0 -10px 30px rgba(0,0,0,0.12)',
};
const input = {
  width: '100%', padding: '10px 12px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--bg-soft)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const prefijoTel = {
  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
  fontSize: 12, color: 'var(--ink-soft)', pointerEvents: 'none',
};
const btnClose = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--bg-soft)', border: 'none',
  fontSize: 22, cursor: 'pointer', color: 'var(--ink-soft)',
  lineHeight: 1,
};

window.EstudioOnboarding = EstudioOnboarding;
export { EstudioOnboarding };
