import React from 'react';
import { supabase } from '../lib/supabase.js';

const { useState, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// useVoiceCommand — captura voz vía Web Speech API y la envía a la
// Edge Function `voice-command` que retorna {tool_name, parameters}.
//
// Estados:
//   idle        — nada activo
//   listening   — micrófono escuchando, transcribiendo
//   processing  — texto enviado al LLM, esperando respuesta
//   result      — recibido tool_call, mostrar preview
//   error       — algo falló (sin permisos, sin internet, etc.)
// ─────────────────────────────────────────────────────────────────────

const SPEECH_LANG = 'es-EC';

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
  }, [stop]);

  const sendToLLM = useCallback(async (text) => {
    setState('processing');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('voice-command', {
        body: { text },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setState('result');
    } catch (e) {
      console.error('[voice] LLM error', e);
      setError(e.message || 'Error contactando el asistente');
      setState('error');
    }
  }, []);

  const start = useCallback(() => {
    const recog = getRecognition();
    if (!recog) {
      setError('Tu navegador no soporta reconocimiento de voz. Prueba Chrome o Safari.');
      setState('error');
      return;
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
      const msg = {
        'no-speech': 'No te escuché. Intenta de nuevo.',
        'audio-capture': 'No detecto micrófono. Revisa permisos.',
        'not-allowed': 'Permiso de micrófono denegado. Activa en ajustes del navegador.',
        'network': 'Sin conexión.',
      }[event.error] || `Error: ${event.error}`;
      setError(msg);
      setState('error');
      recogRef.current = null;
    };

    recog.onend = () => {
      const final = (finalText || interim).trim();
      recogRef.current = null;
      if (!final) {
        // Onend sin texto = usuario canceló o no habló
        if (state === 'listening') {
          setError('No escuché nada. Vuelve a tocar el micrófono.');
          setState('error');
        }
        return;
      }
      setTranscript(final);
      sendToLLM(final);
    };

    try {
      recog.start();
    } catch (e) {
      setError('No pude activar el micrófono. ' + e.message);
      setState('error');
    }
  }, [sendToLLM, state]);

  // Permite enviar texto manualmente (modo "escribir" si no quiere hablar)
  const submitText = useCallback((text) => {
    if (!text || !text.trim()) return;
    setTranscript(text.trim());
    sendToLLM(text.trim());
  }, [sendToLLM]);

  return {
    state,
    transcript,
    interim,
    result,
    error,
    start,
    stop,
    reset,
    submitText,
  };
}
