import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// ClasePublica — pantalla pública (sin auth) en /clase/<slug>.
// El cliente ve detalles del evento, cuántos cupos quedan en vivo, y un
// form simple de inscripción (nombre + email + teléfono opcional).
// Tras confirmar, muestra una pantalla de gracias.
// ─────────────────────────────────────────────────────────────────────

const ClasePublica = ({ slug }) => {
  const [clase, setClase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cuposPostInscripcion, setCuposPostInscripcion] = useState(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('obtener_clase_publica', { p_slug: slug });
    if (e) { setError(e.message); setLoading(false); return; }
    if (data?.error) { setError(data.error); setLoading(false); return; }
    setClase(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    cargar();
    // Realtime: actualizar cupos cuando alguien más se inscribe mientras este
    // visitante está mirando el form.
    const ch = supabase.channel(`clase-${slug}-public`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clase_inscripciones' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, cargar]);

  const submit = async () => {
    setError('');
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Email inválido.'); return; }
    setEnviando(true);
    const { data, error: e } = await supabase.rpc('inscribirse_a_clase', {
      p_slug: slug,
      p_nombre: nombre.trim(),
      p_email: email.trim(),
    });
    setEnviando(false);
    if (e) { setError(e.message); return; }
    if (data?.error) { setError(data.error); return; }
    setCuposPostInscripcion(data?.cupos_disponibles ?? null);
    setEnviado(true);
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>Cargando…</div>
      </div>
    );
  }

  if (!clase) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="serif" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>
            Clase no disponible
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{error || 'Esta clase ya no existe o no está activa.'}</div>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div>
          <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.2 }}>
            ¡Listo, {nombre.split(' ')[0]}!
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 20 }}>
            Tu cupo está reservado para la clase del<br/>
            <strong>{fmtFecha(clase.fecha)}</strong>, {clase.hora_inicio?.slice(0,5)}–{clase.hora_fin?.slice(0,5)}.
          </div>
          <div style={{
            padding: 14, borderRadius: 12,
            background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
            fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5,
          }}>
            Sofía te confirmará un día antes la <strong>ubicación exacta</strong> (Casita del Yoga o Domo Soulspace).
            {cuposPostInscripcion !== null && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)' }}>
                Quedan {cuposPostInscripcion} {cuposPostInscripcion === 1 ? 'cupo' : 'cupos'} para otras personas.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const lleno = clase.cupos_disponibles <= 0;

  return (
    <div style={containerStyle}>
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--terracota)', fontWeight: 600, marginBottom: 8 }}>
          {fmtFecha(clase.fecha)}
        </div>
        <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 500, color: 'var(--ink)', marginBottom: 12 }}>
          {clase.titulo}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 18 }}>
          {clase.descripcion}
        </div>

        {/* Datos del evento */}
        <div style={{
          padding: 14, borderRadius: 12,
          background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
          marginBottom: 18, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
        }}>
          <div>🕗 <strong>{clase.hora_inicio?.slice(0,5)}–{clase.hora_fin?.slice(0,5)}</strong></div>
          <div>📍 {clase.ubicacion}</div>
          <div>🎁 Sin costo</div>
        </div>

        {/* Cupos */}
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: lleno ? '#F0D5CE' : 'var(--terracota-tint)',
          marginBottom: 18, textAlign: 'center',
        }}>
          {lleno ? (
            <div style={{ color: 'var(--rojo)', fontWeight: 600, fontSize: 14 }}>
              Sin cupos disponibles
            </div>
          ) : (
            <>
              <div className="serif" style={{ fontSize: 28, color: '#8A3D26', lineHeight: 1, fontWeight: 500 }}>
                Quedan {clase.cupos_disponibles}
              </div>
              <div style={{ fontSize: 11, color: '#8A3D26', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                de {clase.cupos_max} cupos
              </div>
            </>
          )}
        </div>

        {/* Form */}
        {!lleno && (
          <>
            <div style={{ marginBottom: 14 }}>
              <Label>Tu nombre</Label>
              <input
                type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Nombre completo" style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <Label>Email</Label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                padding: 10, borderRadius: 10, background: '#F0D5CE',
                color: 'var(--rojo)', fontSize: 13, marginBottom: 14, textAlign: 'center',
              }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={enviando || !nombre.trim() || !email.trim()}
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 12,
                background: 'var(--terracota)', color: '#fff',
                border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
                cursor: enviando ? 'wait' : 'pointer',
                opacity: (enviando || !nombre.trim() || !email.trim()) ? 0.5 : 1,
              }}
            >
              {enviando ? 'Confirmando…' : 'Confirmar mi asistencia 🌿'}
            </button>
          </>
        )}

        <div style={{ marginTop: 22, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.4 }}>
          Yoga Sofía Lira · Tumbaco, Ecuador
        </div>
      </div>
    </div>
  );
};

const Label = ({ children }) => (
  <label style={{
    display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--ink-mute)', fontWeight: 500, marginBottom: 6,
  }}>{children}</label>
);

const containerStyle = {
  maxWidth: 520, margin: '0 auto', minHeight: '100vh',
  background: 'var(--bg)', color: 'var(--ink)',
  fontFamily: 'Inter Tight, -apple-system, system-ui, sans-serif',
};

const inputStyle = {
  width: '100%', padding: '12px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 12,
  fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)', outline: 'none',
};

function fmtFecha(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long' });
  } catch { return iso; }
}

window.ClasePublica = ClasePublica;
export { ClasePublica };
