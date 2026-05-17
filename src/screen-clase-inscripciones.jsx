import React from 'react';
import { useClasesAbiertas, useInscripcionesClase } from './hooks/useClasesAbiertas.js';
import { usePreinscripciones } from './hooks/usePreinscripciones.js';
import { buildWaUrl } from './lib/wa.js';
import { supabase } from './lib/supabase.js';

const { useState, useMemo, useEffect } = React;

// Fuzzy match: nombre → persona (lead o alumna). NO requiere tel — útil
// para detectar leads recién creados desde el flow follow-up que aún no
// tienen teléfono. Si necesitas el tel para WA, lee `persona.tel` (puede
// ser null y el caller cae al fallback "copiar mensaje").
function buscarPersonaPorNombre(nombre, leads = [], alumnas = []) {
  const norm = (s) => (s || '').toLowerCase().trim();
  const tokens = (s) => norm(s).split(/\s+/).filter(Boolean);
  const target = tokens(nombre);
  if (target.length === 0) return null;
  const candidatos = [
    ...alumnas.map(a => ({ ...a, kind: 'alumna' })),
    ...leads.map(l => ({ ...l, kind: 'lead' })),
  ];
  for (const c of candidatos) {
    const cTokens = tokens(c.nombre);
    if (cTokens.length === 0) continue;
    if (norm(c.nombre) === norm(nombre)) return c;
    const overlap = target.filter(t => cTokens.some(q => q.startsWith(t) || t.startsWith(q))).length;
    if (overlap >= 2) return c;
  }
  return null;
}

// Helper compat para los call sites que esperan {tel, persona}.
function buscarTelPorNombre(nombre, leads, alumnas) {
  const persona = buscarPersonaPorNombre(nombre, leads, alumnas);
  return { tel: persona?.tel || null, persona };
}

// ─────────────────────────────────────────────────────────────────────
// ClaseInscripcionesScreen — admin de inscripciones a una clase abierta.
// Muestra cupos disponibles, lista de inscritos, botón copiar link.
// ─────────────────────────────────────────────────────────────────────

const ClaseInscripcionesScreen = ({ onClose, store }) => {
  // Icon se lee acá adentro (no al top-level del módulo) porque main.jsx
  // ahora carga los módulos en paralelo con Promise.all, así que cuando
  // este archivo se evalúa, icons.jsx puede no haber registrado window.Icon
  // todavía. Patrón: leer globals en render-time.
  const Icon = window.Icon;
  const { activa, loading: loadingClase } = useClasesAbiertas();
  const { items, loading: loadingInsc, eliminar } = useInscripcionesClase(activa?.id);
  const [copiado, setCopiado] = useState(false);
  const [busy, setBusy] = useState(null);

  // Plantillas + state desde store
  const plantillas = store?.state?.ajustes?.plantillasWA || [];
  const plantillaRecordatorio = plantillas.find(p => p.id === 'recordatorio_clase');
  const plantillaFollowup     = plantillas.find(p => p.id === 'followup_clase');
  const fechaProntoPago = store?.state?.ajustes?.fechaProntoPago || '';
  const leadsList   = store?.state?.leads   || [];
  const alumnasList = store?.state?.alumnas || [];

  // Inscripciones a la formación (preinscripciones). Realtime: cuando
  // alguien llena el form que le mandamos en el follow-up, aparece acá.
  const { items: preinsc } = usePreinscripciones();
  // Map lead_id → preinscripcion (puede ser null si aún no respondió)
  const preinscByLead = useMemo(() => {
    const m = new Map();
    (preinsc || []).forEach(p => { if (p.lead_id) m.set(p.lead_id, p); });
    return m;
  }, [preinsc]);
  // Helper: para un inscrito a la clase, ¿hay preinscripcion completada de su lead?
  const inscritoRespondioForm = (inscrito) => {
    const persona = buscarPersonaPorNombre(inscrito.nombre, leadsList, alumnasList);
    if (!persona || persona.kind !== 'lead') return null;
    const pre = preinscByLead.get(persona.id);
    if (!pre) return null;
    const completada = pre.estado === 'completada' || !!pre.completed_at;
    return completada ? pre : null;
  };

  // ¿Ya pasó la clase? Comparamos timestamp completo (fecha + hora_fin).
  // Antes solo comparábamos fecha → mismo día daba false aunque la clase
  // hubiera terminado horas antes. Ahora: si ya pasó la hora_fin, yaPaso=true.
  const yaPaso = (() => {
    if (!activa?.fecha) return false;
    if (activa.hora_fin) {
      // Asumimos zona Ecuador (UTC-5) si no viene info de TZ
      const claseFin = new Date(`${activa.fecha}T${activa.hora_fin}-05:00`).getTime();
      if (!isNaN(claseFin)) return Date.now() > claseFin;
    }
    // Fallback: solo comparar fecha
    const hoyStr = new Date().toISOString().slice(0, 10);
    return activa.fecha < hoyStr;
  })();

  // Tracking local: para qué leadId ya marcamos follow-up enviado en esta sesión
  // (el dato real vive en leads.followup_clase_enviado_at via realtime).
  const [followupBusy, setFollowupBusy] = useState(null);   // inscritoId que se está procesando
  const [followupError, setFollowupError] = useState({});   // { [inscritoId]: 'msg' }

  const link = activa ? `${window.location.origin}/clase/${activa.slug}` : '';
  const cuposDisponibles = activa ? Math.max(0, activa.cupos_max - items.length) : 0;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };

  const onEliminar = async (item) => {
    if (!confirm(`¿Sacar a ${item.nombre} de la lista? Su cupo queda libre para otra persona.`)) return;
    setBusy(item.id);
    try { await eliminar(item.id); } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  // ─────────────────────────────────────────────────────────────────────
  // Follow-up: prepara link de inscripción tokenizado por inscrito y arma
  // mensaje WhatsApp. Si el inscrito no existe como lead, lo crea.
  // ─────────────────────────────────────────────────────────────────────
  const prepararFollowup = async (inscrito) => {
    // 1) Buscar lead existente por nombre (fuzzy)
    let lead = buscarTelPorNombre(inscrito.nombre, leadsList, alumnasList).persona;
    let leadId = lead?.kind === 'lead' ? lead.id : null;

    // 2) Si no hay lead, crearlo desde el inscrito
    if (!leadId) {
      const { data: nuevo, error: errLead } = await supabase
        .from('leads').insert({
          nombre: inscrito.nombre,
          fuente: 'otro',
          estado: 'interesado',
          mensaje: `Vino a la clase abierta del ${activa.fecha}. Email: ${inscrito.email || '(sin email)'}.`,
        }).select().single();
      if (errLead) throw errLead;
      leadId = nuevo.id;
    }

    // 3) Generar token de inscripción
    const { data: token, error: errTok } = await supabase
      .rpc('crear_preinscripcion', { p_lead_id: leadId });
    if (errTok) throw errTok;
    const linkIns = `${window.location.origin}/preinscripcion/${token}`;

    // 4) Construir mensaje sustituyendo placeholders
    const firstName = (inscrito.nombre || '').split(' ')[0];
    const cuerpo = (plantillaFollowup?.cuerpo || '')
      .replace('[Nombre]', firstName)
      .replace('[fechaProntoPago]', fechaProntoPago || 'el lunes')
      .replace('[LINK_INSCRIPCION]', linkIns);

    return { leadId, leadTel: lead?.tel || null, mensaje: cuerpo, linkIns };
  };

  const enviarFollowup = async (inscrito) => {
    // CRÍTICO iOS Safari/PWA: window.open DEBE invocarse sincrónicamente
    // dentro del click handler. Después de un `await` se pierde el contexto
    // de user gesture y Safari/PWA bloquea la apertura silenciosamente.
    // Solución: abrir una ventana vacía YA y luego redirigirla cuando
    // tengamos el URL listo.
    const waWin = window.open('', '_blank');
    setFollowupBusy(inscrito.id);
    setFollowupError(e => ({ ...e, [inscrito.id]: '' }));
    try {
      const { leadId, leadTel, mensaje } = await prepararFollowup(inscrito);
      // Marcar tracking
      await supabase.from('leads').update({
        followup_clase_enviado_at: new Date().toISOString(),
      }).eq('id', leadId);
      if (leadTel) {
        const waUrl = buildWaUrl(leadTel, mensaje);
        if (waWin && !waWin.closed) {
          waWin.location.href = waUrl;
        } else {
          // Fallback: la ventana se cerró o fue bloqueada → asignar URL al
          // top-level. Si no se redirige, copiamos el mensaje al clipboard.
          window.location.href = waUrl;
        }
      } else {
        // Sin tel: cerrar la ventana vacía y copiar mensaje
        if (waWin && !waWin.closed) waWin.close();
        try { await navigator.clipboard.writeText(mensaje); }
        catch {
          const ta = document.createElement('textarea'); ta.value = mensaje;
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        alert('Sin teléfono · mensaje copiado al portapapeles. Pegalo en WhatsApp / Instagram manualmente.');
      }
    } catch (e) {
      console.error('[followup]', e);
      setFollowupError(prev => ({ ...prev, [inscrito.id]: e.message || 'Error' }));
      if (waWin && !waWin.closed) waWin.close();
    } finally {
      setFollowupBusy(null);
    }
  };

  // ¿Este inscrito ya recibió follow-up? Lo derivamos del lead match.
  const yaRecibioFollowup = (inscrito) => {
    const persona = buscarTelPorNombre(inscrito.nombre, leadsList, alumnasList).persona;
    if (persona?.kind !== 'lead') return false;
    return !!persona.followupClaseEnviadoAt;
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Atrás
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">{yaPaso ? 'Post-evento · clase de prueba' : 'Evento'}</div>
          <h1>{yaPaso ? 'Inscripciones recibidas' : 'Clase abierta'}</h1>
        </div>

        {(loadingClase || !activa) ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            {loadingClase ? 'Cargando…' : 'No hay clase activa.'}
          </div>
        ) : (
          <>
            {/* Datos de la clase */}
            <div style={{ padding: '0 22px 14px' }}>
              <div className="card flat" style={{ padding: 16 }}>
                <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.2 }}>
                  {activa.titulo}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  📅 {fmtFecha(activa.fecha)}<br/>
                  🕗 {activa.hora_inicio?.slice(0,5)}–{activa.hora_fin?.slice(0,5)}<br/>
                  📍 {activa.ubicacion}
                </div>
              </div>
            </div>

            {/* Cupos */}
            <div style={{ padding: '0 22px 14px', display: 'flex', gap: 10 }}>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
                <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', lineHeight: 1 }}>
                  {items.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Inscritos
                </div>
              </div>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center', background: cuposDisponibles === 0 ? '#F0D5CE' : 'var(--terracota-tint)', borderColor: 'transparent' }}>
                <div className="serif" style={{ fontSize: 28, color: cuposDisponibles === 0 ? 'var(--rojo)' : '#8A3D26', lineHeight: 1 }}>
                  {cuposDisponibles}
                </div>
                <div style={{ fontSize: 10, color: cuposDisponibles === 0 ? 'var(--rojo)' : '#8A3D26', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Cupos libres
                </div>
              </div>
              <div className="card flat" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
                <div className="serif" style={{ fontSize: 28, color: 'var(--ink-mute)', lineHeight: 1 }}>
                  {activa.cupos_max}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                  Cupos máx
                </div>
              </div>
            </div>

            {/* Link compartible */}
            <div style={{ padding: '0 22px 14px' }}>
              <div className="card flat" style={{ padding: 14, background: '#F2E2C2', borderColor: 'transparent' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: 8 }}>
                  Link público de la clase
                </div>
                <div style={{
                  background: 'var(--surface)', padding: '8px 12px', borderRadius: 8,
                  fontSize: 11, fontFamily: 'monospace', color: 'var(--ink)', wordBreak: 'break-all',
                }}>{link}</div>
                <button
                  type="button" onClick={copiar}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px 12px', borderRadius: 10,
                    background: copiado ? 'var(--oliva)' : 'var(--surface)',
                    color: copiado ? '#fff' : 'var(--ink)',
                    border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
              </div>
            </div>

            {/* Lista de inscritos */}
            <div className="section-title">
              <h2>Inscritos · {items.length}</h2>
            </div>
            <div style={{ padding: '0 22px 24px' }}>
              {loadingInsc ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
              ) : items.length === 0 ? (
                <div className="card flat" style={{ padding: 22, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
                  Aún nadie se ha inscrito.
                </div>
              ) : (
                <div className="card flat" style={{ padding: '4px 16px' }}>
                  {items.map(item => {
                    const persona = buscarPersonaPorNombre(item.nombre, leadsList, alumnasList);
                    const esAlumnaInscrita = persona?.kind === 'alumna';
                    const tel = persona?.tel || null;
                    const firstName = (item.nombre || '').split(' ')[0];
                    // Recordatorio (pre-clase) — mismo flow simple sync
                    const cuerpoRec = plantillaRecordatorio?.cuerpo || '';
                    const mensajeRec = cuerpoRec.replace('querida(o)', `querida(o) ${firstName}`);
                    const waUrlRec = tel ? buildWaUrl(tel, mensajeRec) : null;
                    // Follow-up tracking (lead-only). Si el lead no existe aún
                    // = false; si existe y ya marcamos enviado = true.
                    const followupEnviado = persona?.kind === 'lead' && !!persona.followupClaseEnviadoAt;
                    const seInscribio = inscritoRespondioForm(item);
                    const busyFollowup = followupBusy === item.id;
                    const errFollowup = followupError[item.id];
                    return (
                    <div key={item.id} className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="body">
                        <div className="t1" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {item.nombre}
                          {seInscribio && (
                            <span style={{
                              fontSize: 9, padding: '2px 8px', borderRadius: 999,
                              background: 'var(--oliva)', color: '#fff',
                              letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700,
                            }}>✓ Se inscribió a formación</span>
                          )}
                          {!seInscribio && esAlumnaInscrita && (
                            <span style={{
                              fontSize: 9, padding: '2px 8px', borderRadius: 999,
                              background: 'var(--bg-warm)', color: 'var(--ink-mute)',
                              letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500,
                            }}>ya inscrita</span>
                          )}
                        </div>
                        <div className="t2">{item.email || '(sin email)'}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>
                          {new Date(item.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {/* Si ya es alumna no mostramos follow-up comercial. */}
                        {esAlumnaInscrita ? (
                          <div style={{
                            marginTop: 6, fontSize: 10, color: 'var(--ink-mute)', fontStyle: 'italic',
                          }}>
                            No requiere follow-up · ya pagó su cupo
                          </div>
                        ) : (
                        /* Follow-up (post-clase) vs Recordatorio (pre-clase) */
                        yaPaso && plantillaFollowup ? (
                          <button
                            type="button"
                            onClick={() => enviarFollowup(item)}
                            disabled={busyFollowup}
                            style={{
                              marginTop: 6, padding: '5px 12px', borderRadius: 999,
                              // Si ya se mandó: gris suave con check. Sino: verde.
                              background: followupEnviado ? 'var(--bg-warm)' : '#25D366',
                              color: followupEnviado ? 'var(--ink-mute)' : '#fff',
                              border: followupEnviado ? '1px solid var(--line-soft)' : 'none',
                              fontFamily: 'inherit', fontSize: 11,
                              fontWeight: 500, cursor: busyFollowup ? 'wait' : 'pointer',
                              opacity: busyFollowup ? 0.6 : 1,
                            }}
                          >
                            {busyFollowup ? 'Generando…' : followupEnviado ? '✓ Follow-up enviado · Reenviar' : 'Enviar follow-up'}
                          </button>
                        ) : (!yaPaso && plantillaRecordatorio) ? (
                          waUrlRec ? (
                            <a href={waUrlRec} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'inline-block', marginTop: 6, padding: '4px 10px',
                                borderRadius: 999, background: '#25D366', color: '#fff',
                                fontSize: 11, fontWeight: 500, textDecoration: 'none',
                              }}
                            >Enviar recordatorio</a>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                try { await navigator.clipboard.writeText(mensajeRec); }
                                catch {
                                  const ta = document.createElement('textarea'); ta.value = mensajeRec;
                                  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                                }
                                alert('Mensaje copiado. Pegalo en WhatsApp / IG manualmente.');
                              }}
                              style={{
                                marginTop: 6, padding: '4px 10px', borderRadius: 999,
                                background: 'var(--surface)', border: '1px solid var(--line-soft)',
                                fontFamily: 'inherit', fontSize: 11, color: 'var(--ink-mute)',
                                cursor: 'pointer',
                              }}
                            >Sin tel · Copiar mensaje</button>
                          )
                        ) : null
                        )}
                        {errFollowup && !esAlumnaInscrita && (
                          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--rojo)' }}>{errFollowup}</div>
                        )}
                      </div>
                      <button
                        onClick={() => onEliminar(item)}
                        disabled={busy === item.id}
                        title="Sacar de la lista"
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--ink-mute)', padding: 4, fontSize: 16, opacity: 0.5,
                        }}
                      >×</button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

function fmtFecha(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

window.ClaseInscripcionesScreen = ClaseInscripcionesScreen;
export { ClaseInscripcionesScreen };
