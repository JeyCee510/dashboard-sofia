import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Form sheets: alumna · lead · pago + Ajustes screen
// ──────────────────────────────────────────

const AlumnaForm = ({ open, onClose, store, alumnaId }) => {
  const editing = alumnaId && store.state.alumnas.find(a => a.id === alumnaId);
  const [form, setForm] = React.useState(() => editing || {
    nombre: '', tel: '', instagram: '', notas: '', bonoSilla: false, pago: 'pendiente',
    pagado: 0, total: store.state.ajustes.precioRegular,
  });

  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({
      nombre: '', tel: '', instagram: '', notas: '', bonoSilla: false, pago: 'pendiente',
      pagado: 0, total: store.state.ajustes.precioRegular,
    });
  }, [alumnaId, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
        <Field label="Total ($)"><NumberInput value={form.total} onChange={v => set('total', v)} prefix="$" min={0} /></Field>
      </div>
      <SwitchToggle
        label="Bono silla"
        hint="Recibe silla de yoga profesional (primeros 6 inscritos)"
        value={form.bonoSilla}
        onChange={v => set('bonoSilla', v)}
      />
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
  const [alumnaId, setAlumnaId] = React.useState(alumnaPreId || null);
  const [monto, setMonto] = React.useState(0);
  const [tipo, setTipo] = React.useState('parcial');

  React.useEffect(() => {
    if (open) {
      setAlumnaId(alumnaPreId || null);
      setMonto(0);
      setTipo('parcial');
    }
  }, [open, alumnaPreId]);

  const alumna = store.state.alumnas.find(a => a.id === alumnaId);
  const restante = alumna ? alumna.total - alumna.pagado : 0;

  const guardar = () => {
    if (!alumnaId || !monto) return;
    store.registrarPago(alumnaId, monto, tipo);
    onClose();
  };

  const quickButtons = alumna ? [
    { label: 'Reserva $200', v: 200, t: 'reserva' },
    { label: `Pronto pago $${store.state.ajustes.precioProntoPago}`, v: store.state.ajustes.precioProntoPago, t: 'pronto-pago' },
    { label: `Saldo $${restante}`, v: restante, t: 'saldo' },
  ] : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar pago"
      footer={
        <button className="btn btn-primary btn-block" onClick={guardar} disabled={!alumnaId || !monto}>
          Registrar ${monto || 0}
        </button>
      }
    >
      <Field label="Alumna">
        <select
          value={alumnaId || ''}
          onChange={e => setAlumnaId(Number(e.target.value))}
          style={{
            width: '100%', background: 'var(--surface)',
            border: '1px solid var(--line-soft)', borderRadius: 12,
            padding: '12px 14px', fontFamily: 'inherit', fontSize: 14,
            color: 'var(--ink)', outline: 'none', appearance: 'none',
          }}
        >
          <option value="">— Selecciona —</option>
          {store.state.alumnas.map(a => (
            <option key={a.id} value={a.id}>{a.nombre} · ${a.pagado}/${a.total}</option>
          ))}
        </select>
      </Field>

      {alumna && (
        <div className="card flat" style={{ padding: 14, marginBottom: 14, background: 'var(--bg-warm)', borderColor: 'transparent' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Pagado: <strong>${alumna.pagado}</strong> de ${alumna.total} · Falta <strong style={{ color: 'var(--rojo)' }}>${restante}</strong>
          </div>
        </div>
      )}

      <Field label="Monto del pago">
        <NumberInput value={monto} onChange={setMonto} prefix="$" min={0} />
      </Field>

      {alumna && (
        <Field label="Atajos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quickButtons.map(qb => (
              <button key={qb.t} type="button"
                onClick={() => { setMonto(qb.v); setTipo(qb.t === 'pronto-pago' ? 'pronto-pago' : 'parcial'); }}
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
