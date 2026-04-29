# Dashboard · Yoga Sofía Lira

Panel privado para gestionar la formación "El Arte de Enseñar Yoga" (50 horas, junio 2026).

## Stack

- **Vite + React 18** — dev server + build
- **Supabase** (Postgres + Auth) — alumnas y pagos en la nube
- **Google OAuth** — login con whitelist de emails
- **localStorage** — leads, asistencia, ajustes (próxima iteración)

## Quick start

```bash
npm install
cp .env.example .env.local       # luego rellenar con credenciales reales
npm run dev                       # http://localhost:5173
```

## Comandos

- `npm run dev` — dev server con HMR
- `npm run build` — bundle de producción a `dist/`
- `npm run preview` — sirve el bundle localmente

## Estructura

```
.
├── index.html              # entry de Vite
├── package.json
├── vite.config.js
├── .env.example            # plantilla de env vars
├── DEPLOY.md               # 🟢 instrucciones de deploy paso-a-paso
├── supabase/
│   └── schema.sql          # tablas + RLS + whitelist de emails
└── src/
    ├── main.jsx            # entry React
    ├── app.jsx             # shell + auth gate
    ├── store.jsx           # estado central (Supabase + localStorage)
    ├── login.jsx           # pantalla de login Google
    ├── lib/
    │   └── supabase.js     # cliente Supabase + ALLOWED_EMAILS
    ├── hooks/
    │   ├── useAuth.js      # sesión + signIn/signOut
    │   └── useAlumnas.js   # CRUD alumnas con realtime
    ├── data.jsx            # mocks (HORARIO_HOY, PILARES, etc.)
    ├── icons.jsx
    ├── ios-frame.jsx       # marco iPhone
    ├── tweaks-panel.jsx    # panel de ajustes dev
    ├── home.jsx
    ├── screen-*.jsx        # cada tab
    ├── forms.jsx
    └── forms-sheets.jsx
```

## Deploy

Ver `DEPLOY.md` (Supabase + GitHub + Vercel, todo gratuito).

## Archivos legacy

`Dashboard Sofia.html` y los `.jsx` en la raíz son la versión original (Babel inline). Se mantienen por referencia y no se usan en producción. El build de Vite solo lee `src/`.
