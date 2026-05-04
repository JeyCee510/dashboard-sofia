import React from 'react';

const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioComprobantes — overlay para validar/rechazar comprobantes
// del módulo Estudio.
//
// Vista de pendientes (default), histórico (validados/rechazados) y
// detalle de cada comprobante con:
//   - Imagen firmada (URL temporal del bucket privado)
//   - Datos del cliente (nombre, contacto, monto declarado)
//   - Selector de estudiante existente (autocomplete)
//   - Selector de membresía (opcional, autodetecta la activa)
//   - Botones validar / rechazar / ajustar monto
// ─────────────────────────────────────────────────────────────────

function EstudioComprobantes({ open, onClose, store }) {
  const e = store.estudio || {};
  const [vista, setVista] = useState('pendientes'); // pendientes | historial
  const [seleccionado, setSeleccionado] = useState(null);

  if (!open) return null;

  const lista = (vista === 'pendientes')
    ? (e.comprobantesPendientes || [])
    : (e.comprobantes || []).filter(c => c.estado !== 'pendiente');

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={ev => ev.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 8px' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
            Comprobantes
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6 }}>
          <button onClick={() => setVista('pendientes')} style={{
            flex: 1, padding: '8px', borderRadius: 8,
            background: vista === 'pendientes' ? 'var(--ink)' : 'var(--bg-soft)',
            color: vista === 'pendientes' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)', fontSize: 12, cursor: 'pointer',
          }}>
            Pendientes ({(e.comprobantesPendientes || []).length})
          </button>
          <button onClick={() => setVista('historial')} style={{
            flex: 1, padding: '8px', borderRadius: 8,
            background: vista === 'historial' ? 'var(--ink)' : 'var(--bg-soft)',
            color: vista === 'historial' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)', fontSize: 12, cursor: 'pointer',
          }}>
            Historial
          </button>
        </div>

        {/* Lista */}
        <div style={{ padding: '0 18px 24px' }}>
          {lista.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)',
              background: 'var(--bg-soft)', borderRadius: 12,
            }}>
              {vista === 'pendientes' ? 'Sin comprobantes pendientes' : 'Sin historial'}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {lista.map((c, i) => (
                <button key={c.id} onClick={() => setSeleccionado(c)} style={{
                  width: '100%', padding: '12px 14px',
                  borderBottom: i < lista.length - 1 ? '1px solid var(--line)' : 'none',
                  background: 'transparent', border: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombreCliente}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {c.monto != null && `$${c.monto.toFixed(2)} · `}
                      {c.forma} · {c.fechaPago || formateaCreated(c.createdAt)}
                    </div>
                  </div>
                  <EstadoBadge estado={c.estado} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        {seleccionado && (
          <ComprobanteDetalle
            comprobante={seleccionado}
            store={store}
            onClose={() => setSeleccionado(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Detalle + acciones de validación ───
function ComprobanteDetalle({ comprobante, store, onClose }) {
  const e = store.estudio;
  const c = comprobante;
  const [imgUrl, setImgUrl] = useState(null);
  const [estudianteId, setEstudianteId] = useState(c.estudianteId || null);
  const [membresiaId, setMembresiaId] = useState(c.membresiaId || null);
  const [monto, setMonto] = useState(c.monto != null ? String(c.monto) : '');
  const [forma, setForma] = useState(c.forma || 'transferencia');
  const [fechaPago, setFechaPago] = useState(c.fechaPago || new Date().toISOString().slice(0, 10));
  const [busqueda, setBusqueda] = useState(c.estudianteId ? '' : (c.nombreCliente || ''));
  const [enviando, setEnviando] = useState(false);

  // Firmar URL del archivo
  useEffect(() => {
    let cancelled = false;
    if (e.firmarUrlComprobanteEstudio && c.storagePath) {
      e.firmarUrlComprobanteEstudio(c.storagePath).then(url => {
        if (!cancelled) setImgUrl(url);
      });
    }
    return () => { cancelled = true; };
  }, [c.storagePath]);

  const sugerencias = (e.estudiantesActivas || [])
    .filter(est => !busqueda.trim() || est.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 8);

  const estudianteSel = (e.estudiantes || []).find(x => x.id === estudianteId);

  const validar = async () => {
    if (!estudianteId) { alert('Elige una estudiante'); return; }
    if (!monto || Number(monto) <= 0) { alert('Monto inválido'); return; }
    setEnviando(true);
    try {
      await e.validarComprobanteEstudio({
        comprobanteId: c.id,
        estudianteId,
        membresiaId: membresiaId || null,
        monto: Number(monto),
        forma,
        fechaPago,
      });
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    const ok = window.confirm('¿Marcar este comprobante como rechazado?');
    if (!ok) return;
    setEnviando(true);
    try {
      await e.rechazarComprobanteEstudio({ comprobanteId: c.id, notas: 'Rechazado manualmente' });
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  const borrar = async () => {
    const ok = window.confirm('¿Borrar este comprobante? Si estaba validado, también se borra el pago asociado.');
    if (!ok) return;
    setEnviando(true);
    try {
      await e.deleteComprobanteEstudio(c.id);
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  // Membresías del estudiante seleccionado
  const membresiasEst = estudianteId
    ? (e.membresias || []).filter(m => m.estudianteId === estudianteId)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
    : [];

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Comprobante</h3>
          <button onClick={onClose} style={btnClose}>×</button>
        </div>

        {/* Imagen */}
        {imgUrl ? (
          (c.archivoTipo || '').startsWith('image') ? (
            <a href={imgUrl} target="_blank" rel="noopener noreferrer">
              <img src={imgUrl} alt="comprobante" style={{ width: '100%', borderRadius: 8, marginBottom: 12, maxHeight: 300, objectFit: 'contain', background: '#f3f4f6' }} />
            </a>
          ) : (
            <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'block', padding: 14, marginBottom: 12,
              background: 'var(--bg-soft)', borderRadius: 8,
              textAlign: 'center', fontSize: 12, color: 'var(--terracota)',
            }}>
              Abrir archivo ({c.archivoNombre || 'archivo'})
            </a>
          )
        ) : (
          <div style={{ padding: 30, background: 'var(--bg-soft)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Cargando archivo…
          </div>
        )}

        {/* Datos del subidor */}
        <div style={{ padding: 10, background: 'var(--bg-soft)', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>Subido por</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombreCliente}</div>
          {c.contacto && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{c.contacto}</div>}
          {c.notas && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic' }}>"{c.notas}"</div>}
        </div>

        {c.estado === 'pendiente' ? (
          <>
            {/* Asociar a estudiante */}
            <Field label="Estudiante">
              {estudianteSel ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{estudianteSel.nombre}</div>
                  <button onClick={() => { setEstudianteId(null); setMembresiaId(null); }} style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 11, cursor: 'pointer',
                  }}>cambiar</button>
                </div>
              ) : (
                <>
                  <input type="text" value={busqueda} onChange={ev => setBusqueda(ev.target.value)}
                    placeholder="Buscar estudiante…" style={input} />
                  {sugerencias.length > 0 && (
                    <div style={{ marginTop: 6, background: '#fff', borderRadius: 10, border: '1px solid var(--line)', maxHeight: 180, overflowY: 'auto' }}>
                      {sugerencias.map((est, i) => (
                        <button key={est.id} onClick={() => { setEstudianteId(est.id); setBusqueda(''); }} style={{
                          width: '100%', padding: '8px 12px',
                          borderBottom: i < sugerencias.length - 1 ? '1px solid var(--line)' : 'none',
                          background: 'transparent', border: 'none',
                          textAlign: 'left', cursor: 'pointer', fontSize: 13,
                        }}>{est.nombre}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Field>

            {/* Membresía (opcional) */}
            {estudianteId && membresiasEst.length > 0 && (
              <Field label="Membresía a la que aplica (opcional)">
                <select value={membresiaId || ''} onChange={ev => setMembresiaId(ev.target.value ? Number(ev.target.value) : null)} style={input}>
                  <option value="">— Auto-detectar —</option>
                  {membresiasEst.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.planSnapshot?.nombre} · {m.fechaInicio} → {m.fechaFin}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* Monto + forma + fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <Field label="Monto">
                <input type="number" value={monto} onChange={ev => setMonto(ev.target.value)} placeholder="0" style={input} />
              </Field>
              <Field label="Forma">
                <div style={{ display: 'flex', gap: 4 }}>
                  {['transferencia','efectivo','payphone','canje'].map(f => (
                    <button key={f} onClick={() => setForma(f)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8,
                      background: forma === f ? 'var(--ink)' : 'var(--bg-soft)',
                      color: forma === f ? '#fff' : 'var(--ink-soft)',
                      border: '1px solid var(--line)', fontSize: 9, cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}>{f === 'transferencia' ? 'Trans.' : f === 'payphone' ? 'P.phone' : f}</button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Fecha del pago">
              <input type="date" value={fechaPago} onChange={ev => setFechaPago(ev.target.value)} style={input} />
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={rechazar} disabled={enviando} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>
                Rechazar
              </button>
              <button onClick={validar} disabled={enviando || !estudianteId || !monto} style={{
                ...btn, flex: 2,
                background: !enviando && estudianteId && monto ? 'var(--terracota)' : 'var(--bg-soft)',
                color: !enviando && estudianteId && monto ? '#fff' : 'var(--ink-soft)',
              }}>{enviando ? 'Validando…' : 'Validar y registrar pago'}</button>
            </div>
          </>
        ) : (
          <>
            {/* Historial — ya procesado */}
            <div style={{ padding: 10, borderRadius: 8, background: c.estado === 'validado' ? '#dcfce7' : '#fee2e2', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: c.estado === 'validado' ? '#15803d' : '#b91c1c' }}>
                {c.estado === 'validado' ? '✓ Validado' : '✗ Rechazado'} {c.validadoAt && `el ${new Date(c.validadoAt).toLocaleDateString('es-EC')}`}
              </div>
              {c.validadoNotas && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>{c.validadoNotas}</div>}
            </div>
            {c.estado === 'validado' && c.monto != null && (
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>${c.monto.toFixed(2)}</strong> via {c.forma} · {c.fechaPago}
              </div>
            )}
            <button onClick={borrar} disabled={enviando} style={{ ...btn, width: '100%', background: '#fee2e2', color: '#b91c1c' }}>
              Borrar comprobante {c.estado === 'validado' && '(revierte el pago)'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───
function EstadoBadge({ estado }) {
  const cfg = {
    pendiente: { label: 'Pendiente', color: '#c2410c', bg: '#fff7ed' },
    validado: { label: 'Validado', color: '#15803d', bg: '#dcfce7' },
    rechazado: { label: 'Rechazado', color: '#b91c1c', bg: '#fee2e2' },
  }[estado] || { label: estado, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function formateaCreated(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, fontWeight: 500 }}>{label}</label>}
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
  maxHeight: '92vh', overflowY: 'auto',
};
const input = {
  width: '100%', padding: '10px 12px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--bg-soft)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const btn = { padding: '12px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const btnClose = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--bg-soft)', border: 'none',
  fontSize: 22, cursor: 'pointer', color: 'var(--ink-soft)',
  lineHeight: 1, flexShrink: 0,
};

window.EstudioComprobantes = EstudioComprobantes;
export { EstudioComprobantes };
