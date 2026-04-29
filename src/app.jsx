import React from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useStore } from './store.jsx';

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showFAB": true,
  "compactMode": false,
  "primaryAccent": "terracota"
}/*EDITMODE-END*/;

const App = () => {
  // Globals que ya están registrados por sus archivos respectivos
  const useTweaks = window.useTweaks;
  const LoginScreen = window.LoginScreen;
  const HomeScreen = window.HomeScreen;
  const ReservasScreen = window.ReservasScreen;
  const PagosScreen = window.PagosScreen;
  const MarketingScreen = window.MarketingScreen;
  const CRMScreen = window.CRMScreen;
  const FichaAlumna = window.FichaAlumna;
  const AsistenciaV2 = window.AsistenciaV2;
  const AjustesScreen = window.AjustesScreen;
  const AlumnaForm = window.AlumnaForm;
  const LeadForm = window.LeadForm;
  const PagoForm = window.PagoForm;
  const Icon = window.Icon;
  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakToggle = window.TweakToggle;
  const TweakButton = window.TweakButton;

  const auth = useAuth();
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const store = useStore();
  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState(null);
  const [sheet, setSheet] = useState(null);

  // Sync store data into globals para que las screens (que leen window.X) funcionen
  window.MOCK_ALUMNAS = store.state.alumnas;
  window.MOCK_LEADS = store.state.leads;
  window.MENSAJES_RECIENTES = store.state.mensajes;
  window.DIAS_FORMACION = store.state.ajustes.diasFormacion;

  const screenTweaks = {
    capacidad: store.state.ajustes.capacidad,
    precioRegular: store.state.ajustes.precioRegular,
    precioProntoPago: store.state.ajustes.precioProntoPago,
    precioReserva: store.state.ajustes.precioReserva,
    fechaProntoPago: store.state.ajustes.fechaProntoPago,
    ownerName: store.state.ajustes.ownerName,
    studioName: store.state.ajustes.studioName,
    lugar: store.state.ajustes.lugar,
    bonoSillaCupos: store.state.ajustes.bonoSillaCupos,
  };

  const navigate = (target) => {
    if (target === 'asistencia') setOverlay('asistencia');
    else if (target === 'ajustes') setOverlay('ajustes');
    else { setTab(target); setOverlay(null); }
  };

  const openAlumna = (id) => setOverlay({ type: 'alumna', id });

  // ── Loading & auth gates ──
  if (auth.loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--ink-soft)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
          Abriendo el estudio…
        </div>
      </div>
    );
  }

  if (!auth.session) {
    return (
      <div className="app">
        <LoginScreen
          onLogin={auth.signInWithGoogle}
          ownerName={screenTweaks.ownerName}
          studioName={screenTweaks.studioName}
          authError={auth.authError}
        />
      </div>
    );
  }

  // ── App autenticada ──
  const asistenciaHoy = store.state.asistencia[0] || {};

  let screen;
  if (tab === 'home') screen = <HomeScreen tweaks={screenTweaks} onNavigate={navigate} asistenciaHoy={asistenciaHoy} alumnas={store.state.alumnas} leads={store.state.leads} mensajes={store.state.mensajes} />;
  else if (tab === 'reservas') screen = <ReservasScreen tweaks={screenTweaks} onNavigate={navigate} onOpenAlumna={openAlumna} />;
  else if (tab === 'pagos') screen = <PagosScreen tweaks={screenTweaks} onOpenAlumna={openAlumna} onNewPago={() => setSheet('new-pago')} />;
  else if (tab === 'marketing') screen = <MarketingScreen onOpenLead={(id) => setSheet(id ? { type: 'edit-lead', id } : 'new-lead')} />;
  else if (tab === 'crm') screen = <CRMScreen />;

  const tabs = [
    { id: 'home', label: 'Hoy', icon: 'home' },
    { id: 'reservas', label: 'Inscritos', icon: 'users' },
    { id: 'pagos', label: 'Pagos', icon: 'cash' },
    { id: 'marketing', label: 'Leads', icon: 'bullhorn' },
    { id: 'crm', label: 'Chat', icon: 'chat' },
  ];

  const fabAction = () => {
    if (tab === 'reservas') setSheet('new-alumna');
    else if (tab === 'pagos') setSheet('new-pago');
    else if (tab === 'marketing') setSheet('new-lead');
    else setSheet('new-alumna');
  };

  return (
    <div className="app">
      <div className="app-scroll" key={tab}>
        <div className="fade-in">{screen}</div>
      </div>

      {tweaks.showFAB && tab !== 'crm' && tab !== 'home' && (
        <button className="fab" onClick={fabAction} aria-label="Nuevo">
          <Icon name="plus" size={20} stroke="var(--bg)" strokeWidth={2.2} />
        </button>
      )}

      <div className="tabbar">
        <div className="tabbar-inner">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setOverlay(null); }}
            >
              <Icon name={t.icon} size={18} strokeWidth={tab === t.id ? 1.8 : 1.5} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'home' && (
        <button onClick={() => navigate('ajustes')} aria-label="Ajustes" style={{
          position: 'absolute', top: 56, right: 18, zIndex: 5,
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--bg-warm)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="settings" size={16} stroke="var(--ink-soft)" />
        </button>
      )}

      {overlay === 'asistencia' && (
        <AsistenciaV2 store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'ajustes' && (
        <AjustesScreen store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay && overlay.type === 'alumna' && (
        <FichaAlumna
          alumnaId={overlay.id}
          onClose={() => setOverlay(null)}
          store={store}
          onEdit={() => setSheet({ type: 'edit-alumna', id: overlay.id })}
          onPagar={() => setSheet({ type: 'new-pago', id: overlay.id })}
        />
      )}

      <AlumnaForm
        open={sheet === 'new-alumna' || (sheet && sheet.type === 'edit-alumna')}
        onClose={() => setSheet(null)}
        store={store}
        alumnaId={sheet && sheet.type === 'edit-alumna' ? sheet.id : null}
      />
      <LeadForm
        open={sheet === 'new-lead' || (sheet && sheet.type === 'edit-lead')}
        onClose={() => setSheet(null)}
        store={store}
        leadId={sheet && sheet.type === 'edit-lead' ? sheet.id : null}
      />
      <PagoForm
        open={sheet === 'new-pago' || (sheet && sheet.type === 'new-pago')}
        onClose={() => setSheet(null)}
        store={store}
        alumnaPreId={sheet && sheet.type === 'new-pago' ? sheet.id : null}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Diseño">
          <TweakToggle label="Mostrar botón +" value={tweaks.showFAB} onChange={v => setTweak('showFAB', v)} />
        </TweakSection>
        <TweakSection title="Sesión">
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', padding: '6px 4px' }}>
            {auth.user?.email}
          </div>
          <TweakButton label="Cerrar sesión" onClick={auth.signOut} />
        </TweakSection>
        <TweakSection title="Datos rápidos">
          <TweakButton label="Ir a Ajustes" onClick={() => navigate('ajustes')} />
          <TweakButton label="🔄 Reset datos locales (no Supabase)" onClick={store.resetTodo} />
        </TweakSection>
        <TweakSection title="Atajos creación">
          <TweakButton label="+ Nueva alumna" onClick={() => setSheet('new-alumna')} />
          <TweakButton label="+ Nuevo lead" onClick={() => setSheet('new-lead')} />
          <TweakButton label="+ Registrar pago" onClick={() => setSheet('new-pago')} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

window.App = App;
export { App };
