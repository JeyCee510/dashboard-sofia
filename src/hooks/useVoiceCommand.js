import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// useVoiceCommand — captura voz vía Web Speech API + envía a la
// Edge Function `voice-command`. Soporta conversación multi-turno:
// si Haiku pregunta clarificación, el usuario responde (voz, texto o
// chip tocable) y se envía con el history para que mantenga contexto.
//
// Estados:
//   idle        — nada activo
//   listening   — micrófono escuchando
//   processing  — esperando respuesta del LLM
//   result      — recibido tool_call, mostrar preview
//   error       — algo falló
// ─────────────────────────────────────────────────────────────────────

const SPEECH_LANG = 'es-EC';

// Detecta si la página fue abierta dentro del navegador integrado
// de una app (WhatsApp, Instagram, Messenger, etc.). En esos webviews
// Web Speech API está bloqueada y devuelve 'service-not-allowed'.
export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  // Apps comunes que tienen webview propio sin Speech API
  return /(WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Twitter|TikTok)/i.test(ua);
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = SPEECH_LANG;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

export function useVoiceCommand() {
  const [state, setState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]); // multi-turn conversation
  const recogRef = useRef(null);

  const stop = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch (e) {}
      recogRef.current = null;
    }
    setInterim('');
  }, []);

  const reset = useCallback(() => {
    stop();
    setState('idle');
    setTranscript('');
    setInterim('');
    setResult(null);
    setError(null);
    setHistory([]);
  }, [stop]);

  const sendToLLM = useCallback(async (text, currentHistory) => {
    setState('processing');
    setError(null);
    try {
      // Construir el user message correctamente.
      // Si el assistant previo tenía un tool_use, este user turn DEBE wrappear
      // con tool_result para que Anthropic acepte la conversación.
      let userMessage;
      const last = currentHistory[currentHistory.length - 1];
      if (last?.role === 'assistant' && Array.isArray(last.content)) {
        const tu = last.content.find(c => c.type === 'tool_use');
        if (tu) {
          userMessage = {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: tu.id, content: text }],
          };
        }
      }
      if (!userMessage) {
        userMessage = { role: 'user', content: text };
      }

      const messagesToSend = [...currentHistory, userMessage];

      const { data, error: fnError } = await supabase.functions.invoke('voice-command', {
        body: { messages: messagesToSend },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Persistir el history completo con el user formateado correctamente
      const newHistory = [
        ...messagesToSend,
        { role: 'assistant', content: data.assistant_turn },
      ];
      setHistory(newHistory);
      setResult(data);
      setState('result');
    } catch (e) {
      console.error('[voice] LLM error', e);
      setError(e.message || 'Error contactando el asistente');
      setState('error');
    }
  }, []);

  const start = useCallback((options = {}) => {
    const recog = getRecognition();
    if (!recog) {
      setError('Tu navegador no soporta reconocimiento de voz. Prueba Chrome o Safari.');
      setState('error');
      return;
    }
    // Si es turno nuevo (no continuación), limpiar history
    if (!options.continueConversation) {
      setHistory([]);
    }
    recogRef.current = recog;
    setState('listening');
    setTranscript('');
    setInterim('');
    setError(null);
    setResult(null);

    let finalText = '';

    recog.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript + ' ';
        else interimText += res[0].transcript;
      }
      setInterim(interimText);
      if (finalText) setTranscript(finalText.trim());
    };

    recog.onerror = (event) => {
      const err = event.error;
      let msg;

      if (isInAppBrowser() && (err === 'service-not-allowed' || err === 'not-allowed')) {
        msg = 'Estás dentro del navegador de otra app (WhatsApp, Instagram…) y desde ahí Apple bloquea el micrófono. Abre el dashboard en Safari real.';
      } else if (err === 'service-not-allowed' && isIOS()) {
        msg = 'iOS está bloqueando el reconocimiento de voz. Ve a Ajustes → General → Teclado → "Permitir dictado" y enciéndelo. Después recarga esta página.';
      } else if (err === 'not-allowed' && isIOS()) {
        msg = 'Safari bloqueó el micrófono para este sitio. Ve a Ajustes → Safari → desliza abajo → "Cámara y micrófono" → permitir. Después recarga.';
      } else {
        msg = {
          'no-speech': 'No te escuché. Intenta de nuevo más cerca del micrófono.',
          'audio-capture': 'No detecto micrófono. Revisa que no esté siendo usado por otra app.',
          'not-allowed': 'Permiso de micrófono denegado. Activa el permiso en los ajustes del navegador.',
          'service-not-allowed': 'El navegador no permite reconocimiento de voz. Prueba en Safari (iPhone) o Chrome (Android/desktop).',
          'network': 'Sin conexión a internet.',
          'aborted': 'Cancelado.',
        }[err] || `Error: ${err}`;
      }

      setError(msg);
      setState('error');
      recogRef.current = null;
    };

    recog.onend = () => {
      const final = (finalText || interim).trim();
      recogRef.current = null;
      if (!final) {
        if (state === 'listening') {
          setError('No escuché nada. Vuelve a tocar el micrófono.');
          setState('error');
        }
        return;
      }
      setTranscript(final);
      // Usar el history actual al momento del envío
      sendToLLM(final, options.continueConversation ? history : []);
    };

    try {
      recog.start();
    } catch (e) {
      setError('No pude activar el micrófono. ' + e.message);
      setState('error');
    }
  }, [sendToLLM, state, history]);

  // Enviar texto (desde chip tocable, fallback de teclado, o respuesta abierta)
  const submitText = useCallback((text, continueConversation = false) => {
    if (!text || !text.trim()) return;
    setTranscript(text.trim());
    sendToLLM(text.trim(), continueConversation ? history : []);
  }, [sendToLLM, history]);

  return {
    state,
    transcript,
    interim,
    result,
    error,
    history,
    start,
    stop,
    reset,
    submitText,
  };
}
