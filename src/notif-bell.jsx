import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ──────────────────────────────────────────────────────────────
// Campana de novedades del inicio.
//
// Muestra lo que pasó en los proyectos a los que la persona tiene acceso
// (la RLS ya filtra: Micaela sólo ve el Seminario). El contador rojo son
// los eventos posteriores a la última vez que abrió la campana.
//
// Complementa al push: si alguien no activó las notificaciones del sistema,
// igual se entera al entrar.
// ──────────────────────────────────────────────────────────────

const KEY_VISTO = 'notifUltimaVista';
const ACCIONES = ['creo', 'pago', 'cambio_estado', 'nota', 'mensaje', 'asigno'];

const fechaCorta = (iso) => {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) + ' ' + hora;
  } catch { return ''; }
};

const NotifBell = () => {
  const Icon = window.Icon;
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [ultimaVista, setUltimaVista] = useState(() => {
    try { return localStorage.getItem(KEY_VISTO) || '1970-01-01'; } catch { return '1970-01-01'; }
  });

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('actividad')
      .select('id, titulo, accion, actor_nombre, actor_email, created_at, proyecto_id')
      .in('accion', ACCIONES)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setEventos(data || []);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel('notif-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, cargar)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible); };
  }, [cargar]);

  const nuevos = eventos.filter(e => e.created_at > ultimaVista).length;

  const abrir = () => {
    setAbierto(true);
    const ahora = new Date().toISOString();
    try { localStorage.setItem(KEY_VISTO, ahora); } catch {}
    setTimeout(() => setUltimaVista(ahora), 600); // deja ver cuáles eran nuevos
  };

  return (
    <>
      <button
        onClick={abrir}
        aria-label="Novedades"
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: '50%',
          background: 'var(--surface)', border: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {Icon ? <Icon name="bell" size={17} stroke="var(--ink-soft)" /> : '🔔'}
        {nuevos > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, background: 'var(--terracota)', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
            border: '2px solid var(--bg)',
          }}>{nuevos > 9 ? '9+' : nuevos}</span>
        )}
      </button>

      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxHeight: '75vh', background: 'var(--bg)',
              borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '18px 20px 10px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: 0, color: 'var(--ink)' }}>
                  Novedades
                </h3>
                <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: '12px 20px 30px' }}>
              {eventos.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: '20px 0', textAlign: 'center' }}>
                  Todo tranquilo por aquí ✨
                </div>
              )}
              {eventos.map(ev => {
                const esNuevo = ev.created_at > ultimaVista;
                const quien = (ev.actor_nombre || ev.actor_email || 'Alguien').split(/[\s@]/)[0];
                return (
                  <div key={ev.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 12px', marginBottom: 6, borderRadius: 12,
                    background: esNuevo ? 'var(--terracota-tint)' : 'transparent',
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: esNuevo ? 'var(--terracota)' : 'var(--line)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.35 }}>
                        <strong style={{ fontWeight: 600 }}>{quien}</strong> {ev.titulo || ev.accion}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{fechaCorta(ev.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

window.NotifBell = NotifBell;
export { NotifBell };
