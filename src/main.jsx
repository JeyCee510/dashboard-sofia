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
  import('./icons.jsx').then(() =>
    import('./preinscripcion-public.jsx').then(({ PreinscripcionPublic }) => {
      ReactDOM.createRoot(document.getElementById('root')).render(
        <PreinscripcionPublic token={token} />
      );
      // Reset cualquier transform/fit del modo desktop
      document.body.style.overflow = 'auto';
      const stage = document.getElementById('stage');
      if (stage) { stage.style.position = 'static'; stage.style.display = 'block'; }
      const root = document.getElementById('root');
      if (root) root.style.transform = '';
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
  await import('./forms.jsx');
  await import('./forms-sheets.jsx');
  await import('./store.jsx');
  const { App } = await import('./app.jsx');

  const IOSDevice = window.IOSDevice;

  const isMobile = () =>
    window.matchMedia('(max-width: 600px)').matches ||
    ('ontouchstart' in window && window.innerWidth < 800);

  const Root = () => {
    if (isMobile()) return <App />;
    return (
      <IOSDevice width={402} height={874}>
        <App />
      </IOSDevice>
    );
  };

  ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

  function fitDevice() {
    const root = document.getElementById('root');
    if (!root) return;
    if (isMobile()) {
      root.style.transform = '';
      document.body.style.overflow = 'auto';
      return;
    }
    const pad = 24;
    const sw = (window.innerWidth - pad) / 402;
    const sh = (window.innerHeight - pad) / 874;
    const scale = Math.min(sw, sh, 1.4);
    root.style.transform = 'scale(' + scale + ')';
  }
  window.addEventListener('resize', fitDevice);
  setTimeout(fitDevice, 50);
  setTimeout(fitDevice, 400);
  setTimeout(fitDevice, 1200);
}
