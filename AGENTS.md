# AGENTS.md — Dashboard Yoga Sofía Lira

> Contexto operativo para agentes de IA (Claude Code, Codex, Cursor, Copilot, etc.) que trabajen en este repo. Mantén este archivo actualizado cuando cambien comandos, arquitectura o convenciones.

## Producto

Dashboard privado para gestionar la formación **"El Arte de Enseñar Yoga"** (50h, 6–21 junio 2026, Domo Soulspace, Tumbaco, Ecuador). Una sola profe (Sofía Lira) y un admin (Juan Cristóbal). 25 alumnas máximo por edición.

**URL producción:** https://dashboard-sofia.vercel.app

## Quick start

```bash
npm install
cp .env.example .env.local         # luego rellenar con credenciales reales de Supabase
npm run dev                        # localhost:5173
```

`.env.local` debe tener:
```
VITE_SUPABASE_URL=https://orceickorgdynlsbskvx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Dev server con HMR en `:5173` |
| `npm run build` | Bundle de producción a `dist/` |
| `npm run preview` | Servir el bundle localmente |
| `git push` | Auto-deploy a Vercel (rama `main`) en ~1 min |

## Stack

- **Vite + React 18** (no Next, no router)
- **Supabase** (Postgres + Auth + Realtime) para todo el estado
- **Google OAuth** con whitelist de emails (single-tenant)
- CSS plano en `src/styles.css` con OKLCH custom properties — **NO usar Tailwind**, no está instalado
- `@supabase/supabase-js` v2.45+

## Arquitectura

```
src/
├── main.jsx                # Entry · decide IOSDevice frame (desktop) vs fullscreen (mobile)
├── app.jsx                 # Shell · auth gate · navigation · sheets/overlays
├── store.jsx               # Orquestador: junta todos los hooks Supabase en un solo objeto
├── styles.css              # CSS global, OKLCH tokens
├── lib/
│   └── supabase.js         # Cliente + ALLOWED_EMAILS whitelist
├── hooks/
│   ├── useAuth.js          # Sesión Google OAuth + rechazo de emails fuera de whitelist
│   ├── useAlumnas.js       # CRUD alumnas + realtime
│   ├── useLeads.js         # CRUD leads + realtime
│   ├── useAsistencia.js    # Toggle por (alumna, día) + realtime + upsert masivo
│   ├── useAjustes.js       # Singleton id=1 con jsonb · debounce 700ms
│   └── useMensajes.js      # Read-only feed de WhatsApp/IG
├── data.jsx                # Mocks estáticos (HORARIO_HOY, ENCUENTROS, PILARES) — no datos de usuario
├── icons.jsx               # SVG icons
├── ios-frame.jsx           # IOSDevice wrapper para mockup desktop
├── tweaks-panel.jsx        # Panel dev (toggle FAB, atajos)
├── login.jsx               # Pantalla de login Google
├── home.jsx                # Tab "Hoy" · saludo + fecha + cuenta regresiva dinámica
├── screen-*.jsx            # Una por tab: reservas, pagos, marketing, crm, detail, asistencia, ajustes
├── forms.jsx               # Inputs reutilizables
└── forms-sheets.jsx        # Sheets: AlumnaForm, LeadForm, PagoForm
```

### Patrón híbrido `window` + ES modules

Cada `.jsx` registra su componente en `window.X` al final (legado de la versión Babel-inline). `app.jsx` lee `window.X` en lugar de hacer imports porque mantiene compatibilidad con la arquitectura original. **No refactorices a imports puros sin razón** — funciona y es estable.

`main.jsx` SÍ usa `import` para forzar el orden de carga (los archivos se ejecutan en cadena y registran sus globals).

### Realtime

Cada hook se suscribe a un canal `<tabla>-changes` que sincroniza INSERT/UPDATE/DELETE entre pestañas y dispositivos. Optimistic UI primero, write a DB después.

### Auth · single-tenant con whitelist

No hay `owner_id` por fila. La autorización es una whitelist de emails verificada en **dos lugares**:

1. **Frontend** — `src/lib/supabase.js` array `ALLOWED_EMAILS`
2. **Backend** — función SQL `is_authorized()` en `supabase/schema.sql`, usada por las políticas RLS

Para añadir un usuario hay que editar **ambos** y volver a correr la función SQL (`CREATE OR REPLACE FUNCTION is_authorized()`).

Usuarios actuales:
- `sofilira@gmail.com` — la profe (uso primario)
- `jclira@gmail.com` — admin / dev

## Schema Supabase

`supabase/schema.sql` (base) y `supabase/migration-002-mensajes.sql` (incremental). Tablas:

| Tabla | Notas |
|---|---|
| `alumnas` | Inscritas. Snake_case en DB, camelCase en JS — el hook hace `fromDb()` / `toDb()`. |
| `leads` | CRM básico. fuente: instagram \| whatsapp \| referido \| otro |
| `pagos` | Audit trail. Cada pago aplicado a alumna actualiza también `alumnas.pagado` y `alumnas.pago` |
| `asistencia` | UNIQUE(alumna_id, dia_idx). Toggle ciclo: undefined → true → false → undefined |
| `ajustes` | Singleton (id=1). `data` jsonb con todo (precios, plantillas WA, días formación) |
| `mensajes` | Feed de WhatsApp/IG. Por ahora se popula manualmente |

Triggers `updated_at` en alumnas/leads/ajustes. RLS habilitado en todas, política única por tabla con `is_authorized()`.

## Convenciones de código

- **Idioma**: español. Comentarios, variables, UI en español. Solo nombres de tipos técnicos en inglés (useAlumnas, fromDb, etc.).
- **No emojis en código** salvo cuando ya están en data/UI existente.
- **No reformatear archivos** que no estés modificando. Vite + el CSS no usan prettier configurado.
- **Inputs controlados de React**: si hay que setear value programáticamente desde DevTools/automation, usar el setter nativo + `dispatchEvent('input')`. El asignar `el.value` directo no dispara el re-render.
- **Optimistic UI**: actualizar state local primero, luego escribir a Supabase. Si el write falla, log a consola (no rollback automático por simplicidad).

## Constraints — qué NO hacer

- **NO borrar archivos legacy**: `Dashboard Sofia.html`, `app.jsx`, `data.jsx`, etc. en la raíz del repo (NO en `src/`) son la versión Babel-inline original. Conservarlos como referencia.
- **NO commitear `.env.local`**. Está en `.gitignore`.
- **NO instalar Tailwind** ni reformatear el CSS a utilities. El estilo es deliberadamente serif/editorial con OKLCH.
- **NO meter el frame IOSDevice en mobile**. Solo aplica para viewports >600px (mockup en desktop). En mobile real renderiza fullscreen.
- **NO refactorizar `window.X` → imports puros** en las screens. Funciona, es estable, y romperlo gratis cuesta tiempo.
- **NO confiar en `localStorage`** para datos persistentes — todo va a Supabase ahora. Solo el panel de Tweaks usa localStorage para preferencias de UI.
- **NO usar `SECURITY DEFINER` en funciones SQL llamadas desde RLS policies** (como `is_authorized()`). Bajo SECURITY DEFINER, `auth.jwt()` no devuelve el JWT del caller real y la función retorna NULL → todos los inserts/updates fallan silenciosamente. Usar `SECURITY INVOKER` (default) + `STABLE`. Ver `migration-003-fix-rls-security-invoker.sql` para el incidente del 2026-04-29.

## Lógica de fechas (home.jsx)

`getFormationContext()` calcula la fase actual con `new Date()`:

| Fase | Cuándo | Eyebrow del hero | Acción primaria |
|---|---|---|---|
| `before` | hoy < 6 jun 2026 | "Faltan X días" | Ver inscritas |
| `today` | hoy ∈ {6,7,13,14,20,21} jun | "Encuentro N · Día M de 6" | Tomar asistencia |
| `during` | hoy entre encuentros | "En X días · Día N" | Ver inscritas |
| `after` | hoy > 21 jun 2026 | "Formación completa" | Ver resumen |

Las fechas están **duplicadas** en `home.jsx` (`DIAS_FECHAS`) y `useAjustes.js` (`DEFAULT_AJUSTES.diasFormacion`). Si cambian, actualizar ambas. **TODO**: unificar en un solo source.

## Mobile vs desktop

`src/main.jsx` decide en runtime:

```js
const isMobile = () =>
  window.matchMedia('(max-width: 600px)').matches ||
  ('ontouchstart' in window && window.innerWidth < 800);
```

- **Mobile real** → `<App />` directo, fullscreen
- **Desktop** → `<IOSDevice><App /></IOSDevice>` (mockup de iPhone para demos)

CSS específico para mobile en `styles.css` bajo `@media (max-width: 600px)`.

## Deploy

**Auto:** push a `main` → Vercel re-deploya en ~1 min.

**Cambiar env vars en producción:**
1. Vercel project settings → Environment Variables
2. Editar `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`
3. Redeploy manual (settings → Deployments → ⋯ → Redeploy)

**Si añades una nueva tabla o cambias el schema:**
1. Crear `supabase/migration-NNN-nombre.sql` (no editar `schema.sql` retroactivamente)
2. Correr en Supabase SQL Editor: https://supabase.com/dashboard/project/orceickorgdynlsbskvx/sql/new
3. Verificar RLS habilitado y política con `is_authorized()`
4. Crear/actualizar el hook correspondiente en `src/hooks/`

## Iteraciones probables (next up)

- Probar en iPhone real, ajustar paddings/typography si hace falta
- Unificar `DIAS_FORMACION` en una sola fuente (hoy duplicado en 3 sitios)
- Conectar tabla `mensajes` a WhatsApp Business API (manual hoy)
- Custom domain (Namecheap ~$2/año) si quiere algo más profesional que `.vercel.app`
- Modo "Producción" en Google OAuth Client (hoy está en "Prueba" con 100 test users máx)

## Recursos externos

| Recurso | URL |
|---|---|
| Repo GitHub (público) | https://github.com/JeyCee510/dashboard-sofia |
| Vercel project | https://vercel.com/jclira-6860s-projects/dashboard-sofia |
| Supabase project | https://supabase.com/dashboard/project/orceickorgdynlsbskvx |
| Google OAuth client | https://console.cloud.google.com/auth/clients?project=jclira-lab |
| SQL Editor (correr migrations) | https://supabase.com/dashboard/project/orceickorgdynlsbskvx/sql/new |

---

<!-- Última revisión compound: 2026-04-28 -->
