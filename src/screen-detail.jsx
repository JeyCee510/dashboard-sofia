import React from 'react';
import { ContactPanel, ComprobanteTokenAdminPanel } from './forms.jsx';
import { useEventosAlumna } from './hooks/useEventosAlumna.js';
import { useComprobantesAlumna } from './hooks/useComprobantesAlumna.js';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Ficha de alumna (overlay) — usa store; con editar / borrar / pagar
// ──────────────────────────────────────────

const FichaAlumna = ({ alumnaId, onClose, store, onEdit, onPagar, onIrAComprobantes, onValidarComprobante }) => {
  const a = store.state.alumnas.find(x => x.id === alumnaId);
  const { eventos, eliminarPago, eliminarEvento } = useEventosAlumna(alumnaId);
  const { items: comprobantes, obtenerUrl } = useComprobantesAlumna(alumnaId);
  if (!a) return null;
  const dias = store.state.ajustes.diasFormacion;
  const restante = a.total - a.pagado;

  // count días asistidos según el store
  const diasAsistidos = dias.filter(d => store.state.asistencia[d.idx]?.[a.id] === true);

  const wa = a.tel ? `https://wa.me/${a.tel.replace(/[^\d]/g, '')}` : '#';

  // ── Silla: estado global y elegibilidad de esta alumna ──
  const sillasMax = store.state.ajustes.bonoSillaCupos || 6;
  const sillasOtorgadas = store.state.alumnas.filter(x => x.bonoSilla).length;
  const sillasLibres = Math.max(0, sillasMax - sillasOtorgadas);
  const esCompleta = (a.tipo_inscripcion || 'completa') === 'completa';
  const esProntoPago = a.pago === 'pronto-pago';
  // Descuento al renunciar = $30 en todos los tipos. Pronto-pago: $0 (precio fijo).
  const descuentoRenunciar = esProntoPago ? 0 : 30;

  const borrar = () => {
    if (!confirm(`¿Borrar a ${a.nombre}? No se puede deshacer.`)) return;
    store.deleteAlumna(a.id);
    onClose();
  };

  const renunciar = () => {
    const msg = descuentoRenunciar > 0
      ? `¿Renunciar al bono silla de ${a.nombre}? Su total bajará $${descuentoRenunciar} (de $${a.total} a $${a.total - descuentoRenunciar}).`
      : `¿Renunciar al bono silla de ${a.nombre}? Como pagó pronto-pago, el total no cambia (sigue en $${a.total}).`;
    if (!confirm(msg)) return;
    store.renunciarSilla(a.id);
  };

  const asignar = () => {
    if (sillasLibres <= 0) {
      alert(`Las 6 sillas ya están asignadas. Tienes que renunciar una existente antes de asignar a ${a.nombre.split(' ')[0]}.`);
      return;
    }
    const nuevoTotal = esProntoPago ? a.total : a.total + 30;
    if (!confirm(`¿Asignar bono silla a ${a.nombre}? El total subirá a $${nuevoTotal}.`)) return;
    store.asignarSilla(a.id);
  };

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Inscritos
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onEdit} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer' }}>
          <Icon name="edit" size={18} stroke="var(--ink-soft)" />
        </button>
      </div>
      <div className="app-scroll" style={{ paddingTop: 0 }}>
        {/* Hero */}
        <div style={{ padding: '12px 22px 24px', textAlign: 'center' }}>
          <div className="avatar" style={{
            width: 88, height: 88, fontSize: 32, margin: '0 auto',
            background: a.avatar,
          }}>{a.iniciales}</div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, marginTop: 14, marginBottom: 4, lineHeight: 1.1 }}>
            {a.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {a.tel && <span>{a.tel}</span>}
            {a.tel && a.instagram && <span>·</span>}
            {a.instagram && <span>@{a.instagram.replace(/^@/, '')}</span>}
            {!a.tel && !a.instagram && <span>sin contacto</span>}
            {a.bonoSilla && <><span>·</span><span style={{ color: 'var(--gold)' }}>bono silla</span></>}
          </div>
          <div style={{ marginTop: 14 }}>
            <ContactPanel
              tel={a.tel}
              instagram={a.instagram}
              plantillas={store.state.ajustes.plantillasWA}
              nombre={a.nombre}
            />
          </div>
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <ComprobanteTokenAdminPanel
              alumnaId={a.id}
              nombre={a.nombre}
              tel={a.tel}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={onPagar}>
              <Icon name="cash" size={13} />
              Pagar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              <Icon name="edit" size={13} />
              Editar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ padding: '0 22px', display: 'flex', gap: 10 }}>
          <div className="card flat" style={{ flex: 1, padding: 14 }}>
            <div className="kpi-label">Pago</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 4, color: restante > 0 ? 'var(--rojo)' : 'var(--oliva)' }}>
              ${a.pagado}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/{a.total}</span>
            </div>
            {restante > 0 ? (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>Falta ${restante}</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--oliva)', marginTop: 4 }}>Pago completo ✓</div>
            )}
          </div>
          <div className="card flat" style={{ flex: 1, padding: 14 }}>
            <div className="kpi-label">Asistencia</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>{diasAsistidos.length}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/{dias.length}</span></div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {dias.map(d => {
                const v = store.state.asistencia[d.idx]?.[a.id] === true;
                return (
                  <div key={d.idx} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: v ? 'var(--oliva)' : 'var(--line-soft)',
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Bono silla */}
        <div className="section-title">
          <h2>Bono silla</h2>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>{sillasOtorgadas}/{sillasMax} asignadas</span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: 14 }}>
            {a.bonoSilla ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--gold)', fontWeight: 600,
                  }}>✓ Tiene silla</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.4 }}>
                  {esProntoPago
                    ? 'Pronto pago incluye silla sin costo adicional. Renunciar no baja el total ($484 fijo).'
                    : `Renunciar baja el total $${descuentoRenunciar} (a $${a.total - descuentoRenunciar}).`}
                </div>
                <button
                  onClick={renunciar}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--rojo)' }}
                >
                  Renunciar a silla
                </button>
              </div>
            ) : !esCompleta ? (
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                Solo aplica a inscripción completa. Cambia el tipo desde Editar si corresponde.
              </div>
            ) : sillasLibres > 0 ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.4 }}>
                  Quedan <strong>{sillasLibres}</strong> {sillasLibres === 1 ? 'cupo' : 'cupos'} de silla.
                  {a.pagado >= 200
                    ? ' Esta persona califica — debería habérsele asignado al pagar.'
                    : ' Se asignará automáticamente apenas registre reserva o más.'}
                </div>
                {a.pagado >= 200 && (
                  <button onClick={asignar} className="btn btn-ghost btn-sm">
                    Asignar silla manualmente
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--rojo)' }}>Sin cupo de silla.</strong> Las 6 sillas ya están asignadas. Para dársela a esta alumna, primero renuncia una desde otra ficha.
              </div>
            )}
          </div>
        </div>

        {/* Comprobantes de esta alumna */}
        <div className="section-title">
          <h2>Comprobantes</h2>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            {comprobantes.length} {comprobantes.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: 14 }}>
            {comprobantes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                Aún no ha subido comprobantes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {comprobantes.map(c => {
                  const estadoMap = {
                    pendiente: { bg: 'var(--terracota-tint)', fg: '#8A3D26', label: 'Pendiente' },
                    validado: { bg: '#DDE0CC', fg: '#4D5230', label: 'Validado ✓' },
                    rechazado: { bg: '#F0D5CE', fg: 'var(--rojo)', label: 'Rechazado' },
                  };
                  const ec = estadoMap[c.estado] || { bg: 'var(--bg-warm)', fg: 'var(--ink-mute)', label: c.estado };
                  const esPdf = (c.archivo_tipo || '').includes('pdf') ||
                                (c.archivo_nombre || '').toLowerCase().endsWith('.pdf');
                  return (
                    <div key={c.id} style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-warm)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--surface)', color: 'var(--ink-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}>{esPdf ? 'PDF' : 'IMG'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
                          {c.monto ? `$${c.monto}` : 'Sin monto'}
                          {c.fecha_pago ? ` · ${new Date(c.fecha_pago + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}` : ''}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                          Subido {new Date(c.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                          {c.notas ? ` · "${c.notas}"` : ''}
                        </div>
                      </div>
                      <span className="pill" style={{
                        background: ec.bg, color: ec.fg, border: 'none',
                        fontSize: 10, padding: '2px 8px',
                      }}>{ec.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={async () => {
                            const u = await obtenerUrl(c.storage_path);
                            if (u) window.open(u, '_blank');
                            else alert('No se pudo abrir el archivo.');
                          }}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--terracota)', padding: 4,
                            display: 'flex', alignItems: 'center',
                          }}
                          aria-label="Ver archivo"
                          title="Ver archivo"
                        >
                          <Icon name="search" size={14} />
                        </button>
                        {c.estado === 'pendiente' && onValidarComprobante && (
                          <button
                            onClick={() => onValidarComprobante({
                              id: c.id,
                              monto: Number(c.monto) || 0,
                              archivo_nombre: c.archivo_nombre,
                            })}
                            style={{
                              background: 'var(--oliva)', color: '#fff',
                              border: 'none', cursor: 'pointer',
                              borderRadius: 8, padding: '4px 8px',
                              fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                            }}
                            title="Validar este comprobante (registra el pago)"
                          >
                            Validar →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {onIrAComprobantes && comprobantes.some(c => c.estado === 'pendiente') && (
              <button
                onClick={onIrAComprobantes}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, width: '100%' }}
              >
                Ir a panel de validación →
              </button>
            )}
          </div>
        </div>

        {/* Asistencia detalle (toca para marcar/desmarcar) */}
        <div className="section-title">
          <h2>Asistencia</h2>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>toca un día</span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {dias.map(d => {
                const status = store.state.asistencia[d.idx]?.[a.id];
                const present = status === true;
                const absent = status === false;
                return (
                  <button
                    key={d.idx}
                    onClick={() => store.toggleAsistencia(d.idx, a.id)}
                    style={{
                      flex: 1,
                      aspectRatio: '1 / 1.05',
                      border: 'none', borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: present ? 'var(--ink)' : absent ? 'var(--terracota-tint)' : 'var(--bg-warm)',
                      color: present ? 'var(--bg)' : absent ? '#8A3D26' : 'var(--ink-mute)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '6px 2px', gap: 1,
                    }}
                  >
                    <span className="serif" style={{ fontSize: 14, lineHeight: 1, fontWeight: 500 }}>{d.fecha.split(' ')[0]}</span>
                    <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: '0.06em' }}>{d.fecha.split(' ')[1]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="section-title">
          <h2>Notas</h2>
          <span className="link" style={{ cursor: 'pointer' }} onClick={onEdit}>editar</span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: 16, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, fontStyle: a.notas ? 'normal' : 'italic' }}>
            {a.notas || 'Sin notas. Toca editar para escribir cómo la viste hoy.'}
          </div>
        </div>

        {/* Línea de tiempo */}
        <div className="section-title">
          <h2>Línea de tiempo</h2>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>{eventos.length} {eventos.length === 1 ? 'movimiento' : 'movimientos'}</span>
        </div>
        <div style={{ padding: '0 22px 18px' }}>
          <div className="card flat" style={{ padding: '4px 16px' }}>
            {eventos.length === 0 ? (
              <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                Sin movimientos registrados aún.
              </div>
            ) : (
              eventos.map((ev, i) => (
                <TimelineRow
                  key={ev.id}
                  icon={iconForEvent(ev.tipo)}
                  date={fmtFecha(ev.created_at)}
                  title={ev.titulo}
                  subtitle={ev.subtitulo}
                  last={i === eventos.length - 1}
                  onDelete={() => {
                    const labelTipo = ev.source === 'pago' ? 'pago' : 'evento';
                    const msg = ev.source === 'pago'
                      ? `¿Eliminar este pago de $${ev.monto}?\n\nEsto va a:\n  • Borrar el pago del audit\n  • Restar $${ev.monto} al pagado de ${a.nombre}\n\nEsta acción no se puede deshacer.`
                      : `¿Eliminar el evento "${ev.titulo}"?\n\nNo se reverten cambios automáticos (silla, total, etc.). Solo borra el registro del historial.\n\nEsta acción no se puede deshacer.`;
                    if (!confirm(msg)) return;
                    if (ev.source === 'pago') eliminarPago(ev.rawId);
                    else eliminarEvento(ev.rawId);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Borrar (zona peligrosa) */}
        <div style={{ padding: '0 22px 40px' }}>
          <button onClick={borrar} style={{
            width: '100%', padding: '12px 14px',
            background: 'transparent',
            border: '1px solid #E5C8C0',
            borderRadius: 12,
            color: 'var(--rojo)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Borrar estudiante</button>
        </div>
      </div>
    </div>
  );
};

const TimelineRow = ({ icon, date, title, subtitle, last, onDelete }) => (
  <div style={{
    display: 'flex', gap: 12, padding: '12px 0',
    borderBottom: last ? 'none' : '1px solid var(--line-soft)',
    alignItems: 'flex-start',
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      background: 'var(--bg-warm)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-soft)', flexShrink: 0, marginTop: 2,
    }}>
      <Icon name={icon} size={14} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{subtitle}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{date}</div>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Eliminar movimiento"
          title="Eliminar movimiento"
          style={{
            background: 'transparent', border: 'none', padding: 4,
            cursor: 'pointer', color: 'var(--ink-mute)',
            opacity: 0.5, fontSize: 14, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--rojo)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--ink-mute)'; }}
        >×</button>
      )}
    </div>
  </div>
);

// Mapeo tipo → ícono para la timeline
function iconForEvent(tipo) {
  if (tipo === 'pago') return 'cash';
  if (tipo === 'silla_asignada_auto' || tipo === 'silla_asignada_manual') return 'check';
  if (tipo === 'silla_renunciada') return 'x';
  if (tipo === 'inscrita' || tipo === 'inscrita_desde_lead') return 'user';
  if (tipo === 'tipo_cambiado') return 'edit';
  return 'arrow';
}

// "29 abr · 14:32" estilo es-EC
function fmtFecha(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
    const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fecha} · ${hora}`;
  } catch { return '—'; }
}

window.FichaAlumna = FichaAlumna;
