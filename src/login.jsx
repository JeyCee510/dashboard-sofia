import React from 'react';

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-12.7l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C41 35 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
  </svg>
);

const LoginScreen = ({ onLogin, ownerName, studioName, authError }) => (
  <div className="login">
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="mark fade-in">S</div>
      <div className="fade-in" style={{ animationDelay: '0.06s' }}>
        <h1>el arte de <em>guiar</em><br/>tu estudio</h1>
      </div>
      <p className="fade-in" style={{ animationDelay: '0.12s' }}>
        Tu panel privado para gestionar la formación, los estudiantes y todo lo que sucede entre clases.
      </p>
    </div>

    <div style={{ width: '100%' }}>
      <button className="gbtn fade-in" style={{ animationDelay: '0.2s' }} onClick={onLogin}>
        <GoogleG />
        <span>Continuar con Google</span>
      </button>
      {authError && (
        <div className="fade-in" style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'rgba(181, 86, 58, 0.14)',
          border: '1px solid rgba(181, 86, 58, 0.3)',
          borderRadius: 10,
          color: '#E8B8A6',
          fontSize: 13,
          lineHeight: 1.4,
        }}>
          {authError}
        </div>
      )}
      <div className="footer-note">
        Solo {(ownerName || 'Sofía').split(' ')[0]} accede a este panel · {studioName || 'Yoga Sofía Lira'}
      </div>
    </div>
  </div>
);

window.LoginScreen = LoginScreen;
export { LoginScreen };
