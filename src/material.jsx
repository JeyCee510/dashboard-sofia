import React from 'react';
import { supabase } from './lib/supabase.js';
import { buildWaUrl } from './lib/wa.js';

// ──────────────────────────────────────────────────────────────
// Material compartible del proyecto (brochure, flyers, posts).
//
// Vive en `ajustes.material` como una lista:
//   [{ id, titulo, url, tipo: 'pdf'|'imagen', nombreArchivo, path }]
// Los archivos van al bucket Storage `material`, bajo `proyecto-<id>/`, para
// que un proyecto no pise el archivo de otro (el card viejo del programa
// subía siempre a `programa.pdf`, compartido por todos).
//
// Desde la ficha del lead se manda por WhatsApp (link), se copia o se abre
// la hoja de compartir del sistema (que sí permite mandar el archivo por
// cualquier app). WhatsApp Web no acepta adjuntos por URL: por eso el
// mensaje lleva el link, que en el teléfono abre el PDF directo.
// ──────────────────────────────────────────────────────────────

const BUCKET = 'material';
const MAX_MB = 25;

export function materialDeAjustes(ajustes) {
  const lista = ajustes?.material;
  if (Array.isArray(lista) && lista.length) return lista.filter(m => m && m.url);
  // Compatibilidad: proyectos que sólo tienen el PDF del programa de antes.
  if (ajustes?.materialProgramaUrl) {
    return [{
      id: 'programa',
      titulo: ajustes.materialProgramaNombre || 'Programa (PDF)',
      url: ajustes.materialProgramaUrl,
      tipo: 'pdf',
    }];
  }
  return [];
}

// Mensaje con el que se comparte una pieza de material.
export function mensajeMaterial(item, nombre) {
  const primer = (nombre || '').split(' ')[0];
  const saludo = primer ? `${primer}, te comparto` : 'Te comparto';
  return `${saludo} ${item.titulo} 🌿\n\n${item.url}`;
}

const iconoTipo = (tipo) => (tipo === 'imagen' ? 'IMG' : 'PDF');

// ──────────────────────────────────────────────────────────────
// MaterialPanel — se muestra en la ficha del lead / de la inscrita.
// ──────────────────────────────────────────────────────────────
export const MaterialPanel = ({ ajustes, nombre, tel }) => {
  const items = materialDeAjustes(ajustes);
  const [copiado, setCopiado] = React.useState(null);
  const [abierto, setAbierto] = React.useState(false);
  const Icon = window.Icon; // se lee en render: main.jsx carga los módulos en paralelo

  if (!items.length) return null;

  const copiar = async (item) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiado(item.id);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* navegador sin clipboard: queda el botón de compartir */ }
  };

  const compartir = (item) => {
    // navigator.share debe dispararse en el gesto del usuario, sin await previo.
    if (!navigator.share) { copiar(item); return; }
    navigator.share({
      title: item.titulo,
      text: mensajeMaterial(item, nombre),
      url: item.url,
    }).catch(() => { /* el usuario canceló */ });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line-soft)',
          fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon name="note" size={14} stroke="var(--terracota)" />}
          Enviar material ({items.length})
        </span>
        {Icon && <Icon name="chevronD" size={14} stroke="var(--ink-mute)" />}
      </button>

      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 6, marginTop: 8 }}>
          {items.map(item => {
            const waUrl = buildWaUrl(tel, mensajeMaterial(item, nombre));
            return (
              <div key={item.id} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--bg-warm)', border: '1px solid var(--line-soft)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.tipo === 'imagen' ? (
                    <img src={item.url} alt="" style={{
                      width: 34, height: 34, borderRadius: 7, objectFit: 'cover',
                      border: '1px solid var(--line-soft)', flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                      background: 'var(--terracota-tint)', color: '#8A3D26',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>{iconoTipo(item.tipo)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>
                    {item.titulo}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8,
                      background: '#25D366', color: '#fff',
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                      textDecoration: 'none', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      {Icon && <Icon name="whatsapp" size={11} stroke="#fff" />}
                      WhatsApp
                    </a>
                  )}
                  <button type="button" onClick={() => compartir(item)} style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8,
                    background: 'var(--surface)', border: '1px solid var(--line-soft)',
                    fontFamily: 'inherit', fontSize: 11, color: 'var(--ink)', cursor: 'pointer',
                  }}>Compartir</button>
                  <button type="button" onClick={() => copiar(item)} style={{
                    padding: '7px 10px', borderRadius: 8,
                    background: copiado === item.id ? 'var(--oliva)' : 'var(--surface)',
                    color: copiado === item.id ? '#fff' : 'var(--ink-soft)',
                    border: '1px solid ' + (copiado === item.id ? 'transparent' : 'var(--line-soft)'),
                    fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
                  }}>{copiado === item.id ? '✓' : 'Link'}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// MaterialAdminCard — alta/baja del material desde Ajustes.
// ──────────────────────────────────────────────────────────────
export const MaterialAdminCard = ({ store }) => {
  const items = materialDeAjustes(store.state.ajustes);
  const [subiendo, setSubiendo] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileRef = React.useRef(null);

  const guardar = (lista) => store.updateAjustes({ material: lista });

  const subir = async (file) => {
    if (!file) return;
    const esPdf = file.type.includes('pdf');
    const esImg = file.type.startsWith('image/');
    if (!esPdf && !esImg) { setError('Solo PDFs o imágenes.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera los ${MAX_MB} MB. Comprímelo antes de subir.`);
      return;
    }
    setSubiendo(true);
    setError('');
    try {
      const proyectoId = window.PROYECTO_ID || 2;
      const ext = (file.name.split('.').pop() || (esPdf ? 'pdf' : 'jpg')).toLowerCase();
      const base = file.name.replace(/\.[^.]+$/, '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'archivo';
      const path = `proyecto-${proyectoId}/${Date.now()}-${base}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const nuevo = {
        id: `m${Date.now()}`,
        titulo: file.name.replace(/\.[^.]+$/, ''),
        url: data.publicUrl,
        tipo: esPdf ? 'pdf' : 'imagen',
        nombreArchivo: file.name,
        path,
      };
      guardar([...items, nuevo]);
    } catch (e) {
      console.error('[material] subir', e);
      setError(e.message || 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  const renombrar = (item) => {
    const t = prompt('Nombre con el que lo verás al enviarlo:', item.titulo);
    if (t === null) return;
    const limpio = t.trim();
    if (!limpio) return;
    guardar(items.map(m => m.id === item.id ? { ...m, titulo: limpio } : m));
  };

  const quitar = async (item) => {
    if (!confirm(`¿Quitar "${item.titulo}" del material?`)) return;
    guardar(items.filter(m => m.id !== item.id));
    // El archivo sólo se borra si lo subimos nosotros (tiene path conocido).
    if (item.path) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove([item.path]);
      if (delErr) console.warn('[material] no se pudo borrar el archivo', delErr);
    }
  };

  return (
    <div style={{ padding: '6px 16px 0' }}>
      <div className="card flat" style={{ padding: 14 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 12, lineHeight: 1.4 }}>
            Sube el brochure, flyers o posts. Aparecerán en la ficha de cada lead
            con un botón para mandarlos por WhatsApp.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.tipo === 'imagen' ? (
                  <img src={item.url} alt="" style={{
                    width: 34, height: 34, borderRadius: 7, objectFit: 'cover',
                    border: '1px solid var(--line-soft)', flexShrink: 0,
                  }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                    background: 'var(--terracota-tint)', color: '#8A3D26',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                  }}>{iconoTipo(item.tipo)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, color: 'var(--ink)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{item.titulo}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                    {item.tipo === 'imagen' ? 'Imagen' : 'PDF'}
                  </div>
                </div>
                <button onClick={() => renombrar(item)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--terracota)', fontSize: 11.5, fontFamily: 'inherit',
                }}>Renombrar</button>
                <button onClick={() => quitar(item)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-mute)', fontSize: 14, fontFamily: 'inherit', padding: '0 2px',
                }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => fileRef.current?.click()} disabled={subiendo} style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          background: 'var(--terracota)', color: '#fff', border: 'none',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
          cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo ? 0.6 : 1,
        }}>{subiendo ? 'Subiendo…' : '+ Subir PDF o imagen'}</button>

        {error && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--rojo)' }}>{error}</div>}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};

window.MaterialPanel = MaterialPanel;
window.MaterialAdminCard = MaterialAdminCard;
