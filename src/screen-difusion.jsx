import React from 'react';

const { useState, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────
// DifusionScreen — Flujo guiado para mandar el mismo mensaje a varios
// inscritos uno por uno. Sin API: abre WhatsApp con el mensaje pre-cargado
// y Sofía toca "enviar" en WA. Al volver, marca como enviado y avanza.
// ─────────────────────────────────────────────────────────────────────

const cleanPhone = (tel) => (tel || '').replace(/[^\d]/g, '');
const buildWaUrl = (tel, mensaje) => {
  const phone = cleanPhone(tel);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
};

const DifusionScreen = ({ store, onClose }) => {
  const [step, setStep] = useState('elegir');  // elegir | mensaje | enviar
  const [audiencia, setAudiencia] = useState('todos'); // todos | pendientes | bono
  const [plantilla, setPlantilla] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [enviados, setEnviados] = useState(new Set());
  const [idx, setIdx] = useState(0);

  const plantillas = store.state.ajustes.plantillasWA || [];
  const firstName = (n) => (n || '').split(' ')[0];

  const destinatarios = useMemo(() => {
    let lista = store.state.alumnas.filter(a => a.tel);
    if (audiencia === 'pendientes') lista = lista.filter(a => a.pago === 'pendiente' || a.pago === 'parcial');
    if (audiencia === 'bono') lista = lista.filter(a => a.bonoSilla);
    return lista;
  }, [store.state.alumnas, audiencia]);

  const personalizar = (cuerpo, alumna) => {
    const nombre = firstName(alumna?.nombre);
    if (!cuerpo) return '';
    if (!nombre) return cuerpo;
    return cuerpo.replace(/^Hola!?,?/i, `Hola ${nombre}!`);
  };

  const elegirPlantilla = (p) => {
    setPlantilla(p);
    setMensaje(p.cuerpo);
    setStep('enviar');
    setIdx(0);
    setEnviados(new Set());
  };

  const escribirCustom = () => {
    setPlantilla({ id: 'custom', titulo: 'Mensaje personalizado', cuerpo: '' });
    setMensaje('');
    setStep('mensaje');
  };

  const confirmarMensaje = () => {
    if (!mensaje.trim()) return;
    setStep('enviar');
    setIdx(0);
    setEnviados(new Set());
  };

  const actual = destinatarios[idx];
  const completado = idx >= destinatarios.length;
  const waUrl = actual ? buildWaUrl(actual.tel, personalizar(mensaje, actual)) : null;

  const marcarEnviado = () => {
    if (actual) setEnviados(s => new Set([...s, actual.id]));
    if (idx < destinatarios.length - 1) setIdx(idx + 1);
    else setIdx(destinatarios.length); // estado completado
  };

  const saltar = () => {
    if (idx < destinatarios.length - 1) setIdx(idx + 1);
    else setIdx(destinatarios.length);
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Inscritos
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">Mensajería guiada</div>
          <h1>Difusión a inscritos</h1>
        </div>

        {/* Paso 1 — Elegir audiencia y plantilla */}
        {step === 'elegir' && (
          <div style={{ padding: '0 22px' }}>
            <div className="section-title" style={{ paddingLeft: 0 }}><h2 style={{ marginLeft: 0 }}>A quién</h2></div>
            <div className="segmented" style={{ marginBottom: 18 }}>
              <button className={audiencia === 'todos' ? 'active' : ''} onClick={() => setAudiencia('todos')}>
                Todos · {store.state.alumnas.filter(a => a.tel).length}
              </button>
              <button className={audiencia === 'pendientes' ? 'active' : ''} onClick={() => setAudiencia('pendientes')}>
                Con pago pendiente · {store.state.alumnas.filter(a => a.tel && (a.pago === 'pendiente' || a.pago === 'parcial')).length}
              </button>
              <button className={audiencia === 'bono' ? 'active' : ''} onClick={() => setAudiencia('bono')}>
                Bono silla · {store.state.alumnas.filter(a => a.tel && a.bonoSilla).length}
              </button>
            </div>

            <div className="section-title" style={{ paddingLeft: 0 }}><h2 style={{ marginLeft: 0 }}>Mensaje</h2></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plantillas.map(p => (
                <button
                  key={p.id}
                  onClick={() => elegirPlantilla(p)}
                  className="card flat"
                  style={{
                    padding: 14, textAlign: 'left',
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--line-soft)',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>{p.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4, lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.cuerpo}
                  </div>
                </button>
              ))}

              <button
                onClick={escribirCustom}
                className="card flat"
                style={{
                  padding: 14, textAlign: 'left',
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px dashed var(--line-soft)',
                  color: 'var(--ink-soft)', fontSize: 13,
                }}
              >
                + Escribir mensaje personalizado
              </button>
            </div>

            {destinatarios.length === 0 && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'var(--bg-warm)', fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center' }}>
                No hay inscritos con teléfono en esta selección.
              </div>
            )}
          </div>
        )}

        {/* Paso 2 — Editar mensaje custom */}
        {step === 'mensaje' && (
          <div style={{ padding: '0 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 8 }}>
              Escribe el mensaje. Si empiezas con "Hola!" se personaliza con el primer nombre de cada estudiante.
            </div>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={6}
              placeholder="Hola! Te recuerdo que..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: '1px solid var(--line-soft)', fontFamily: 'inherit',
                fontSize: 14, color: 'var(--ink)', background: 'var(--surface)',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setStep('elegir')} className="btn btn-ghost" style={{ flex: 1 }}>Atrás</button>
              <button onClick={confirmarMensaje} className="btn btn-primary" style={{ flex: 1 }} disabled={!mensaje.trim()}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Paso 3 — Enviar uno por uno */}
        {step === 'enviar' && (
          <div style={{ padding: '0 22px' }}>
            {/* Progreso */}
            <div className="card flat" style={{ padding: 14, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 500 }}>
                  Progreso
                </span>
                <span className="serif" style={{ fontSize: 18 }}>
                  {Math.min(idx, destinatarios.length)}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/{destinatarios.length}</span>
                </span>
              </div>
              <div className="progress">
                <div style={{ width: `${(Math.min(idx, destinatarios.length) / Math.max(1, destinatarios.length)) * 100}%` }} />
              </div>
            </div>

            {!completado && actual && (
              <>
                <div className="card flat" style={{ padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div className="avatar" style={{ background: actual.avatar }}>{actual.iniciales}</div>
                    <div style={{ flex: 1 }}>
                      <div className="serif" style={{ fontSize: 19, lineHeight: 1.2, color: 'var(--ink)' }}>{actual.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{actual.tel}</div>
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--bg-warm)', padding: 12, borderRadius: 10,
                    fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.45,
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {personalizar(mensaje, actual)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saltar} className="btn btn-ghost" style={{ flex: 1 }}>
                    Saltar
                  </button>
                  {waUrl && (
                    <a
                      href={waUrl} target="_blank" rel="noopener noreferrer"
                      onClick={() => setTimeout(marcarEnviado, 300)}
                      style={{
                        flex: 2, padding: '12px 16px', borderRadius: 999,
                        background: '#25D366', color: '#fff',
                        fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                        textDecoration: 'none', textAlign: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Icon name="whatsapp" size={15} stroke="#fff" />
                      Abrir WhatsApp
                    </a>
                  )}
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center', fontStyle: 'italic' }}>
                  Después de enviar en WhatsApp, vuelve a esta pestaña — avanza al siguiente automático.
                </div>
              </>
            )}

            {completado && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>🌿</div>
                <h2 className="serif" style={{ fontSize: 26, marginTop: 16, color: 'var(--ink)' }}>
                  Difusión completada
                </h2>
                <p style={{ color: 'var(--ink-soft)', marginTop: 10, fontSize: 13 }}>
                  Enviaste {enviados.size} mensajes de {destinatarios.length}.
                </p>
                <button onClick={onClose} className="btn btn-primary" style={{ marginTop: 22, width: '100%' }}>
                  Volver
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

window.DifusionScreen = DifusionScreen;
export { DifusionScreen };
