import React from 'react';

const { useState, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioFicha — overlay con detalle de una estudiante
//
// Muestra:
//   - Cabecera con avatar + nombre + contacto + acciones rápidas (WhatsApp, IG)
//   - Estado de la membresía actual (al día / por vencer / vencida / congelada)
//   - Historial: membresías anteriores + pagos + congelaciones (timeline simple)
//   - Acciones: renovar plan, registrar pago, congelar/descongelar, editar, archivar
// ─────────────────────────────────────────────────────────────────

function EstudioFicha({ estudianteId, onClose, store }) {
  const e = store.estudio || {};
  const est = (e.estudiantes || []).find(x => x.id === estudianteId);
  const [accion, setAccion] = useState(null); // 'renovar' | 'pago' | 'editar'
  const [menu, setMenu] = useState(false);

  const historialMembresias = useMemo(() =>
    (e.membresias || []).filter(m => m.estudianteId === estudianteId)
      .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')),
    [e.membresias, estudianteId]);

  const historialPagos = useMemo(() =>
    (e.pagos || []).filter(p => p.estudianteId === estudianteId)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [e.pagos, estudianteId]);

  if (!est) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={panel} onClick={ev => ev.stopPropagation()}>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>
            Estudiante no encontrada
          </div>
          <button onClick={onClose} style={btn}>Cerrar</button>
        </div>
      </div>
    );
  }

  const m = historialMembresias[0] || null;
  const congelada = e.estaCongelada ? e.estaCongelada(m?.id) : false;
  const vencida = m && e.estaVencida ? e.estaVencida(m) : false;
  const dias = m && e.diasParaVencer ? e.diasParaVencer(m) : null;

  const enviarWA = () => {
    const tel = (est.tel || '').replace(/\D/g, '');
    if (!tel) { alert('Sin WhatsApp registrado'); return; }
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  const abrirIG = () => {
    if (!est.instagram) return;
    const handle = est.instagram.replace(/^@/, '');
    window.open(`https://instagram.com/${handle}`, '_blank');
  };

  const congelarToggle = async () => {
    if (!m) return;
    try {
      if (congelada) {
        await e.descongelarMembresia({ membresiaId: m.id });
      } else {
        const ok = window.confirm(`¿Congelar la membresía de ${est.nombre}? Se pausa desde hoy y al descongelar la fecha_fin se extiende automáticamente.`);
        if (!ok) return;
        await e.congelarMembresia({ membresiaId: m.id, notas: 'Congelada manualmente' });
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={ev => ev.stopPropagation()}>
        {/* Header con menú + cerrar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px 0', position: 'relative' }}>
          <button onClick={() => setMenu(!menu)} aria-label="Más opciones" style={btnClose}>⋯</button>
          {menu && (
            <div style={{
              position: 'absolute', top: 46, left: 14,
              background: '#fff', borderRadius: 10, border: '1px solid var(--line)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 90,
              minWidth: 180,
            }}>
              <button onClick={() => { setMenu(false); setAccion('editar'); }} style={menuItem}>Editar datos</button>
              <button onClick={async () => {
                setMenu(false);
                const ok = window.confirm(`¿Archivar a ${est.nombre}? Se oculta de la lista pero los datos se preservan.`);
                if (ok) { await e.archivarEstudiante(estudianteId); onClose(); }
              }} style={{ ...menuItem, borderTop: '1px solid var(--line)' }}>Archivar</button>
            </div>
          )}
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>×</button>
        </div>

        {/* Avatar + nombre */}
        <div style={{ padding: '4px 22px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: est.avatar || 'var(--bg-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 500, fontSize: 18, flexShrink: 0,
          }}>
            {est.iniciales}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
              {est.nombre}
            </h2>
            {(est.tel || est.instagram) && (
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', gap: 10 }}>
                {est.tel && <span>{est.tel}</span>}
                {est.instagram && <span>{est.instagram}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {est.tel && <ChipBtn label="WhatsApp" onClick={enviarWA} color="oliva" />}
          {est.instagram && <ChipBtn label="Instagram" onClick={abrirIG} />}
          <ChipBtn label={m ? 'Renovar' : 'Asignar plan'} onClick={() => setAccion('renovar')} primary />
          <ChipBtn label="Registrar pago" onClick={() => setAccion('pago')} />
          {m && <ChipBtn label={congelada ? 'Descongelar' : 'Congelar'} onClick={congelarToggle} color={congelada ? 'azul' : null} />}
        </div>

        {/* Membresía actual */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Membresía actual
          </div>
          {m ? (
            <div style={{
              padding: 14, borderRadius: 12,
              background: vencida ? '#fef2f2' : congelada ? '#eff6ff' : '#fff',
              border: `1px solid ${vencida ? '#fecaca' : congelada ? '#bfdbfe' : 'var(--line)'}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {m.planSnapshot?.nombre || 'Plan'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                {m.fechaInicio} → {m.fechaFin}
                {m.clasesTotales != null && ` · ${m.clasesUsadas}/${m.clasesTotales} clases`}
              </div>
              <div style={{ marginTop: 8 }}>
                {congelada && <Tag color="azul">❄ Congelada</Tag>}
                {!congelada && vencida && <Tag color="rojo">Vencida</Tag>}
                {!congelada && !vencida && dias != null && dias <= 7 && <Tag color="naranja">Vence en {dias}d</Tag>}
                {!congelada && !vencida && dias != null && dias > 7 && <Tag color="verde">Al día</Tag>}
                {m.estado === 'cancelada' && <Tag color="gris">Cancelada</Tag>}
              </div>
            </div>
          ) : (
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-soft)', fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Sin membresía activa. Toca "Asignar plan" para empezar.
            </div>
          )}
        </div>

        {/* Historial — pagos + membresías unificadas */}
        {(historialPagos.length > 0 || historialMembresias.length > 1) && (
          <div style={{ padding: '0 18px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Historial
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {historialPagos.map((p, i) => (
                <div key={'p-' + p.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>Pago · {p.forma}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.fecha}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>${p.monto.toFixed(2)}</div>
                </div>
              ))}
              {historialMembresias.slice(1).map((mh) => (
                <div key={'m-' + mh.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Membresía · {mh.planSnapshot?.nombre}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{mh.fechaInicio} → {mh.fechaFin}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-sheets de acciones */}
        {accion === 'renovar' && (
          <RenovarSheet store={store} estudianteId={estudianteId} onClose={() => setAccion(null)} />
        )}
        {accion === 'pago' && (
          <PagoSheet store={store} estudianteId={estudianteId} membresiaActual={m} onClose={() => setAccion(null)} />
        )}
        {accion === 'editar' && (
          <EditarSheet store={store} estudiante={est} onClose={() => setAccion(null)} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-sheet: Renovar plan ───
function RenovarSheet({ store, estudianteId, onClose }) {
  const e = store.estudio;
  const planes = e.planesActivos || [];
  const [planId, setPlanId] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoForma, setPagoForma] = useState('transferencia');
  const [enviando, setEnviando] = useState(false);

  const planSel = planes.find(p => p.id === planId);
  React.useEffect(() => { if (planSel && !pagoMonto) setPagoMonto(String(planSel.precio)); }, [planSel]);

  const guardar = async () => {
    if (!planId) return;
    setEnviando(true);
    try {
      await e.renovarMembresia({
        estudianteId, planId, fechaInicio,
        pagoMonto: pagoMonto ? Number(pagoMonto) : null,
        pagoForma,
      });
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Renovar plan</h3>
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {planes.map(p => (
            <button key={p.id} onClick={() => setPlanId(p.id)} style={{
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${planId === p.id ? 'var(--terracota)' : 'var(--line)'}`,
              background: planId === p.id ? '#fff7ed' : '#fff',
              textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.duracionDias}d{p.numClases ? ` · ${p.numClases} clases` : ''}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--terracota)' }}>${p.precio}</div>
            </button>
          ))}
        </div>
        <Field label="Fecha inicio">
          <input type="date" value={fechaInicio} onChange={ev => setFechaInicio(ev.target.value)} style={input} />
        </Field>
        <Field label="Pago (opcional)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
            <input type="number" value={pagoMonto} onChange={ev => setPagoMonto(ev.target.value)} placeholder="0" style={input} />
            <SelectorForma value={pagoForma} onChange={setPagoForma} />
          </div>
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} disabled={!planId || enviando} style={{
            ...btn, flex: 2,
            background: planId && !enviando ? 'var(--terracota)' : 'var(--bg-soft)',
            color: planId && !enviando ? '#fff' : 'var(--ink-soft)',
          }}>{enviando ? 'Guardando…' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-sheet: Registrar pago manual ───
function PagoSheet({ store, estudianteId, membresiaActual, onClose }) {
  const e = store.estudio;
  const [monto, setMonto] = useState('');
  const [forma, setForma] = useState('transferencia');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!monto) return;
    setEnviando(true);
    try {
      await e.registrarPagoEstudio({
        estudianteId,
        membresiaId: membresiaActual?.id || null,
        monto: Number(monto), forma, fecha, notas,
      });
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Registrar pago</h3>
        <Field label="Monto">
          <input type="number" value={monto} onChange={ev => setMonto(ev.target.value)} placeholder="0" autoFocus style={input} />
        </Field>
        <Field label="Forma">
          <SelectorForma value={forma} onChange={setForma} />
        </Field>
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={ev => setFecha(ev.target.value)} style={input} />
        </Field>
        <Field label="Notas (opcional)">
          <input type="text" value={notas} onChange={ev => setNotas(ev.target.value)} placeholder="" style={input} />
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} disabled={!monto || enviando} style={{
            ...btn, flex: 2,
            background: monto && !enviando ? 'var(--terracota)' : 'var(--bg-soft)',
            color: monto && !enviando ? '#fff' : 'var(--ink-soft)',
          }}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-sheet: Editar datos personales ───
function EditarSheet({ store, estudiante, onClose }) {
  const [nombre, setNombre] = useState(estudiante.nombre || '');
  const [tel, setTel] = useState(estudiante.tel || '');
  const [instagram, setInstagram] = useState((estudiante.instagram || '').replace(/^@/, ''));
  const [email, setEmail] = useState(estudiante.email || '');
  const [notas, setNotas] = useState(estudiante.notas || '');
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setEnviando(true);
    try {
      await store.estudio.updateEstudiante(estudiante.id, {
        nombre: nombre.trim(),
        tel: tel || '',
        instagram: instagram ? '@' + instagram : '',
        email: email || '',
        notas: notas || '',
      });
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Editar estudiante</h3>
        <Field label="Nombre">
          <input type="text" value={nombre} onChange={ev => setNombre(ev.target.value)} style={input} autoFocus />
        </Field>
        <Field label="WhatsApp">
          <input type="tel" value={tel} onChange={ev => setTel(ev.target.value)} placeholder="+593 9 1234 5678" style={input} />
        </Field>
        <Field label="Instagram">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--ink-soft)', pointerEvents: 'none' }}>@</span>
            <input type="text" value={instagram} onChange={ev => setInstagram(ev.target.value.replace(/^@/, ''))}
              placeholder="usuario" style={{ ...input, paddingLeft: 28 }} />
          </div>
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={ev => setEmail(ev.target.value)} style={input} />
        </Field>
        <Field label="Notas">
          <textarea value={notas} onChange={ev => setNotas(ev.target.value)} rows={3}
            style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} disabled={!nombre.trim() || enviando} style={{
            ...btn, flex: 2,
            background: nombre.trim() && !enviando ? 'var(--terracota)' : 'var(--bg-soft)',
            color: nombre.trim() && !enviando ? '#fff' : 'var(--ink-soft)',
          }}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers UI ───
function ChipBtn({ label, onClick, color, primary }) {
  const colores = {
    oliva: { bg: '#6f8c5c', fg: '#fff' },
    azul:  { bg: '#075985', fg: '#fff' },
  };
  const c = primary
    ? { bg: 'var(--terracota)', fg: '#fff' }
    : color && colores[color]
      ? colores[color]
      : { bg: 'var(--bg-soft)', fg: 'var(--ink)' };
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 999,
      background: c.bg, color: c.fg,
      border: '1px solid var(--line)', fontSize: 11,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

function Tag({ color, children }) {
  const colores = {
    rojo: { bg: '#fee2e2', fg: '#b91c1c' },
    naranja: { bg: '#fff7ed', fg: '#c2410c' },
    verde: { bg: '#dcfce7', fg: '#15803d' },
    azul: { bg: '#dbeafe', fg: '#1e40af' },
    gris: { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = colores[color] || colores.gris;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 500,
    }}>{children}</span>
  );
}

function SelectorForma({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {['transferencia','efectivo','payphone','canje'].map(f => (
        <button key={f} onClick={() => onChange(f)} style={{
          flex: 1, padding: '8px 4px', borderRadius: 8,
          background: value === f ? 'var(--ink)' : 'var(--bg-soft)',
          color: value === f ? '#fff' : 'var(--ink-soft)',
          border: '1px solid var(--line)', fontSize: 9, cursor: 'pointer',
          textTransform: 'capitalize',
        }}>
          {f === 'transferencia' ? 'Trans.' : f === 'payphone' ? 'P.phone' : f}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 80,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const panel = {
  background: 'var(--bg, #faf7f2)',
  width: '100%', maxWidth: 720,
  borderTopLeftRadius: 20, borderTopRightRadius: 20,
  maxHeight: '94vh', overflowY: 'auto',
  boxShadow: '0 -10px 30px rgba(0,0,0,0.12)',
};
const subSheetBackdrop = {
  position: 'fixed', inset: 0, zIndex: 110,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const subSheet = {
  background: '#fff', width: '100%', maxWidth: 720,
  borderTopLeftRadius: 20, borderTopRightRadius: 20,
  padding: '20px 18px 24px',
  maxHeight: '90vh', overflowY: 'auto',
};
const input = {
  width: '100%', padding: '10px 12px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--bg-soft)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const btn = {
  padding: '12px', borderRadius: 12,
  border: 'none', fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
};
const btnClose = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--bg-soft)', border: 'none',
  fontSize: 18, cursor: 'pointer', color: 'var(--ink-soft)',
  lineHeight: 1,
};
const menuItem = {
  width: '100%', padding: '12px 16px',
  background: '#fff', border: 'none',
  textAlign: 'left', fontSize: 13, cursor: 'pointer',
  color: 'var(--ink)',
};

window.EstudioFicha = EstudioFicha;
export { EstudioFicha };
