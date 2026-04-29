// ──────────────────────────────────────────
// SVG icons — minimal stroke set for the dashboard
// ──────────────────────────────────────────

const Icon = ({ name, size = 18, stroke = 'currentColor', strokeWidth = 1.6, fill = 'none' }) => {
  const paths = {
    home: <><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
    list: <><path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" /></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
    bullhorn: <><path d="M3 9v6l8 3V6L3 9zM11 6v12l4-1V7l-4-1zM15 8v8l4-1V9l-4-1z" /></>,
    chat: <><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-5 4z" /></>,
    chevronR: <><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></>,
    chevronL: <><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></>,
    chevronD: <><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></>,
    plus: <><path d="M12 5v14M5 12h14" strokeLinecap="round" /></>,
    check: <><path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" /></>,
    x: <><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></>,
    bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16zM10 19a2 2 0 0 0 4 0" /></>,
    filter: <><path d="M3 6h18M6 12h12M10 18h4" strokeLinecap="round" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></>,
    whatsapp: <><path d="M3 21l1.5-5A8 8 0 1 1 8 19.5L3 21z" strokeLinejoin="round" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5.5-5-5.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" /></>,
    location: <><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
    note: <><path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5z" /><path d="M9 9h7M9 13h7M9 17h4" strokeLinecap="round" /></>,
    sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" strokeLinecap="round" /></>,
    chair: <><path d="M7 4v8h10V4M5 12h14M7 12v8M17 12v8M9 16h6" strokeLinecap="round" /></>,
    refresh: <><path d="M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a6 6 0 1 0 1 8" strokeLinecap="round" strokeLinejoin="round"/></>,
    flame: <><path d="M12 22a6 6 0 0 0 6-6c0-3-2-5-3-7 0 2-2 3-3 3 0-3-2-5-2-9-3 4-6 7-6 12a6 6 0 0 0 8 7z" strokeLinejoin="round"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.8a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.4a7 7 0 0 0-1.7 1l-2.3-.8-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7 7 0 0 0 1.7-1l2.3.8 2-3.4-2-1.5c.1-.3.1-.6.1-1z" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16zM14 6l4 4" strokeLinejoin="round"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
      {paths[name]}
    </svg>
  );
};

window.Icon = Icon;
