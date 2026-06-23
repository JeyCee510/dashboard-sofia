import React from 'react';
const { useState, useMemo } = React;

// ──────────────────────────────────────────────────────────────
// ProyectoShell — shell genérico de proyecto (modelo convergido)
//
// Mismo lenguaje que la formación: pestañas inferiores Hoy / Inscritos /
// Pagos / Leads. Lee de `participaciones` + `personas` vía useProyectoData.
// Sirve para CUALQUIER proyecto con shell='formacion' (taller, futuros, etc.).
// Los Leads son el pool COMPARTIDO entre todos los proyectos.
// ──────────────────────────────────────────────────────────────

const money = (n) => '$' + (Number(n || 0)).toLocaleString('es-EC');
const saldoDe = (p) => Math.max(0, Number(p.total || 0) - Number(p.pagado || 0));

const Avatar = ({ persona }) => (
  <div style={{
    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
    background: persona?.avatar || 'var(--oliva-soft)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600,
  }}>
    {persona?.iniciales || (persona?.nombre || '?').slice(0, 1).toUpperCase()}
  </div>
);

// ── Sheet de alta (inscrito o lead) ──
const AltaSheet = ({ open, titulo, conTotal, onClose, onGuardar }) => {
  const [d, setD] = useState({ nombre: '', tel: '', instagram: '', total: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  React.useEffect(() => { if (open) { setD({ nombre: '', tel: '', instagram: '', total: '' }); setErr(null); } }, [open]);
  if (!open) return null;
  const inp = { width: '100%', padding: '11px 13px', fontSize: 14, border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface)', color: 'var(--ink)', marginBottom: 10, fontFamily: 'inherit' };
  const guardar = async () => {
    if (!d.nombre.trim()) { setErr('Falta el nombre'); return; }
    setBusy(true); setErr(null);
    try { await onGuardar({ nombre: d.nombre, tel: d.tel, instagram: d.instagram, total: conTotal && d.total ? Number(d.total) : null }); onClose(); }
    catch (e) { setErr(e.message || 'Error al guardar'); } finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '22px 20px calc(22px + env(safe-area-inset-bottom))' }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: '0 0 14px', color: 'var(--ink)' }}>{titulo}</h3>
        <input style={inp} placeholder="Nombre" value={d.nombre} onChange={e => setD({ ...d, nombre: e.target.value })} />
        <input style={inp} placeholder="Teléfono (opcional)" value={d.tel} onChange={e => setD({ ...d, tel: e.target.value })} />
        <input style={inp} placeholder="Instagram (opcional)" value={d.instagram} onChange={e => setD({ ...d, instagram: e.target.value })} />
        {conTotal && <input style={inp} placeholder="Total a pagar (opcional)" inputMode="decimal" value={d.total} onChange={e => setD({ ...d, total: e.target.value })} />}
        {err && <div style={{ color: 'var(--rojo)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        <button className="btn btn-primary btn-block" onClick={guardar} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
};

const ProyectoShell = ({ proyecto, onBack }) => {
  const Icon = window.Icon;
  const useProyectoData = window.useProyectoData;
  const { inscritos, leads, loading, agregarInscrito, registrarPago, agregarLead, convertirLead } = useProyectoData(proyecto.id);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // 'inscrito' | 'lead'

  const stats = useMemo(() => {
    const recaudado = inscritos.reduce((s, p) => s + Number(p.pagado || 0), 0);
    const total = inscritos.reduce((s, p) => s + Number(p.total || 0), 0);
    const pendientes = inscritos.filter(p => saldoDe(p) > 0).length;
    return { recaudado, total, pendientes, nInscritos: inscritos.length, nLeads: leads.length };
  }, [inscritos, leads]);

  const tabs = [
    { id: 'home', label: 'Hoy', icon: 'home' },
    { id: 'inscritos', label: 'Inscritos', icon: 'users' },
    { id: 'pagos', label: 'Pagos', icon: 'cash', badge: stats.pendientes },
    { id: 'leads', label: 'Leads', icon: 'bullhorn' },
  ];

  const pedirPago = async (p) => {
    const monto = window.prompt(`Registrar pago para ${p.persona?.nombre} (saldo ${money(saldoDe(p))})`, '');
    if (monto && !isNaN(Number(monto))) { try { await registrarPago(p.id, Number(monto)); } catch (e) { alert(e.message); } }
  };

  return (
    <div className="app">
      {/* Volver al inicio */}
      <button onClick={onBack} title="Volver al inicio" style={{ position: 'absolute', top: 12, right: 12, zIndex: 70, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', border: '1px solid var(--line)', fontSize: 11, color: 'var(--ink)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>← Inicio</button>

      <div className="app-scroll fade-in" key={tab}>
        <div style={{ padding: '56px 20px 20px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>{proyecto.nombre}</div>

          {/* ── HOY ── */}
          {tab === 'home' && (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: '0 0 16px', color: 'var(--ink)' }}>Resumen</h1>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { k: 'Inscritos', v: stats.nInscritos },
                  { k: 'Por cobrar', v: stats.pendientes },
                  { k: 'Recaudado', v: money(stats.recaudado) },
                  { k: 'Leads', v: stats.nLeads },
                ].map(c => (
                  <div key={c.k} className="card" style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.k}</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: 'var(--ink)', fontWeight: 600, marginTop: 4 }}>{c.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INSCRITOS ── */}
          {tab === 'inscritos' && (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: '0 0 12px', color: 'var(--ink)' }}>Inscritos</h1>
              {loading && <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>}
              {!loading && inscritos.length === 0 && <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Aún no hay inscritos. Toca + para agregar.</div>}
              {inscritos.map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
                  <Avatar persona={p.persona} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{p.persona?.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{money(p.pagado)} / {money(p.total)} · {p.estado || 'pendiente'}</div>
                  </div>
                  {saldoDe(p) > 0 && <span style={{ fontSize: 11, color: 'var(--rojo)', fontWeight: 600 }}>{money(saldoDe(p))}</span>}
                </div>
              ))}
            </div>
          )}

          {/* ── PAGOS ── */}
          {tab === 'pagos' && (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: '0 0 6px', color: 'var(--ink)' }}>Pagos</h1>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>Recaudado {money(stats.recaudado)} de {money(stats.total)}</div>
              {inscritos.filter(p => saldoDe(p) > 0).map(p => (
                <button key={p.id} onClick={() => pedirPago(p)} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10, width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
                  <Avatar persona={p.persona} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{p.persona?.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Saldo {money(saldoDe(p))}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--terracota)', fontWeight: 600 }}>+ pago</span>
                </button>
              ))}
              {inscritos.filter(p => saldoDe(p) > 0).length === 0 && <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Nadie debe saldo. ✨</div>}
            </div>
          )}

          {/* ── LEADS (pool compartido) ── */}
          {tab === 'leads' && (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: '0 0 4px', color: 'var(--ink)' }}>Leads</h1>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 14 }}>Pool compartido entre todos tus proyectos</div>
              {leads.map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
                  <Avatar persona={p.persona} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{p.persona?.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.fuente || 'lead'} · {p.estado || 'nuevo'}</div>
                  </div>
                  <button onClick={() => convertirLead(p.persona_id).catch(e => alert(e.message))} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--oliva)', cursor: 'pointer', fontWeight: 600 }}>+ inscribir</button>
                </div>
              ))}
              {leads.length === 0 && <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Sin leads todavía.</div>}
            </div>
          )}
        </div>
      </div>

      {/* FAB contextual */}
      {(tab === 'inscritos' || tab === 'leads') && (
        <button className="fab" onClick={() => setSheet(tab === 'inscritos' ? 'inscrito' : 'lead')} aria-label="Nuevo">
          {Icon ? <Icon name="plus" size={20} stroke="var(--bg)" strokeWidth={2.2} /> : '+'}
        </button>
      )}

      {/* Tabbar */}
      <div className="tabbar">
        <div className="tabbar-inner">
          {tabs.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ position: 'relative' }}>
              {Icon ? <Icon name={t.icon} size={18} strokeWidth={tab === t.id ? 1.8 : 1.5} /> : null}
              <span>{t.label}</span>
              {t.badge > 0 && (
                <span style={{ position: 'absolute', top: 4, right: '50%', transform: 'translateX(20px)', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--terracota)', color: '#fff', fontSize: 10, fontWeight: 600, lineHeight: '18px', textAlign: 'center' }}>{t.badge > 9 ? '9+' : t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AltaSheet open={sheet === 'inscrito'} titulo="Nuevo inscrito" conTotal onClose={() => setSheet(null)} onGuardar={agregarInscrito} />
      <AltaSheet open={sheet === 'lead'} titulo="Nuevo lead" onClose={() => setSheet(null)} onGuardar={agregarLead} />
    </div>
  );
};

window.ProyectoShell = ProyectoShell;
export { ProyectoShell };
