import React from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useStore } from './store.jsx';
import { VoiceButton } from './voice-button.jsx';
import { executeVoiceCommand } from './lib/voice-executor.js';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';

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
  const DifusionScreen = window.DifusionScreen;
  const PapeleraLeadsScreen = window.PapeleraLeadsScreen;
  const PreinscripcionesScreen = window.PreinscripcionesScreen;
  const LeadsDescartadosScreen = window.LeadsDescartadosScreen;
  const ClaseInscripcionesScreen = window.ClaseInscripcionesScreen;
  const ComprobantesScreen = window.ComprobantesScreen;
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
  const [voiceToast, setVoiceToast] = useState(null);
  const [voiceExecResult, setVoiceExecResult] = useState(null);

  // ── Selector de módulos: Inicio (launcher) | Formación | Estudio | Wizard ──
  // 'launcher' es el home provisional con las tarjetas de proyectos.
  // Persiste en localStorage para recordar el último lugar visitado.
  const [moduloActivo, setModuloActivoState] = useState(() => {
    try { return localStorage.getItem('moduloActivo') || 'launcher'; }
    catch { return 'launcher'; }
  });
  const setModuloActivo = (m) => {
    setModuloActivoState(m);
    try { localStorage.setItem('moduloActivo', m); } catch {}
  };
  // Estado del módulo Estudio (overlays/sheets propios)
  const [estudioOverlay, setEstudioOverlay] = useState(null);   // null | { type:'ficha', id } | 'asistencia' | 'config' | 'comprobantes'
  const [estudioSheet, setEstudioSheet] = useState(null);       // null | 'onboarding'

  const LauncherScreen = window.LauncherScreen;
  const ProyectoWizard = window.ProyectoWizard;
  const EstudioScreen = window.EstudioScreen;
  const EstudioFicha = window.EstudioFicha;
  const EstudioOnboarding = window.EstudioOnboarding;
  const EstudioAsistencia = window.EstudioAsistencia;
  const EstudioConfig = window.EstudioConfig;
  const EstudioComprobantes = window.EstudioComprobantes;

  // Ejecutor de comandos de voz: traduce {tool, params} a llamadas al store + UI
  const handleVoiceExecute = async (toolName, params, transcript) => {
    setVoiceExecResult(null);
    try {
      const result = await executeVoiceCommand(toolName, params, store);
      setVoiceToast({ ok: result.ok, message: result.message });
      setTimeout(() => setVoiceToast(null), 4500);
      // Side effects de navegación
      if (result.ok) {
        if (result.navigate) { setTab(result.navigate); setOverlay(null); }
        if (result.openAlumna) setOverlay({ type: 'alumna', id: result.openAlumna });
        if (result.openSheet) setSheet(result.openSheet);
      }
      setVoiceExecResult(result.ok ? 'success' : 'failed');
    } catch (e) {
      console.error('[voice] exec error', e);
      setVoiceToast({ ok: false, message: 'Error ejecutando: ' + e.message });
      setTimeout(() => setVoiceToast(null), 4500);
      setVoiceExecResult('failed');
    }
  };

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
    else if (target === 'difusion') setOverlay('difusion');
    else if (target === 'papelera-leads') setOverlay('papelera-leads');
    else if (target === 'preinscripciones') setOverlay('preinscripciones');
    else if (target === 'leads-descartados') setOverlay('leads-descartados');
    else if (target === 'clase-inscripciones') setOverlay('clase-inscripciones');
    else { setTab(target); setOverlay(null); }
  };

  const openAlumna = (id) => setOverlay({ type: 'alumna', id });

  // Pull-to-refresh debe ir antes de los early returns (regla de hooks)
  const ptr = usePullToRefresh({
    onRefresh: () => new Promise((resolve) => {
      window.location.reload();
      setTimeout(resolve, 1500);
    }),
  });

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

  // ── App autenticada — Inicio (home provisional con tarjetas) ──
  if (moduloActivo === 'launcher' && LauncherScreen) {
    return (
      <div className="app">
        <LauncherScreen
          ownerName={screenTweaks.ownerName}
          onEstudio={() => setModuloActivo('estudio')}
          onFormacion={() => setModuloActivo('formacion')}
          onNuevoProyecto={() => setModuloActivo('wizard')}
        />
      </div>
    );
  }

  // ── App autenticada — Wizard de nuevo proyecto ──
  if (moduloActivo === 'wizard' && ProyectoWizard) {
    return (
      <div className="app">
        <ProyectoWizard onClose={() => setModuloActivo('launcher')} />
      </div>
    );
  }

  // ── App autenticada — Módulo Estudio ──
  if (moduloActivo === 'estudio' && EstudioScreen) {
    return (
      <div className="app">
        <EstudioScreen
          store={store}
          onSwitch={() => setModuloActivo('launcher')}
          onOpenEstudiante={(id) => setEstudioOverlay({ type: 'ficha', id })}
          onNewEstudiante={() => setEstudioSheet('onboarding')}
          onTomarAsistencia={() => setEstudioOverlay('asistencia')}
          onAbrirConfig={() => setEstudioOverlay('config')}
          onAbrirComprobantes={() => setEstudioOverlay('comprobantes')}
        />

        {/* Ficha de estudiante */}
        {estudioOverlay && estudioOverlay.type === 'ficha' && EstudioFicha && (
          <EstudioFicha
            estudianteId={estudioOverlay.id}
            store={store}
            onClose={() => setEstudioOverlay(null)}
          />
        )}

        {/* Asistencia */}
        {EstudioAsistencia && (
          <EstudioAsistencia
            open={estudioOverlay === 'asistencia'}
            store={store}
            onClose={() => setEstudioOverlay(null)}
          />
        )}

        {/* Config del estudio */}
        {EstudioConfig && (
          <EstudioConfig
            open={estudioOverlay === 'config'}
            store={store}
            onClose={() => setEstudioOverlay(null)}
          />
        )}

        {/* Comprobantes */}
        {EstudioComprobantes && (
          <EstudioComprobantes
            open={estudioOverlay === 'comprobantes'}
            store={store}
            onClose={() => setEstudioOverlay(null)}
          />
        )}

        {/* Wizard de onboarding */}
        {EstudioOnboarding && (
          <EstudioOnboarding
            open={estudioSheet === 'onboarding'}
            store={store}
            onClose={() => setEstudioSheet(null)}
            onCreado={(id) => {
              setEstudioSheet(null);
              setEstudioOverlay({ type: 'ficha', id });
            }}
          />
        )}

        {/* Voice button (los comandos por ahora caen en el módulo formación) */}
        <VoiceButton onExecute={handleVoiceExecute} executingResult={voiceExecResult} />
      </div>
    );
  }

  const asistenciaHoy = store.state.asistencia[0] || {};

  let screen;
  if (tab === 'home') screen = <HomeScreen tweaks={screenTweaks} onNavigate={navigate} asistenciaHoy={asistenciaHoy} alumnas={store.state.alumnas} leads={store.state.leads} mensajes={store.state.mensajes} comprobantesPendientes={store.state.comprobantesPendientes} comprobantePendienteLatest={store.state.comprobantePendienteLatest} />;
  else if (tab === 'reservas') screen = <ReservasScreen tweaks={screenTweaks} onNavigate={navigate} onOpenAlumna={openAlumna} />;
  else if (tab === 'pagos') screen = <PagosScreen tweaks={screenTweaks} store={store} onOpenAlumna={openAlumna} onNewPago={() => setSheet('new-pago')} onNavigate={navigate} />;
  else if (tab === 'marketing') screen = <MarketingScreen onOpenLead={(id) => setSheet(id ? { type: 'edit-lead', id } : 'new-lead')} onNavigate={navigate} />;
  // Tab CRM eliminado: sin integración WA/IG no aporta. Plantillas viven en Ajustes y en el flujo de difusión.

  const tabs = [
    { id: 'home', label: 'Hoy', icon: 'home' },
    { id: 'reservas', label: 'Inscritos', icon: 'users' },
    { id: 'pagos', label: 'Pagos', icon: 'cash', badge: store.state.comprobantesPendientes },
    { id: 'marketing', label: 'Leads', icon: 'bullhorn' },
  ];

  const fabAction = () => {
    if (tab === 'reservas') setSheet('new-alumna');
    else if (tab === 'pagos') setSheet('new-pago');
    else if (tab === 'marketing') setSheet('new-lead');
    else setSheet('new-alumna');
  };

  return (
    <div className="app">
      {/* Volver al Inicio (home con tarjetas de proyectos). Flotante top-right
          sobre el header de cada screen de la formación. */}
      <button
        onClick={() => setModuloActivo('launcher')}
        title="Volver al inicio"
        aria-label="Volver al inicio"
        style={{
          position: 'absolute',
          top: 12, right: 12,
          zIndex: 70,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '6px 10px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--line)',
          fontSize: 11,
          color: 'var(--ink)',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        ← Inicio
      </button>

      <div
        ref={ptr.ref}
        className="app-scroll"
        key={tab}
        style={{
          transform: ptr.refreshing ? 'translateY(50px)' : (ptr.pullDistance > 0 ? `translateY(${ptr.pullDistance}px)` : ''),
          transition: ptr.pullDistance === 0 || ptr.refreshing ? 'transform 0.25s ease' : 'none',
        }}
      >
        {/* Indicador pull-to-refresh */}
        {(ptr.pullDistance > 0 || ptr.refreshing) && (
          <div style={{
            position: 'absolute', top: -50, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 50, color: 'var(--ink-soft)',
            pointerEvents: 'none',
          }}>
            {ptr.refreshing ? (
              <span style={{
                display: 'inline-block', width: 22, height: 22, borderRadius: '50%',
                border: '2px solid var(--terracota)', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <span style={{
                fontSize: 12,
                opacity: Math.min(1, ptr.pullDistance / ptr.UMBRAL),
                transform: ptr.triggered ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease',
                fontWeight: 500,
                letterSpacing: '0.06em',
              }}>
                {ptr.triggered ? '↑ Suelta para actualizar' : '↓ Jala para actualizar'}
              </span>
            )}
          </div>
        )}
        <div className="fade-in">{screen}</div>
      </div>

      {tweaks.showFAB && tab !== 'home' && (
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
              style={{ position: 'relative' }}
            >
              <Icon name={t.icon} size={18} strokeWidth={tab === t.id ? 1.8 : 1.5} />
              <span>{t.label}</span>
              {t.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: '50%',
                  transform: 'translateX(20px)',
                  minWidth: 18, height: 18, padding: '0 5px',
                  borderRadius: 9, background: 'var(--terracota)', color: '#fff',
                  fontSize: 10, fontWeight: 600, lineHeight: '18px', textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}>
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* gear flotante removido — el avatar S del home navega a ajustes */}

      {overlay === 'asistencia' && (
        <AsistenciaV2 store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'ajustes' && (
        <AjustesScreen store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'difusion' && (
        <DifusionScreen store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'papelera-leads' && (
        <PapeleraLeadsScreen onClose={() => setOverlay(null)} />
      )}
      {overlay === 'preinscripciones' && (
        <PreinscripcionesScreen
          onClose={() => setOverlay(null)}
          onOpenLead={(id) => { setOverlay(null); setSheet({ type: 'edit-lead', id }); }}
          onOpenAlumna={(id) => setOverlay({ type: 'alumna', id })}
        />
      )}
      {overlay === 'leads-descartados' && (
        <LeadsDescartadosScreen
          onClose={() => setOverlay(null)}
          onOpenLead={(id) => { setOverlay(null); setSheet({ type: 'edit-lead', id }); }}
        />
      )}
      {overlay === 'clase-inscripciones' && (
        <ClaseInscripcionesScreen onClose={() => setOverlay(null)} store={store} />
      )}
      {overlay && overlay.type === 'alumna' && (
        <FichaAlumna
          alumnaId={overlay.id}
          onClose={() => setOverlay(null)}
          store={store}
          onEdit={() => setSheet({ type: 'edit-alumna', id: overlay.id })}
          onPagar={() => setSheet({ type: 'new-pago', id: overlay.id })}
          onIrAComprobantes={() => { setOverlay(null); setTab('pagos'); }}
          onValidarComprobante={(comprobantePreData) =>
            setSheet({ type: 'new-pago', id: overlay.id, comprobantePreData })
          }
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
        onConvertir={(leadId) => setSheet({ type: 'new-pago-lead', id: leadId })}
      />
      <PagoForm
        open={sheet === 'new-pago' || (sheet && (sheet.type === 'new-pago' || sheet.type === 'new-pago-lead'))}
        onClose={() => setSheet(null)}
        store={store}
        alumnaPreId={sheet && sheet.type === 'new-pago' ? sheet.id : null}
        leadPreId={sheet && sheet.type === 'new-pago-lead' ? sheet.id : null}
        comprobantePreData={sheet && sheet.type === 'new-pago' ? sheet.comprobantePreData : null}
      />

      {/* Voice button (mic flotante) — encima del FAB */}
      <VoiceButton onExecute={handleVoiceExecute} executingResult={voiceExecResult} />

      {/* Toast de feedback del comando */}
      {voiceToast && (
        <div style={{
          position: 'absolute',
          bottom: 170, left: 16, right: 16,
          padding: '12px 16px',
          borderRadius: 14,
          background: voiceToast.ok ? 'var(--oliva)' : 'var(--terracota)',
          color: '#fff',
          fontSize: 13, lineHeight: 1.4,
          boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
          zIndex: 95,
          animation: 'slideUp 0.25s ease',
          textAlign: 'center',
        }}>
          {voiceToast.message}
        </div>
      )}

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
        </TweakSection>
        <TweakSection title="Atajos creación">
          <TweakButton label="+ Nuevo estudiante" onClick={() => setSheet('new-alumna')} />
          <TweakButton label="+ Nuevo lead" onClick={() => setSheet('new-lead')} />
          <TweakButton label="+ Registrar pago" onClick={() => setSheet('new-pago')} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

window.App = App;
export { App };
