import React from 'react';
import { calcularTotal, TIPOS_INSCRIPCION, ENCUENTROS } from './lib/precios.js';
import { ContactPanel, PreinscripcionAdminPanel, ComprobanteTokenAdminPanel } from './forms.jsx';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Form sheets: alumna · lead · pago + Ajustes screen
// ──────────────────────────────────────────

const AlumnaForm = ({ open, onClose, store, alumnaId }) => {
  const editing = alumnaId && store.state.alumnas.find(a => a.id === alumnaId);
  const defaultForm = () => ({
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
    else next = [...cur, num].sort();
    // Mantener consistencia con el tipo
    let tipo = f.tipo_inscripcion;
    if (next.length === 3) tipo = 'completa';
    else if (next.length === 2) tipo = 'dos_encuentros';
    else if (next.length === 1) tipo = 'un_encuentro';
    const upd = { ...f, encuentros_asistir: next, tipo_inscripcion: tipo };
    if (!f.totalManual) upd.total = calcularTotal({ tipo, bonoSilla: f.bonoSilla, ajustes: store.state.ajustes });
    return upd;
  });

  const guardar = () => {
    if (!form.nombre.trim()) return;
    if (editing) store.updateAlumna(alumnaId, form);
    else store.addAlumna(form);
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
        <TextInput value={form.tel} onChange={v => set('tel', v)} placeholder="+593 99 234 5678" />
      </Field>
      <Field label="Instagram (opcional)">
        <TextInput value={form.instagram} onChange={v => set('instagram', v)} placeholder="@usuario" />
      </Field>
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
          Total calculado automáticamente. Edítalo si necesitas un descuento especial.
        </div>
      )}
      <Field label="Notas">
        <TextArea value={form.notas} onChange={v => set('notas', v)} placeholder="Cómo la viste, recordatorios, etc." rows={3} />
      </Field>
    </Sheet>
  );
};

const LeadForm = ({ open, onClose, store, leadId }) => {
  const editing = leadId && store.state.leads.find(l => l.id === leadId);
  const [form, setForm] = React.useState(() => editing || {
    nombre: '', tel: '', instagram: '', mensaje: '', fuente: 'instagram', estado: 'nuevo',
  });

  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ nombre: '', tel: '', instagram: '', mensaje: '', fuente: 'instagram', estado: 'nuevo' });
  }, [leadId, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    store.convertLeadToAlumna(leadId);
    onClose();
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
          <div style={{ marginBottom: 14 }}>
            <ContactPanel
              tel={form.tel}
              instagram={form.instagram}
              plantillas={store.state.ajustes.plantillasWA}
              nombre={form.nombre}
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
            <ComprobanteTokenAdminPanel
              leadId={leadId}
              nombre={form.nombre}
              tel={form.tel}
            />
          </div>
          <button className="btn btn-secondary btn-block" style={{ marginBottom: 14 }} onClick={convertir}>
            <Icon name="arrow" size={14} /> Convertir en estudiante
          </button>
        </>
      )}
      <Field label="Nombre">
        <TextInput value={form.nombre} onChange={v => set('nombre', v)} placeholder="Ej. Mónica Salinas" />
      </Field>
      <Field label="Teléfono / WhatsApp">
        <TextInput value={form.tel} onChange={v => set('tel', v)} placeholder="+593 99 …" />
      </Field>
      <Field label="Instagram (opcional)">
        <TextInput value={form.instagram} onChange={v => set('instagram', v)} placeholder="@usuario" />
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
      <Field label="Mensaje / contexto">
        <TextArea value={form.mensaje} onChange={v => set('mensaje', v)} placeholder="¿Qué te dijo? ¿Qué necesita?" rows={3} />
      </Field>
    </Sheet>
  );
};

const PagoForm = ({ open, onClose, store, alumnaPreId }) => {
  // selection puede ser:
  //   "alumna:<id>" → estudiante existente
  //   "lead:<id>"   → lead que se convertirá a estudiante al registrar pago
  const [selection, setSelection] = React.useState(alumnaPreId ? `alumna:${alumnaPreId}` : '');
  const [monto, setMonto] = React.useState(0);
  const [tipo, setTipo] = React.useState('parcial');
  const [convirtiendo, setConvirtiendo] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelection(alumnaPreId ? `alumna:${alumnaPreId}` : '');
      setMonto(0);
      setTipo('parcial');
      setConvirtiendo(false);
    }
  }, [open, alumnaPreId]);

  const [tipoSel, idSel] = selection.split(':');
  const idNum = idSel ? Number(idSel) : null;
  const alumna = tipoSel === 'alumna' ? store.state.alumnas.find(a => a.id === idNum) : null;
  const lead = tipoSel === 'lead' ? store.state.leads.find(l => l.id === idNum) : null;
  const restante = alumna ? alumna.total - alumna.pagado : 0;
  const esLead = !!lead;

  const guardar = async () => {
    if (!selection || !monto) return;
    if (tipoSel === 'alumna') {
      store.registrarPago(idNum, monto, tipo);
      onClose();
      return;
    }
    if (tipoSel === 'lead' && lead) {
      // Convertir lead → estudiante con el monto ya pagado
      setConvirtiendo(true);
      try {
        const total = store.state.ajustes.precioRegular || 640;
        // addAlumna directo con datos del lead + monto inicial
        const nuevaId = await store.addAlumna({
          nombre: lead.nombre,
          tel: lead.tel,
          instagram: lead.instagram || '',
          pago: monto >= total ? (tipo === 'pronto-pago' ? 'pronto-pago' : 'completo') : 'parcial',
          pagado: monto,
          total,
          tipo_inscripcion: 'completa',
          encuentros_asistir: [1, 2, 3],
        });
        // Registrar el pago en la tabla de pagos para mantener el audit trail
        if (nuevaId) {
          await store.registrarPago(nuevaId, 0, tipo); // dummy: el pagado ya está en el row
        }
        // Borrar el lead
        await store.deleteLead(idNum);
      } catch (e) {
        console.error('[pago lead → alumna]', e);
      } finally {
        setConvirtiendo(false);
        onClose();
      }
    }
  };

  const quickButtons = alumna ? [
    { label: 'Reserva $200', v: 200, t: 'reserva' },
    { label: `Pronto pago $${store.state.ajustes.precioProntoPago}`, v: store.state.ajustes.precioProntoPago, t: 'pronto-pago' },
    { label: `Saldo $${restante}`, v: restante, t: 'saldo' },
  ] : esLead ? [
    { label: 'Reserva $200', v: 200, t: 'reserva' },
    { label: `Pronto pago $${store.state.ajustes.precioProntoPago}`, v: store.state.ajustes.precioProntoPago, t: 'pronto-pago' },
    { label: `Total $${store.state.ajustes.precioRegular}`, v: store.state.ajustes.precioRegular, t: 'completo' },
  ] : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar pago"
      footer={
        <button
          className="btn btn-primary btn-block"
          onClick={guardar}
          disabled={!selection || !monto || convirtiendo}
        >
          {convirtiendo ? 'Convirtiendo…' :
           esLead ? `Inscribir y registrar $${monto || 0}` :
           `Registrar $${monto || 0}`}
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

      {lead && (
        <div className="card flat" style={{ padding: 14, marginBottom: 14, background: 'var(--terracota-tint)', borderColor: 'transparent' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A3D26', fontWeight: 600, marginBottom: 4 }}>
            Convirtiendo lead → estudiante
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink)' }}>
            Al registrar este pago, <strong>{lead.nombre}</strong> queda inscrito como estudiante (formación completa) y el lead se elimina del embudo.
          </div>
        </div>
      )}

      <Field label="Monto del pago">
        <NumberInput value={monto} onChange={setMonto} prefix="$" min={0} />
      </Field>

      {(alumna || lead) && quickButtons.length > 0 && (
        <Field label="Atajos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quickButtons.map(qb => (
              <button key={qb.t} type="button"
                onClick={() => { setMonto(qb.v); setTipo(qb.t === 'pronto-pago' ? 'pronto-pago' : qb.t === 'reserva' ? 'reserva' : qb.t === 'completo' ? 'completo' : 'parcial'); }}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line-soft)',
                  borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit',
                  fontSize: 13, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                }}
              >{qb.label}</button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Tipo">
        <SelectChips
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'reserva', label: 'Reserva' },
            { value: 'parcial', label: 'Parcial' },
            { value: 'pronto-pago', label: 'Pronto pago' },
            { value: 'saldo', label: 'Saldo' },
          ]}
        />
      </Field>
    </Sheet>
  );
};

window.AlumnaForm = AlumnaForm;
window.LeadForm = LeadForm;
window.PagoForm = PagoForm;
