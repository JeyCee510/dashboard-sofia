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
// Estética tomada del arte del viaje (IBM Plex Serif, verde oliva, papel).
// El QR apunta a /viaje/<slug>?src=qr para que el lead quede con fuente "QR"
// (sin el parámetro queda como "Web").
// ─────────────────────────────────────────────────────────────────────

const CSS = `
.vj { --o: #43451E; --o2: #5C5F2C; --m: #7E2A1D; --g: #B8893E; --paper: #F5F1EA; --card: #FFFDF9; --ink2: #4A4632; --mute: #8A8470; --line: #E3DCCD;
  width: 100%; align-self: stretch; min-height: 100dvh; color: var(--o); font-family: 'IBM Plex Serif', Georgia, serif;
  background: var(--paper); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.3 0 0 0 0 0.28 0 0 0 0 0.2 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }
.vj * { box-sizing: border-box; }
.vj-wrap { max-width: 980px; margin: 0 auto; padding: 0 20px; }
.vj-narrow { max-width: 680px; margin: 0 auto; padding: 0 20px; }
.vj-hero { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 36px 0 12px; align-items: center; }
.vj-hero-img { width: 100%; max-width: 520px; justify-self: center; display: block; mix-blend-mode: multiply; }
.vj-h1 { font-weight: 700; font-size: clamp(64px, 18vw, 112px); line-height: .86; letter-spacing: -.01em; margin: 0; text-transform: uppercase; }
.vj-h1 span { display: block; font-size: .79em; }
.vj-mes { font-size: clamp(20px, 5.4vw, 30px); letter-spacing: .32em; margin: 18px 0 6px; font-weight: 400; }
.vj-fechas { font-size: clamp(18px, 4.6vw, 24px); letter-spacing: .08em; font-weight: 700; margin: 0 0 22px; }
.vj-sub { font-size: 17px; line-height: 1.55; color: var(--ink2); margin: 0 0 24px; max-width: 460px; }
.vj-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; cursor: pointer; font-family: inherit; font-size: 16px; font-weight: 600; padding: 15px 24px; border-radius: 999px; text-decoration: none; letter-spacing: .02em; }
.vj-btn-o { background: var(--o); color: #F7F3EA; }
.vj-btn-o:hover { background: var(--o2); }
.vj-btn-o:disabled { opacity: .6; cursor: default; }
.vj-btn-wa { background: #25D366; color: #fff; width: 100%; font-family: system-ui, sans-serif; }
.vj-sec { padding-top: 44px; padding-bottom: 8px; }
.vj-kicker { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; font-weight: 600; color: var(--m); margin-bottom: 10px; }
.vj-h2 { font-size: clamp(30px, 7vw, 44px); font-weight: 700; line-height: 1.02; margin: 0 0 16px; text-transform: uppercase; }
.vj-p { font-size: 16.5px; line-height: 1.7; color: var(--ink2); margin: 0; white-space: pre-line; }
.vj-rule { width: 64px; height: 2px; background: var(--m); margin: 0 0 18px; border: 0; }
.vj-dest { display: grid; grid-template-columns: 1fr; gap: 16px; }
.vj-dcard { background: var(--card); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; display: grid; grid-template-columns: 120px 1fr; }
.vj-dimg { background: #fff; display: flex; align-items: center; justify-content: center; min-height: 130px; }
.vj-dimg img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vj-dimg.contain img { object-fit: contain; padding: 6px; }
.vj-dbody { padding: 16px 16px 16px 18px; }
.vj-dn { font-size: 11px; letter-spacing: .2em; color: var(--g); font-weight: 600; margin-bottom: 4px; }
.vj-dt { font-size: 22px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
.vj-dd { font-size: 14.5px; line-height: 1.55; color: var(--ink2); margin: 0; }
.vj-dest-big { background: var(--o); color: #F4EFE3; border-radius: 22px; overflow: hidden; display: grid; grid-template-columns: 1fr; }
.vj-dest-big .vj-p, .vj-dest-big .vj-dd { color: #E7E1D0; }
.vj-dest-big .vj-kicker { color: #E6C987; }
.vj-big-imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.vj-big-imgs img { width: 100%; height: 260px; object-fit: cover; display: block; }
.vj-gal { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.vj-gal img { width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 14px; display: block; background: #fff; }
.vj-aloj { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
.vj-aloj img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; display: block; box-shadow: 0 8px 22px rgba(67,69,30,.12); }
.vj-faq { border-top: 1px solid var(--line); }
.vj-faq details { border-bottom: 1px solid var(--line); padding: 16px 0; }
.vj-faq summary { cursor: pointer; font-size: 17px; font-weight: 600; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
.vj-faq summary::after { content: '+'; color: var(--m); font-size: 22px; line-height: 1; }
.vj-faq details[open] summary::after { content: '–'; }
.vj-faq details p { margin: 10px 0 0; }
.vj-formcard { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 26px 20px; box-shadow: 0 14px 40px rgba(67,69,30,.12); }
.vj-form { display: grid; gap: 14px; }
.vj-label { font-size: 13px; letter-spacing: .04em; color: var(--mute); margin-bottom: 6px; display: block; }
.vj-input { width: 100%; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; padding: 13px 14px; border-radius: 12px; border: 1px solid var(--line); background: #fff; color: #2A2A1A; outline: none; }
.vj-input:focus { border-color: var(--o2); box-shadow: 0 0 0 3px rgba(92,95,44,.15); }
.vj-err { font-size: 14px; color: var(--m); background: #F6E3DC; border-radius: 10px; padding: 10px 12px; font-family: system-ui, sans-serif; }
.vj-foot { text-align: center; color: var(--mute); padding: 44px 0 96px; font-style: italic; font-size: 15px; }
.vj-sticky { position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(245,241,234,.98) 70%, rgba(245,241,234,0)); display: flex; justify-content: center; z-index: 5; transition: opacity .2s; }
.vj-sticky .vj-btn { width: 100%; max-width: 420px; box-shadow: 0 8px 22px rgba(67,69,30,.25); }
@media (min-width: 760px) {
  .vj-hero { grid-template-columns: 1.05fr 1fr; padding: 56px 0 24px; }
  .vj-dest { grid-template-columns: 1fr 1fr; }
  .vj-dcard { grid-template-columns: 140px 1fr; }
  .vj-dest-big { grid-template-columns: 1fr 1fr; }
  .vj-big-imgs img { height: 100%; min-height: 340px; }
  .vj-gal { grid-template-columns: repeat(4, 1fr); }
  .vj-sticky { display: none; }
  .vj-formcard { padding: 32px 32px; }
  .vj-foot { padding-bottom: 56px; }
}
`;

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,600;0,700;1,400;1,700&display=swap';

function useFuente() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);
}

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

const lista = (x) => (Array.isArray(x) ? x : []);

const ViajePublico = ({ slug }) => {
  useFuente();
  const [viaje, setViaje] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', tel: '', email: '', ciudad: '', mensaje: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const fuente = fuenteDeUrl();

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc('viaje_obtener_publico', { p_slug: slug });
      if (e) console.error('[viaje] cargar', e);
      setViaje(data || null);
      setLoading(false);
      const w = data?.web;
      if (w) document.title = [w.titulo, w.titulo2].filter(Boolean).join(' ') + (w.mes ? ` · ${w.mes}` : '');
    })();
  }, [slug]);

  // El botón flotante (móvil) se esconde cuando el formulario ya está a la vista
  useEffect(() => {
    const el = document.getElementById('interes');
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [viaje]);

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
      <div style={{ fontStyle: 'italic', color: '#8A8470', fontSize: 18 }}>Cargando…</div>
    </div>;
  }

  if (!viaje?.web) {
    return <div className="vj" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <style>{CSS}</style>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Página no disponible</div>
        <div style={{ color: '#4A4632' }}>Este viaje ya no está publicado.</div>
      </div>
    </div>;
  }

  const w = viaje.web;
  const destinos = lista(w.destinos);
  const galeria = lista(w.galeria);
  const preguntas = lista(w.preguntas);
  const dest = w.destacado || null;
  const aloj = w.alojamiento || null;
  const nombreViaje = [w.titulo, w.titulo2].filter(Boolean).join(' ') || 'viaje';
  const waDirecto = waLink(w.whatsapp, `Hola! Quiero información del ${nombreViaje} 🙏`);
  const cta = w.ctaTexto || 'Quiero información';

  return (
    <div className="vj">
      <style>{CSS}</style>

      <header className="vj-wrap">
        <div className="vj-hero">
          <div>
            {w.eyebrow && <div className="vj-kicker">{w.eyebrow}</div>}
            <h1 className="vj-h1">{w.titulo}{w.titulo2 && <span>{w.titulo2}</span>}</h1>
            {w.mes && <div className="vj-mes">{w.mes}</div>}
            {w.fechas && <div className="vj-fechas">{w.fechas}</div>}
            {w.subtitulo && <p className="vj-sub">{w.subtitulo}</p>}
            <a href="#interes" className="vj-btn vj-btn-o">{cta} →</a>
          </div>
          {w.imagenHero && <img className="vj-hero-img" src={w.imagenHero} alt="" />}
        </div>
      </header>

      <main>
        {w.intro && (
          <section className="vj-sec vj-narrow">
            <div className="vj-kicker">El viaje</div>
            <hr className="vj-rule" />
            <p className="vj-p" style={{ fontSize: 19 }}>{w.intro}</p>
          </section>
        )}

        {destinos.length > 0 && (
          <section className="vj-sec vj-wrap">
            <div className="vj-kicker">{w.destinosKicker || 'Recorrido'}</div>
            <h2 className="vj-h2">{w.destinosTitulo || 'Visitaremos estas ciudades'}</h2>
            <div className="vj-dest">
              {destinos.map((d, i) => (
                <div key={i} className="vj-dcard">
                  <div className={`vj-dimg${d.contain ? ' contain' : ''}`}>{d.img && <img src={d.img} alt={d.nombre} loading="lazy" />}</div>
                  <div className="vj-dbody">
                    <div className="vj-dn">{String(i + 1).padStart(2, '0')}</div>
                    <div className="vj-dt">{d.nombre}</div>
                    {d.texto && <p className="vj-dd">{d.texto}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {dest && (
          <section className="vj-sec vj-wrap">
            <div className="vj-dest-big">
              <div style={{ padding: '30px 24px' }}>
                {dest.kicker && <div className="vj-kicker">{dest.kicker}</div>}
                <h2 className="vj-h2" style={{ color: '#F7F3EA' }}>{dest.titulo}</h2>
                {dest.con && <div style={{ fontSize: 14, letterSpacing: '.24em', textTransform: 'uppercase', marginBottom: 2 }}>con</div>}
                {dest.con && <div style={{ fontSize: 28, fontStyle: 'italic', fontWeight: 700, marginBottom: 16 }}>{dest.con}</div>}
                {dest.texto && <p className="vj-p">{dest.texto}</p>}
              </div>
              {lista(dest.imgs).length > 0 && (
                <div className="vj-big-imgs">{lista(dest.imgs).slice(0, 2).map((s, i) => <img key={i} src={s} alt="" loading="lazy" />)}</div>
              )}
            </div>
          </section>
        )}

        {galeria.length > 0 && (
          <section className="vj-sec vj-wrap">
            <div className="vj-gal">{galeria.map((s, i) => <img key={i} src={s} alt="" loading="lazy" />)}</div>
          </section>
        )}

        {aloj && (
          <section className="vj-sec vj-narrow">
            <div className="vj-kicker">{aloj.kicker || 'Alojamiento'}</div>
            <h2 className="vj-h2">{aloj.titulo}</h2>
            {aloj.texto && <p className="vj-p">{aloj.texto}</p>}
            {lista(aloj.imgs).length > 0 && <div className="vj-aloj">{lista(aloj.imgs).map((s, i) => <img key={i} src={s} alt="" loading="lazy" />)}</div>}
          </section>
        )}

        {preguntas.length > 0 && (
          <section className="vj-sec vj-narrow">
            <h2 className="vj-h2">Preguntas frecuentes</h2>
            <div className="vj-faq">
              {preguntas.map((q, i) => (
                <details key={i}>
                  <summary>{q.p}</summary>
                  <p className="vj-p" style={{ fontSize: 15.5 }}>{q.r}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section id="interes" className="vj-sec vj-narrow" style={{ scrollMarginTop: 16, paddingBottom: 12 }}>
          <div className="vj-formcard">
            {enviado ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div className="vj-h2" style={{ marginBottom: 10 }}>¡Recibido!</div>
                <p className="vj-p" style={{ marginBottom: 20 }}>{w.graciasTexto || 'Gracias por tu interés. Te escribiremos pronto.'}</p>
                {waDirecto && <a className="vj-btn vj-btn-wa" href={waDirecto} target="_blank" rel="noopener noreferrer">Escribirnos ahora por WhatsApp</a>}
              </div>
            ) : (
              <form className="vj-form" onSubmit={enviar} noValidate>
                <div>
                  {w.cupos && <div className="vj-kicker">{w.cupos}</div>}
                  <h2 className="vj-h2" style={{ marginBottom: 8 }}>{w.formTitulo || '¿Te sumas?'}</h2>
                  <p className="vj-p" style={{ fontSize: 15.5 }}>{w.formTexto || 'Déjanos tus datos y te escribimos con toda la información.'}</p>
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
                <button className="vj-btn vj-btn-o" type="submit" disabled={enviando} style={{ width: '100%' }}>
                  {enviando ? 'Enviando…' : cta}
                </button>
                {waDirecto && (
                  <a href={waDirecto} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', fontSize: 14, color: '#4A4632' }}>
                    ¿Prefieres escribirnos directo? WhatsApp →
                  </a>
                )}
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="vj-foot">{w.pie || 'Sofía Lira Yoga'}</footer>

      {!enviado && (
        <div className="vj-sticky" style={{ opacity: formVisible ? 0 : 1, pointerEvents: formVisible ? 'none' : 'auto' }}>
          <a href="#interes" className="vj-btn vj-btn-o">{cta}</a>
        </div>
      )}
    </div>
  );
};

export { ViajePublico };
