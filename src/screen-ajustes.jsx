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

        {/* Precios — en proyectos por sede (Seminario) la estructura es una
            matriz, no tres números sueltos: se muestra en modo lectura para no
            dar la falsa impresión de que editando aquí cambia algo. */}
        {a.matrizPrecios ? (
          <Section title="Precios por encuentro">
            <div style={{ padding: '12px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0 4px 6px', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Viene a</th>
                    {(a.sedes || []).map(s => (
                      <th key={s.n} style={{ textAlign: 'right', padding: '0 4px 6px', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                        {(s.lugar || s.nombre).split(',')[0].split('·')[0].trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: '3', l: 'los 3' }, { k: '2', l: '2' },
                    { k: '1_pp', l: '1 · pronto pago' }, { k: '1', l: '1 · regular' },
                  ].map(f => (
                    <tr key={f.k} style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '6px 4px', color: 'var(--ink)' }}>{f.l}</td>
                      {(a.sedes || []).map(s => (
                        <td key={s.n} style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                          ${(a.matrizPrecios[f.k] || {})[String(s.n)] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                Pronto pago hasta {a.fechaProntoPago || '—'}.
                {a.reservaPorSede && (
                  <> · Apartar cupo: {Object.entries(a.reservaPorSede).filter(([, v]) => v).map(([k, v]) => {
                    const s = (a.sedes || []).find(x => String(x.n) === k);
                    return `${s ? (s.lugar || s.nombre).split(',')[0].split('·')[0].trim() : k} $${v}`;
                  }).join(' · ')}</>
                )}
              </div>
              <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                Para cambiar estos valores, pídeselo a Juan Cristóbal.
              </div>
            </div>
          </Section>
        ) : (
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
        )}

        {/* Capacidad — por sede si el proyecto las tiene */}
        {a.cuposPorSede ? (
          <Section title="Cupos por encuentro">
            {(a.sedes || []).map(s => (
              <RowEdit
                key={s.n}
                label={(s.lugar || s.nombre).split(',')[0].split('·')[0].trim()}
                value={a.cuposPorSede[String(s.n)] ?? 0}
                type="number"
                onChange={v => updateAjustes({
                  cuposPorSede: { ...a.cuposPorSede, [String(s.n)]: Number(v) },
                })}
              />
            ))}
          </Section>
        ) : (
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
        )}

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
              <div key={p.id} className="row" style={{ padding: '12px 0', alignItems: 'flex-start', gap: 10 }}>
                {p.imagen_url && (
                  <img
                    src={p.imagen_url}
                    alt=""
                    style={{
                      width: 38, height: 38, borderRadius: 8, objectFit: 'cover',
                      border: '1px solid var(--line-soft)', flexShrink: 0,
                    }}
                  />
                )}
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
          <div style={{ padding: '8px 16px 4px' }}>
            <button
              type="button"
              onClick={() => setEditing('__nueva__')}
              className="btn btn-ghost btn-block"
              style={{ fontSize: 13 }}
            >
              + Nueva plantilla
            </button>
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

      {/* Sheet: editar/crear plantilla */}
      <PlantillaSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        plantilla={
          editing === '__nueva__'
            ? { id: `tpl_${Date.now()}`, titulo: '', cuerpo: '', imagen_url: '', _nueva: true }
            : a.plantillasWA.find(p => p.id === editing)
        }
        onSave={(np) => {
          // Filtramos virtuales (las que se inyectan en runtime) antes de
          // persistir. _nueva es flag interna del sheet, también la quitamos.
          const limpia = { ...np };
          delete limpia._nueva;
          const sinVirtuales = a.plantillasWA.filter(p => !p.id.startsWith('__'));
          const existe = sinVirtuales.some(p => p.id === limpia.id);
          updateAjustes({
            plantillasWA: existe
              ? sinVirtuales.map(p => p.id === limpia.id ? limpia : p)
              : [...sinVirtuales, limpia],
          });
          setEditing(null);
        }}
        onDelete={
          editing && editing !== '__nueva__'
            ? () => {
                if (!confirm('¿Borrar esta plantilla? No se puede recuperar.')) return;
                updateAjustes({
                  plantillasWA: a.plantillasWA
                    .filter(p => !p.id.startsWith('__') && p.id !== editing),
                });
                setEditing(null);
              }
            : null
        }
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

const PlantillaSheet = ({ open, onClose, plantilla, onSave, onDelete }) => {
  const [form, setForm] = React.useState(plantilla);
  const [subiendo, setSubiendo] = React.useState(false);
  const [errorImg, setErrorImg] = React.useState('');
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    setForm(plantilla);
    setErrorImg('');
  }, [plantilla, open]);
  if (!plantilla) return null;

  // Subir imagen (JPG/PNG) al bucket `material/plantillas/<random>.<ext>` y
  // guardar la URL pública en la plantilla. WhatsApp/IG mostrarán preview
  // automáticamente cuando el cuerpo del mensaje incluye la URL.
  const subirImagen = async (file) => {
    if (!file) return;
    const tipoOk = file.type.startsWith('image/');
    if (!tipoOk) {
      setErrorImg('Solo imágenes (JPG o PNG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorImg('Imagen supera 5 MB.');
      return;
    }
    setSubiendo(true);
    setErrorImg('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `plantillas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('material')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('material').getPublicUrl(path);
      setForm(f => ({ ...f, imagen_url: data.publicUrl }));
    } catch (e) {
      console.error('[plantilla img]', e);
      setErrorImg(e.message || 'Error al subir.');
    } finally {
      setSubiendo(false);
    }
  };

  const titulo = plantilla._nueva ? 'Nueva plantilla' : 'Editar plantilla';
  const ok = (form?.titulo || '').trim() && (form?.cuerpo || '').trim();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titulo}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {onDelete && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--rojo)', borderColor: '#E5C8C0' }}
              onClick={onDelete}
            >Borrar</button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => onSave(form)}
            disabled={!ok}
          >
            {plantilla._nueva ? 'Crear plantilla' : 'Guardar'}
          </button>
        </div>
      }
    >
      <Field label="Título"><TextInput value={form?.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} placeholder="Ej. Bienvenida" /></Field>
      <Field label="Mensaje" hint="Esto se enviará por WhatsApp/Instagram. Usa salto de línea con Enter.">
        <TextArea value={form?.cuerpo} onChange={v => setForm(f => ({ ...f, cuerpo: v }))} rows={6} />
      </Field>
      <Field label="Imagen adjunta (opcional)" hint="WhatsApp y Instagram muestran preview automático cuando el mensaje incluye una URL de imagen.">
        {form?.imagen_url ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 10, borderRadius: 10,
            background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
          }}>
            <img
              src={form.imagen_url}
              alt=""
              style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
            />
            <div style={{ flex: 1, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.4 }}>
              Imagen cargada. Aparecerá como preview en el chat al enviar.
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, imagen_url: '' }))}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--ink-mute)', padding: 4, fontSize: 18,
              }}
            >×</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              background: 'var(--surface)', border: '1px dashed var(--line-soft)',
              fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-soft)',
              cursor: 'pointer',
            }}
          >
            {subiendo ? 'Subiendo…' : '📎 Adjuntar imagen'}
          </button>
        )}
        {errorImg && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--rojo)' }}>{errorImg}</div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { subirImagen(e.target.files?.[0]); e.target.value = ''; }}
        />
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
