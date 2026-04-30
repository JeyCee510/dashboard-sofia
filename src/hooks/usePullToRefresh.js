import React from 'react';

const { useEffect, useState, useRef } = React;

// ─────────────────────────────────────────────────────────────────────
// usePullToRefresh — gesto nativo "jalar hacia abajo para refrescar"
// en mobile. Adjunta listeners touch al elemento de scroll dado.
// Cuando el usuario jala > UMBRAL desde scrollTop=0 y suelta, ejecuta onRefresh.
// ─────────────────────────────────────────────────────────────────────

const UMBRAL = 70;       // px que hay que jalar para activar
const RESISTENCIA = 2.5; // factor de resistencia visual (más alto = más cuesta jalar)

export function usePullToRefresh({ onRefresh, enabled = true }) {
  const ref = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onTouchStart = (e) => {
      if (refreshing) return;
      // Solo activar si el scroll está en el top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      dragging.current = false;
    };

    const onTouchMove = (e) => {
      if (refreshing || startY.current === null) return;
      const currentY = e.touches[0].clientY;
      const delta = currentY - startY.current;
      if (delta <= 0) return;
      // Si scrollTop > 0 (el usuario hizo scroll hacia abajo durante el gesto), abortar
      if (el.scrollTop > 0) {
        startY.current = null;
        setPullDistance(0);
        return;
      }
      dragging.current = true;
      const dist = Math.min(delta / RESISTENCIA, UMBRAL * 1.6);
      setPullDistance(dist);
    };

    const onTouchEnd = async () => {
      if (refreshing) return;
      const dist = pullDistance;
      startY.current = null;
      const wasDragging = dragging.current;
      dragging.current = false;
      if (!wasDragging) { setPullDistance(0); return; }
      if (dist >= UMBRAL) {
        setRefreshing(true);
        try { await onRefresh?.(); } catch (e) { console.error('[ptr]', e); }
        // pequeño delay para que el usuario vea el indicador
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 600);
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onRefresh, refreshing, pullDistance]);

  const triggered = pullDistance >= UMBRAL;

  return {
    ref,
    pullDistance,
    refreshing,
    triggered,
    UMBRAL,
  };
}
