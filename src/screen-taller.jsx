import React from 'react';
import { useTaller } from './hooks/useTaller.js';
import { buildWaUrl, buildIgUrl, cleanInstagram } from './lib/wa.js';
import { supabase } from './lib/supabase.js';

const { useState, useMemo, useEffect, useRef } = React;

// ──────────────────────────────────────────────────────────────
// TallerScreen — Admin para un proyecto de tipo "taller_drop_in".
//
// Pantalla principal con 3 tabs (Encuentros / Inscritos / Pagos) y
// overlays para agregar inscrita, registrar pago, ficha individual,
// y generar links personalizados (admin → WA con prefill).
//
// Aplicados aprendizajes del módulo formación:
//  - window.Icon leído render-time (evita race con Promise.all)
//  - window.open SÍNCRONO antes de awaits (iOS PWA gotcha)
//  - touch-action:manipulation hereda del root
//  - Realtime con UN canal por feature (sin colisiones)
//  - useState al tope (sin violar Rules of Hooks)
// ──────────────────────────────────────────────────────────────

const fechaCorta = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[m - 1]}`;
};
const fechaLarga = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return `${dias[dt.getDay()]} ${d} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m-1]}`;
};

const money = (n) => `$${Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;

// Precio según cantidad de encuentros (usa los tiers de config)
function precioPorN(proyecto, n) {
  const tiers = proyecto?.config?.tiers || {};
  if (tiers[String(n)] != null) return Number(tiers[String(n)]);
  return Number(tiers.default || 0) * n;
}

// ────────── Tarjeta encuentro (tab Encuentros) ──────────
const EncuentroCard = ({ encuentro, onClick }) => {
  const lleno = encuentro.disponibles === 0;
  return (
    <button
      onClick={onClick}
      className="card lift"
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: 16, marginBottom: 10,
        background: 'var(--surface)', borderRadius: 'var(--r-md)',
        border: `1px solid ${lleno ? 'var(--terracota)' : 'var(--line)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Encuentro {encuentro.numero}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: lleno ? 'var(--terracota)' : encuentro.disponibles <= 3 ? 'var(--gold)' : 'var(--oliva)',
        }}>
          {lleno ? 'Lleno' : `${encuentro.disponibles} de ${encuentro.cupos} libres`}
        </div>
      </div>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif", fontSize: 22, lineHeight: 1.1,
        color: 'var(--ink)', fontWeight: 600,
      }}>
        {fechaLarga(encuentro.fecha)}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
        {encuentro.hora_inicio}–{encuentro.hora_fin} · {encuentro.ubicacion || 'sin ubicación'}
      </div>
    </button>
  );
};

// ────────── Tarjeta inscrita (tab Inscritos) ──────────
const InscritaRow = ({ inscrita, onClick }) => {
  const pagado = inscrita.pagado;
  const saldo = inscrita.saldo;
  const total = inscrita.total;
  const completa = saldo === 0 && total > 0;
  return (
    <button
      onClick={onClick}
      className="card lift"
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 14px', marginBottom: 8,
        background: 'var(--surface)', borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15, marginBottom: 2 }}>
            {inscrita.nombre}
            {inscrita.precio_especial && (
              <span style={{
                marginLeft: 6, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999,
                background: 'var(--terracota-tint)', color: 'var(--terracota)',
              }}>precio especial</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {inscrita.encuentros.length} encuentro(s): {inscrita.encuentros.map(e => `#${e.numero}`).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: completa ? 'var(--oliva)' : 'var(--ink)' }}>
            {money(pagado)} <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>/{money(total)}</span>
          </div>
          {saldo > 0 && (
            <div style={{ fontSize: 11, color: 'var(--terracota)' }}>saldo {money(saldo)}</div>
          )}
          {completa && (
            <div style={{ fontSize: 11, color: 'var(--oliva)' }}>completado</div>
          )}
        </div>
      </div>
    </button>
  );
};

// ────────── Form agregar inscrita manual ──────────
const AgregarInscritaSheet = ({ open, onClose, taller }) => {
  const Icon = window.Icon;
  const TelInput = window.TelInput;
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [instagram, setInstagram] = useState('');
  const [encuentrosSel, setEncuentrosSel] = useState([]);
  const [precioEspecial, setPrecioEspecial] = useState(false);
  const [totalManual, setTotalManual] = useState('');
  const [precioMotivo, setPrecioMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) {
      setNombre(''); setTel(''); setInstagram('');
      setEncuentrosSel([]); setPrecioEspecial(false); setTotalManual(''); setPrecioMotivo('');
      setErr(null); setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const totalCalculado = precioPorN(taller.proyecto, encuentrosSel.length);
  const totalUsar = precioEspecial ? Number(totalManual || 0) : totalCalculado;

  const toggleEnc = (id) => {
    setEncuentrosSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const guardar = async () => {
    setErr(null);
    if (precioEspecial && (!totalManual || !precioMotivo.trim())) {
      setErr('Para precio especial necesitas monto y motivo');
      return;
    }
    setBusy(true);
    try {
      await taller.agregarInscritoManual({
        nombre, tel, instagram,
        encuentroIds: encuentrosSel,
        totalManual: precioEspecial ? Number(totalManual) : null,
        precioEspecial,
        precioMotivo: precioEspecial ? precioMotivo : null,
      });
      onClose();
    } catch (e) {
      setErr(e.message || 'No se pudo agregar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '24px 22px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: 0, fontWeight: 600 }}>
            Agregar inscrita
          </h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>
            {Icon && <Icon name="close" size={18} />}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="Nombre completo" />

        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>WhatsApp</label>
        {TelInput
          ? <TelInput value={tel} onChange={setTel} />
          : <input value={tel} onChange={e => setTel(e.target.value)} className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="+593..." />
        }

        <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, marginTop: 12 }}>Instagram (opcional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--ink-mute)' }}>@</span>
          <input value={instagram} onChange={e => setInstagram(e.target.value)} className="input" style={{ flex: 1 }} placeholder="handle" />
        </div>

        <div style={{ marginTop: 18, marginBottom: 6, fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Encuentros (elige uno o más)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {taller.encuentros.map(e => {
            const sel = encuentrosSel.includes(e.id);
            const lleno = e.disponibles === 0;
            return (
              <button
                key={e.id}
                disabled={lleno && !sel}
                onClick={() => !lleno && toggleEnc(e.id)}
                style={{
                  padding: 10, borderRadius: 'var(--r-md)', textAlign: 'left',
                  border: `1.5px solid ${sel ? 'var(--terracota)' : 'var(--line)'}`,
                  background: sel ? 'var(--terracota-tint)' : 'var(--bg-warm)',
                  cursor: lleno ? 'not-allowed' : 'pointer',
                  opacity: lleno && !sel ? 0.45 : 1,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>#{e.numero} · {fechaCorta(e.fecha)}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {lleno ? 'lleno' : `${e.disponibles} libres`}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-warm)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Total {encuentrosSel.length} encuentro{encuentrosSel.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{money(totalUsar)}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 8 }}>
            <input type="checkbox" checked={precioEspecial} onChange={e => setPrecioEspecial(e.target.checked)} />
            Precio especial (distinto del estándar)
          </label>
          {precioEspecial && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <input type="number" value={totalManual} onChange={e => setTotalManual(e.target.value)} className="input" placeholder="Monto total" />
              <input value={precioMotivo} onChange={e => setPrecioMotivo(e.target.value)} className="input" placeholder="Motivo (obligatorio)" />
            </div>
          )}
        </div>

        {err && <div style={{ marginTop: 10, color: 'var(--terracota)', fontSize: 13 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={guardar}
            className="btn btn-primary"
            disabled={busy || !nombre.trim() || encuentrosSel.length === 0}
            style={{ flex: 2 }}
          >
            {busy ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────── Ficha de inscrita ──────────
const FichaInscritaSheet = ({ open, inscrita, taller, onClose }) => {
  const Icon = window.Icon;
  const [tabFicha, setTabFicha] = useState('info');
  const [montoPago, setMontoPago] = useState('');
  const [formaPago, setFormaPago] = useState('transferencia');
  const [busyPago, setBusyPago] = useState(false);
  const [errPago, setErrPago] = useState(null);
  const [planEdit, setPlanEdit] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (open && inscrita) {
      setTabFicha('info');
      setMontoPago('');
      setFormaPago('transferencia');
      setErrPago(null);
      setPlanEdit(inscrita.plan_pagos || '');
    }
  }, [open, inscrita?.id]);

  if (!open || !inscrita) return null;

  // Origen ubicación maps
  const linkComprobante = `${window.location.origin}/taller-comprobante/${inscrita.comprobante_token}`;

  const enviarLinkComprobante = () => {
    // SYNC primero (iOS PWA gotcha)
    const msg = `Hola ${inscrita.nombre}! Te dejo tu link personal para subir comprobantes del taller "${taller.proyecto?.nombre}":\n${linkComprobante}`;
    const waUrl = buildWaUrl(inscrita.tel, msg);
    if (waUrl) window.open(waUrl, '_blank');
  };

  const enviarLinkInscripcionPublica = async () => {
    // Genera token personalizado y manda link prellenado para que confirme su inscripción
    setLinkBusy(true);
    // ABRIR window SÍNCRONO primero (iOS PWA)
    const waWin = window.open('', '_blank');
    try {
      const token = await taller.crearLinkPersonalizado({
        nombre: inscrita.nombre, tel: inscrita.tel, instagram: inscrita.instagram,
      });
      const url = `${window.location.origin}/taller/${taller.proyecto.slug}/i/${token}`;
      const msg = `Hola ${inscrita.nombre}! Te comparto el link personalizado para que confirmes tu inscripción al taller "${taller.proyecto.nombre}":\n${url}`;
      const waUrl = buildWaUrl(inscrita.tel, msg);
      if (waUrl && waWin) waWin.location.href = waUrl;
      else if (waWin) waWin.close();
    } catch (e) {
      if (waWin) waWin.close();
      alert(e.message || 'No se pudo generar el link');
    } finally {
      setLinkBusy(false);
    }
  };

  const registrarPago = async () => {
    setErrPago(null);
    setBusyPago(true);
    try {
      await taller.registrarPago({
        inscritoId: inscrita.id,
        monto: Number(montoPago),
        formaPago,
      });
      setMontoPago('');
    } catch (e) {
      setErrPago(e.message);
    } finally {
      setBusyPago(false);
    }
  };

  const guardarPlan = async () => {
    if (planEdit === inscrita.plan_pagos) return;
    try { await taller.actualizarInscrito(inscrita.id, { plan_pagos: planEdit }); }
    catch (e) { console.error(e); }
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar a ${inscrita.nombre} del taller? Esto borra sus encuentros y pagos.`)) return;
    try {
      await taller.eliminarInscrito(inscrita.id);
      onClose();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="sheet-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', width: '100%', maxWidth: 600,
        maxHeight: '92vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '20px 22px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Inscrita
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, margin: '2px 0 0', fontWeight: 600 }}>
              {inscrita.nombre}
            </h2>
            {inscrita.tel && <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{inscrita.tel}</div>}
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>
            {Icon && <Icon name="close" size={18} />}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
          {['info', 'pagos', 'asistencia'].map(t => (
            <button
              key={t}
              onClick={() => setTabFicha(t)}
              style={{
                padding: '8px 14px', background: 'transparent', border: 'none',
                borderBottom: tabFicha === t ? '2px solid var(--terracota)' : '2px solid transparent',
                fontWeight: 600, color: tabFicha === t ? 'var(--terracota)' : 'var(--ink-soft)',
                cursor: 'pointer', fontSize: 13, textTransform: 'capitalize',
              }}
            >{t}</button>
          ))}
        </div>

        {tabFicha === 'info' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Encuentros elegidos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inscrita.encuentros.map(e => (
                  <span key={e.id} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12,
                    background: 'var(--terracota-tint)', color: 'var(--terracota)', fontWeight: 600,
                  }}>
                    #{e.numero} · {fechaCorta(e.fecha)}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <Stat label="Total" valor={money(inscrita.total)} />
              <Stat label="Pagado" valor={money(inscrita.pagado)} color="var(--oliva)" />
              <Stat label="Saldo" valor={money(inscrita.saldo)} color={inscrita.saldo > 0 ? 'var(--terracota)' : 'var(--ink-mute)'} />
            </div>

            {inscrita.precio_especial && (
              <div style={{ padding: 10, background: 'var(--terracota-tint)', borderRadius: 'var(--r-md)', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--terracota)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Precio especial</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>{inscrita.precio_motivo}</div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Plan de pagos (nota)</div>
              <textarea
                value={planEdit}
                onChange={e => setPlanEdit(e.target.value)}
                onBlur={guardarPlan}
                rows={2}
                className="input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Notas del plan de pagos..."
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={enviarLinkComprobante} className="btn btn-ghost" disabled={!inscrita.tel}>
                {Icon && <Icon name="link" size={14} />} Enviar link de comprobantes
              </button>
              <button onClick={enviarLinkInscripcionPublica} className="btn btn-ghost" disabled={linkBusy || !inscrita.tel}>
                {Icon && <Icon name="link" size={14} />} {linkBusy ? 'Generando...' : 'Enviar link personalizado de inscripción'}
              </button>
              <button onClick={eliminar} className="btn btn-ghost" style={{ color: 'var(--terracota)' }}>
                Eliminar del taller
              </button>
            </div>
          </>
        )}

        {tabFicha === 'pagos' && (
          <>
            <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-warm)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Registrar pago</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} className="input" placeholder="Monto $" />
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className="input">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="payphone">Payphone</option>
                  <option value="canje">Canje</option>
                </select>
                {errPago && <div style={{ color: 'var(--terracota)', fontSize: 12 }}>{errPago}</div>}
                <button onClick={registrarPago} className="btn btn-primary" disabled={busyPago || !montoPago}>
                  {busyPago ? 'Registrando...' : 'Registrar (no valida automáticamente)'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Historial ({inscrita.pagos.length})
            </div>
            {inscrita.pagos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: 16, textAlign: 'center' }}>Sin pagos aún</div>
            )}
            {inscrita.pagos.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 10, marginBottom: 6,
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{money(p.monto)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    {p.forma_pago} · {new Date(p.fecha).toLocaleDateString('es-EC')}
                  </div>
                  {p.comprobante_url && (
                    <a href={p.comprobante_url} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--terracota)' }}>ver comprobante</a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!p.validado && (
                    <button onClick={() => taller.validarPago(p.id)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>
                      Validar
                    </button>
                  )}
                  {p.validado && (
                    <span style={{ fontSize: 11, color: 'var(--oliva)', fontWeight: 600 }}>✓ validado</span>
                  )}
                  <button onClick={() => {
                    if (confirm('¿Eliminar este pago?')) taller.eliminarPago(p.id);
                  }} className="btn btn-ghost" style={{ padding: '4px 8px', color: 'var(--terracota)' }}>×</button>
                </div>
              </div>
            ))}
          </>
        )}

        {tabFicha === 'asistencia' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Marca su asistencia a cada encuentro al que se inscribió.
            </div>
            {inscrita.encuentros.map(e => {
              const rel = taller.inscritos.find(i => i.id === inscrita.id)?.encuentros.find(x => x.id === e.id);
              // necesitamos el id de la relación, no del encuentro. Re-busco
              return (
                <RelAsistencia key={e.id} inscritoId={inscrita.id} encuentro={e} taller={taller} />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, valor, color }) => (
  <div style={{ padding: 10, background: 'var(--bg-warm)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: color || 'var(--ink)', marginTop: 2 }}>{valor}</div>
  </div>
);

// Componente para una fila de asistencia (busca la relación correctamente)
const RelAsistencia = ({ inscritoId, encuentro, taller }) => {
  const [busy, setBusy] = useState(false);
  // Buscar id de relación
  const [relacionId, setRelacionId] = useState(null);
  const [asistio, setAsistio] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('taller_inscripciones_encuentros')
        .select('id, asistio')
        .eq('inscrito_id', inscritoId)
        .eq('encuentro_id', encuentro.id)
        .single();
      if (cancelled) return;
      setRelacionId(data?.id);
      setAsistio(data?.asistio);
    })();
    return () => { cancelled = true; };
  }, [inscritoId, encuentro.id]);

  const marcar = async (v) => {
    if (!relacionId) return;
    setBusy(true);
    try {
      await taller.toggleAsistencia(relacionId, v);
      setAsistio(v);
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 10, marginBottom: 6,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>#{encuentro.numero} · {fechaCorta(encuentro.fecha)}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
          {encuentro.hora_inicio}–{encuentro.hora_fin}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => marcar(true)}
          disabled={busy}
          style={{
            padding: '6px 12px', fontSize: 12,
            background: asistio === true ? 'var(--oliva)' : 'var(--bg-warm)',
            color: asistio === true ? 'white' : 'var(--ink-soft)',
            border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer',
          }}
        >asistió</button>
        <button
          onClick={() => marcar(false)}
          disabled={busy}
          style={{
            padding: '6px 12px', fontSize: 12,
            background: asistio === false ? 'var(--terracota)' : 'var(--bg-warm)',
            color: asistio === false ? 'white' : 'var(--ink-soft)',
            border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer',
          }}
        >faltó</button>
      </div>
    </div>
  );
};

// ────────── Sheet detalle encuentro (lista inscritas) ──────────
const DetalleEncuentroSheet = ({ open, encuentro, taller, onClose, onAbrirInscrita }) => {
  const Icon = window.Icon;
  if (!open || !encuentro) return null;
  const inscritasEnEste = taller.inscritos.filter(i => i.encuentros.some(e => e.id === encuentro.id));

  return (
    <div className="sheet-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '20px 22px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Encuentro {encuentro.numero}
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: '2px 0 0', fontWeight: 600 }}>
              {fechaLarga(encuentro.fecha)}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {encuentro.hora_inicio}–{encuentro.hora_fin} · {encuentro.ubicacion}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>
            {Icon && <Icon name="close" size={18} />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Stat label="Cupos" valor={encuentro.cupos} />
          <Stat label="Inscritas" valor={encuentro.ocupados} color="var(--terracota)" />
          <Stat label="Libres" valor={encuentro.disponibles} color={encuentro.disponibles === 0 ? 'var(--terracota)' : 'var(--oliva)'} />
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Inscritas
        </div>
        {inscritasEnEste.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: 16, textAlign: 'center' }}>Nadie aún</div>
        )}
        {inscritasEnEste.map(i => (
          <button key={i.id} onClick={() => onAbrirInscrita(i)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: 10, marginBottom: 6, cursor: 'pointer',
            background: 'var(--bg-warm)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          }}>
            <div style={{ fontWeight: 600 }}>{i.nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
              {i.encuentros.length} encuentros · {money(i.pagado)}/{money(i.total)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ────────── Pantalla principal ──────────
const TallerScreen = ({ proyectoSlug = 'refinar-la-practica', onSwitch }) => {
  const Icon = window.Icon;
  const [proyectoId, setProyectoId] = useState(null);
  const [errProy, setErrProy] = useState(null);
  const [tab, setTab] = useState('encuentros');
  const [sheet, setSheet] = useState(null);   // 'agregar' | { type: 'encuentro', e } | { type: 'ficha', inscrita }
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Cargar id del proyecto por slug (single shot)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('proyectos').select('id, estado').eq('slug', proyectoSlug).single();
      if (error) { setErrProy(error.message); return; }
      if (data.estado !== 'activo') setErrProy('Proyecto no está activo');
      setProyectoId(data.id);
    })();
  }, [proyectoSlug]);

  const taller = useTaller(proyectoId);

  // Stats globales
  const stats = useMemo(() => {
    const totalInscritas = taller.inscritos.length;
    const cobrado = taller.inscritos.reduce((s, i) => s + i.pagado, 0);
    const porCobrar = taller.inscritos.reduce((s, i) => s + i.saldo, 0);
    const cuposVendidos = taller.inscritos.reduce((s, i) => s + i.encuentros.length, 0);
    const cuposTotales = taller.encuentros.reduce((s, e) => s + e.cupos, 0);
    return { totalInscritas, cobrado, porCobrar, cuposVendidos, cuposTotales };
  }, [taller.inscritos, taller.encuentros]);

  const linkPublico = `${window.location.origin}/taller/${proyectoSlug}`;
  const copiarLinkPublico = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (e) { alert(linkPublico); }
  };

  if (errProy) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--terracota)' }}>Error: {errProy}</p>
      <button onClick={onSwitch} className="btn btn-ghost">← Volver</button>
    </div>
  );

  if (taller.loading || !taller.proyecto) {
    return (
      <div className="app-scroll fade-in" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>
        Cargando taller...
      </div>
    );
  }

  return (
    <div className="app-scroll fade-in">
      <div style={{ padding: '32px 18px 80px' }}>
        {/* Header */}
        <button onClick={onSwitch} className="btn btn-ghost" style={{ fontSize: 13, padding: '4px 8px', marginBottom: 8 }}>
          ← Inicio
        </button>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Taller · {taller.proyecto.config.nivel}
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 32, lineHeight: 1.05, margin: '2px 0 6px',
          color: 'var(--ink)', fontWeight: 600,
        }}>
          {taller.proyecto.nombre}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px', maxWidth: 400 }}>
          6 sábados en {taller.proyecto.config.ubicacion}. Cada inscrita elige cuántos encuentros toma.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
          <Stat label="Inscritas" valor={stats.totalInscritas} />
          <Stat label="Cupos vend." valor={`${stats.cuposVendidos}/${stats.cuposTotales}`} />
          <Stat label="Cobrado" valor={money(stats.cobrado)} color="var(--oliva)" />
          <Stat label="Por cobrar" valor={money(stats.porCobrar)} color={stats.porCobrar > 0 ? 'var(--terracota)' : 'var(--ink-mute)'} />
        </div>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setSheet('agregar')} className="btn btn-primary" style={{ flex: 1 }}>
            {Icon && <Icon name="plus" size={14} />} Agregar inscrita
          </button>
          <button onClick={copiarLinkPublico} className="btn btn-ghost" style={{ flex: 1 }}>
            {Icon && <Icon name="link" size={14} />} {linkCopiado ? '✓ copiado' : 'Link público'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
          {[
            { id: 'encuentros', label: `Encuentros (${taller.encuentros.length})` },
            { id: 'inscritos', label: `Inscritas (${stats.totalInscritas})` },
            { id: 'pagos', label: 'Pagos' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px', background: 'transparent', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--terracota)' : '2px solid transparent',
                fontWeight: 600, color: tab === t.id ? 'var(--terracota)' : 'var(--ink-soft)',
                cursor: 'pointer', fontSize: 13,
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Contenido por tab */}
        {tab === 'encuentros' && (
          <div>
            {taller.encuentros.map(e => (
              <EncuentroCard key={e.id} encuentro={e} onClick={() => setSheet({ type: 'encuentro', e })} />
            ))}
          </div>
        )}

        {tab === 'inscritos' && (
          <div>
            {taller.inscritos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: 30, textAlign: 'center' }}>
                Aún no hay inscritas. Usa "Agregar inscrita" o comparte el link público.
              </div>
            )}
            {taller.inscritos.map(i => (
              <InscritaRow key={i.id} inscrita={i} onClick={() => setSheet({ type: 'ficha', inscrita: i })} />
            ))}
          </div>
        )}

        {tab === 'pagos' && (
          <PagosTab taller={taller} />
        )}
      </div>

      {/* Sheets */}
      <AgregarInscritaSheet open={sheet === 'agregar'} onClose={() => setSheet(null)} taller={taller} />
      <DetalleEncuentroSheet
        open={sheet?.type === 'encuentro'}
        encuentro={sheet?.e}
        taller={taller}
        onClose={() => setSheet(null)}
        onAbrirInscrita={(i) => setSheet({ type: 'ficha', inscrita: i })}
      />
      <FichaInscritaSheet
        open={sheet?.type === 'ficha'}
        inscrita={sheet?.inscrita ? taller.inscritos.find(x => x.id === sheet.inscrita.id) : null}
        taller={taller}
        onClose={() => setSheet(null)}
      />
    </div>
  );
};

const PagosTab = ({ taller }) => {
  const pendientes = taller.pagos.filter(p => !p.validado);
  const validados = taller.pagos.filter(p => p.validado);
  const inscritaPorId = (id) => taller.inscritos.find(i => i.id === id);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        Pendientes de validar ({pendientes.length})
      </div>
      {pendientes.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: 16, textAlign: 'center' }}>Ninguno</div>}
      {pendientes.map(p => {
        const i = inscritaPorId(p.inscrito_id);
        return (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 10, marginBottom: 6,
            background: 'var(--terracota-tint)', border: '1px solid var(--terracota)', borderRadius: 'var(--r-md)',
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{i?.nombre || '?'} — {`$${p.monto}`}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {p.forma_pago} · {new Date(p.fecha).toLocaleDateString('es-EC')}
              </div>
              {p.comprobante_url && (
                <a href={p.comprobante_url} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--terracota)' }}>ver comprobante</a>
              )}
            </div>
            <button onClick={() => taller.validarPago(p.id)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>
              Validar
            </button>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '18px 0 6px' }}>
        Validados ({validados.length})
      </div>
      {validados.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: 16, textAlign: 'center' }}>Aún ninguno</div>}
      {validados.slice(0, 20).map(p => {
        const i = inscritaPorId(p.inscrito_id);
        return (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 10, marginBottom: 6,
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{i?.nombre || '?'} — {`$${p.monto}`}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {p.forma_pago} · {new Date(p.fecha).toLocaleDateString('es-EC')} ✓
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

window.TallerScreen = TallerScreen;
export { TallerScreen };
