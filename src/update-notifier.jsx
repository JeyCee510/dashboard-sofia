import React from 'react';
const { useState, useEffect, useRef } = React;

// ──────────────────────────────────────────────────────────────
// UpdateNotifier — aviso de "nueva versión disponible" en tiempo real
//
// Cómo funciona (sin tocar el build):
//   · Al cargar, guarda el hash del chunk de entrada que está corriendo
//     (Vite inyecta <script src="/assets/index-XXXX.js">).
//   · Cada cierto rato — y cada vez que la app vuelve al primer plano —
//     baja el index.html del servidor (sin caché) y mira qué chunk de
//     entrada referencia ahora. Si cambió, es que hubo un deploy nuevo.
//   · Muestra un banner para recargar. Así Sofía nunca queda atascada en
//     una versión vieja tras un deploy.
//
// Se monta como hermano de <App/> (ver main.jsx), así que vive en todas
// las pantallas. Es defensivo: cualquier fallo de red se ignora en silencio.
// ──────────────────────────────────────────────────────────────

const INTERVALO_MS = 60 * 1000; // chequea cada minuto

function hashEntradaActual() {
  try {
    const s = document.querySelector('script[type="module"][src*="/assets/index-"]')
           || document.querySelector('script[src*="/assets/index-"]');
    const src = s && s.getAttribute('src');
    const m = src && src.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch { return null; }
}

const UpdateNotifier = () => {
  const [hayUpdate, setHayUpdate] = useState(false);
  const actualRef = useRef(hashEntradaActual());

  useEffect(() => {
    let vivo = true;

    async function chequear() {
      if (!actualRef.current || hayUpdate) return;
      try {
        const html = await fetch('/?v=' + Date.now(), { cache: 'no-store' }).then(r => r.text());
        const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
        if (vivo && m && m[0] !== actualRef.current) setHayUpdate(true);
      } catch { /* sin red: reintenta luego */ }
    }

    const id = setInterval(chequear, INTERVALO_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') chequear(); };
    document.addEventListener('visibilitychange', onVisible);
    // Primer chequeo a los 8s (no molestar en el arranque)
    const t = setTimeout(chequear, 8000);

    return () => { vivo = false; clearInterval(id); clearTimeout(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [hayUpdate]);

  if (!hayUpdate) return null;

  const recargar = () => {
    // Limpia cualquier caché del SW por si acaso, luego recarga duro.
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update()));
      }
    } catch {}
    window.location.reload();
  };

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12,
      top: 'calc(8px + env(safe-area-inset-top))',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderRadius: 14,
      background: 'var(--terracota, #B5563A)',
      color: '#fff',
      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
      fontSize: 13.5,
      animation: 'slideUp 0.25s ease',
    }}>
      <span style={{ flex: 1, lineHeight: 1.35 }}>
        Hay una versión nueva de la app.
      </span>
      <button
        onClick={recargar}
        style={{
          flexShrink: 0,
          background: '#fff', color: 'var(--terracota, #B5563A)',
          border: 'none', borderRadius: 999,
          padding: '7px 16px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Actualizar
      </button>
    </div>
  );
};

window.UpdateNotifier = UpdateNotifier;
export { UpdateNotifier };
