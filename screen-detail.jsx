// ──────────────────────────────────────────
// Ficha de alumna (overlay) — usa store; con editar / borrar / pagar
// ──────────────────────────────────────────

const FichaAlumna = ({ alumnaId, onClose, store, onEdit, onPagar }) => {
  const a = store.state.alumnas.find(x => x.id === alumnaId);
  if (!a) return null;
  const dias = store.state.ajustes.diasFormacion;
  const restante = a.total - a.pagado;

  // count días asistidos según el store
  const diasAsistidos = dias.filter(d => store.state.asistencia[d.idx]?.[a.id] === true);

  const wa = a.tel ? `https://wa.me/${a.tel.replace(/[^\d]/g, '')}` : '#';

  const borrar = () => {
    if (!confirm(`¿Borrar a ${a.nombre}? No se puede deshacer.`)) return;
    store.deleteAlumna(a.id);
    onClose();
  };

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="back" onClick={onClose}>
          <Icon name="chevronL" size={20} />
          Inscritas
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onEdit} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer' }}>
          <Icon name="edit" size={18} stroke="var(--ink-soft)" />
        </button>
      </div>
      <div className="app-scroll" style={{ paddingTop: 0 }}>
        {/* Hero */}
        <div style={{ padding: '12px 22px 24px', textAlign: 'center' }}>
          <div className="avatar" style={{
            width: 88, height: 88, fontSize: 32, margin: '0 auto',
            background: a.avatar,
          }}>{a.iniciales}</div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, marginTop: 14, marginBottom: 4, lineHeight: 1.1 }}>
            {a.nombre}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
            <span>{a.tel || 'sin teléfono'}</span>
            {a.bonoSilla && <><span>·</span><span style={{ color: 'var(--gold)' }}>bono silla</span></>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            {a.tel && (
              <a className="btn btn-primary btn-sm" href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <Icon name="whatsapp" size={13} />
                WhatsApp
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onPagar}>
              <Icon name="cash" size={13} />
              Pagar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              <Icon name="edit" size={13} />
              Editar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ padding: '0 22px', display: 'flex', gap: 10 }}>
          <div className="card flat" style={{ flex: 1, padding: 14 }}>
            <div className="kpi-label">Pago</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 4, color: restante > 0 ? 'var(--rojo)' : 'var(--oliva)' }}>
              ${a.pagado}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/{a.total}</span>
            </div>
            {restante > 0 ? (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>Falta ${restante}</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--oliva)', marginTop: 4 }}>Pago completo ✓</div>
            )}
          </div>
          <div className="card flat" style={{ flex: 1, padding: 14 }}>
            <div className="kpi-label">Asistencia</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>{diasAsistidos.length}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>/{dias.length}</span></div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {dias.map(d => {
                const v = store.state.asistencia[d.idx]?.[a.id] === true;
                return (
                  <div key={d.idx} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: v ? 'var(--oliva)' : 'var(--line-soft)',
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Asistencia detalle (toca para marcar/desmarcar) */}
        <div className="section-title">
          <h2>Asistencia</h2>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>toca un día</span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {dias.map(d => {
                const status = store.state.asistencia[d.idx]?.[a.id];
                const present = status === true;
                const absent = status === false;
                return (
                  <button
                    key={d.idx}
                    onClick={() => store.toggleAsistencia(d.idx, a.id)}
                    style={{
                      flex: 1,
                      aspectRatio: '1 / 1.05',
                      border: 'none', borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: present ? 'var(--ink)' : absent ? 'var(--terracota-tint)' : 'var(--bg-warm)',
                      color: present ? 'var(--bg)' : absent ? '#8A3D26' : 'var(--ink-mute)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '6px 2px', gap: 1,
                    }}
                  >
                    <span className="serif" style={{ fontSize: 14, lineHeight: 1, fontWeight: 500 }}>{d.fecha.split(' ')[0]}</span>
                    <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: '0.06em' }}>{d.fecha.split(' ')[1]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="section-title">
          <h2>Notas</h2>
          <span className="link" style={{ cursor: 'pointer' }} onClick={onEdit}>editar</span>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div className="card flat" style={{ padding: 16, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, fontStyle: a.notas ? 'normal' : 'italic' }}>
            {a.notas || 'Sin notas. Toca editar para escribir cómo la viste hoy.'}
          </div>
        </div>

        {/* Línea de tiempo */}
        <div className="section-title">
          <h2>Línea de tiempo</h2>
        </div>
        <div style={{ padding: '0 22px 18px' }}>
          <div className="card flat" style={{ padding: '4px 16px' }}>
            {a.pagado > 0 && <TimelineRow icon="cash" date={a.inscrita || '—'} title={`Pagó $${a.pagado}`} subtitle={a.pago} />}
            {diasAsistidos.length > 0 && diasAsistidos.map(d => (
              <TimelineRow key={d.idx} icon="check" date={d.fecha} title={`Asistió ${d.label}`} subtitle={`Encuentro ${d.encuentro}`} />
            ))}
            <TimelineRow icon="user" date={a.inscrita || '—'} title="Se inscribió" subtitle="" last />
          </div>
        </div>

        {/* Borrar (zona peligrosa) */}
        <div style={{ padding: '0 22px 40px' }}>
          <button onClick={borrar} style={{
            width: '100%', padding: '12px 14px',
            background: 'transparent',
            border: '1px solid #E5C8C0',
            borderRadius: 12,
            color: 'var(--rojo)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Borrar alumna</button>
        </div>
      </div>
    </div>
  );
};

const TimelineRow = ({ icon, date, title, subtitle, last }) => (
  <div style={{
    display: 'flex', gap: 12, padding: '12px 0',
    borderBottom: last ? 'none' : '1px solid var(--line-soft)',
    alignItems: 'flex-start',
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      background: 'var(--bg-warm)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-soft)', flexShrink: 0, marginTop: 2,
    }}>
      <Icon name={icon} size={14} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{subtitle}</div>}
    </div>
    <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{date}</div>
  </div>
);

window.FichaAlumna = FichaAlumna;
