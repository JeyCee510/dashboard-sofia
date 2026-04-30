import React from 'react';
import { supabase } from './lib/supabase.js';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ──────────────────────────────────────────
// Ajustes — pantalla de mantenimiento
// ──────────────────────────────────────────

const AjustesScreen = ({ store, onClose }) => {
  const { state, updateAjustes } = store;
  const a = state.ajustes;
  const [editing, setEditing] = React.useState(null); // plantilla id
  const [editingDay, setEditingDay] = React.useState(null);

  const updateDia = (idx, patch) => {
    updateAjustes({
      diasFormacion: a.diasFormacion.map(d => d.idx === idx ? { ...d, ...patch } : d),
    });
  };

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Inicio
        </button>
      </div>
      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header" style={{ paddingTop: 6 }}>
          <div className="eyebrow">Mantenimiento</div>
          <h1>Ajustes</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
            Cambios persisten automáticamente.
          </div>
        </div>

        {/* Estudio */}
        <Section title="Estudio">
          <RowEdit
            label="Tu nombre"
            value={a.ownerName}
            onChange={v => updateAjustes({ ownerName: v })}
          />
          <RowEdit
            label="Nombre del estudio"
            value={a.studioName}
            onChange={v => updateAjustes({ studioName: v })}
          />
          <RowEdit
            label="Lugar"
            value={a.lugar}
            onChange={v => updateAjustes({ lugar: v })}
          />
        </Section>

        {/* Precios */}
        <Section title="Precios">
          <RowEdit
            label="Precio regular"
            value={a.precioRegular}
            type="number"
            prefix="$"
            onChange={v => updateAjustes({ precioRegular: Number(v) })}
          />
          <RowEdit
            label="Pronto pago"
            value={a.precioProntoPago}
            type="number"
            prefix="$"
            onChange={v => updateAjustes({ precioProntoPago: Number(v) })}
          />
          <RowEdit
            label="Reserva"
            value={a.precioReserva}
            type="number"
            prefix="$"
            onChange={v => updateAjustes({ precioReserva: Number(v) })}
          />
          <RowEdit
            label="Fecha límite pronto pago"
            value={a.fechaProntoPago}
            onChange={v => updateAjustes({ fechaProntoPago: v })}
          />
        </Section>

        {/* Capacidad */}
        <Section title="Capacidad y bonos">
          <RowEdit
            label="Cupos totales"
            value={a.capacidad}
            type="number"
            onChange={v => updateAjustes({ capacidad: Number(v) })}
          />
          <RowEdit
            label="Cupos bono silla"
            value={a.bonoSillaCupos}
            type="number"
            onChange={v => updateAjustes({ bonoSillaCupos: Number(v) })}
          />
        </Section>

        {/* Días */}
        <Section title="Días del programa">
          <div style={{ padding: '0 16px' }}>
            {a.diasFormacion.map(d => (
              <div key={d.idx} className="row" style={{ padding: '12px 0' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bg-warm)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="serif" style={{ fontSize: 13, lineHeight: 1 }}>{d.fecha.split(' ')[0]}</span>
                  <span style={{ fontSize: 8, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>{d.fecha.split(' ')[1]}</span>
                </div>
                <div className="body">
                  <div className="t1">{d.label}</div>
                  <div className="t2">Encuentro {d.encuentro}</div>
                </div>
                <button onClick={() => setEditingDay(d.idx)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--terracota)', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
                }}>Editar</button>
              </div>
            ))}
          </div>
        </Section>

        {/* Material compartible (PDF programa) */}
        <Section title="Material para compartir">
          <MaterialPdfCard store={store} />
        </Section>

        {/* Plantillas WhatsApp */}
        <Section title="Plantillas WhatsApp">
          <div style={{ padding: '0 16px' }}>
            {a.plantillasWA.filter(p => !p.id.startsWith('__')).map(p => (
              <div key={p.id} className="row" style={{ padding: '12px 0', alignItems: 'flex-start' }}>
                <div className="body">
                  <div className="t1">{p.titulo}</div>
                  <div className="t2" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.cuerpo}</div>
                </div>
                <button onClick={() => setEditing(p.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--terracota)', fontSize: 12, fontFamily: 'inherit', fontWeight: 500, marginTop: 2,
                }}>Editar</button>
              </div>
            ))}
          </div>
        </Section>

        {/* Link público de comprobantes */}
        <Section title="Link público para comprobantes">
          <ComprobanteLinkCard />
        </Section>

        {/* Datos */}
        <Section title="Datos">
          <div style={{ padding: '0 22px 6px', fontSize: 12, color: 'var(--ink-mute)' }}>
            {state.alumnas.length} estudiantes · {state.leads.length} leads
          </div>
        </Section>

        <div style={{ height: 60 }} />
      </div>

      {/* Sheet: editar plantilla */}
      <PlantillaSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        plantilla={a.plantillasWA.find(p => p.id === editing)}
        onSave={(np) => {
          // Filtramos virtuales antes de persistir, para que Supabase nunca
          // reciba la plantilla "Programa PDF" que se inyecta en runtime.
          updateAjustes({
            plantillasWA: a.plantillasWA
              .filter(p => !p.id.startsWith('__'))
              .map(p => p.id === np.id ? np : p),
          });
          setEditing(null);
        }}
      />

      {/* Sheet: editar día */}
      <DiaSheet
        open={editingDay !== null}
        onClose={() => setEditingDay(null)}
        dia={a.diasFormacion.find(d => d.idx === editingDay)}
        onSave={(nd) => { updateDia(nd.idx, nd); setEditingDay(null); }}
      />
    </div>
  );
};

const Section = ({ title, children }) => (
  <div style={{ padding: '0 22px', marginTop: 18 }}>
    <div style={{
      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--ink-mute)', fontWeight: 500, marginBottom: 8, paddingLeft: 4,
    }}>{title}</div>
    <div className="card flat" style={{ padding: '4px 0' }}>
      {children}
    </div>
  </div>
);

const RowEdit = ({ label, value, onChange, type = 'text', prefix }) => {
  const [editing, setEditing] = React.useState(false);
  const [tmp, setTmp] = React.useState(value);
  React.useEffect(() => setTmp(value), [value]);
  const commit = () => { onChange(tmp); setEditing(false); };
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '11px 16px',
      borderBottom: '1px solid var(--line-soft)',
      gap: 10,
    }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-soft)' }}>{label}</div>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={tmp ?? ''}
          onChange={e => setTmp(type === 'number' ? Number(e.target.value) : e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          style={{
            border: '1px solid var(--terracota)', background: 'var(--bg)',
            borderRadius: 8, padding: '4px 8px',
            fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)',
            width: 130, textAlign: 'right', outline: 'none',
          }}
        />
      ) : (
        <button onClick={() => setEditing(true)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', fontWeight: 500,
        }}>{prefix}{value}</button>
      )}
    </div>
  );
};

const PlantillaSheet = ({ open, onClose, plantilla, onSave }) => {
  const [form, setForm] = React.useState(plantilla);
  React.useEffect(() => setForm(plantilla), [plantilla, open]);
  if (!plantilla) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Editar plantilla"
      footer={<button className="btn btn-primary btn-block" onClick={() => onSave(form)}>Guardar</button>}
    >
      <Field label="Título"><TextInput value={form?.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} /></Field>
      <Field label="Mensaje" hint="Esto se enviará por WhatsApp">
        <TextArea value={form?.cuerpo} onChange={v => setForm(f => ({ ...f, cuerpo: v }))} rows={6} />
      </Field>
    </Sheet>
  );
};

const DiaSheet = ({ open, onClose, dia, onSave }) => {
  const [form, setForm] = React.useState(dia);
  React.useEffect(() => setForm(dia), [dia, open]);
  if (!dia) return null;
  return (
    <Sheet open={open} onClose={onClose} title={`Día ${dia.idx + 1}`}
      footer={<button className="btn btn-primary btn-block" onClick={() => onSave(form)}>Guardar</button>}
    >
      <Field label="Fecha (ej. '6 jun')"><TextInput value={form?.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} /></Field>
      <Field label="Etiqueta (ej. 'Día 1')"><TextInput value={form?.label} onChange={v => setForm(f => ({ ...f, label: v }))} /></Field>
      <Field label="Encuentro"><NumberInput value={form?.encuentro} onChange={v => setForm(f => ({ ...f, encuentro: v }))} min={1} max={6} /></Field>
    </Sheet>
  );
};

// Card que muestra el link público de comprobantes y permite copiarlo
const ComprobanteLinkCard = () => {
  const link = `${window.location.origin}/comprobante`;
  const [copiado, setCopiado] = React.useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };
  const compartirWa = () => {
    const msg = `Hola! Te paso el link para subir tu comprobante de pago de la formación. Es seguro y solo Sofía verá tus datos:\n\n${link}\n\n🌿`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  return (
    <div style={{ padding: '0 22px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.45 }}>
        Comparte este link con cualquier cliente que vaya a pagar. Sube su comprobante (foto o PDF) y lo verás en la sección Comprobantes de Pagos. Es reusable y no requiere que el cliente cree cuenta.
      </div>
      <div style={{
        background: 'var(--surface)', padding: '8px 12px', borderRadius: 10,
        border: '1px solid var(--line-soft)',
        fontSize: 11, color: 'var(--ink)', wordBreak: 'break-all',
        fontFamily: 'monospace',
      }}>
        {link}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={copiar} style={{
          flex: 1, padding: '9px 12px', borderRadius: 10,
          background: copiado ? 'var(--oliva)' : 'var(--surface)',
          color: copiado ? '#fff' : 'var(--ink)',
          border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
        <button onClick={compartirWa} style={{
          flex: 1, padding: '9px 12px', borderRadius: 10,
          background: '#25D366', color: '#fff',
          border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>Compartir por WhatsApp</button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// MaterialPdfCard — sube el PDF del programa a Supabase Storage
// (bucket `material`) y guarda la URL pública en ajustes.materialProgramaUrl.
// La plantilla "Programa PDF" usa esa URL automáticamente.
// ──────────────────────────────────────────
const MaterialPdfCard = ({ store }) => {
  const url = store.state.ajustes.materialProgramaUrl || '';
  const nombre = store.state.ajustes.materialProgramaNombre || '';
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copiado, setCopiado] = React.useState(false);
  const fileRef = React.useRef(null);

  const subir = async (file) => {
    if (!file) return;
    if (!file.type.includes('pdf')) {
      setError('Solo se aceptan PDFs.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('El PDF supera los 25 MB. Comprímelo antes de subir.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      // Path fijo para que la URL no cambie cuando se actualiza el archivo.
      const path = 'programa.pdf';
      const { error: upErr } = await supabase.storage
        .from('material')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw upErr;
      // Obtener URL pública (bucket es público de lectura)
      const { data } = supabase.storage.from('material').getPublicUrl(path);
      // Cache-buster para que las plantillas siempre traigan la última versión
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
      store.updateAjustes({
        materialProgramaUrl: publicUrl,
        materialProgramaNombre: file.name,
      });
    } catch (e) {
      console.error('[material upload]', e);
      setError(e.message || 'Error al subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  };

  return (
    <div style={{ padding: '6px 16px 0' }}>
      <div className="card flat" style={{ padding: 14 }}>
        {url ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--terracota-tint)', color: '#8A3D26',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              }}>PDF</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                  {nombre || 'Programa de la formación'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                  Disponible en la plantilla "Programa PDF"
                </div>
              </div>
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-soft)',
              padding: '8px 10px', background: 'var(--bg-warm)', borderRadius: 8,
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>{url}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={copiar} style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                background: copiado ? 'var(--oliva)' : 'var(--surface)',
                color: copiado ? '#fff' : 'var(--ink)',
                border: '1px solid ' + (copiado ? 'transparent' : 'var(--line-soft)'),
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                background: 'var(--surface)', color: 'var(--ink)',
                border: '1px solid var(--line-soft)',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
              }}>{uploading ? 'Subiendo…' : 'Reemplazar'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>Sin PDF cargado.</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 12, lineHeight: 1.4 }}>
              Sube el PDF del programa para activar la plantilla automática que envía el link a leads e inscritos.
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              background: 'var(--terracota)', color: '#fff', border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
            }}>{uploading ? 'Subiendo…' : 'Subir PDF'}</button>
          </>
        )}
        {error && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--rojo)' }}>{error}</div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};

window.AjustesScreen = AjustesScreen;
