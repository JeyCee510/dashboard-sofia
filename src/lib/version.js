// ──────────────────────────────────────────────────────────────
// Versión de la app. Los valores los inyecta Vite en el build
// (ver `define` en vite.config.js); en dev caen a un default.
//
// Se muestra en pantalla a propósito: cuando algo "no aparece", lo primero es
// saber si el dispositivo está viendo la última versión o una cacheada por la
// PWA. Preguntarle a Sofía "¿qué versión te sale?" resuelve eso en segundos.
//
// Al publicar un cambio que ella deba ver: subir `version` en package.json.
//   · parche (1.5.x) → arreglos
//   · menor  (1.x.0) → funcionalidad nueva
// ──────────────────────────────────────────────────────────────

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD   = typeof __APP_BUILD__   !== 'undefined' ? __APP_BUILD__   : 'dev';
export const APP_COMMIT  = typeof __APP_COMMIT__  !== 'undefined' ? __APP_COMMIT__  : 'dev';

// "v1.5.0 · 21 ago 2026"  — para mostrar al usuario
export function versionLegible() {
  let fecha = APP_BUILD;
  try {
    const [a, m, d] = APP_BUILD.split('-').map(Number);
    fecha = new Date(a, m - 1, d).toLocaleDateString('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { /* si el build no trae fecha, se muestra tal cual */ }
  return `v${APP_VERSION} · ${fecha}`;
}

// "v1.5.0 · 21 ago 2026 · fc29726" — para reportar un problema
export function versionCompleta() {
  return `${versionLegible()} · ${APP_COMMIT}`;
}

window.APP_VERSION = APP_VERSION;
