import React from 'react';

const { useState, useMemo } = React;

// ─────────────────────────────────────────────────────────────────
// EstudioAsistencia — overlay para tomar asistencia a una clase
//
// Flujo:
//   1. Sofía abre la pantalla → ve clases recientes (últimas 14 días)
//   2. Toca una clase existente o "+ Nueva clase" (ad-hoc: fecha + hora + nombre)
//   3. Dentro de una clase: checklist de estudiantes activas
//   4. Cada toggle dispara `marcarAsistencia` (o `borrarAsistencia` si revierte)
//   5. El trigger AFTER INSERT/DELETE en BD descuenta/restaura clases del paquete
//
// La membresía activa se autodetecta por la RPC. UI muestra "X/Y clases".
// ─────────────────────────────────────────────────────────────────

function EstudioAsistencia({ open, onClose, store }) {
  const e = store.estudio || {};
  const [vista, setVista] = useState('lista'); // 'lista' | 'clase'
  const [claseSel, setClaseSel] = useState(null);
  const [creandoClase, setCreandoClase] = useState(false);

  if (!open) return null;

  // Clases recientes (últimas 14 días)
  const hoyStr = new Date().toISOString().slice(0, 10);
  const hace14 = new Date(); hace14.setDate(hace14.getDate() - 14);
  const hace14Str = hace14.toISOString().slice(0, 10);
  const clasesRecientes = (e.clases || [])
    .filter(c => c.fecha >= hace14Str && c.fecha <= hoyStr)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const handleSelectClase = (clase) => {
    setClaseSel(clase);
    setVista('clase');
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={ev => ev.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 8px' }}>
          {vista === 'clase' && (
            <button onClick={() => { setVista('lista'); setClaseSel(null); }} style={btnBack}>← Volver</button>
          )}
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, flex: 1, textAlign: vista === 'clase' ? 'center' : 'left' }}>
            {vista === 'lista' ? 'Asistencia' : tituloClase(claseSel)}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={btnClose}>×</button>
        </div>

        {vista === 'lista' && (
          <ListaClases
            clasesRecientes={clasesRecientes}
            onSelectClase={handleSelectClase}
            onCrearClase={() => setCreandoClase(true)}
            asistenciaPorClase={e.asistenciaPorClase}
          />
        )}

        {vista === 'clase' && claseSel && (
          <DentroDeClase clase={claseSel} store={store} onClose={onClose} />
        )}

        {/* Sub-sheet: crear nueva clase */}
        {creandoClase && (
          <CrearClaseSheet
            onClose={() => setCreandoClase(false)}
            onCreada={(clase) => {
              setCreandoClase(false);
              handleSelectClase(clase);
            }}
            store={store}
          />
        )}
      </div>
    </div>
  );
}

// ─── Lista de clases recientes ───
function ListaClases({ clasesRecientes, onSelectClase, onCrearClase, asistenciaPorClase }) {
  return (
    <div style={{ padding: '8px 18px 24px' }}>
      <button onClick={onCrearClase} style={{
        width: '100%', padding: '14px',
        borderRadius: 12, border: '2px dashed var(--line)',
        background: '#fff', color: 'var(--terracota)',
        fontSize: 14, fontWeight: 500, cursor: 'pointer',
        marginBottom: 14,
      }}>
        + Nueva clase
      </button>

      {clasesRecientes.length === 0 ? (
        <div style={{
          padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)',
          background: 'var(--bg-soft)', borderRadius: 12,
        }}>
          Sin clases recientes.<br />Crea la primera para tomar asistencia.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Últimas clases
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {clasesRecientes.map((c, i) => {
              const asistentes = (asistenciaPorClase?.get(c.id) || []).filter(a => a.presente).length;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectClase(c)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderBottom: i < clasesRecientes.length - 1 ? '1px solid var(--line)' : 'none',
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre || 'Clase sin nombre'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {formateaFecha(c.fecha)}{c.horaInicio ? ` · ${c.horaInicio.slice(0, 5)}` : ''}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 999,
                    background: asistentes > 0 ? '#dcfce7' : 'var(--bg-soft)',
                    color: asistentes > 0 ? '#15803d' : 'var(--ink-soft)',
                    fontSize: 11, fontWeight: 500,
                  }}>
                    {asistentes} asistente{asistentes === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Vista dentro de una clase: checklist ───
function DentroDeClase({ clase, store, onClose }) {
  const e = store.estudio;
  const [filtro, setFiltro] = useState(''); // búsqueda

  const estudiantesActivas = (e.estudiantesActivas || [])
    .filter(est => est.nombre.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Mapa de asistencias actuales para esta clase
  const asistenciasClase = e.asistenciaPorClase?.get(clase.id) || [];
  const presenciaPorEst = useMemo(() => {
    const m = new Map();
    for (const a of asistenciasClase) m.set(a.estudianteId, a);
    return m;
  }, [asistenciasClase]);

  const handleToggle = async (estudianteId) => {
    const a = presenciaPorEst.get(estudianteId);
    try {
      if (a) {
        // ya está → quitar
        await e.borrarAsistencia(a.id);
      } else {
        // no está → marcar
        await e.marcarAsistencia({
          estudianteId,
          claseRealizadaId: clase.id,
          // membresiaId se autodetecta en la RPC
        });
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const totalPresentes = asistenciasClase.filter(a => a.presente).length;

  return (
    <div style={{ padding: '0 18px 24px' }}>
      {/* Resumen */}
      <div style={{
        padding: 12, borderRadius: 10, marginBottom: 12,
        background: 'var(--bg-soft)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 13 }}>
          <strong>{totalPresentes}</strong> presente{totalPresentes === 1 ? '' : 's'}
          <span style={{ color: 'var(--ink-soft)' }}> de {estudiantesActivas.length} activas</span>
        </div>
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar estudiante…"
        value={filtro}
        onChange={ev => setFiltro(ev.target.value)}
        style={{
          width: '100%', padding: '10px 12px', boxSizing: 'border-box',
          borderRadius: 10, border: '1px solid var(--line)',
          background: '#fff', fontSize: 13, marginBottom: 10,
          outline: 'none',
        }}
      />

      {/* Checklist */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
        {estudiantesActivas.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
            Sin estudiantes activas
          </div>
        ) : estudiantesActivas.map((est, i) => {
          const a = presenciaPorEst.get(est.id);
          const presente = a?.presente;
          const m = e.getMembresiaActiva ? e.getMembresiaActiva(est.id) : null;
          const clasesRest = m && e.clasesRestantes ? e.clasesRestantes(m) : null;

          return (
            <button
              key={est.id}
              onClick={() => handleToggle(est.id)}
              style={{
                width: '100%', padding: '12px 14px',
                borderBottom: i < estudiantesActivas.length - 1 ? '1px solid var(--line)' : 'none',
                background: presente ? '#f0fdf4' : 'transparent',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              {/* Checkbox visual */}
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                border: `2px solid ${presente ? '#16a34a' : 'var(--line)'}`,
                background: presente ? '#16a34a' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {presente && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
              </div>

              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: est.avatar || 'var(--bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 500, flexShrink: 0,
              }}>
                {est.iniciales}
              </div>

              {/* Datos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: presente ? 500 : 400, color: 'var(--ink)' }}>
                  {est.nombre}
                </div>
                {m && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>
                    {clasesRest != null ? `${clasesRest} clase${clasesRest === 1 ? '' : 's'} restante${clasesRest === 1 ? '' : 's'}` : 'ilimitado'}
                  </div>
                )}
                {!m && (
                  <div style={{ fontSize: 11, color: 'var(--terracota)', marginTop: 1 }}>
                    Sin plan activo
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: 10, fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.5 }}>
        Toca un nombre para marcar/quitar asistencia.<br />
        Las clases se descuentan automáticamente del paquete activo.
      </div>
    </div>
  );
}

// ─── Sub-sheet: crear nueva clase ad-hoc ───
function CrearClaseSheet({ onClose, onCreada, store }) {
  const e = store.estudio;
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    try {
      const id = await e.addClase({ fecha, horaInicio, nombre: nombre.trim() || `Clase ${formateaFecha(fecha)}` });
      const claseCreada = (e.clases || []).find(c => c.id === id) || { id, fecha, horaInicio, nombre };
      onCreada(claseCreada);
    } catch (err) {
      alert('Error: ' + err.message);
      setEnviando(false);
    }
  };

  return (
    <div style={subSheetBackdrop} onClick={onClose}>
      <div style={subSheet} onClick={ev => ev.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontFamily: 'Cormorant Garamond, serif' }}>Nueva clase</h3>

        <Field label="Nombre">
          <input type="text" value={nombre} onChange={ev => setNombre(ev.target.value)}
            placeholder="Ej: Hatha 7am" style={input} autoFocus />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={ev => setFecha(ev.target.value)} style={input} />
          </Field>
          <Field label="Hora">
            <input type="time" value={horaInicio} onChange={ev => setHoraInicio(ev.target.value)} style={input} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--bg-soft)', color: 'var(--ink)' }}>Cancelar</button>
          <button onClick={guardar} disabled={enviando} style={{
            ...btn, flex: 2,
            background: enviando ? 'var(--bg-soft)' : 'var(--terracota)',
            color: enviando ? 'var(--ink-soft)' : '#fff',
          }}>{enviando ? 'Creando…' : 'Crear y tomar asistencia'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───
function tituloClase(c) {
  if (!c) return '';
  return (c.nombre || `Clase ${formateaFecha(c.fecha)}`)
    + (c.horaInicio ? ` · ${c.horaInicio.slice(0, 5)}` : '');
}

function formateaFecha(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]}`;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
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
const input = {
  width: '100%', padding: '10px 12px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--bg-soft)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const btn = {
  padding: '12px', borderRadius: 12,
  border: 'none', fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
};
const btnClose = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--bg-soft)', border: 'none',
  fontSize: 22, cursor: 'pointer', color: 'var(--ink-soft)',
  lineHeight: 1, flexShrink: 0,
};
const btnBack = {
  background: 'transparent', border: 'none',
  fontSize: 13, color: 'var(--terracota)',
  cursor: 'pointer', padding: '4px 4px 4px 0',
  marginRight: 8,
};

window.EstudioAsistencia = EstudioAsistencia;
export { EstudioAsistencia };
