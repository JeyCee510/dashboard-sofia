import React from 'react';

const { useState } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioConfig — pantalla de ajustes del módulo Estudio
//
// 5 secciones colapsables (mobile-first):
//   1. Información del estudio (nombre, dirección, maps url)
//   2. Planes y precios (CRUD sobre planes_catalogo)
//   3. Vencimientos y alertas (ventana de días)
//   4. Plantillas WhatsApp del estudio
//   5. Datos de transferencia (compartidos con formación)
//
// Single source of truth:
//   - Planes → tabla planes_catalogo (vía store.estudio.*)
//   - Resto → ajustes.data.estudio.* (vía useAjustes deep-merged)
// ─────────────────────────────────────────────────────────────────

function EstudioConfig({ open, onClose, store }) {
  const [seccion, setSeccion] = useState(null); // null | 'info' | 'planes' | 'vencimientos' | 'plantillas' | 'transferencia'

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={ev => ev.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 10px' }}>
          {seccion && (
            <button onClick={() => setSeccion(null)} style={btnBack}>← Atrás</button>
          )}
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, flex: 1, textAlign: seccion ? 'center' : 'left' }}>
            {seccion ? tituloSeccion(seccion) : 'Ajustes del estudio'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>×</button>
        </div>

        {!seccion && <MenuPrincipal onSelect={setSeccion} />}
        {seccion === 'info' && <SeccionInfo store={store} />}
        {seccion === 'planes' && <SeccionPlanes store={store} />}
        {seccion === 'vencimientos' && <SeccionVencimientos store={store} />}
        {seccion === 'plantillas' && <SeccionPlantillas store={store} />}
        {seccion === 'transferencia' && <SeccionTransferencia store={store} />}
      </div>
    </div>
  );
}

// ─── Menú principal ───
function MenuPrincipal({ onSelect }) {
  const items = [
    { k: 'info', label: 'Información del estudio', sub: 'Nombre, dirección, Maps' },
    { k: 'planes', label: 'Planes y precios', sub: 'Catálogo editable' },
    { k: 'vencimientos', label: 'Vencimientos y alertas', sub: 'Ventana de días' },
    { k: 'plantillas', label: 'Plantillas WhatsApp', sub: 'Bienvenida, vencimiento, etc.' },
    { k: 'transferencia', label: 'Datos de transferencia', sub: 'Compartidos con formación' },
  ];
  return (
    <div style={{ padding: '4px 18px 24px' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
        {items.map((it, i) => (
          <button
            key={it.k}
            onClick={() => onSelect(it.k)}
            style={{
              width: '100%', padding: '14px 16px',
              borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
              background: 'transparent', border: 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{it.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{it.sub}</div>
            </div>
            <span style={{ color: 'var(--ink-soft)' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 1. Información del estudio ───
function SeccionInfo({ store }) {
  const ajustes = store.state.ajustes;
  const update = store.updateAjustes;
  const info = ajustes.estudio?.info || {};
  return (
    <div style={contenidoSeccion}>
      <Field label="Nombre del estudio">
        <input type="text" value={ajustes.studioName || ''}
          onChange={ev => update({ studioName: ev.target.value })} style={input} />
      </Field>
      <Field label="Dirección">
        <input type="text" value={info.direccion || ''}
          onChange={ev => update({ estudio: { info: { direccion: ev.target.value } } })} style={input} />
      </Field>
      <Field label="Maps URL">
        <input type="url" value={info.mapsUrl || ''}
          onChange={ev => update({ estudio: { info: { mapsUrl: ev.target.value } } })}
          placeholder="https://maps.app.goo.gl/..." style={input} />
      </Field>
      <div style={hint}>Los cambios se guardan automáticamente.</div>
    </div>
  );
}

// ─── 2. Planes y precios ───
function SeccionPlanes({ store }) {
  const e = store.estudio;
  const planes = (e.planes || []).sort((a, b) => a.orden - b.orden);
  const activos = planes.filter(p => p.activo);
  const archivados = planes.filter(p => !p.activo);
  const [editando, setEditando] = useState(null); // null | id | 'new'

  return (
    <div style={contenidoSeccion}>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Activos ({activos.length})
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 14 }}>
        {activos.map((p, i) => (
          <PlanRow key={p.id} plan={p} esLast={i === activos.length - 1} onEditar={() => setEditando(p.id)} />
        ))}
      </div>

      <button onClick={() => setEditando('new')} style={{
        width: '100%', padding: '12px',
        borderRadius: 12, border: '2px dashed var(--line)',
        background: '#fff', color: 'var(--terracota)',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        marginBottom: 14,
      }}>
        + Crear plan nuevo
      </button>

      {archivados.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Archivados ({archivados.length})
          </div>
          <div style={{ background: 'var(--bg-soft)', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {archivados.map((p, i) => (
              <PlanRow key={p.id} plan={p} esLast={i === archivados.length - 1} archivado onEditar={() => setEditando(p.id)} />
            ))}
          </div>
        </>
      )}

      {editando !== null && (
        <PlanEditor
          planId={editando === 'new' ? null : editando}
          store={store}
          onClose={() => setEditando(null)}
        />
      )}

      <div style={hint}>
        Editar precios no afecta membresías ya creadas (snapshot del plan).<br />
        Archivar un plan lo oculta del wizard pero preserva el historial.
      </div>
    </div>
  );
}

function PlanRow({ plan, esLast, archivado, onEditar }) {
  return (
    <button onClick={onEditar} style={{
      width: '100%', padding: '12px 14px',
      borderBottom: esLast ? 'none' : '1px solid var(--line)',
      background: 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer', textAlign: 'left',
      opacity: archivado ? 0.6 : 1,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{plan.nombre}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>
          {plan.tipo} · {plan.duracionDias}d{plan.numClases ? ` · ${plan.numClases} clases` : ' · ilimitado'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--terracota)' }}>${plan.precio.toFixed(2)}</span>
        <span style={{ color: 'var(--ink-soft)', fontSize: 14 }}>›</span>
      </div>
    </button>
  );
}

function PlanEditor({ planId, store, onClose }) {
  const e = store.estudio;
  const existente = planId ? e.planes.find(p => p.id === planId) : null;
  const [nombre, setNombre] = useState(existente?.nombre || '');
  const [tipo, setTipo] = useState(existente?.tipo || 'mensualidad');
  const [precio, setPrecio] = useState(String(existente?.precio || ''));
  const [duracionDias, setDuracionDias] = useState(String(existente?.duracionDias || 30));
  const [numClases, setNumClases] = useState(existente?.numClases != null ? String(existente.numClases) : '');
  const [descripcion, setDescripcion] = useState(existente?.descripcion || '');
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    try {
      const data = {
        nombre: nombre.trim(),
        tipo,
        precio: Number(precio) || 0,
        duracionDias: Number(duracionDias) || 30,
        numClases: numClases ? Number(numClases) : null,
        descripcion,
      };
      if (existente) await e.updatePlan(existente.id, data);
      else await e.addPlan(data);
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  const archivar = async () => {
    if (!existente) return;
    const ok = window.confirm(`¿Archivar el plan "${existente.nombre}"? Las membresías históricas se preservan.`);
    if (!ok) return;
    await e.archivarPlan(existente.id);
    onClose();
  };

  const reactivar = async () => {
    if (!existente) return;
    await e.reactivarPlan(existente.id);
    onClose();
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>
          {existente ? 'Editar plan' : 'Crear plan'}
        </h3>
        <Field label="Nombre">
          <input type="text" value={nombre} onChange={ev => setNombre(ev.target.value)} style={input} autoFocus />
        </Field>
        <Field label="Tipo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {['mensualidad','paquete','drop_in','trimestral','semestral'].map(t => (
              <button key={t} onClick={() => setTipo(t)} style={{
                padding: '8px 4px', borderRadius: 8,
                background: tipo === t ? 'var(--ink)' : 'var(--bg-soft)',
                color: tipo === t ? '#fff' : 'var(--ink-soft)',
                border: '1px solid var(--line)', fontSize: 10, cursor: 'pointer',
              }}>{t === 'drop_in' ? 'Drop-in' : t}</button>
            ))}
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Field label="Precio ($)">
            <input type="number" value={precio} onChange={ev => setPrecio(ev.target.value)} style={input} />
          </Field>
          <Field label="Duración (días)">
            <input type="number" value={duracionDias} onChange={ev => setDuracionDias(ev.target.value)} style={input} />
          </Field>
          <Field label="N° clases">
            <input type="number" value={numClases} onChange={ev => setNumClases(ev.target.value)} placeholder="ilim." style={input} />
          </Field>
        </div>
        <Field label="Descripción">
          <input type="text" value={descripcion} onChange={ev => setDescripcion(ev.target.value)} style={input} />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} disabled={!nombre.trim() || enviando} style={{
            ...btn, flex: 2,
            background: nombre.trim() && !enviando ? 'var(--terracota)' : 'var(--bg-soft)',
            color: nombre.trim() && !enviando ? '#fff' : 'var(--ink-soft)',
          }}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
        {existente && (
          existente.activo
            ? <button onClick={archivar} style={{ ...btn, width: '100%', background: 'transparent', color: 'var(--ink-soft)', fontSize: 12 }}>Archivar plan</button>
            : <button onClick={reactivar} style={{ ...btn, width: '100%', background: 'transparent', color: 'var(--terracota)', fontSize: 12 }}>Reactivar plan</button>
        )}
      </div>
    </div>
  );
}

// ─── 3. Vencimientos y alertas ───
function SeccionVencimientos({ store }) {
  const v = store.state.ajustes.estudio?.vencimientos || {};
  const update = store.updateAjustes;
  const opciones = [3, 7, 14];
  return (
    <div style={contenidoSeccion}>
      <Field label="Ventana de alerta (días antes de vencer)">
        <div style={{ display: 'flex', gap: 6 }}>
          {opciones.map(d => (
            <button key={d} onClick={() => update({ estudio: { vencimientos: { ventanaDias: d } } })} style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: v.ventanaDias === d ? 'var(--terracota)' : 'var(--bg-soft)',
              color: v.ventanaDias === d ? '#fff' : 'var(--ink)',
              border: '1px solid var(--line)', fontSize: 13, cursor: 'pointer',
            }}>{d} días</button>
          ))}
          <input type="number" value={[3,7,14].includes(v.ventanaDias) ? '' : (v.ventanaDias || '')}
            onChange={ev => update({ estudio: { vencimientos: { ventanaDias: Number(ev.target.value) || 7 } } })}
            placeholder="Otro"
            style={{ ...input, width: 70, textAlign: 'center' }} />
        </div>
      </Field>
      <Field label="">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
          <input type="checkbox" checked={!!v.alertaPaqueteCerca}
            onChange={ev => update({ estudio: { vencimientos: { alertaPaqueteCerca: ev.target.checked } } })} />
          <span style={{ fontSize: 13 }}>Alertar también cuando queden ≤2 clases en paquetes</span>
        </label>
      </Field>
      <div style={hint}>La ventana de alertas controla qué membresías aparecen como "Por vencer".</div>
    </div>
  );
}

// ─── 4. Plantillas WhatsApp ───
function SeccionPlantillas({ store }) {
  const ajustes = store.state.ajustes;
  const update = store.updateAjustes;
  const plantillas = ajustes.estudio?.plantillasWA || [];
  const [editando, setEditando] = useState(null);

  return (
    <div style={contenidoSeccion}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 14 }}>
        {plantillas.map((p, i) => (
          <button key={p.id} onClick={() => setEditando(p)} style={{
            width: '100%', padding: '12px 14px',
            borderBottom: i < plantillas.length - 1 ? '1px solid var(--line)' : 'none',
            background: 'transparent', border: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.titulo}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.cuerpo.split('\n')[0]}
              </div>
            </div>
            <span style={{ color: 'var(--ink-soft)', marginLeft: 8 }}>›</span>
          </button>
        ))}
      </div>
      <div style={hint}>
        Placeholders disponibles: <code>{'{nombre}'}</code>, <code>{'{plan}'}</code>, <code>{'{vence}'}</code>, <code>{'{dias}'}</code>, <code>{'{monto}'}</code>.
      </div>

      {editando && (
        <PlantillaEditor plantilla={editando} ajustes={ajustes} update={update} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function PlantillaEditor({ plantilla, ajustes, update, onClose }) {
  const [titulo, setTitulo] = useState(plantilla.titulo);
  const [cuerpo, setCuerpo] = useState(plantilla.cuerpo);

  const guardar = () => {
    const lista = (ajustes.estudio?.plantillasWA || []).map(p =>
      p.id === plantilla.id ? { ...p, titulo, cuerpo } : p
    );
    update({ estudio: { plantillasWA: lista } });
    onClose();
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Plantilla</h3>
        <Field label="Título">
          <input type="text" value={titulo} onChange={ev => setTitulo(ev.target.value)} style={input} />
        </Field>
        <Field label="Mensaje">
          <textarea value={cuerpo} onChange={ev => setCuerpo(ev.target.value)} rows={7}
            style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} style={{ ...btn, flex: 2, background: 'var(--terracota)', color: '#fff' }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── 5. Datos de transferencia ───
function SeccionTransferencia({ store }) {
  const t = store.state.ajustes.transferencia || {};
  const update = store.updateAjustes;
  const set = (k, v) => update({ transferencia: { [k]: v } });
  return (
    <div style={contenidoSeccion}>
      <div style={{
        padding: 10, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 11, color: '#1e40af', marginBottom: 14,
      }}>
        ⓘ Estos datos también los usa el módulo Formación.
      </div>
      <Field label="Titular"><input type="text" value={t.titular || ''} onChange={ev => set('titular', ev.target.value)} style={input} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
        <Field label="Banco"><input type="text" value={t.banco || ''} onChange={ev => set('banco', ev.target.value)} style={input} /></Field>
        <Field label="Tipo"><input type="text" value={t.tipoCuenta || ''} onChange={ev => set('tipoCuenta', ev.target.value)} placeholder="Ahorro" style={input} /></Field>
      </div>
      <Field label="Número de cuenta"><input type="text" value={t.cuenta || ''} onChange={ev => set('cuenta', ev.target.value)} style={input} /></Field>
      <Field label="Cédula"><input type="text" value={t.cedula || ''} onChange={ev => set('cedula', ev.target.value)} style={input} /></Field>
      <Field label="Email"><input type="email" value={t.email || ''} onChange={ev => set('email', ev.target.value)} style={input} /></Field>
    </div>
  );
}

// ─── Helpers ───
function tituloSeccion(s) {
  return {
    info: 'Información del estudio',
    planes: 'Planes y precios',
    vencimientos: 'Vencimientos y alertas',
    plantillas: 'Plantillas WhatsApp',
    transferencia: 'Datos de transferencia',
  }[s] || s;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
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
  maxHeight: '90vh', overflowY: 'auto',
};
const contenidoSeccion = { padding: '4px 18px 24px' };
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
const btnBack = {
  background: 'transparent', border: 'none',
  fontSize: 13, color: 'var(--terracota)', cursor: 'pointer',
  padding: '4px 4px 4px 0', marginRight: 8,
};
const hint = { fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 6 };

window.EstudioConfig = EstudioConfig;
export { EstudioConfig };
