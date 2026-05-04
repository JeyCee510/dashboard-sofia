import React from 'react';

const { useState, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioScreen — pantalla principal del módulo Estudio
//
// Una sola vista scrollable con todo lo crítico:
//   - Header con switch a Formación
//   - 4 KPIs: Activas / Vencen 7d / Cobros del mes / Pendientes validar
//   - Donut "¿Cómo me pagaron?" del mes (4 formas)
//   - Sección "Vencen pronto" con WhatsApp 1-tap
//   - Búsqueda + lista de estudiantes con estado (al día / por vencer / vencida)
//   - FAB "+" para abrir wizard de onboarding
// ─────────────────────────────────────────────────────────────────

function EstudioScreen({ store, onSwitch, onOpenEstudiante, onNewEstudiante, onTomarAsistencia, onAbrirConfig, onAbrirComprobantes }) {
  const e = store.estudio || {};
  const Icon = window.Icon;
  const [filtro, setFiltro] = useState('todas'); // todas | activas | porVencer | vencidas
  const [busqueda, setBusqueda] = useState('');

  // ── Cálculos de fechas ──
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
  const hoyStr = hoy.toISOString().slice(0, 10);
  const en7Str = en7.toISOString().slice(0, 10);

  // ── Mes en curso ──
  const mesIni = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const mesFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10);
  const sumas = e.sumarPagosPorForma ? e.sumarPagosPorForma(mesIni, mesFin) : { transferencia: 0, efectivo: 0, payphone: 0, canje: 0, total: 0 };

  // ── Estudiantes con estado ──
  const estudiantesConEstado = useMemo(() => {
    return (e.estudiantesActivas || []).map(est => {
      const m = e.getMembresiaActiva ? e.getMembresiaActiva(est.id) : null;
      const congelada = e.estaCongelada ? e.estaCongelada(m?.id) : false;
      let estado = 'sin_plan';
      let dias = null;
      if (m) {
        if (m.estado === 'cancelada') estado = 'cancelada';
        else if (congelada) estado = 'congelada';
        else if (e.estaVencida && e.estaVencida(m)) estado = 'vencida';
        else if (m.fechaFin && m.fechaFin <= en7Str) { estado = 'porVencer'; dias = e.diasParaVencer ? e.diasParaVencer(m) : null; }
        else estado = 'activa';
      }
      return { est, m, estado, dias, congelada };
    });
  }, [e.estudiantesActivas, e.membresias, e.congelaciones]);

  const porVencer = estudiantesConEstado.filter(x => x.estado === 'porVencer');
  const vencidas = estudiantesConEstado.filter(x => x.estado === 'vencida');
  const totalActivas = estudiantesConEstado.length;

  const filtradas = useMemo(() => {
    let lista = estudiantesConEstado;
    if (filtro === 'activas') lista = lista.filter(x => x.estado === 'activa' || x.estado === 'porVencer');
    else if (filtro === 'porVencer') lista = lista.filter(x => x.estado === 'porVencer' || x.estado === 'vencida');
    else if (filtro === 'vencidas') lista = lista.filter(x => x.estado === 'vencida');
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(x => x.est.nombre.toLowerCase().includes(q) || (x.est.tel || '').includes(q) || (x.est.instagram || '').toLowerCase().includes(q));
    }
    return lista.sort((a, b) => a.est.nombre.localeCompare(b.est.nombre));
  }, [estudiantesConEstado, filtro, busqueda]);

  // ── WhatsApp template ──
  const enviarWhatsApp = (estudiante, membresia, dias) => {
    const tel = (estudiante.tel || '').replace(/\D/g, '');
    if (!tel) {
      alert('No hay número de WhatsApp para ' + estudiante.nombre);
      return;
    }
    const msg = membresia && dias != null
      ? `Hola ${estudiante.nombre.split(' ')[0]} 🌿 Te recuerdo que tu plan "${membresia.planSnapshot?.nombre || 'mensualidad'}" vence en ${dias} día${dias === 1 ? '' : 's'} (el ${membresia.fechaFin}). Avísame si quieres renovar y te paso datos. Un abrazo, Sofía.`
      : `Hola ${estudiante.nombre.split(' ')[0]} 🌿 Tu plan venció. ¿Renovamos?`;
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="app-scroll" style={{ paddingBottom: 110 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '20px 22px 14px',
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Yoga · Estudio
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
            {store.state.ajustes.studioName || 'Estudio'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={onAbrirConfig}
            aria-label="Ajustes del estudio"
            title="Ajustes"
            style={iconBtn}
          >
            ⚙
          </button>
          <button
            onClick={onSwitch}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 999,
              background: 'var(--bg-soft)', border: '1px solid var(--line)',
              fontSize: 11, color: 'var(--ink)', cursor: 'pointer',
            }}
            aria-label="Ir a Formación"
          >
            Formación →
          </button>
        </div>
      </div>

      {/* Acciones primarias */}
      <div style={{ padding: '0 18px 14px', display: 'flex', gap: 8 }}>
        <button onClick={onTomarAsistencia} style={primaryActionBtn}>
          ✓ Tomar asistencia
        </button>
        {(e.countComprobantesPendientes || 0) > 0 && (
          <button onClick={onAbrirComprobantes} style={{ ...primaryActionBtn, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
            {e.countComprobantesPendientes} comprobante{e.countComprobantesPendientes === 1 ? '' : 's'} →
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <KpiCard label="Activas" value={totalActivas} sub="estudiantes" />
          <KpiCard label="Vencen 7d" value={porVencer.length} sub="membresías" emphasis={porVencer.length > 0 ? 'warn' : null} />
          <KpiCard label={`Cobros ${nombreMes(hoy)}`} value={`$${sumas.total.toFixed(0)}`} sub={`${sumas.transferencia + sumas.efectivo + sumas.payphone + sumas.canje > 0 ? 'este mes' : 'sin pagos aún'}`} />
          <KpiCard label="Pendientes" value={e.countComprobantesPendientes || 0} sub="comprobantes" emphasis={(e.countComprobantesPendientes || 0) > 0 ? 'warn' : null} />
        </div>
      </div>

      {/* Donut "¿Cómo me pagaron?" */}
      {sumas.total > 0 && (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid var(--line)', padding: 14,
          }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, fontWeight: 500 }}>
              ¿Cómo me pagaron este mes?
            </div>
            <DonutPagos sumas={sumas} />
          </div>
        </div>
      )}

      {/* Vencen pronto */}
      {(porVencer.length > 0 || vencidas.length > 0) && (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8, fontWeight: 500, paddingLeft: 4 }}>
            Vencen pronto
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {[...porVencer, ...vencidas].map((x, i, arr) => (
              <div key={x.est.id} style={{
                padding: '12px 14px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div onClick={() => onOpenEstudiante(x.est.id)} style={{ flex: 1, cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{x.est.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {x.m?.planSnapshot?.nombre || 'Sin plan'} ·{' '}
                    {x.estado === 'vencida' ? <span style={{ color: 'var(--terracota)' }}>Vencida {x.m?.fechaFin}</span> :
                      <span>Vence en {x.dias}d ({x.m?.fechaFin})</span>}
                  </div>
                </div>
                <button
                  onClick={(ev) => { ev.stopPropagation(); enviarWhatsApp(x.est, x.m, x.dias); }}
                  style={{
                    padding: '6px 10px', borderRadius: 999,
                    background: 'var(--oliva, #6f8c5c)', color: '#fff',
                    fontSize: 11, border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                  aria-label="Enviar WhatsApp"
                >
                  WhatsApp
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador + filtros */}
      <div style={{ padding: '0 18px 8px' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, tel o IG…"
          value={busqueda}
          onChange={ev => setBusqueda(ev.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--bg-soft)', fontSize: 13,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { k: 'todas', label: `Todas (${estudiantesConEstado.length})` },
            { k: 'activas', label: 'Activas' },
            { k: 'porVencer', label: 'Por vencer' },
            { k: 'vencidas', label: 'Vencidas' },
          ].map(f => (
            <button
              key={f.k}
              onClick={() => setFiltro(f.k)}
              style={{
                padding: '6px 12px', borderRadius: 999,
                background: filtro === f.k ? 'var(--ink)' : 'var(--bg-soft)',
                color: filtro === f.k ? '#fff' : 'var(--ink)',
                border: '1px solid var(--line)',
                fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de estudiantes */}
      <div style={{ padding: '8px 18px 24px' }}>
        {filtradas.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13,
            background: 'var(--bg-soft)', borderRadius: 14,
          }}>
            {busqueda.trim() ? 'Sin resultados para esa búsqueda' :
              estudiantesConEstado.length === 0 ? (
                <>
                  Aún no tienes estudiantes registradas.<br/>
                  Toca el <strong style={{ color: 'var(--ink)' }}>+</strong> para agregar la primera.
                </>
              ) : 'Sin estudiantes en este filtro'}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {filtradas.map((x, i) => (
              <button
                key={x.est.id}
                onClick={() => onOpenEstudiante(x.est.id)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderBottom: i < filtradas.length - 1 ? '1px solid var(--line)' : 'none',
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: x.est.avatar || 'var(--bg-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 500, fontSize: 13,
                  flexShrink: 0,
                }}>
                  {x.est.iniciales}
                </div>
                {/* Datos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                    {x.est.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <EstadoBadge estado={x.estado} />
                    {x.m?.planSnapshot?.nombre && <span>· {x.m.planSnapshot.nombre}</span>}
                    {x.estado === 'porVencer' && x.dias != null && <span>· en {x.dias}d</span>}
                    {x.m?.clasesTotales != null && <span>· {x.m.clasesUsadas}/{x.m.clasesTotales}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FAB onboarding — posicionado ENCIMA del mic para que no choquen.
          En el módulo formación el mic está sobre la tabbar; aquí no hay
          tabbar, así que el FAB sube a 175px y el mic queda a 100px. */}
      <button
        onClick={onNewEstudiante}
        aria-label="Nueva estudiante"
        style={{
          position: 'absolute',
          bottom: 175, right: 18,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--terracota)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 31,
        }}
      >
        <Icon name="plus" size={22} stroke="#fff" strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ─── Sub-componentes ───
function KpiCard({ label, value, sub, emphasis }) {
  const bg = emphasis === 'warn' ? '#fff7ed' : '#fff';
  const border = emphasis === 'warn' ? '#fed7aa' : 'var(--line)';
  const valueColor = emphasis === 'warn' ? '#c2410c' : 'var(--ink)';
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: bg, border: `1px solid ${border}`,
    }}>
      <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: valueColor, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-soft)', opacity: 0.7 }}>
        {sub}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    activa: { label: 'Al día', color: '#15803d', bg: '#dcfce7' },
    porVencer: { label: 'Por vencer', color: '#c2410c', bg: '#fff7ed' },
    vencida: { label: 'Vencida', color: '#b91c1c', bg: '#fee2e2' },
    cancelada: { label: 'Cancelada', color: '#6b7280', bg: '#f3f4f6' },
    congelada: { label: 'Congelada', color: '#075985', bg: '#e0f2fe' },
    sin_plan: { label: 'Sin plan', color: '#6b7280', bg: '#f3f4f6' },
  }[estado] || { label: estado, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 500,
    }}>
      {cfg.label}
    </span>
  );
}

function DonutPagos({ sumas }) {
  const colores = {
    transferencia: '#3b82f6',
    efectivo:      '#10b981',
    payphone:      '#a855f7',
    canje:         '#f59e0b',
  };
  const labels = {
    transferencia: 'Transferencia',
    efectivo:      'Efectivo',
    payphone:      'Payphone',
    canje:         'Canje',
  };
  const total = sumas.total || 1;
  const segmentos = ['transferencia', 'efectivo', 'payphone', 'canje']
    .map(k => ({ k, valor: sumas[k] || 0, pct: ((sumas[k] || 0) / total) * 100 }))
    .filter(s => s.valor > 0);

  // Donut SVG
  let acum = 0;
  const r = 36;
  const cx = 60, cy = 60;
  const arcs = segmentos.map(s => {
    const startAng = (acum / 100) * 2 * Math.PI - Math.PI / 2;
    const endAng = ((acum + s.pct) / 100) * 2 * Math.PI - Math.PI / 2;
    acum += s.pct;
    const x1 = cx + r * Math.cos(startAng);
    const y1 = cy + r * Math.sin(startAng);
    const x2 = cx + r * Math.cos(endAng);
    const y2 = cy + r * Math.sin(endAng);
    const largeArc = s.pct > 50 ? 1 : 0;
    return {
      k: s.k,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colores[s.k],
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {arcs.length === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="var(--bg-soft)" />
        ) : (
          arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)
        )}
        {/* Hueco central */}
        <circle cx={cx} cy={cy} r={20} fill="#fff" />
        <text x={cx} y={cy + 1} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
          ${sumas.total.toFixed(0)}
        </text>
      </svg>
      <div style={{ flex: 1, display: 'grid', gap: 4 }}>
        {['transferencia', 'efectivo', 'payphone', 'canje'].map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: colores[k], flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--ink-soft)' }}>{labels[k]}</span>
            <span style={{ fontWeight: 500, color: 'var(--ink)' }}>${(sumas[k] || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function nombreMes(d) {
  return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
}

const iconBtn = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--bg-soft)', border: '1px solid var(--line)',
  fontSize: 16, cursor: 'pointer', color: 'var(--ink)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
};

const primaryActionBtn = {
  flex: 1,
  padding: '12px',
  borderRadius: 12,
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'center',
};

window.EstudioScreen = EstudioScreen;
export { EstudioScreen };
