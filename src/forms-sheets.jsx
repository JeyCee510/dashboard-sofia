import React from 'react';
import { supabase } from './lib/supabase.js';
import { calcularTotal, TIPOS_INSCRIPCION, ENCUENTROS } from './lib/precios.js';
import { ContactPanel, PreinscripcionAdminPanel, ComprobanteTokenAdminPanel, InstaInput, TelInput } from './forms.jsx';
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
        <TelInput value={form.tel} onChange={v => set('tel', v)} />
      </Field>
      <Field label="Instagram (opcional)">
        <InstaInput value={form.instagram} onChange={v => set('instagram', v)} />
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

const LeadForm = ({ open, onClose, store, leadId, onConvertir }) => {
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
  const [convirtiendo, setConvirtiendo] = React.useState(false);
  // Archivo opcional para subir al validar
  const [archivo, setArchivo] = React.useState(null);
  const [errorArchivo, setErrorArchivo] = React.useState('');
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setSelection(initialSel());
      // Si viene un comprobante pre-validar, prepoblar monto
      setMonto(comprobantePreData?.monto || 0);
      setTipo('parcial');
      setConvirtiendo(false);
      setArchivo(null);
      setErrorArchivo('');
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
  const validarExistente = async (comprobanteId, alumnaId, montoNum) => {
    await supabase.from('comprobantes_pago').update({
      estado: 'validado',
      alumna_id: alumnaId,
      monto: montoNum,
      validado_at: new Date().toISOString(),
    }).eq('id', comprobanteId);
  };

  const guardar = async () => {
    if (!selection) return;
    // Caso especial: convertir lead sin pago aún
    const sinPago = esLead && tipo === 'ninguno';
    if (!sinPago && !monto) return;
    const montoNum = Number(monto) || 0;

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
      await store.registrarPago(idNum, montoNum, tipo);
      onClose();
      return;
    }
    if (tipoSel === 'lead' && lead) {
      setConvirtiendo(true);
      try {
        if (sinPago) {
          // Convertir sin pago: sólo crea alumna con pagado=0 y borra lead
          await store.convertLeadToAlumna(idNum, {
            tipo_inscripcion: 'completa',
            encuentros_asistir: [1, 2, 3],
            total: precioRegular,
            pagado: 0,
            pago: 'pendiente',
          });
        } else {
          // 1) Convertir lead → alumna
          const nuevaId = await store.convertLeadToAlumna(idNum, {
            tipo_inscripcion: 'completa',
            encuentros_asistir: [1, 2, 3],
            total: precioRegular,
            pagado: 0,
            pago: 'pendiente',
          });
          if (nuevaId) {
            // 2) Subir comprobante si lo hay
            if (archivo) await subirComprobanteValidado(nuevaId, montoNum, archivo);
            // 3) Registrar pago
            await store.registrarPago(nuevaId, montoNum, tipo);
          }
        }
      } catch (e) {
        console.error('[pago lead → alumna]', e);
      } finally {
        setConvirtiendo(false);
        onClose();
      }
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
  ] : esLead ? [
    { label: `Reserva $${precioReserva}`, v: precioReserva, t: 'reserva' },
    { label: `Pronto pago $${precioProntoPago}`, v: precioProntoPago, t: 'pronto-pago' },
    { label: `Pago completo $${precioRegular}`, v: precioRegular, t: 'completo' },
    { label: 'Otro monto', v: 0, t: 'parcial' },
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
          disabled={!selection || (tipo !== 'ninguno' && !monto) || convirtiendo}
        >
          {convirtiendo ? 'Convirtiendo…' :
           esLead && tipo === 'ninguno' ? 'Inscribir sin pago' :
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

      {(alumna || lead) && quickButtons.length > 0 && !comprobantePreData && (
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

      {tipo !== 'ninguno' && (
        <Field label="Tipo">
          <SelectChips
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'reserva', label: 'Reserva' },
              { value: 'parcial', label: 'Parcial' },
              { value: 'pronto-pago', label: 'Pronto pago' },
              { value: 'completo', label: 'Completo' },
              { value: 'saldo', label: 'Saldo' },
            ]}
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
