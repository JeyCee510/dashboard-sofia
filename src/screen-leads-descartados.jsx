import React from 'react';
import { supabase } from './lib/supabase.js';

const { useState, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// LeadsDescartadosScreen — leads con estado='no_interesado'.
// Soft delete: quedan en la misma tabla `leads` (compartida con el módulo
// estudio). Sólo cambia el estado. Sofía puede restaurar (estado='nuevo')
// o purgar definitivo (delete → trigger archive en leads_archive).
// ─────────────────────────────────────────────────────────────────────

const LeadsDescartadosScreen = ({ onClose, onOpenLead }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('estado', 'no_interesado')
      .order('updated_at', { ascending: false });
    if (error) console.error('[descartados] load', error);
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel('leads-descartados')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  const restaurar = async (id) => {
    setBusy(id);
    try {
      await supabase.from('leads').update({ estado: 'nuevo' }).eq('id', id);
    } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  const purgar = async (id, nombre) => {
    if (!confirm(`¿Borrar definitivamente a "${nombre}"?\n\nIrá a la papelera de Borrados, desde donde puedes recuperarlo si te equivocas.`)) return;
    setBusy(id);
    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) { alert('Error: ' + e.message); }
    setBusy(null);
  };

  return (
    <div className="detail-screen" style={{ background: 'var(--bg)' }}>
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Leads
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="page-header">
          <div className="eyebrow">Histórico</div>
          <h1>Descartados</h1>
        </div>

        <div style={{ padding: '0 22px 14px', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.45 }}>
          Leads marcados como "no interesados". Quedan accesibles para futuro contacto (otros productos, próximas formaciones). Restáuralos para volverlos al embudo.
        </div>

        <div style={{ padding: '4px 22px 24px' }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="card flat" style={{ padding: 26, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              No hay leads descartados.
            </div>
          )}
          {!loading && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(l => (
                <div key={l.id} className="card flat" style={{ padding: 14 }}>
                  <div
                    onClick={() => onOpenLead && onOpenLead(l.id)}
                    style={{ cursor: onOpenLead ? 'pointer' : 'default' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{l.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                      {l.tel || l.instagram || 'sin contacto'}
                      {l.fuente ? ` · ${l.fuente}` : ''}
                    </div>
                    {l.mensaje && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        "{l.mensaje}"
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => restaurar(l.id)}
                      disabled={busy === l.id}
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: 10,
                        background: 'var(--oliva)', color: '#fff',
                        border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', opacity: busy === l.id ? 0.5 : 1,
                      }}
                    >
                      {busy === l.id ? '…' : '↺ Restaurar al embudo'}
                    </button>
                    <button
                      onClick={() => purgar(l.id, l.nombre)}
                      disabled={busy === l.id}
                      style={{
                        padding: '9px 12px', borderRadius: 10,
                        background: 'transparent', color: 'var(--rojo)',
                        border: '1px solid #E5C8C0', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', opacity: busy === l.id ? 0.5 : 1,
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

window.LeadsDescartadosScreen = LeadsDescartadosScreen;
export { LeadsDescartadosScreen };
