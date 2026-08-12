import React from 'react';
import { supabase } from './lib/supabase.js';
import { calcularTotal, TIPOS_INSCRIPCION, ENCUENTROS, esTaller, encuentrosDeAjustes, precioTaller, tienePreciosPorEncuentro, precioPorEncuentros, precioSedeSegunCantidad } from './lib/precios.js';
import { destinatariosAviso, mensajeTraspasoLead, abrirAvisoWhatsApp, etiquetasInteres } from './lib/avisos.js';
import { registrarActividad, actorActividad } from './lib/actividad.js';
import { ContactPanel, PreinscripcionAdminPanel, ComprobanteTokenAdminPanel, InstaInput, TelInput, ClaseAbiertaPanel } from './forms.jsx';
import { MaterialPanel } from './material.jsx';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// Perf · monta children DESPUÉS del primer paint del padre. Sirve para
// paneles pesados (que hacen queries a Supabase al montarse) dentro de un
// Sheet, así el Sheet aparece instantáneo y los paneles cargan justo después.
const DeferMount = ({ children, ms = 60 }) => {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, []);
  return ready ? children : null;
};

// ──────────────────────────────────────────
// Form sheets: alumna · lead · pago + Ajustes screen
// ──────────────────────────────────────────

const AlumnaForm = ({ open, onClose, store, alumnaId }) => {
  const editing = alumnaId && store.state.alumnas.find(a => a.id === alumnaId);
  // Modo taller drop-in: precio por nº de encuentros (tiers), sin completa/2/1 ni silla.
  const taller = esTaller(store.state.ajustes);
  const encuentrosProy = encuentrosDeAjustes(store.state.ajustes);
  const totalEncuentros = encuentrosProy.length;
  const defaultForm = () => taller ? ({
    nombre: '', tel: '', instagram: '', notas: '', bonoSilla: false, pago: 'pendiente',
    pagado: 0,
    tipo_inscripcion: 'taller',
    encuentros_asistir: encuentrosProy.map(e => e.num),
    total: precioTaller(totalEncuentros, store.state.ajustes),
    totalManual: false,
  }) : ({
    nombre: '', tel: '', instagram: '', notas: '', bonoSilla: false, pago: 'pendiente',
    pagado: 0,
    tipo_inscripcion: 'completa',
    encuentros_asistir: [1, 2, 3],
    total: calcularTotal({ tipo: 'completa', bonoSilla: false, ajustes: store.state.ajustes }),
    totalManual: false,
  });
  const [form, setForm] = React.useState(defaultForm);

  React.useEffect(() => {
    if (editing) setForm({ ...editing, totalManual: true });
    else setForm(defaultForm());
  }, [alumnaId, open]);

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    // Auto-recalcular total cuando cambia tipo o silla, salvo que el usuario lo haya editado manualmente
    if ((k === 'tipo_inscripcion' || k === 'bonoSilla') && !next.totalManual) {
      next.total = calcularTotal({ tipo: next.tipo_inscripcion, bonoSilla: next.bonoSilla, ajustes: store.state.ajustes });
    }
    // Si cambia a completa, resetear encuentros a [1,2,3]
    if (k === 'tipo_inscripcion') {
      if (v === 'completa') next.encuentros_asistir = [1, 2, 3];
      else if (v === 'dos_encuentros' && (next.encuentros_asistir || []).length !== 2) next.encuentros_asistir = [1, 2];
      else if (v === 'un_encuentro' && (next.encuentros_asistir || []).length !== 1) next.encuentros_asistir = [1];
    }
    return next;
  });

  const setTotalManual = (v) => setForm(f => ({ ...f, total: v, totalManual: true }));

  const toggleEncuentro = (num) => setForm(f => {
    const cur = f.encuentros_asistir || [];
    let next;
    if (cur.includes(num)) next = cur.filter(x => x !== num);
    else next = [...cur, num].sort((a, b) => a - b);
    // Taller: precio por nº de encuentros elegidos (tiers)
    if (taller) {
      const upd = { ...f, encuentros_asistir: next, tipo_inscripcion: 'taller' };
      if (!f.totalManual) {
        upd.total = tienePreciosPorEncuentro(store.state.ajustes)
          ? precioPorEncuentros(next, store.state.ajustes, { prontoPago: !!f.prontoPago })
          : precioTaller(next.length, store.state.ajustes);
      }
      return upd;
    }
    // Formación: mantener consistencia con el tipo
    let tipo = f.tipo_inscripcion;
    if (next.length === 3) tipo = 'completa';
    else if (next.length === 2) tipo = 'dos_encuentros';
    else if (next.length === 1) tipo = 'un_encuentro';
    const upd = { ...f, encuentros_asistir: next, tipo_inscripcion: tipo };
    if (!f.totalManual) upd.total = calcularTotal({ tipo, bonoSilla: f.bonoSilla, ajustes: store.state.ajustes });
    return upd;
  });

  // Motivo del precio especial — obligatorio cuando el total fue editado
  // manualmente Y difiere del calculado automáticamente.
  const [precioMotivo, setPrecioMotivo] = React.useState('');
  React.useEffect(() => { setPrecioMotivo(''); }, [alumnaId, open]);
  const totalCalculado = taller
    ? (tienePreciosPorEncuentro(store.state.ajustes)
        ? precioPorEncuentros(form.encuentros_asistir || [], store.state.ajustes, { prontoPago: !!form.prontoPago })
        : precioTaller((form.encuentros_asistir || []).length, store.state.ajustes))
    : calcularTotal({ tipo: form.tipo_inscripcion, bonoSilla: form.bonoSilla, ajustes: store.state.ajustes });
  const esPrecioEspecial = form.totalManual && Number(form.total) !== Number(totalCalculado);

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    // Si es precio especial, exigir motivo
    if (esPrecioEspecial && !precioMotivo.trim()) {
      alert('Falta el motivo del precio especial.');
      return;
    }
    const totalAnterior = editing ? Number(editing.total) || 0 : Number(totalCalculado);
    if (editing) {
      await store.updateAlumna(alumnaId, form);
      // Registrar evento de ajuste si cambió el total
      if (esPrecioEspecial && Number(form.total) !== totalAnterior) {
        await store.ajustarPrecioAlumna(alumnaId, Number(form.total), precioMotivo, totalAnterior);
      }
    } else {
      const nuevaId = await store.addAlumna(form);
      // Para una nueva con precio especial, registrar el evento contra el precio calculado
      if (nuevaId && esPrecioEspecial) {
        await store.ajustarPrecioAlumna(nuevaId, Number(form.total), precioMotivo, totalCalculado);
      }
    }
    onClose();
  };

  const borrar = () => {
    if (!editing) return;
    if (!confirm(`¿Borrar a ${form.nombre}? No se puede deshacer.`)) return;
    store.deleteAlumna(alumnaId);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar estudiante' : 'Nuevo estudiante'}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {editing && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rojo)', borderColor: '#E5C8C0' }} onClick={borrar}>
              Borrar
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={!form.nombre.trim()}>
            {editing ? 'Guardar cambios' : 'Crear estudiante'}
          </button>
        </div>
      }
    >
      <Field label="Nombre completo">
        <TextInput value={form.nombre} onChange={v => set('nombre', v)} placeholder="Ej. María Fernanda Castro" />
      </Field>
      <Field label="Teléfono / WhatsApp">
        <TelInput value={form.tel} onChange={v => set('tel', v)} />
      </Field>
      <Field label="Instagram (opcional)">
        <InstaInput value={form.instagram} onChange={v => set('instagram', v)} />
      </Field>
      {taller ? (
        <>
        {tienePreciosPorEncuentro(store.state.ajustes) && (
          <SwitchToggle
            label="Precio pronto pago"
            hint={store.state.ajustes.prontoPagoNota || 'Aplica el precio de pronto pago a los encuentros elegidos'}
            value={!!form.prontoPago}
            onChange={v => setForm(f => {
              const upd = { ...f, prontoPago: v };
              if (!f.totalManual) upd.total = precioPorEncuentros(f.encuentros_asistir || [], store.state.ajustes, { prontoPago: v });
              return upd;
            })}
          />
        )}
        <Field label="¿Cuáles encuentros?" hint={`Puede venir a uno, a varios o a todos (${(form.encuentros_asistir || []).length} seleccionados)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {encuentrosProy.map(e => {
              const sel = (form.encuentros_asistir || []).includes(e.num);
              // Precio de esta sede según cuántas lleva elegidas (matriz) o precio fijo
              const nSel = (form.encuentros_asistir || []).length || 1;
              const precioSedeNum = store.state.ajustes.matrizPrecios
                ? precioSedeSegunCantidad(e.num, sel ? nSel : Math.min(nSel + 1, 3), store.state.ajustes, { prontoPago: !!form.prontoPago })
                : ((store.state.ajustes.preciosPorEncuentro || []).find(p => p.n === e.num)
                    ? (form.prontoPago
                        ? store.state.ajustes.preciosPorEncuentro.find(p => p.n === e.num).prontoPago
                        : store.state.ajustes.preciosPorEncuentro.find(p => p.n === e.num).regular)
                    : null);
              return (
                <button
                  key={e.num} type="button" onClick={() => toggleEncuentro(e.num)}
                  style={{
                    padding: '10px 14px', borderRadius: 12,
                    background: sel ? 'var(--ink)' : 'var(--surface)',
                    color: sel ? 'var(--bg)' : 'var(--ink-soft)',
                    border: '1px solid ' + (sel ? 'transparent' : 'var(--line-soft)'),
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{e.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                    {e.fechas}
                    {precioSedeNum ? ` · $${precioSedeNum}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        </>
      ) : (
        <>
          <Field label="Tipo de inscripción">
            <SelectChips
              value={form.tipo_inscripcion}
              onChange={v => set('tipo_inscripcion', v)}
              options={TIPOS_INSCRIPCION}
            />
          </Field>

          {form.tipo_inscripcion !== 'completa' && (
            <Field label={form.tipo_inscripcion === 'dos_encuentros' ? '¿Cuáles 2 encuentros asistirá?' : '¿Cuál encuentro asistirá?'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ENCUENTROS.map(e => {
                  const sel = (form.encuentros_asistir || []).includes(e.num);
                  return (
                    <button
                      key={e.num} type="button" onClick={() => toggleEncuentro(e.num)}
                      style={{
                        padding: '10px 14px', borderRadius: 12,
                        background: sel ? 'var(--ink)' : 'var(--surface)',
                        color: sel ? 'var(--bg)' : 'var(--ink-soft)',
                        border: '1px solid ' + (sel ? 'transparent' : 'var(--line-soft)'),
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <span>{e.label}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{e.fechas}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <SwitchToggle
            label="Bono silla"
            hint={form.tipo_inscripcion === 'completa'
              ? 'Recibe silla de yoga profesional (primeros 6 inscritos a completa)'
              : 'Incluye silla (cuesta extra para inscripción parcial)'}
            value={form.bonoSilla}
            onChange={v => set('bonoSilla', v)}
          />
        </>
      )}

      <Field label="Estado de pago">
        <SelectChips
          value={form.pago}
          onChange={v => set('pago', v)}
          options={[
            { value: 'pendiente', label: 'Solo reserva' },
            { value: 'parcial', label: 'Pago parcial' },
            { value: 'pronto-pago', label: 'Pronto pago' },
            { value: 'completo', label: 'Pagado completo' },
          ]}
        />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Pagado ($)"><NumberInput value={form.pagado} onChange={v => set('pagado', v)} prefix="$" min={0} /></Field>
        <Field label="Total ($)"><NumberInput value={form.total} onChange={setTotalManual} prefix="$" min={0} /></Field>
      </div>
      {!form.totalManual && (
        <div style={{ marginTop: -8, marginBottom: 8, fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
          Total calculado automáticamente. Edítalo si necesitas un precio especial.
        </div>
      )}
      {esPrecioEspecial && (
        <div className="card flat" style={{
          padding: 10, marginBottom: 14,
          background: 'var(--terracota-tint)', border: '1px solid var(--terracota)',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A3D26', fontWeight: 700, marginBottom: 6 }}>
            Precio especial · diferencia ${Number(form.total) - totalCalculado >= 0 ? '+' : ''}{Number(form.total) - totalCalculado}
          </div>
          <textarea
            value={precioMotivo}
            onChange={(e) => setPrecioMotivo(e.target.value)}
            placeholder="Motivo (beca, intercambio, amistad, promo…)"
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--line-soft)',
              fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)',
              resize: 'vertical', outline: 'none',
            }}
          />
          {!precioMotivo.trim() && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--rojo)' }}>
              Motivo obligatorio.
            </div>
          )}
        </div>
      )}
      <Field label="Notas">
        <TextArea value={form.notas} onChange={v => set('notas', v)} placeholder="Cómo la viste, recordatorios, etc." rows={3} />
      </Field>
    </Sheet>
  );
};

// ──────────────────────────────────────────────────────────────
// ResponsablesLead — quién trajo el lead y quién lo tiene hoy.
//
// Sofía hace el primer contacto y crea el lead; Micaela retoma pagos y
// logística. Antes el traspaso era sólo un WhatsApp: no quedaba en ningún
// lado quién estaba a cargo. Ahora el botón hace las tres cosas a la vez:
// abre el WhatsApp con el resumen, deja el lead asignado y le manda un push
// a quien lo recibe.
// ──────────────────────────────────────────────────────────────
const ResponsablesLead = ({ form, leadId, store }) => {
  const [pasando, setPasando] = React.useState(null);
  const equipo = destinatariosAviso(store.state.ajustes);
  const yo = actorActividad();
  const aCargo = form.asignadoANombre || form.asignadoAEmail;
  const creador = form.creadoPorNombre || form.creadoPorEmail;

  const pasarA = (p) => {
    // window.open SÍNCRONO antes de cualquier await: iOS/PWA lo bloquea si
    // se dispara después de una promesa.
    const ok = abrirAvisoWhatsApp(
      p,
      mensajeTraspasoLead({ ...form, id: leadId }, store.state.ajustes)
    );
    if (!ok) { alert(`${p.nombre} no tiene WhatsApp configurado.`); return; }
    setPasando(p.nombre);
    Promise.resolve(store.asignarLead(leadId, p)).finally(() => setPasando(null));
  };

  const tomarloYo = () => {
    if (!yo.email && !yo.nombre) return;
    store.asignarLead(leadId, { nombre: yo.nombre || yo.email, email: yo.email });
  };

  const soyLaResponsable = !!yo.email && form.asignadoAEmail === yo.email;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--ink-mute)', marginBottom: 8,
      }}>
        Responsables
      </div>

      <div className="card flat" style={{
        padding: 12, marginBottom: 8,
        background: 'var(--bg-warm)', borderColor: 'transparent',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
          <span style={{ color: 'var(--ink-mute)' }}>Creó el lead</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'right' }}>
            {creador || 'Sin registro'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
          <span style={{ color: 'var(--ink-mute)' }}>A cargo</span>
          <span style={{ textAlign: 'right' }}>
            <span style={{
              color: aCargo ? 'var(--ink)' : 'var(--ink-mute)',
              fontWeight: aCargo ? 600 : 400,
            }}>
              {aCargo || 'Nadie todavía'}
            </span>
            {form.asignadoAt && (
              <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-mute)' }}>
                desde el {new Date(form.asignadoAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {equipo.map(p => (
          <button
            key={p.tel}
            type="button"
            onClick={() => pasarA(p)}
            disabled={!!pasando}
            style={{
              padding: '9px 14px', borderRadius: 999,
              background: 'var(--whatsapp)', border: 'none',
              color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              cursor: pasando ? 'default' : 'pointer', opacity: pasando ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="whatsapp" size={13} stroke="#fff" />
            {pasando === p.nombre ? 'Pasando…' : `Pasar a ${p.nombre}`}
          </button>
        ))}
        {(yo.email || yo.nombre) && !soyLaResponsable && (
          <button
            type="button"
            onClick={tomarloYo}
            style={{
              padding: '9px 14px', borderRadius: 999,
              background: 'transparent', border: '1px solid var(--line-soft)',
              color: 'var(--ink-soft)', fontFamily: 'inherit', fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Me lo quedo yo
          </button>
        )}
      </div>
      {equipo.length === 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.4 }}>
          Para pasar leads al equipo, agrega a las personas en la configuración
          del proyecto (avisos → equipo).
        </div>
      )}
    </div>
  );
};

const LEAD_VACIO = {
  nombre: '', tel: '', instagram: '', mensaje: '', fuente: 'instagram', estado: 'nuevo',
  interesSedes: [],
};

const LeadForm = ({ open, onClose, store, leadId, onConvertir }) => {
  const editing = leadId && store.state.leads.find(l => l.id === leadId);
  const [form, setForm] = React.useState(() => editing || LEAD_VACIO);

  React.useEffect(() => {
    if (editing) setForm({ ...editing, interesSedes: editing.interesSedes || [] });
    else setForm(LEAD_VACIO);
  }, [leadId, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Sedes del proyecto (Seminario: 3 encuentros independientes). Si el
  // proyecto no las define (formación, estudio), el bloque no se muestra.
  const sedesProy = store.state.ajustes?.sedes || [];
  const toggleInteres = (n) => {
    const actual = form.interesSedes || [];
    const next = actual.includes(n)
      ? actual.filter(x => x !== n)
      : [...actual, n].sort((a, b) => a - b);
    set('interesSedes', next);
  };

  const guardar = () => {
    if (!form.nombre.trim()) return;
    if (editing) store.updateLead(leadId, form);
    else store.addLead(form);
    onClose();
  };

  const borrar = () => {
    if (!editing) return;
    if (!confirm(`¿Borrar lead ${form.nombre}?`)) return;
    store.deleteLead(leadId);
    onClose();
  };

  const convertir = () => {
    if (!editing) return;
    // Cierra este sheet y delega al padre, que abre PagoForm con leadPreId.
    // El PagoForm es donde Sofía elige tipo de pago (incluso "sin pago aún").
    onClose();
    if (onConvertir) onConvertir(leadId);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar lead' : 'Nuevo lead'}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {editing && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rojo)', borderColor: '#E5C8C0' }} onClick={borrar}>
              Borrar
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={!form.nombre.trim()}>
            {editing ? 'Guardar' : 'Crear lead'}
          </button>
        </div>
      }
    >
      {editing && (
        <>
          {form.createdAt && (
            <div style={{
              marginBottom: 14, fontSize: 11, color: 'var(--ink-mute)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                Registrado
              </span>
              <span>
                {new Date(form.createdAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}
                {new Date(form.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          )}
          <DeferMount>
            <div style={{ marginBottom: 14 }}>
              <ContactPanel
                tel={form.tel}
                instagram={form.instagram}
                plantillas={store.state.ajustes.plantillasWA}
                nombre={form.nombre}
                fechaProntoPago={store.state.ajustes.fechaProntoPago}
                leadId={leadId}
              />
            </div>
            {/* Brochure, flyers y posts del proyecto — se envían por WhatsApp
                o por la hoja de compartir del teléfono. */}
            <div style={{ marginBottom: 14 }}>
              <MaterialPanel
                ajustes={store.state.ajustes}
                nombre={form.nombre}
                tel={form.tel}
                leadId={leadId}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <PreinscripcionAdminPanel
                leadId={leadId}
                leadNombre={form.nombre}
                leadTel={form.tel}
                plantillas={store.state.ajustes.plantillasWA}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <ClaseAbiertaPanel
                leadId={leadId}
                leadNombre={form.nombre}
                leadTel={form.tel}
                fechaProntoPago={store.state.ajustes.fechaProntoPago}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <ComprobanteTokenAdminPanel
                leadId={leadId}
                nombre={form.nombre}
                tel={form.tel}
              />
            </div>
            {/* Responsables: quién trajo el lead y quién lo tiene hoy.
                El traspaso (Sofía → Micaela) abre WhatsApp con el resumen y
                además deja asignado el lead + avisa por push a quien lo recibe. */}
            {leadId && <ResponsablesLead form={form} leadId={leadId} store={store} />}

            {/* Historial del lead: qué pasó y quién lo hizo (bitácora) */}
            {leadId && window.ActividadDeFicha && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--ink-mute)', marginBottom: 8,
                }}>
                  Historial
                </div>
                <window.ActividadDeFicha
                  proyectoId={store.state.proyectoId}
                  entidad="lead"
                  entidadId={leadId}
                />
              </div>
            )}
          </DeferMount>
          <button className="btn btn-secondary btn-block" style={{ marginBottom: 14 }} onClick={convertir}>
            <Icon name="arrow" size={14} /> Convertir en estudiante
          </button>
          {form.estado !== 'no_interesado' && (
            <button
              type="button"
              onClick={() => {
                if (!confirm(`¿Marcar a ${form.nombre} como NO interesado?\n\nSale del embudo activo pero queda guardado en "Descartados" (puedes restaurarlo después).`)) return;
                store.updateLead(leadId, { estado: 'no_interesado' });
                onClose();
              }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12,
                background: 'transparent', border: '1px solid var(--line-soft)',
                color: 'var(--ink-soft)', fontFamily: 'inherit', fontSize: 12,
                cursor: 'pointer', marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon name="x" size={13} stroke="var(--ink-mute)" />
              Marcar como no interesado
            </button>
          )}
          {form.estado === 'no_interesado' && (
            <button
              type="button"
              onClick={() => {
                store.updateLead(leadId, { estado: 'nuevo' });
                onClose();
              }}
              className="btn btn-ghost btn-block"
              style={{ marginBottom: 14, color: 'var(--oliva)' }}
            >
              ↺ Restaurar al embudo (estado: nuevo)
            </button>
          )}
        </>
      )}
      <Field label="Nombre">
        <TextInput value={form.nombre} onChange={v => set('nombre', v)} placeholder="Ej. Mónica Salinas" />
      </Field>
      <Field label="Teléfono / WhatsApp">
        <TelInput value={form.tel} onChange={v => set('tel', v)} />
      </Field>
      <Field label="Instagram (opcional)">
        <InstaInput value={form.instagram} onChange={v => set('instagram', v)} />
      </Field>
      <Field label="¿Cómo llegó?">
        <SelectChips
          value={form.fuente}
          onChange={v => set('fuente', v)}
          options={[
            { value: 'instagram', label: 'Instagram' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'referido', label: 'Referido/a' },
          ]}
        />
      </Field>
      <Field label="Estado">
        <SelectChips
          value={form.estado}
          onChange={v => set('estado', v)}
          options={[
            { value: 'nuevo', label: 'Nuevo' },
            { value: 'interesado', label: 'Interesado' },
            { value: 'reservado', label: 'Reservado' },
            { value: 'frío', label: 'Frío' },
          ]}
        />
      </Field>
      {sedesProy.length > 0 && (
        <Field
          label="¿A qué encuentro(s) quiere venir?"
          hint="Puedes marcar varios o ninguno si todavía no lo define."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sedesProy.map(s => {
              const checked = (form.interesSedes || []).includes(s.n);
              return (
                <button key={s.n} type="button" onClick={() => toggleInteres(s.n)} style={{
                  background: checked ? 'var(--terracota-tint)' : 'var(--surface)',
                  border: `1px solid ${checked ? 'var(--terracota)' : 'var(--line-soft)'}`,
                  borderRadius: 10, padding: '10px 13px', fontFamily: 'inherit',
                  fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: checked ? 600 : 400 }}>{s.nombre || `Sede ${s.n}`}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)' }}>
                      {[s.fechas, s.lugar].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {checked && <span style={{ color: 'var(--terracota)', fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </Field>
      )}
      <Field label="Mensaje / contexto">
        <TextArea value={form.mensaje} onChange={v => set('mensaje', v)} placeholder="¿Qué te dijo? ¿Qué necesita?" rows={3} />
      </Field>
    </Sheet>
  );
};

const PagoForm = ({ open, onClose, store, alumnaPreId, leadPreId, comprobantePreData = null }) => {
  // selection puede ser:
  //   "alumna:<id>" → estudiante existente
  //   "lead:<id>"   → lead que se convertirá a estudiante al registrar pago
  // comprobantePreData: si se pasa, viene de "Validar →" en la ficha. Tiene
  //   { id, monto, archivo_nombre } y se usa para asociar/validar un
  //   comprobante existente en lugar de subir uno nuevo.
  const initialSel = () => {
    if (alumnaPreId) return `alumna:${alumnaPreId}`;
    if (leadPreId) return `lead:${leadPreId}`;
    return '';
  };
  const [selection, setSelection] = React.useState(initialSel);
  const [monto, setMonto] = React.useState(0);
  const [tipo, setTipo] = React.useState('parcial');
  const [forma, setForma] = React.useState('transferencia'); // método: transferencia/efectivo/payphone/canje
  // Destino del dinero (Seminario Angelo): el abono de reserva de los retiros
  // se paga DIRECTO al aliado (Izhcayluma / Wisdom Forest); el saldo va a Sofía.
  const [destino, setDestino] = React.useState('sofia');
  const reglaPagos = store.state.ajustes?.reglaPagos || null;
  const destinosCfg = reglaPagos?.destinos || null;
  // Proyecto tipo taller/seminario: se eligen encuentros/sedes y el precio sale
  // de la matriz del proyecto. No hay "pronto pago único" ni bono silla.
  const esTallerProy = esTaller(store.state.ajustes);
  const encuentrosProyPago = encuentrosDeAjustes(store.state.ajustes);
  const sedesPago = store.state.ajustes?.sedes || [];
  const [convirtiendo, setConvirtiendo] = React.useState(false);
  // Archivo opcional para subir al validar
  const [archivo, setArchivo] = React.useState(null);
  const [errorArchivo, setErrorArchivo] = React.useState('');
  const fileInputRef = React.useRef(null);
  // Producto cuando es lead — define el total y la inscripción.
  // esProntoPago=true ⇒ tipo='completa', encuentros=[1,2,3], silla incluida, total=484.
  const [esProntoPago, setEsProntoPago] = React.useState(false);
  const [prodTipo, setProdTipo] = React.useState('completa');
  const [prodEncuentros, setProdEncuentros] = React.useState([1, 2, 3]);
  const [prodSilla, setProdSilla] = React.useState(true);
  // "Solo validar" — caso comprobante ya registrado manualmente por Sofía.
  // Solo asocia el archivo a la alumna y lo marca validado, sin sumar.
  const [soloValidar, setSoloValidar] = React.useState(false);
  // Precio especial — override del productoTotal cuando Sofía acuerda un
  // precio puntual (beca, intercambio, amistad). Requiere motivo.
  const [precioEspecial, setPrecioEspecial] = React.useState(false);
  const [precioEspecialMonto, setPrecioEspecialMonto] = React.useState(0);
  const [precioEspecialMotivo, setPrecioEspecialMotivo] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setSelection(initialSel());
      // Si viene un comprobante pre-validar, prepoblar monto
      setMonto(comprobantePreData?.monto || 0);
      setTipo('parcial');
      setForma('transferencia');
      setDestino('sofia');
      setConvirtiendo(false);
      setArchivo(null);
      setErrorArchivo('');
      // Reset del producto (lead path). En taller/seminario se arranca con el
      // primer encuentro y en etapa pronto pago (lo más común al inscribir).
      const esT = esTaller(store.state.ajustes);
      setEsProntoPago(esT ? true : false);
      setProdTipo(esT ? 'taller' : 'completa');
      setProdEncuentros(esT ? [1] : [1, 2, 3]);
      setProdSilla(esT ? false : true);
      setSoloValidar(false);
      setPrecioEspecial(false);
      setPrecioEspecialMonto(0);
      setPrecioEspecialMotivo('');
    }
  }, [open, alumnaPreId, leadPreId, comprobantePreData]);

  const [tipoSel, idSel] = selection.split(':');
  const idNum = idSel ? Number(idSel) : null;
  const alumna = tipoSel === 'alumna' ? store.state.alumnas.find(a => a.id === idNum) : null;
  const lead = tipoSel === 'lead' ? store.state.leads.find(l => l.id === idNum) : null;
  const restante = alumna ? Math.max(0, alumna.total - alumna.pagado) : 0;
  const esLead = !!lead;

  const precioReserva = store.state.ajustes.precioReserva || 200;
  const precioProntoPago = store.state.ajustes.precioProntoPago || 484;
  const precioRegular = store.state.ajustes.precioRegular || 640;

  // Total del producto (lead path).
  // Taller/Seminario: suma de los encuentros elegidos según la matriz del
  // proyecto (el precio por sede cambia según cuántas tome) + etapa del precio.
  // Formación: depende de tipo + silla; pronto pago es fijo.
  const productoTotalBase = esTallerProy
    ? precioPorEncuentros(prodEncuentros, store.state.ajustes, { prontoPago: esProntoPago })
    : (esProntoPago
        ? precioProntoPago
        : calcularTotal({ tipo: prodTipo, bonoSilla: prodSilla, ajustes: store.state.ajustes }));
  // Si precioEspecial está activo, usamos el monto custom como total real
  const productoTotal = precioEspecial ? (Number(precioEspecialMonto) || 0) : productoTotalBase;

  // Helper: cambia el producto y normaliza encuentros_asistir.
  const setProducto = (nextTipo, isProntoPago = false) => {
    // Taller/Seminario: el "producto" son los encuentros elegidos; este helper
    // sólo cambia la etapa del precio (pronto pago vs regular).
    if (esTallerProy) { setEsProntoPago(!!isProntoPago); return; }
    if (isProntoPago) {
      setEsProntoPago(true);
      setProdTipo('completa');
      setProdEncuentros([1, 2, 3]);
      setProdSilla(true);
      return;
    }
    setEsProntoPago(false);
    setProdTipo(nextTipo);
    if (nextTipo === 'completa') setProdEncuentros([1, 2, 3]);
    else if (nextTipo === 'dos_encuentros') setProdEncuentros([1, 2]);
    else if (nextTipo === 'un_encuentro') setProdEncuentros([1]);
  };

  const toggleEncuentro = (num) => {
    // Taller/Seminario: selección libre (uno, varios o todos). El precio se
    // recalcula solo según cuántos queden elegidos.
    if (esTallerProy) {
      const checked = prodEncuentros.includes(num);
      const next = checked
        ? prodEncuentros.filter(x => x !== num)
        : [...prodEncuentros, num].sort((a, b) => a - b);
      setProdEncuentros(next);
      return;
    }
    if (prodTipo === 'un_encuentro') {
      setProdEncuentros([num]);
      return;
    }
    if (prodTipo === 'dos_encuentros') {
      const checked = prodEncuentros.includes(num);
      if (checked) {
        if (prodEncuentros.length > 1) setProdEncuentros(prodEncuentros.filter(x => x !== num));
      } else if (prodEncuentros.length < 2) {
        setProdEncuentros([...prodEncuentros, num].sort());
      } else {
        // Reemplaza el primero (FIFO) para mantener exactamente 2
        setProdEncuentros([prodEncuentros[1], num].sort());
      }
    }
  };

  // Sube archivo nuevo a Storage e inserta comprobante en estado validado.
  // Devuelve el id insertado o null.
  const subirComprobanteValidado = async (alumnaId, montoNum, file) => {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('comprobantes').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const a = store.state.alumnas.find(x => x.id === alumnaId);
      const insertRow = {
        nombre_cliente: a?.nombre || 'Sin nombre',
        contacto: a?.tel || '',
        storage_path: path,
        archivo_nombre: file.name,
        archivo_tipo: file.type,
        alumna_id: alumnaId,
        monto: montoNum,
        estado: 'validado',
        validado_at: new Date().toISOString(),
        proyecto_id: store.state.proyectoId,
      };
      const { data, error } = await supabase
        .from('comprobantes_pago').insert(insertRow).select().single();
      if (error) throw error;
      return data?.id || null;
    } catch (e) {
      console.error('[subir comprobante validado]', e);
      return null;
    }
  };

  // Marca un comprobante existente como validado y lo asocia a alumna_id.
  // Si montoNum es null/undefined/0 y soloAsociar=true, NO sobreescribe el
  // monto del comprobante (caso "solo validar" — el pago fue registrado
  // aparte por Sofía).
  const validarExistente = async (comprobanteId, alumnaId, montoNum, soloAsociar = false) => {
    const patch = {
      estado: 'validado',
      alumna_id: alumnaId,
      validado_at: new Date().toISOString(),
    };
    if (!soloAsociar && montoNum !== null && montoNum !== undefined) {
      patch.monto = montoNum;
    }
    await supabase.from('comprobantes_pago').update(patch).eq('id', comprobanteId);
  };

  const guardar = async () => {
    if (!selection) return;
    // Caso especial: convertir lead sin pago aún
    const sinPago = esLead && tipo === 'ninguno';
    // Caso especial: solo validar comprobante existente (sin sumar al pagado).
    // Usado cuando Sofía ya registró el pago manualmente y solo quiere
    // asociar el comprobante a la alumna y marcarlo validado.
    if (soloValidar && comprobantePreData?.id) {
      await validarExistente(comprobantePreData.id, idNum, null, true);
      onClose();
      return;
    }
    // El monto $0 es válido y deliberado (beca completa, canje, cortesía):
    // deja registro en `pagos` de que la persona entró sin dinero de por medio.
    // Sólo se bloquea un monto negativo.
    const montoNum = Number(monto) || 0;
    if (!sinPago && montoNum < 0) return;

    if (tipoSel === 'alumna') {
      // 1. Si hay archivo Y NO hay comprobante existente → subir comprobante validado
      if (archivo && !comprobantePreData) {
        await subirComprobanteValidado(idNum, montoNum, archivo);
      }
      // 2. Si vino un comprobante pre-existente → marcar como validado
      if (comprobantePreData?.id) {
        await validarExistente(comprobantePreData.id, idNum, montoNum);
      }
      // 3. Registrar el pago (esto crea fila en `pagos` + actualiza alumnas + auto-silla)
      await store.registrarPago(idNum, montoNum, tipo, forma, { destino });
      onClose();
      return;
    }
    if (tipoSel === 'lead' && lead) {
      // Validación precio especial: motivo obligatorio
      if (precioEspecial && !precioEspecialMotivo.trim()) {
        alert('Falta el motivo del precio especial.');
        return;
      }
      // $0 es un precio especial legítimo (beca completa): sólo se rechaza negativo.
      if (precioEspecial && (Number(precioEspecialMonto) || 0) < 0) {
        alert('El precio especial no puede ser negativo.');
        return;
      }
      setConvirtiendo(true);
      try {
        // Producto elegido por Sofía: tipo + encuentros + silla → total.
        const insExtra = {
          tipo_inscripcion: prodTipo,
          encuentros_asistir: prodEncuentros,
          total: productoTotal,
          bonoSilla: esProntoPago ? true : prodSilla, // pronto-pago siempre incluye silla
        };
        if (sinPago) {
          // Convertir sin pago: crea alumna con el producto definido, pagado=0
          await store.convertLeadToAlumna(idNum, {
            ...insExtra,
            pagado: 0,
            pago: 'pendiente',
          });
        } else {
          // 1) Convertir lead → alumna con el producto definido
          const nuevaId = await store.convertLeadToAlumna(idNum, {
            ...insExtra,
            pagado: 0,
            pago: 'pendiente',
          });
          if (nuevaId) {
            // 2) Subir comprobante si lo hay
            if (archivo) await subirComprobanteValidado(nuevaId, montoNum, archivo);
            // 3) Registrar pago con forma seleccionada.
            //    skipAutoSilla=true porque Sofía ya decidió silla en el picker.
            await store.registrarPago(nuevaId, montoNum, tipo, forma, { skipAutoSilla: true, destino });
            // 4) Si fue precio especial, registrar evento en timeline
            if (precioEspecial && productoTotal !== productoTotalBase) {
              await supabase.from('eventos_alumna').insert({
                alumna_id: nuevaId,
                tipo: 'ajuste_precio',
                titulo: 'Precio especial',
                subtitulo: `De $${productoTotalBase} a $${productoTotal} · ${precioEspecialMotivo.trim()}`,
                monto: productoTotal - productoTotalBase,
              });
            }
          }
        }
      } catch (e) {
        // NO cerrar la hoja si falló: antes se cerraba igual y la conversión
        // se perdía en silencio (el lead seguía ahí y no aparecía inscrito).
        console.error('[pago lead → alumna]', e);
        setConvirtiendo(false);
        alert(
          `No se pudo inscribir a ${lead.nombre}.\n\n` +
          `${e?.message || e}\n\n` +
          'No se guardó nada. Vuelve a intentar; si sigue igual, avísale a Juan Cristóbal con este mensaje.'
        );
        return;
      } finally {
        setConvirtiendo(false);
      }
      onClose();
    }
  };

  const onPickFile = (file) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setErrorArchivo('Archivo supera 12 MB.');
      return;
    }
    setErrorArchivo('');
    setArchivo(file);
  };

  // Atajos: 4 botones para alumna y lead, + extra ("sin pago") solo en lead.
  // Para alumna existente, el monto del pronto-pago/completo se ajusta a lo que falta.
  const quickButtons = alumna ? [
    { label: `Reserva $${precioReserva}`, v: precioReserva, t: 'reserva' },
    {
      label: alumna.pagado > 0 && alumna.pagado < precioProntoPago
        ? `Pronto pago (saldo $${precioProntoPago - alumna.pagado})`
        : `Pronto pago $${precioProntoPago}`,
      v: Math.max(0, precioProntoPago - (alumna.pagado || 0)),
      t: 'pronto-pago',
    },
    {
      label: alumna.pagado > 0 && alumna.pagado < alumna.total
        ? `Pago completo (saldo $${alumna.total - alumna.pagado})`
        : `Pago completo $${alumna.total}`,
      v: Math.max(0, (alumna.total || precioRegular) - (alumna.pagado || 0)),
      t: 'completo',
    },
    { label: 'Otro monto', v: 0, t: 'parcial' },
    { label: 'Sin costo · $0 (beca / canje)', v: 0, t: 'cortesia' },
  ] : esLead ? [
    { label: `Reserva $${precioReserva}`, v: precioReserva, t: 'reserva' },
    {
      label: esProntoPago
        ? `Pago completo $${productoTotal} (pronto pago)`
        : `Pago completo $${productoTotal}`,
      v: productoTotal,
      t: esProntoPago ? 'pronto-pago' : 'completo',
    },
    { label: 'Otro monto', v: 0, t: 'parcial' },
    { label: 'Sin costo · $0 (beca / canje)', v: 0, t: 'cortesia' },
    { label: 'Convertir sin pago aún', v: 0, t: 'ninguno' },
  ] : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={comprobantePreData ? 'Validar comprobante' : 'Registrar pago'}
      footer={
        <button
          className="btn btn-primary btn-block"
          onClick={guardar}
          disabled={!selection || (!soloValidar && (Number(monto) || 0) < 0) || convirtiendo}
        >
          {convirtiendo ? 'Convirtiendo…' :
           soloValidar ? 'Validar sin sumar al pago' :
           esLead && tipo === 'ninguno' ? 'Inscribir sin pago' :
           // $0 explícito: beca completa, canje o cortesía. Queda registrado.
           (Number(monto) || 0) === 0 ? (esLead ? 'Inscribir sin costo ($0)' : 'Registrar sin costo ($0)') :
           esLead ? `Inscribir y registrar $${monto}` :
           `Registrar $${monto}`}
        </button>
      }
    >
      <Field label="Estudiante o lead">
        <select
          value={selection}
          onChange={e => setSelection(e.target.value)}
          style={{
            width: '100%', background: 'var(--surface)',
            border: '1px solid var(--line-soft)', borderRadius: 12,
            padding: '12px 14px', fontFamily: 'inherit', fontSize: 14,
            color: 'var(--ink)', outline: 'none', appearance: 'none',
          }}
        >
          <option value="">— Selecciona —</option>
          {store.state.alumnas.length > 0 && (
            <optgroup label="Estudiantes inscritos">
              {store.state.alumnas.map(a => (
                <option key={a.id} value={`alumna:${a.id}`}>{a.nombre} · ${a.pagado}/${a.total}</option>
              ))}
            </optgroup>
          )}
          {store.state.leads.length > 0 && (
            <optgroup label="Leads (al pagar se inscriben)">
              {store.state.leads.map(l => (
                <option key={l.id} value={`lead:${l.id}`}>{l.nombre} · {l.tel || l.instagram || 'sin contacto'}</option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>

      {alumna && (
        <div className="card flat" style={{ padding: 14, marginBottom: 14, background: 'var(--bg-warm)', borderColor: 'transparent' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Pagado: <strong>${alumna.pagado}</strong> de ${alumna.total} · Falta <strong style={{ color: 'var(--rojo)' }}>${restante}</strong>
          </div>
        </div>
      )}

      {/* Solo validar: visible cuando vamos a validar un comprobante existente
          y la persona elegida es una alumna. Permite asociar + marcar validado
          sin sumar al pagado (caso: pago ya registrado manualmente). */}
      {comprobantePreData && alumna && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: 12, marginBottom: 14, borderRadius: 12,
          background: soloValidar ? 'var(--terracota-tint)' : 'var(--bg-warm)',
          border: `1px solid ${soloValidar ? 'var(--terracota)' : 'var(--line-soft)'}`,
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={soloValidar}
            onChange={(e) => setSoloValidar(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
              Solo validar (sin sumar al pago)
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.4 }}>
              Marca esta opción si ya registraste el pago manualmente y solo quieres
              asociar el comprobante a la alumna y marcarlo como validado.
            </div>
          </div>
        </label>
      )}

      {lead && (
        <>
          <div className="card flat" style={{ padding: 14, marginBottom: 14, background: 'var(--terracota-tint)', borderColor: 'transparent' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A3D26', fontWeight: 600, marginBottom: 4 }}>
              Convirtiendo lead → estudiante
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink)' }}>
              <strong>{lead.nombre}</strong> queda inscrito como estudiante al guardar.
            </div>
          </div>

          {esTallerProy ? (
            <>
              {/* Taller / Seminario: se eligen los encuentros (sedes) y el
                  precio sale de la matriz del proyecto. Sin silla. */}
              <Field
                label="① ¿A cuáles encuentros viene?"
                hint={store.state.ajustes.prontoPagoNota || 'El precio cambia según cuántos tome'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {encuentrosProyPago.map(e => {
                    const checked = prodEncuentros.includes(e.num);
                    const sede = sedesPago.find(s => s.n === e.num);
                    return (
                      <button key={e.num} type="button" onClick={() => toggleEncuentro(e.num)} style={{
                        background: checked ? 'var(--terracota-tint)' : 'var(--surface)',
                        border: `1px solid ${checked ? 'var(--terracota)' : 'var(--line-soft)'}`,
                        borderRadius: 10, padding: '10px 13px', fontFamily: 'inherit',
                        fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: checked ? 600 : 400 }}>{e.label}</span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)' }}>
                            {[e.fechas, sede?.lugar].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {checked && <span style={{ color: 'var(--terracota)', fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {store.state.ajustes.matrizPrecios && (
                <Field label="② Etapa del precio">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { v: true,  l: `Pronto pago` },
                      { v: false, l: 'Precio regular' },
                    ].map(o => {
                      const sel = esProntoPago === o.v;
                      return (
                        <button key={String(o.v)} type="button"
                          onClick={() => setProducto(prodTipo, o.v)}
                          style={{
                            flex: 1, padding: '9px 10px', borderRadius: 10,
                            background: sel ? 'var(--terracota-tint)' : 'var(--surface)',
                            border: `1px solid ${sel ? 'var(--terracota)' : 'var(--line-soft)'}`,
                            fontFamily: 'inherit', fontSize: 12, fontWeight: sel ? 600 : 400,
                            color: 'var(--ink)', cursor: 'pointer',
                          }}>{o.l}</button>
                      );
                    })}
                  </div>
                </Field>
              )}
            </>
          ) : (
          <Field label="① Producto que compra">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { key: 'pronto-pago', label: `Pronto pago · $${precioProntoPago}`, sub: 'hasta 10 may · todo incluido (silla)', sel: esProntoPago, onClick: () => setProducto('completa', true) },
                { key: 'completa',    label: 'Completo · 50h · 3 encuentros',       sub: '', sel: !esProntoPago && prodTipo === 'completa',       onClick: () => setProducto('completa') },
                { key: 'dos_enc',     label: '2 encuentros',                         sub: 'elige 2 de 3 fines de semana', sel: !esProntoPago && prodTipo === 'dos_encuentros', onClick: () => setProducto('dos_encuentros') },
                { key: 'un_enc',      label: '1 encuentro',                          sub: 'elige 1 de 3 fines de semana', sel: !esProntoPago && prodTipo === 'un_encuentro',  onClick: () => setProducto('un_encuentro') },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={opt.onClick} style={{
                  background: opt.sel ? 'var(--terracota-tint)' : 'var(--surface)',
                  border: `1px solid ${opt.sel ? 'var(--terracota)' : 'var(--line-soft)'}`,
                  borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit',
                  fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                  fontWeight: opt.sel ? 600 : 400,
                }}>
                  {opt.label}
                  {opt.sub && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 400, marginTop: 2 }}>{opt.sub}</div>}
                </button>
              ))}
            </div>
          </Field>
          )}

          {!esTallerProy && !esProntoPago && (prodTipo === 'dos_encuentros' || prodTipo === 'un_encuentro') && (
            <Field label={prodTipo === 'dos_encuentros' ? '¿Cuáles 2 encuentros?' : '¿Cuál encuentro?'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ENCUENTROS.map(e => {
                  const checked = prodEncuentros.includes(e.num);
                  return (
                    <button key={e.num} type="button" onClick={() => toggleEncuentro(e.num)} style={{
                      background: checked ? 'var(--bg-warm)' : 'var(--surface)',
                      border: `1px solid ${checked ? 'var(--terracota)' : 'var(--line-soft)'}`,
                      borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit',
                      fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span>{e.label} · <span style={{ color: 'var(--ink-mute)' }}>{e.fechas}</span></span>
                      {checked && <span style={{ color: 'var(--terracota)', fontWeight: 700 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {!esTallerProy && !esProntoPago && (
            <Field label="② Bono silla ($40)">
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { v: true,  l: 'Sí, con silla' },
                  { v: false, l: 'No (renuncia · −$40)' },
                ].map(o => {
                  const sel = prodSilla === o.v;
                  return (
                    <button key={String(o.v)} type="button" onClick={() => setProdSilla(o.v)} style={{
                      flex: 1, padding: '9px 10px', borderRadius: 10,
                      background: sel ? 'var(--terracota-tint)' : 'var(--surface)',
                      border: `1px solid ${sel ? 'var(--terracota)' : 'var(--line-soft)'}`,
                      fontFamily: 'inherit', fontSize: 12, fontWeight: sel ? 600 : 400,
                      color: 'var(--ink)', cursor: 'pointer',
                    }}>{o.l}</button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="card flat" style={{
            padding: 12, marginBottom: 8, background: 'var(--bg-warm)', borderColor: 'transparent',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
              Total a pagar
            </span>
            <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>
              {precioEspecial && productoTotalBase !== productoTotal && (
                <span style={{ textDecoration: 'line-through', color: 'var(--ink-mute)', fontSize: 14, marginRight: 8 }}>${productoTotalBase}</span>
              )}
              ${productoTotal}
            </span>
          </div>

          {/* Precio especial · override + motivo obligatorio */}
          {!precioEspecial ? (
            <button
              type="button"
              onClick={() => { setPrecioEspecial(true); setPrecioEspecialMonto(productoTotalBase); }}
              style={{
                marginBottom: 14, padding: '6px 12px', borderRadius: 999,
                background: 'transparent', border: '1px dashed var(--terracota-soft)',
                color: 'var(--terracota)', fontFamily: 'inherit', fontSize: 11,
                fontWeight: 500, cursor: 'pointer',
              }}
            >+ Aplicar precio especial</button>
          ) : (
            <div className="card flat" style={{
              padding: 12, marginBottom: 14,
              background: 'var(--terracota-tint)', border: '1px solid var(--terracota)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
              }}>
                <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A3D26', fontWeight: 700 }}>
                  Precio especial
                </span>
                <button
                  type="button"
                  onClick={() => { setPrecioEspecial(false); setPrecioEspecialMonto(0); setPrecioEspecialMotivo(''); }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-mute)',
                    fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >Quitar</button>
              </div>
              <NumberInput value={precioEspecialMonto} onChange={setPrecioEspecialMonto} prefix="$" min={0} />
              <textarea
                value={precioEspecialMotivo}
                onChange={(e) => setPrecioEspecialMotivo(e.target.value)}
                placeholder="Motivo (beca, intercambio, amistad, promo…)"
                rows={2}
                style={{
                  width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 8,
                  background: 'var(--surface)', border: '1px solid var(--line-soft)',
                  fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)',
                  resize: 'vertical', outline: 'none',
                }}
              />
              {!precioEspecialMotivo.trim() && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--rojo)' }}>
                  Motivo obligatorio para aplicar precio especial.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!soloValidar && (
      <Field
        label={esLead ? '③ ¿Cuánto paga ahora?' : 'Monto del pago'}
        hint={(Number(monto) || 0) === 0 && tipo !== 'ninguno'
          ? 'En $0 queda el registro de una beca, canje o cortesía.'
          : undefined}
      >
        <NumberInput value={monto} onChange={setMonto} prefix="$" min={0} />
      </Field>
      )}

      {!soloValidar && (alumna || lead) && quickButtons.length > 0 && !comprobantePreData && (
        <Field label="Atajos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quickButtons.map(qb => {
              const seleccionado = tipo === qb.t && (qb.t === 'ninguno' || monto === qb.v);
              return (
                <button key={qb.t} type="button"
                  onClick={() => { setMonto(qb.v); setTipo(qb.t); }}
                  style={{
                    background: seleccionado ? 'var(--terracota-tint)' : 'var(--surface)',
                    border: `1px solid ${seleccionado ? 'var(--terracota)' : 'var(--line-soft)'}`,
                    borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit',
                    fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                    fontWeight: seleccionado ? 600 : 400,
                  }}
                >{qb.label}</button>
              );
            })}
          </div>
        </Field>
      )}

      {!soloValidar && tipo !== 'ninguno' && (
        <Field label={esLead ? '③ Forma de pago' : 'Forma de pago'}>
          <SelectChips
            value={forma}
            onChange={setForma}
            options={[
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'payphone', label: 'Payphone' },
              { value: 'canje', label: 'Canje' },
            ]}
          />
        </Field>
      )}

      {/* Destino del dinero — sólo en proyectos con aliados (Seminario Angelo) */}
      {!soloValidar && tipo !== 'ninguno' && destinosCfg && (
        <Field
          label="¿A qué cuenta entró?"
          hint={reglaPagos?.descripcion || 'El abono de reserva de los retiros va a la sede; el saldo a Sofía.'}
        >
          <SelectChips
            value={destino}
            onChange={setDestino}
            options={Object.entries(destinosCfg).map(([value, label]) => ({ value, label }))}
          />
        </Field>
      )}

      {/* Comprobante: archivo opcional para nuevos pagos, info si validamos uno existente */}
      {tipo !== 'ninguno' && (
        <Field label="Comprobante (opcional)">
          {comprobantePreData ? (
            <div style={{
              padding: 10, borderRadius: 10,
              background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
              fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4,
            }}>
              📎 <strong style={{ color: 'var(--ink)' }}>{comprobantePreData.archivo_nombre || 'Archivo existente'}</strong><br />
              Al guardar, este comprobante quedará validado y vinculado al pago.
            </div>
          ) : archivo ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--surface)', color: 'var(--ink-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>{archivo.type.includes('pdf') ? 'PDF' : 'IMG'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {archivo.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                  {(archivo.size / 1024).toFixed(0)} KB · queda validado al guardar
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchivo(null)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-mute)', padding: 4, fontSize: 16,
                }}
              >×</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--surface)', border: '1px dashed var(--line-soft)',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-soft)',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              📎 Adjuntar comprobante (foto o PDF)
            </button>
          )}
          {errorArchivo && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--rojo)' }}>{errorArchivo}</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Field>
      )}
    </Sheet>
  );
};

window.AlumnaForm = AlumnaForm;
window.LeadForm = LeadForm;
window.PagoForm = PagoForm;
