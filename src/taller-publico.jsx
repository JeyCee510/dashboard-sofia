import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// TallerPublico — Página pública (sin auth) para inscribirse a un
// taller drop-in modular. Funciona en 2 modos:
//
//   1) /taller/<slug>           → form abierto (cualquiera puede entrar)
//   2) /taller/<slug>/i/<token> → link personalizado prellenado (admin
//      generó token desde un lead/inscrita conocida)
//
// Flow:
//   - Carga proyecto + encuentros con cupos en vivo (RPC public)
//   - Si hay token, carga preinscripción (prefill nombre/tel)
//   - Usuario elige cuántos encuentros (1, 2, 3 o paquete completo)
//   - Submit llama RPC `taller_completar_preinscripcion`
//   - Tras éxito, redirige a /taller-comprobante/<comprobante_token>
//
// Aprendizajes aplicados:
//   - Realtime para cupos (channel filtrado por proyecto_id)
//   - touch-action: manipulation
//   - SI hay token y ya está completada, redirige al comprobante
//   - Validación de cupos en cliente (defensiva) + el RPC lo refuerza
// ─────────────────────────────────────────────────────────────────

const fechaLarga = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[dt.getDay()]} ${d} de ${meses[m-1]}`;
};

const money = (n) => `$${Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;

function precioPorN(config, n) {
  const tiers = config?.tiers || {};
  if (tiers[String(n)] != null) return Number(tiers[String(n)]);
  return Number(tiers.default || 0) * n;
}

const TallerPublico = ({ slug, token = null }) => {
  const [proyecto, setProyecto] = useState(null);
  const [encuentros, setEncuentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errCarga, setErrCarga] = useState(null);

  // Form fields (precargados desde token si existe)
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [instagram, setInstagram] = useState('');
  const [email, setEmail] = useState('');
  const [selIds, setSelIds] = useState([]);

  // Pre / submit state
  const [preinscripcion, setPreinscripcion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errSubmit, setErrSubmit] = useState(null);
  const [exito, setExito] = useState(null);

  // ── Cargar proyecto + encuentros ──
  const cargar = async () => {
    const { data, error } = await supabase.rpc('taller_obtener_publico', { p_slug: slug });
    if (error || !data) {
      setErrCarga(error?.message || 'No se encontró el taller');
      setLoading(false);
      return;
    }
    setProyecto(data.proyecto);
    setEncuentros(data.encuentros);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // Realtime: cupos
    const ch = supabase.channel(`taller-publico-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taller_inscripciones_encuentros' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Cargar preinscripción si hay token ──
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc('taller_cargar_preinscripcion', { p_token: token });
      if (error || !data) return;
      setPreinscripcion(data);
      // Si ya completó, redirige al comprobante
      if (data.completada_at && data.inscrito_id) {
        const { data: insc } = await supabase
          .from('taller_inscritos')
          .select('comprobante_token')
          .eq('id', data.inscrito_id)
          .single();
        if (insc?.comprobante_token) {
          window.location.href = `/taller-comprobante/${insc.comprobante_token}`;
          return;
        }
      }
      // Prefill
      if (data.nombre) setNombre(data.nombre);
      if (data.tel) setTel(data.tel);
      if (data.instagram) setInstagram(data.instagram);
      if (data.email) setEmail(data.email);
    })();
  }, [token]);

  const toggle = (id) => {
    setSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const total = useMemo(() => precioPorN(proyecto?.config, selIds.length), [selIds, proyecto]);

  // ── Submit ──
  const enviar = async () => {
    setErrSubmit(null);
    if (!nombre.trim()) { setErrSubmit('Falta tu nombre'); return; }
    if (selIds.length === 0) { setErrSubmit('Elige al menos un encuentro'); return; }
    if (!tel.trim()) { setErrSubmit('Necesitamos un WhatsApp para contactarte'); return; }

    setEnviando(true);

    // Dos paths:
    //  - Con token (link personalizado): completar la preinscripción existente
    //  - Sin token (link público): RPC abierto que crea inscrito + preinscripción
    const rpcName = token ? 'taller_completar_preinscripcion' : 'taller_inscripcion_publica';
    const args = token
      ? { p_token: token, p_nombre: nombre, p_tel: tel, p_instagram: instagram || null, p_email: email || null, p_encuentros_ids: selIds }
      : { p_slug: slug, p_nombre: nombre, p_tel: tel, p_instagram: instagram || null, p_email: email || null, p_encuentros_ids: selIds };

    const { data, error } = await supabase.rpc(rpcName, args);
    if (error) {
      setErrSubmit(error.message || 'No se pudo enviar');
      setEnviando(false);
      return;
    }
    setExito(data);
    // Redirigir a la página de comprobante
    if (data?.comprobante_token) {
      setTimeout(() => {
        window.location.href = `/taller-comprobante/${data.comprobante_token}`;
      }, 1500);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>Cargando taller...</div>;
  if (errCarga) return <div style={{ padding: 60, textAlign: 'center' }}>
    <h2 style={{ color: 'var(--terracota)' }}>No encontramos este taller</h2>
    <p style={{ color: 'var(--ink-soft)' }}>{errCarga}</p>
  </div>;

  if (exito) {
    return (
      <div style={{ padding: 30, maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, margin: '12px 0' }}>
          ¡Tu inscripción está registrada!
        </h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          Total a pagar: <b>{money(exito.total)}</b>
        </p>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
          Te redirigimos en un momento para que subas tu comprobante de transferencia...
        </p>
      </div>
    );
  }

  const precios = proyecto?.config?.precios_label || [];

  return (
    <div style={{ padding: '24px 18px 60px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Sofía Lira · Yoga
      </div>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 34, lineHeight: 1.05, margin: '4px 0 8px', fontWeight: 600,
      }}>
        {proyecto.nombre}
      </h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 18 }}>
        {proyecto.descripcion}
      </p>

      {/* Tabla de precios */}
      {precios.length > 0 && (
        <div style={{ marginBottom: 22, padding: 14, background: 'var(--bg-warm)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Inversión
          </div>
          {precios.map(p => (
            <div key={p.encuentros} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
              <span>{p.label}</span>
              <span style={{ fontWeight: 600 }}>{money(p.precio)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Encuentros */}
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Elige los encuentros a los que vas
      </div>
      <div style={{ marginBottom: 18 }}>
        {encuentros.map(e => {
          const sel = selIds.includes(e.id);
          const lleno = e.ocupados >= e.cupos;
          return (
            <button
              key={e.id}
              disabled={lleno && !sel}
              onClick={() => !lleno && toggle(e.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: 14, marginBottom: 8,
                borderRadius: 'var(--r-md)', cursor: lleno ? 'not-allowed' : 'pointer',
                border: `1.5px solid ${sel ? 'var(--terracota)' : 'var(--line)'}`,
                background: sel ? 'var(--terracota-tint)' : 'var(--surface)',
                opacity: lleno && !sel ? 0.45 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Encuentro {e.numero}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600 }}>
                    {fechaLarga(e.fecha)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {e.hora_inicio}–{e.hora_fin} · {e.ubicacion}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: lleno ? 'var(--terracota)' : 'var(--ink-mute)' }}>
                  {lleno ? 'LLENO' : `${e.cupos - e.ocupados} libres`}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Resumen total */}
      {selIds.length > 0 && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 'var(--r-md)',
          background: 'var(--terracota-tint)', border: '1.5px solid var(--terracota)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>
              {selIds.length} encuentro{selIds.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--terracota)' }}>{money(total)}</div>
          </div>
        </div>
      )}

      {/* Datos personales */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Tu nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} className="input" style={{ width: '100%' }} placeholder="Nombre completo" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>WhatsApp</label>
        <input value={tel} onChange={e => setTel(e.target.value)} className="input" style={{ width: '100%' }} placeholder="+593 9..." inputMode="tel" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Instagram (opcional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--ink-mute)' }}>@</span>
          <input value={instagram} onChange={e => setInstagram(e.target.value)} className="input" style={{ flex: 1 }} placeholder="handle" />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Email (opcional)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} className="input" style={{ width: '100%' }} placeholder="tu@email.com" inputMode="email" />
      </div>

      {errSubmit && (
        <div style={{ padding: 10, marginBottom: 12, color: 'var(--terracota)', background: 'var(--terracota-tint)', borderRadius: 'var(--r-md)', fontSize: 13 }}>
          {errSubmit}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={enviando || selIds.length === 0 || !nombre.trim() || !tel.trim()}
        className="btn btn-primary"
        style={{ width: '100%', padding: '14px', fontSize: 15 }}
      >
        {enviando ? 'Enviando...' : `Confirmar inscripción · ${money(total)}`}
      </button>

      <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
        Tras confirmar, te abrimos una página privada para subir el comprobante de transferencia.
      </p>
    </div>
  );
};

window.TallerPublico = TallerPublico;
export { TallerPublico };
