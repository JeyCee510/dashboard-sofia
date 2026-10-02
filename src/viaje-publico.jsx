import React from 'react';
import { supabase } from './lib/supabase.js';
import { enviarAvisoPush } from './lib/push.js';

const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────────
// ViajePublico — web pública (sin auth) en /viaje/<slug>.
//
// Es la página a la que lleva el QR del viaje. Muestra la información del
// viaje y un formulario de interés: cada envío entra como lead del proyecto
// (RPC `viaje_registrar_interes`, migración 044) y aparece en la pestaña
// Leads del dashboard para darle seguimiento.
//
// Todo el contenido sale de `proyectos.config.web`: se edita sin tocar código.
// El QR debe apuntar a /viaje/<slug>?src=qr para que el lead quede con
// fuente "QR" (sin el parámetro queda como "Web").
// ─────────────────────────────────────────────────────────────────────

const CSS = `
.vj { width: 100%; align-self: stretch; min-height: 100dvh; background: var(--bg); color: var(--ink); font-family: 'Inter Tight', system-ui, sans-serif; }
.vj-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
.vj-wrap { max-width: 640px; margin: 0 auto; padding: 0 22px; }
.vj-hero { position: relative; overflow: hidden; background: linear-gradient(160deg, #B5563A 0%, #9C4A33 45%, #6E3B2A 100%); color: #FBF3EA; padding: 56px 0 64px; }
.vj-hero-img { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: .35; }
.vj-mandala { position: absolute; right: -90px; top: -70px; width: 320px; height: 320px; opacity: .18; }
.vj-eyebrow { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; opacity: .85; margin-bottom: 14px; }
.vj-h1 { font-size: 52px; line-height: .98; font-weight: 500; margin: 0 0 14px; }
.vj-sub { font-size: 17px; line-height: 1.45; opacity: .92; margin: 0 0 24px; max-width: 460px; }
.vj-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.vj-chip { font-size: 12.5px; padding: 7px 12px; border-radius: 999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); }
.vj-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 500; padding: 15px 22px; border-radius: 14px; text-decoration: none; }
.vj-btn-light { background: #FBF3EA; color: #8A3D26; }
.vj-btn-primary { background: var(--terracota); color: #fff; width: 100%; }
.vj-btn-primary:disabled { opacity: .6; cursor: default; }
.vj-btn-wa { background: #25D366; color: #fff; width: 100%; }
.vj-sec { padding: 40px 0 8px; }
.vj-h2 { font-size: 30px; font-weight: 500; margin: 0 0 14px; line-height: 1.1; }
.vj-p { font-size: 15.5px; line-height: 1.6; color: var(--ink-soft); margin: 0; white-space: pre-line; }
.vj-card { background: var(--surface); border: 1px solid var(--line-soft); border-radius: 18px; padding: 18px 18px; }
.vj-dest { display: grid; gap: 12px; }
.vj-dest-n { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--terracota); margin-bottom: 4px; }
.vj-dest-t { font-size: 22px; font-weight: 500; margin-bottom: 4px; }
.vj-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.vj-list li { display: flex; gap: 10px; font-size: 15px; line-height: 1.45; color: var(--ink-soft); }
.vj-list li::before { content: '✦'; color: var(--gold); flex: none; }
.vj-faq { border-top: 1px solid var(--line); }
.vj-faq details { border-bottom: 1px solid var(--line); padding: 14px 0; }
.vj-faq summary { cursor: pointer; font-size: 15.5px; font-weight: 500; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
.vj-faq summary::after { content: '+'; color: var(--terracota); font-size: 20px; line-height: 1; }
.vj-faq details[open] summary::after { content: '–'; }
.vj-faq details p { margin: 10px 0 0; }
.vj-form { display: grid; gap: 14px; }
.vj-label { font-size: 12px; letter-spacing: .04em; color: var(--ink-mute); margin-bottom: 6px; display: block; }
.vj-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 16px; padding: 13px 14px; border-radius: 12px; border: 1px solid var(--line); background: #fff; color: var(--ink); outline: none; }
.vj-input:focus { border-color: var(--terracota); box-shadow: 0 0 0 3px var(--terracota-tint); }
.vj-err { font-size: 13px; color: var(--rojo); background: #F6E0DA; border-radius: 10px; padding: 10px 12px; }
.vj-foot { text-align: center; font-size: 12px; color: var(--ink-mute); padding: 36px 0 48px; }
@media (max-width: 420px) { .vj-h1 { font-size: 44px; } }
`;

const Mandala = () => (
  <svg className="vj-mandala" viewBox="0 0 200 200" fill="none" stroke="#FBF3EA" strokeWidth="1" aria-hidden="true">
    {[90, 72, 54, 36, 18].map(r => <circle key={r} cx="100" cy="100" r={r} />)}
    {Array.from({ length: 16 }).map((_, i) => {
      const a = (i * Math.PI) / 8;
      return <ellipse key={i} cx={100 + Math.cos(a) * 63} cy={100 + Math.sin(a) * 63} rx="9" ry="20"
        transform={`rotate(${(i * 180) / 8 + 90} ${100 + Math.cos(a) * 63} ${100 + Math.sin(a) * 63})`} />;
    })}
  </svg>
);

function fuenteDeUrl() {
  try {
    const s = (new URL(window.location.href).searchParams.get('src') || '').toLowerCase();
    return ['qr', 'instagram', 'whatsapp'].includes(s) ? s : 'web';
  } catch { return 'web'; }
}

function waLink(tel, texto) {
  const n = String(tel || '').replace(/\D/g, '');
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

const ViajePublico = ({ slug }) => {
  const [viaje, setViaje] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', tel: '', email: '', ciudad: '', mensaje: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const fuente = fuenteDeUrl();

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc('viaje_obtener_publico', { p_slug: slug });
      if (e) console.error('[viaje] cargar', e);
      setViaje(data || null);
      setLoading(false);
      if (data?.web?.titulo) document.title = data.web.titulo;
    })();
  }, [slug]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (form.nombre.trim().length < 2) { setError('Escribe tu nombre.'); return; }
    if (form.tel.replace(/\D/g, '').length < 7) { setError('Escribe tu WhatsApp (con código de país si no es de Ecuador).'); return; }
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setError('Revisa tu email.'); return; }
    setEnviando(true);
    const { data, error: err } = await supabase.rpc('viaje_registrar_interes', {
      p_slug: slug,
      p_nombre: form.nombre.trim(),
      p_tel: form.tel.trim(),
      p_email: form.email.trim() || null,
      p_mensaje: form.mensaje.trim() || null,
      p_fuente: fuente,
      p_extra: { ciudad: form.ciudad.trim() || null },
    });
    setEnviando(false);
    // Si falla NO mostramos el "gracias": la persona tiene que saber que no llegó.
    if (err || !data?.ok) {
      setError(err?.message || 'No se pudo enviar. Intenta de nuevo o escríbenos por WhatsApp.');
      return;
    }
    setEnviado(true);
    if (data.nuevo) {
      enviarAvisoPush({
        titulo: 'Nuevo interesado · India 🌿',
        cuerpo: `${form.nombre.trim()}${fuente === 'qr' ? ' · vía QR' : ' · vía web'}`,
        proyectoId: viaje.id, tag: 'lead',
      });
    }
  };

  if (loading) {
    return <div className="vj" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div className="vj-serif" style={{ fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: 18 }}>Cargando…</div>
    </div>;
  }

  if (!viaje?.web) {
    return <div className="vj" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <style>{CSS}</style>
      <div>
        <div className="vj-serif" style={{ fontSize: 28, marginBottom: 8 }}>Página no disponible</div>
        <div style={{ color: 'var(--ink-soft)' }}>Este viaje ya no está publicado.</div>
      </div>
    </div>;
  }

  const w = viaje.web;
  const chips = [w.fechas, w.duracion, w.precio, w.cupos].filter(Boolean);
  const destinos = Array.isArray(w.destinos) ? w.destinos : [];
  const incluye = Array.isArray(w.incluye) ? w.incluye : [];
  const preguntas = Array.isArray(w.preguntas) ? w.preguntas : [];
  const waDirecto = waLink(w.whatsapp, `Hola! Quiero información del ${w.titulo || 'viaje'} 🙏`);

  return (
    <div className="vj">
      <style>{CSS}</style>

      <header className="vj-hero">
        {w.imagen && <div className="vj-hero-img" style={{ backgroundImage: `url(${w.imagen})` }} />}
        <Mandala />
        <div className="vj-wrap" style={{ position: 'relative' }}>
          {w.eyebrow && <div className="vj-eyebrow">{w.eyebrow}</div>}
          <h1 className="vj-h1 vj-serif">{w.titulo}</h1>
          {w.subtitulo && <p className="vj-sub">{w.subtitulo}</p>}
          {chips.length > 0 && <div className="vj-chips">{chips.map(c => <span key={c} className="vj-chip">{c}</span>)}</div>}
          <a href="#interes" className="vj-btn vj-btn-light">{w.ctaTexto || 'Quiero información'} →</a>
        </div>
      </header>

      <main className="vj-wrap">
        {w.intro && (
          <section className="vj-sec">
            <h2 className="vj-h2 vj-serif">El viaje</h2>
            <p className="vj-p">{w.intro}</p>
          </section>
        )}

        {destinos.length > 0 && (
          <section className="vj-sec">
            <h2 className="vj-h2 vj-serif">Recorrido</h2>
            <div className="vj-dest">
              {destinos.map((d, i) => (
                <div key={i} className="vj-card">
                  {d.dias && <div className="vj-dest-n">{d.dias}</div>}
                  <div className="vj-dest-t vj-serif">{d.nombre}</div>
                  {d.texto && <p className="vj-p" style={{ fontSize: 14.5 }}>{d.texto}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {incluye.length > 0 && (
          <section className="vj-sec">
            <h2 className="vj-h2 vj-serif">Qué incluye</h2>
            <ul className="vj-list">{incluye.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </section>
        )}

        {preguntas.length > 0 && (
          <section className="vj-sec">
            <h2 className="vj-h2 vj-serif">Preguntas frecuentes</h2>
            <div className="vj-faq">
              {preguntas.map((q, i) => (
                <details key={i}>
                  <summary>{q.p}</summary>
                  <p className="vj-p" style={{ fontSize: 14.5 }}>{q.r}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section id="interes" className="vj-sec" style={{ scrollMarginTop: 16 }}>
          <div className="vj-card" style={{ padding: '22px 20px', boxShadow: 'var(--shadow-lift)' }}>
            {enviado ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div className="vj-serif" style={{ fontSize: 30, marginBottom: 8 }}>¡Recibido!</div>
                <p className="vj-p" style={{ marginBottom: 18 }}>{w.graciasTexto || 'Gracias por tu interés. Te escribiremos pronto.'}</p>
                {waDirecto && <a className="vj-btn vj-btn-wa" href={waDirecto} target="_blank" rel="noopener noreferrer">Escribirnos ahora por WhatsApp</a>}
              </div>
            ) : (
              <form className="vj-form" onSubmit={enviar} noValidate>
                <div>
                  <h2 className="vj-h2 vj-serif" style={{ marginBottom: 6 }}>¿Te interesa?</h2>
                  <p className="vj-p" style={{ fontSize: 14.5 }}>Déjanos tus datos y te escribimos con toda la información.</p>
                </div>
                <label>
                  <span className="vj-label">Nombre y apellido</span>
                  <input className="vj-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} autoComplete="name" />
                </label>
                <label>
                  <span className="vj-label">WhatsApp</span>
                  <input className="vj-input" value={form.tel} onChange={e => set('tel', e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="09… o +código país" />
                </label>
                <label>
                  <span className="vj-label">Email (opcional)</span>
                  <input className="vj-input" value={form.email} onChange={e => set('email', e.target.value)} type="email" inputMode="email" autoComplete="email" />
                </label>
                <label>
                  <span className="vj-label">Ciudad (opcional)</span>
                  <input className="vj-input" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} autoComplete="address-level2" />
                </label>
                <label>
                  <span className="vj-label">¿Algo que quieras contarnos o preguntar? (opcional)</span>
                  <textarea className="vj-input" rows={3} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} style={{ resize: 'vertical' }} />
                </label>
                {error && <div className="vj-err">{error}</div>}
                <button className="vj-btn vj-btn-primary" type="submit" disabled={enviando}>
                  {enviando ? 'Enviando…' : (w.ctaTexto || 'Quiero información')}
                </button>
                {waDirecto && (
                  <a href={waDirecto} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
                    ¿Prefieres escribirnos directo? WhatsApp →
                  </a>
                )}
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="vj-foot vj-serif" style={{ fontStyle: 'italic', fontSize: 14 }}>
        Sofía Lira Yoga
      </footer>
    </div>
  );
};

export { ViajePublico };
