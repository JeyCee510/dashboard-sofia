import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

// ─── Routing simple por pathname ───
// Si es /preinscripcion/<token>, renderiza el form público sin auth ni IOSDevice ni hooks de store.
// Cualquier otra ruta = la app normal con login.
const path = window.location.pathname;
const preinscripcionMatch = path.match(/^\/preinscripcion\/([\w-]+)\/?$/);

if (preinscripcionMatch) {
  // Modo público — solo carga lo necesario para el form
  const token = preinscripcionMatch[1];
  // Marcar body para que el CSS desactive las restricciones de scroll del modo app
  document.body.classList.add('public-route');
  document.documentElement.classList.add('public-route');
  import('./icons.jsx').then(() =>
    import('./preinscripcion-public.jsx').then(({ PreinscripcionPublic }) => {
      ReactDOM.createRoot(document.getElementById('root')).render(
        <PreinscripcionPublic token={token} />
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
  await import('./forms.jsx');
  await import('./forms-sheets.jsx');
  await import('./store.jsx');
  const { App } = await import('./app.jsx');

  // App responsive en cualquier tamaño. En desktop el container queda centrado
  // con max-width (ver styles.css). En mobile ocupa fullscreen. Sin frame iOS.
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
