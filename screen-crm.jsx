// ──────────────────────────────────────────
// CRM / WhatsApp screen
// ──────────────────────────────────────────

const CRMScreen = () => {
  const [filter, setFilter] = React.useState('todos');
  let msgs = MENSAJES_RECIENTES;
  if (filter === 'sinleer') msgs = msgs.filter(m => m.sinLeer);
  if (filter === 'leads') msgs = msgs.filter(m => m.esLead);

  // Build full list including alumnas
  const conversaciones = [
    ...msgs,
    { id: 99, alumna: 'Camila Ortega', preview: 'Llevaré el manual impreso 📖', tiempo: 'mar', sinLeer: false },
    { id: 100, alumna: 'Regina Solís', preview: 'Tengo una pregunta sobre el bono silla', tiempo: 'lun', sinLeer: false },
    { id: 101, alumna: 'Paulina Velázquez', preview: 'Te confirmo asistencia para el sábado', tiempo: 'lun', sinLeer: false },
  ];

  const sinLeer = MENSAJES_RECIENTES.filter(m => m.sinLeer).length;

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">Mensajería · {sinLeer} sin leer</div>
        <h1>Conversaciones</h1>
      </div>

      {/* Plantillas rápidas */}
      <div className="section-title">
        <h2>Respuestas rápidas</h2>
      </div>
      <div style={{ padding: '0 22px', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { label: 'Datos del programa', icon: 'note' },
          { label: 'Cómo reservar $200', icon: 'cash' },
          { label: 'Ubicación Tumbaco', icon: 'location' },
          { label: 'Cronograma', icon: 'calendar' },
        ].map((t, i) => (
          <button key={i} className="card flat" style={{
            flexShrink: 0, padding: '10px 14px', display: 'flex', gap: 8,
            alignItems: 'center', fontFamily: 'inherit', fontSize: 12,
            fontWeight: 500, color: 'var(--ink)', cursor: 'pointer',
          }}>
            <Icon name={t.icon} size={14} stroke="var(--terracota)" />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 22px 10px' }}>
        <div className="segmented">
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          <button className={filter === 'sinleer' ? 'active' : ''} onClick={() => setFilter('sinleer')}>Sin leer</button>
          <button className={filter === 'leads' ? 'active' : ''} onClick={() => setFilter('leads')}>Leads</button>
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {conversaciones.map(m => (
            <div key={m.id} className="row" style={{ cursor: 'pointer' }}>
              <div className="avatar" style={{ background: m.esLead ? 'var(--terracota-soft)' : 'oklch(0.74 0.06 45)' }}>
                {m.alumna.split(' ').map(p => p[0]).slice(0, 2).join('')}
              </div>
              <div className="body">
                <div className="t1" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.alumna}
                  <Icon name="whatsapp" size={11} stroke="var(--whatsapp)" />
                  {m.esLead && <span style={{ fontSize: 10, color: 'var(--terracota)', fontWeight: 500 }}>· lead</span>}
                </div>
                <div className="t2">{m.preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{m.tiempo}</span>
                {m.sinLeer && <span className="dot" style={{ background: 'var(--terracota)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 22px' }}>
        <button className="btn btn-secondary btn-block">
          <Icon name="bullhorn" size={14} />
          Difusión a inscritas (22)
        </button>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
};

window.CRMScreen = CRMScreen;
