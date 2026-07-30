import React from 'react';
import { supabase } from './lib/supabase.js';
import { estadoPush, activarPush } from './lib/push.js';

const { useState, useEffect } = React;

// ──────────────────────────────────────────────────────────────
// Aviso en el inicio para activar las notificaciones.
//
// Reglas de cortesía:
//  · Sólo aparece si de verdad se pueden activar ('disponible') o si en
//    iPhone falta instalar la app ('requiere-instalar', ahí sólo explica).
//  · Si la persona lo cierra, no vuelve a molestar en 30 días.
//  · Nunca aparece si ya están activas, si las bloqueó o si el navegador
//    no las soporta.
// ──────────────────────────────────────────────────────────────

const KEY_DESCARTE = 'pushBannerDescartadoHasta';

const PushBanner = () => {
  const Icon = window.Icon;
  const [estado, setEstado] = useState(null);
  const [busy, setBusy] = useState(false);
  const [oculto, setOculto] = useState(() => {
    try {
      const hasta = Number(localStorage.getItem(KEY_DESCARTE) || 0);
      return Date.now() < hasta;
    } catch { return false; }
  });

  useEffect(() => {
    if (oculto) return;
    estadoPush().then(setEstado).catch(() => setEstado(null));
  }, [oculto]);

  if (oculto) return null;
  if (estado !== 'disponible' && estado !== 'requiere-instalar') return null;

  const descartar = () => {
    try {
      localStorage.setItem(KEY_DESCARTE, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {}
    setOculto(true);
  };

  const activar = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const nuevo = await activarPush(data?.user?.email, window.PROYECTO_ID || null);
      setEstado(nuevo);
      if (nuevo === 'activo') setOculto(true);
    } catch (e) {
      alert(e.message || 'No se pudieron activar las notificaciones.');
      setEstado(await estadoPush());
    } finally { setBusy(false); }
  };

  const esIOS = estado === 'requiere-instalar';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 16px', marginBottom: 16,
      borderRadius: 'var(--r-lg)',
      background: 'var(--terracota-tint)',
      border: '1px solid var(--terracota-soft)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.6)', color: 'var(--terracota)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {Icon ? <Icon name="bell" size={16} strokeWidth={1.8} /> : '🔔'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#8A3D26' }}>
          {esIOS ? 'Instala la app para recibir avisos' : 'Activa las notificaciones'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.45 }}>
          {esIOS
            ? 'Toca Compartir → “Agregar a inicio”. Desde ahí podrás activarlas.'
            : 'Te avisamos cuando entre un lead nuevo o se registre un pago, aunque no tengas la app abierta.'}
        </div>
        {!esIOS && (
          <button
            onClick={activar}
            disabled={busy}
            style={{
              marginTop: 10, padding: '8px 16px', borderRadius: 999,
              background: 'var(--terracota)', color: '#fff', border: 'none',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Activando…' : 'Activar'}
          </button>
        )}
      </div>

      <button
        onClick={descartar}
        aria-label="Ahora no"
        title="Ahora no"
        style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink-mute)', padding: 2, lineHeight: 1,
        }}
      >
        {Icon ? <Icon name="x" size={15} stroke="var(--ink-mute)" /> : '×'}
      </button>
    </div>
  );
};

window.PushBanner = PushBanner;
export { PushBanner };
