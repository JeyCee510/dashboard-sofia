// ──────────────────────────────────────────
// Reservas / Inscritos screen
// ──────────────────────────────────────────

const ReservasScreen = ({ tweaks, onNavigate, onOpenAlumna }) => {
  const [filter, setFilter] = React.useState('todas');
  const [search, setSearch] = React.useState('');

  let alumnas = MOCK_ALUMNAS;
  if (filter === 'pendientes') alumnas = alumnas.filter(a => a.pago === 'pendiente' || a.pago === 'parcial');
  if (filter === 'silla') alumnas = alumnas.filter(a => a.bonoSilla);
  if (search) alumnas = alumnas.filter(a => a.nombre.toLowerCase().includes(search.toLowerCase()));

  const total = MOCK_ALUMNAS.length;
  const cupos = tweaks.capacidad - total;
  const sillas = MOCK_ALUMNAS.filter(a => a.bonoSilla).length;
  const sillasMax = 6;

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">Formación junio</div>
        <h1>Inscritas</h1>
      </div>

      {/* Capacidad */}
      <div style={{ padding: '0 22px', display: 'flex', gap: 10, marginTop: 8 }}>
        <div className="card flat" style={{ flex: 1, padding: 16 }}>
          <div className="kpi-num">{total}<span style={{ fontSize: 18, color: 'var(--ink-mute)' }}>/{tweaks.capacidad}</span></div>
          <div className="kpi-label" style={{ marginTop: 4 }}>Inscritas</div>
          <div className="progress" style={{ marginTop: 10 }}>
            <div style={{ width: `${(total / tweaks.capacidad) * 100}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
            Quedan <strong style={{ color: 'var(--ink)' }}>{cupos} cupos</strong>
          </div>
        </div>
        <div className="card flat" style={{ flex: 1, padding: 16 }}>
          <div className="kpi-num" style={{ color: 'var(--gold)' }}>{sillas}<span style={{ fontSize: 18, color: 'var(--ink-mute)' }}>/{sillasMax}</span></div>
          <div className="kpi-label" style={{ marginTop: 4 }}>Bono silla</div>
          <div className="progress" style={{ marginTop: 10 }}>
            <div style={{ width: `${(sillas / sillasMax) * 100}%`, background: 'var(--gold)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
            {sillas >= sillasMax ? 'Bono cerrado' : `${sillasMax - sillas} sillas disponibles`}
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ padding: '20px 22px 10px' }}>
        <div className="search">
          <Icon name="search" size={15} stroke="var(--ink-mute)" />
          <input placeholder="Buscar alumna…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={{ padding: '0 22px' }}>
        <div className="segmented">
          <button className={filter === 'todas' ? 'active' : ''} onClick={() => setFilter('todas')}>Todas · {MOCK_ALUMNAS.length}</button>
          <button className={filter === 'pendientes' ? 'active' : ''} onClick={() => setFilter('pendientes')}>Pendientes · {MOCK_ALUMNAS.filter(a => a.pago === 'pendiente' || a.pago === 'parcial').length}</button>
          <button className={filter === 'silla' ? 'active' : ''} onClick={() => setFilter('silla')}>Silla · {sillas}</button>
        </div>
      </div>

      <div style={{ padding: '14px 22px' }}>
        <div className="card flat" style={{ padding: '4px 16px' }}>
          {alumnas.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              Sin resultados
            </div>
          )}
          {alumnas.map(a => (
            <div key={a.id} className="row" onClick={() => onOpenAlumna(a.id)} style={{ cursor: 'pointer' }}>
              <div className="avatar" style={{ background: a.avatar }}>{a.iniciales}</div>
              <div className="body">
                <div className="t1">{a.nombre}</div>
                <div className="t2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Inscrita {a.inscrita}</span>
                  {a.bonoSilla && <span style={{ color: 'var(--gold)' }}>· silla</span>}
                </div>
              </div>
              <PagoPill pago={a.pago} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
};

const PagoPill = ({ pago }) => {
  const cfg = {
    'pronto-pago': { label: 'Pagado', cls: 'oliva' },
    'completo': { label: 'Pagado', cls: 'oliva' },
    'pendiente': { label: 'Pendiente', cls: 'alert' },
    'parcial': { label: 'Parcial', cls: 'gold' },
  }[pago];
  return <span className={`pill ${cfg.cls}`}>{cfg.label}</span>;
};

window.ReservasScreen = ReservasScreen;
window.PagoPill = PagoPill;
