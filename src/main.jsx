import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

// Helpers / chrome (registran globals window.X)
import './ios-frame.jsx';
import './tweaks-panel.jsx';

// Datos seed (mantiene MOCK_*; nuestro store los sobreescribe en runtime)
import './data.jsx';
import './icons.jsx';

// Pantallas
import './login.jsx';
import './home.jsx';
import './screen-reservas.jsx';
import './screen-pagos.jsx';
import './screen-marketing.jsx';
import './screen-crm.jsx';
import './screen-detail.jsx';
import './screen-asistencia.jsx';
import './screen-ajustes.jsx';
import './forms.jsx';
import './forms-sheets.jsx';

// Store + App (estos sí usan ES imports además de globals)
import './store.jsx';
import { App } from './app.jsx';

const IOSDevice = window.IOSDevice;

const Root = () => (
  <IOSDevice width={402} height={874}>
    <App />
  </IOSDevice>
);

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

// Fit-to-viewport (mobile-first scaling)
function fitDevice() {
  const root = document.getElementById('root');
  if (!root) return;
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
