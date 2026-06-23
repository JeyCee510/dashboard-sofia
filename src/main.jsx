import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

// PWA: registrar service worker mínimo para que Chrome/Edge marquen la app
// como instalable y muestre el banner "Add to Home Screen". El SW no cachea
// nada (la app depende de Supabase realtime).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[PWA] sw register fail', err);
    });
  });
}

// ─── Routing simple por pathname ───
// /preinscripcion/<token>, /comprobante y /clase/<slug> son rutas públicas
// (sin auth). Cualquier otra = la app normal con login.
const path = window.location.pathname;
const preinscripcionMatch = path.match(/^\/preinscripcion\/([\w-]+)\/?$/);
const comprobanteTokenMatch = path.match(/^\/comprobante\/([\w-]+)\/?$/);
const comprobanteMatch = path.match(/^\/comprobante\/?$/);
const claseMatch = path.match(/^\/clase\/([\w-]+)\/?$/);

if (claseMatch) {
  const slug = claseMatch[1];
  document.body.classList.add('public-route');
  document.documentElement.classList.add('public-route');
  import('./clase-publica.jsx').then(({ ClasePublica }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <ClasePublica slug={slug} />
    );
  });
} else if (preinscripcionMatch) {
  const token = preinscripcionMatch[1];
  document.body.classList.add('public-route');
  document.documentElement.classList.add('public-route');
  import('./icons.jsx').then(() =>
    import('./preinscripcion-public.jsx').then(({ PreinscripcionPublic }) => {
      ReactDOM.createRoot(document.getElementById('root')).render(
        <PreinscripcionPublic token={token} />
      );
    })
  );
} else if (comprobanteTokenMatch) {
  const token = comprobanteTokenMatch[1];
  document.body.classList.add('public-route');
  document.documentElement.classList.add('public-route');
  import('./icons.jsx').then(() =>
    import('./comprobante-public.jsx').then(({ ComprobantePublic }) => {
      ReactDOM.createRoot(document.getElementById('root')).render(
        <ComprobantePublic token={token} />
      );
    })
  );
} else if (comprobanteMatch) {
  document.body.classList.add('public-route');
  document.documentElement.classList.add('public-route');
  import('./icons.jsx').then(() =>
    import('./comprobante-public.jsx').then(({ ComprobantePublic }) => {
      ReactDOM.createRoot(document.getElementById('root')).render(
        <ComprobantePublic />
      );
    })
  );
} else {
  initApp();
}

async function initApp() {
  // Cargamos todos los módulos en paralelo. Antes eran 21 awaits secuenciales
  // que bloqueaban el first paint en ~1-2s. Cada módulo sólo registra globals
  // en `window.X`, no hay dependencias de orden entre ellos. App.jsx se carga
  // al final porque su export es lo que se renderiza.
  await Promise.all([
    import('./ios-frame.jsx'),
    import('./tweaks-panel.jsx'),
    import('./data.jsx'),
    import('./icons.jsx'),
    import('./login.jsx'),
    import('./screen-launcher.jsx'),          // Home provisional (selector de proyectos)
    import('./screen-proyecto-wizard.jsx'),   // Wizard de alcance de nuevo proyecto
    import('./home.jsx'),
    import('./screen-reservas.jsx'),
    import('./screen-pagos.jsx'),
    import('./screen-marketing.jsx'),
    import('./screen-crm.jsx'),
    import('./screen-detail.jsx'),
    import('./screen-asistencia.jsx'),
    import('./screen-ajustes.jsx'),
    import('./screen-difusion.jsx'),
    import('./screen-papelera-leads.jsx'),
    import('./screen-preinscripciones.jsx'),
    import('./screen-leads-descartados.jsx'),
    import('./screen-clase-inscripciones.jsx'),
    import('./screen-comprobantes.jsx'),
    import('./screen-estudio.jsx'),             // Módulo Estudio — pantalla principal
    import('./screen-estudio-onboarding.jsx'),  // Wizard de alta de estudiante
    import('./screen-estudio-ficha.jsx'),       // Ficha individual + sub-sheets
    import('./screen-estudio-asistencia.jsx'),  // Tomar asistencia a clases
    import('./screen-estudio-config.jsx'),      // Pantalla de Ajustes del estudio
    import('./screen-estudio-comprobantes.jsx'),// Validar/rechazar comprobantes
    import('./forms.jsx'),
    import('./forms-sheets.jsx'),
    import('./store.jsx'),
  ]);
  // screen-estudio-placeholder.jsx omitido: era legacy ("ya no se usa").
  // El archivo sigue en src/ por si quieres consultarlo, pero ya no se importa.
  const { App } = await import('./app.jsx');

  // App responsive en cualquier tamaño. En desktop el container queda centrado
  // con max-width (ver styles.css). En mobile ocupa fullscreen. Sin frame iOS.
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
