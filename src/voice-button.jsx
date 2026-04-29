import React from 'react';
import { useVoiceCommand, isInAppBrowser, isIOS } from './hooks/useVoiceCommand.js';

const { useState, useEffect } = React;

// Construye un link para abrir la página actual en Safari real desde un webview iOS
function buildSafariLink() {
  const url = window.location.href;
  if (isIOS()) {
    // x-safari-https:// es el deep link para forzar Safari en iOS
    return 'x-safari-' + url; // ej: x-safari-https://dashboard-sofia.vercel.app/
  }
  return url;
}

// ─────────────────────────────────────────────────────────────────────
// VoiceButton — micrófono flotante + modal de confirmación de comando.
// Recibe `onExecute(toolName, parameters)` que es el ejecutor del store.
// ─────────────────────────────────────────────────────────────────────

const VoiceButton = ({ onExecute, executingResult }) => {
  const v = useVoiceCommand();
  const [textInput, setTextInput] = useState('');

  // Cerrar modal cuando una acción se ejecutó exitosamente
  useEffect(() => {
    if (executingResult === 'success') {
      v.reset();
      setTextInput('');
    }
  }, [executingResult]);

  const handleConfirm = () => {
    if (!v.result) return;
    onExecute(v.result.tool_name, v.result.parameters, v.result.transcript);
  };

  const isOpen = v.state !== 'idle';

  return (
    <>
      {/* Botón mic flotante */}
      <button
        onClick={() => {
          if (v.state === 'idle') v.start();
          else if (v.state === 'listening') v.stop();
          else v.reset();
        }}
        aria-label="Asistente de voz"
        style={{
          position: 'absolute',
          bottom: 100, right: 18,
          width: 56, height: 56, borderRadius: '50%',
          background: v.state === 'listening' ? '#E15D43' : 'var(--ink)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 30,
          transition: 'background 0.2s, transform 0.18s',
          transform: v.state === 'listening' ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        {v.state === 'listening' ? (
          <span style={{
            display: 'inline-block', width: 14, height: 14, borderRadius: 3,
            background: '#fff',
          }} />
        ) : v.state === 'processing' ? (
          <span style={{
            display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
            border: '2px solid #fff', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        ) : (
          <Icon name="mic" size={22} stroke="#fff" strokeWidth={2} />
        )}
        {v.state === 'listening' && (
          <span style={{
            position: 'absolute', inset: -6,
            borderRadius: '50%', border: '2px solid #E15D43',
            opacity: 0.5,
            animation: 'pulse 1.2s ease-out infinite',
          }} />
        )}
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          onClick={() => v.reset()}
          style={{
            position: 'absolute', inset: 0, zIndex: 80,
            background: 'rgba(27, 20, 16, 0.55)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Modal */}
      {isOpen && (
        <div style={{
          position: 'absolute', left: 16, right: 16, bottom: 90,
          background: 'var(--surface)',
          borderRadius: 20, padding: 22,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          zIndex: 90,
          animation: 'slideUp 0.25s ease',
          maxHeight: '70vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {v.state === 'listening' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#E15D43', fontWeight: 600 }}>
                Escuchando…
              </div>
              <div className="serif" style={{ fontSize: 22, marginTop: 12, color: 'var(--ink)', minHeight: 50, lineHeight: 1.3 }}>
                {v.interim || v.transcript || <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>Habla ahora…</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button onClick={v.reset} style={btnGhost}>Cancelar</button>
                <button onClick={v.stop} style={btnPrimary}>Listo</button>
              </div>
              <details style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-mute)' }}>
                <summary style={{ cursor: 'pointer' }}>Ejemplos</summary>
                <ul style={{ textAlign: 'left', marginTop: 8, lineHeight: 1.6, paddingLeft: 18 }}>
                  <li>"Anota a Mónica Salinas que escribió por Insta"</li>
                  <li>"María Fernanda pagó doscientos"</li>
                  <li>"Convierte a Lucía en estudiante"</li>
                  <li>"Ábreme la ficha de Andrea"</li>
                  <li>"Cuántos cupos quedan"</li>
                </ul>
              </details>
            </div>
          )}

          {v.state === 'processing' && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{
                display: 'inline-block', width: 32, height: 32, borderRadius: '50%',
                border: '3px solid var(--terracota)', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div style={{ marginTop: 14, color: 'var(--ink-soft)', fontSize: 13 }}>
                Pensando…
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                "{v.transcript}"
              </div>
            </div>
          )}

          {v.state === 'result' && v.result && v.result.tool_name === 'preguntar_clarificacion' && (
            <ClarificationPrompt
              result={v.result}
              onTextResponse={(text) => v.submitText(text, true)}
              onVoiceResponse={() => v.start({ continueConversation: true })}
              onCancel={v.reset}
            />
          )}

          {v.state === 'result' && v.result && v.result.tool_name !== 'preguntar_clarificacion' && (
            <ResultPreview result={v.result} onConfirm={handleConfirm} onCancel={v.reset} onRetry={() => v.start()} />
          )}

          {v.state === 'error' && (
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--terracota)', fontWeight: 600 }}>
                Algo falló
              </div>
              <div style={{ fontSize: 14, marginTop: 10, color: 'var(--ink)', lineHeight: 1.5 }}>
                {v.error}
              </div>

              {/* Botón especial si está en webview de otra app */}
              {isInAppBrowser() && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-warm)', borderRadius: 10, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>Cómo abrir en Safari:</div>
                  {isIOS() ? (
                    <ol style={{ paddingLeft: 18, margin: 0 }}>
                      <li>Toca el botón <strong>compartir</strong> (cuadrado con flecha hacia arriba) abajo a la derecha.</li>
                      <li>Elige <strong>"Abrir en Safari"</strong>.</li>
                    </ol>
                  ) : (
                    <ol style={{ paddingLeft: 18, margin: 0 }}>
                      <li>Toca los <strong>tres puntos</strong> arriba a la derecha.</li>
                      <li>Elige <strong>"Abrir en Chrome"</strong> u otro navegador.</li>
                    </ol>
                  )}
                  <a
                    href={buildSafariLink()}
                    style={{
                      display: 'block', marginTop: 10,
                      padding: '10px 14px', borderRadius: 999,
                      background: 'var(--ink)', color: '#fff',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                      textDecoration: 'none', textAlign: 'center',
                    }}
                  >
                    Intentar abrir en Safari
                  </a>
                </div>
              )}

              {/* Fallback: campo de texto si no hay micrófono */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6 }}>
                  O escribe el comando:
                </div>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Ej. anota a Mónica por Instagram"
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--line-soft)', fontFamily: 'inherit',
                    fontSize: 13, color: 'var(--ink)', resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={v.reset} style={btnGhost}>Cerrar</button>
                {textInput.trim() && (
                  <button onClick={() => v.submitText(textInput)} style={btnPrimary}>Enviar texto</button>
                )}
                {!isInAppBrowser() && (
                  <button onClick={() => v.start()} style={btnPrimary}>Reintentar voz</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const ACTION_LABELS = {
  crear_lead: { titulo: 'Crear lead', icon: 'bullhorn', color: 'var(--terracota)' },
  crear_estudiante: { titulo: 'Inscribir estudiante', icon: 'users', color: 'var(--oliva)' },
  registrar_pago: { titulo: 'Registrar pago', icon: 'cash', color: 'var(--gold)' },
  cambiar_estado_lead: { titulo: 'Cambiar estado de lead', icon: 'arrow', color: 'var(--ink-soft)' },
  convertir_lead_a_estudiante: { titulo: 'Convertir lead → estudiante', icon: 'arrow', color: 'var(--oliva)' },
  marcar_asistencia: { titulo: 'Marcar asistencia', icon: 'check', color: 'var(--oliva)' },
  eliminar_registro: { titulo: 'Borrar registro ⚠', icon: 'x', color: 'var(--rojo)' },
  generar_preinscripcion: { titulo: 'Enviar preinscripción', icon: 'note', color: 'var(--terracota)' },
  abrir_ficha: { titulo: 'Abrir ficha', icon: 'user', color: 'var(--ink-soft)' },
  consultar: { titulo: 'Consultar', icon: 'search', color: 'var(--ink-soft)' },
  preguntar_clarificacion: { titulo: 'Necesito que repitas', icon: 'chat', color: 'var(--gold)' },
};

const ClarificationPrompt = ({ result, onTextResponse, onVoiceResponse, onCancel }) => {
  const [textInput, setTextInput] = React.useState('');
  const params = result.parameters || {};
  const opciones = Array.isArray(params.opciones) ? params.opciones : [];
  const tieneOpciones = opciones.length > 0;

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>
        Necesito que me digas
      </div>
      {params.contexto && (
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4, fontStyle: 'italic' }}>
          {params.contexto}
        </div>
      )}
      <div className="serif" style={{ fontSize: 22, marginTop: 8, marginBottom: 14, color: 'var(--ink)', lineHeight: 1.25, fontWeight: 500 }}>
        {params.pregunta || '¿…?'}
      </div>

      {tieneOpciones && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {opciones.map((opt, i) => (
            <button
              key={i}
              onClick={() => onTextResponse(opt)}
              style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--line-soft)',
                fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {!tieneOpciones && (
        <div style={{ marginBottom: 10 }}>
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            rows={2}
            placeholder="Escribe la respuesta o toca 🎤 para hablar"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--line-soft)', fontFamily: 'inherit',
              fontSize: 13, color: 'var(--ink)', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onCancel} style={btnGhost}>Cancelar</button>
        <button onClick={onVoiceResponse} style={btnGhost}>🎤 Hablar</button>
        {!tieneOpciones && textInput.trim() && (
          <button onClick={() => onTextResponse(textInput)} style={btnPrimary}>Enviar</button>
        )}
      </div>
    </div>
  );
};

const ResultPreview = ({ result, onConfirm, onCancel, onRetry }) => {
  const meta = ACTION_LABELS[result.tool_name] || { titulo: result.tool_name, icon: 'settings', color: 'var(--ink-soft)' };
  const isClarification = result.tool_name === 'preguntar_clarificacion';
  const isDestructive = result.tool_name === 'eliminar_registro';

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 500 }}>
        Entendí
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: meta.color + '20', color: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name={meta.icon} size={18} />
        </div>
        <div className="serif" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1.15, fontWeight: 500 }}>
          {meta.titulo}
        </div>
      </div>

      {isClarification && (
        <div style={{
          padding: '12px 14px', background: 'var(--bg-warm)',
          borderRadius: 12, color: 'var(--ink)', fontSize: 14, lineHeight: 1.5,
        }}>
          {result.parameters?.pregunta || 'No te entendí bien.'}
        </div>
      )}

      {!isClarification && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          {Object.entries(result.parameters || {}).map(([k, val]) => {
            if (val === undefined || val === null || val === '') return null;
            const label = k.replace(/_/g, ' ');
            return (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '8px 0', borderBottom: '1px solid var(--line-soft)',
              }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-mute)' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>
                  {String(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Dijiste: "{result.transcript}"
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={btnGhost}>Cancelar</button>
        <button onClick={onRetry} style={btnGhost}>🎤 Repetir</button>
        {!isClarification && (
          <button
            onClick={onConfirm}
            style={{
              ...btnPrimary,
              background: isDestructive ? 'var(--rojo)' : 'var(--terracota)',
            }}
          >
            {isDestructive ? 'Sí, borrar' : 'Confirmar'}
          </button>
        )}
      </div>
    </div>
  );
};

const btnGhost = {
  flex: 1, padding: '11px 16px', borderRadius: 999,
  background: 'transparent', border: '1px solid var(--line-soft)',
  color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13,
  cursor: 'pointer',
};
const btnPrimary = {
  flex: 1, padding: '11px 16px', borderRadius: 999,
  background: 'var(--terracota)', border: 'none',
  color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

window.VoiceButton = VoiceButton;
export { VoiceButton };
