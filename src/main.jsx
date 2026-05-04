import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

// ─── Routing simple por pathname ───
// /preinscripcion/<token> y /comprobante son rutas públicas (sin auth).
// Cualquier otra = la app normal con login.
const path = window.location.pathname;
const preinscripcionMatch = path.match(/^\/preinscripcion\/([\w-]+)\/?$/);
const comprobanteTokenMatch = path.match(/^\/comprobante\/([\w-]+)\/?$/);
const comprobanteMatch = path.match(/^\/comprobante\/?$/);

if (preinscripcionMatch) {
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
  // Helpers / chrome (registran globals window.X)
  await import('./ios-frame.jsx');
  await import('./tweaks-panel.jsx');
  await import('./data.jsx');
  await import('./icons.jsx');
  await import('./login.jsx');
  await import('./home.jsx');
  await import('./screen-reservas.jsx');
  await import('./screen-pagos.jsx');
  await import('./screen-marketing.jsx');
  await import('./screen-crm.jsx');
  await import('./screen-detail.jsx');
  await import('./screen-asistencia.jsx');
  await import('./screen-ajustes.jsx');
  await import('./screen-difusion.jsx');
  await import('./screen-papelera-leads.jsx');
  await import('./screen-preinscripciones.jsx');
  await import('./screen-leads-descartados.jsx');
  await import('./screen-comprobantes.jsx');
  await import('./screen-estudio-placeholder.jsx'); // Módulo Estudio — placeholder (legacy, ya no se usa)
  await import('./screen-estudio.jsx');             // Módulo Estudio — pantalla principal
  await import('./screen-estudio-onboarding.jsx');  // Wizard de alta de estudiante
  await import('./screen-estudio-ficha.jsx');       // Ficha individual + sub-sheets
  await import('./screen-estudio-asistencia.jsx');  // Tomar asistencia a clases
  await import('./screen-estudio-config.jsx');      // Pantalla de Ajustes del estudio
  await import('./screen-estudio-comprobantes.jsx');// Validar/rechazar comprobantes
  await import('./forms.jsx');
  await import('./forms-sheets.jsx');
  await import('./store.jsx');
  const { App } = await import('./app.jsx');

  // App responsive en cualquier tamaño. En desktop el container queda centrado
  // con max-width (ver styles.css). En mobile ocupa fullscreen. Sin frame iOS.
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
