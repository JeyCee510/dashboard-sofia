# AGENTS.md — Dashboard Sofía Lira Yoga

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
| `npm run deploy:voice` | Deploy edge function `voice-command` a Supabase (requiere `supabase login` 1× previo) |
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
│   ├── supabase.js         # Cliente + ALLOWED_EMAILS whitelist
│   ├── wa.js               # Helpers cleanPhone/cleanInstagram/buildWaUrl/buildIgUrl (DRY)
│   └── voice-executor.js   # Traduce {tool, params} de Haiku → llamadas al store
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
├── screen-reservas.jsx     # Tab "Inscritos"
├── screen-pagos.jsx        # Tab "Pagos" (con acceso a Comprobantes)
├── screen-marketing.jsx    # Tab "Leads" (con acceso a Papelera)
├── screen-detail.jsx       # FichaAlumna overlay
├── screen-asistencia.jsx   # Asistencia overlay (respeta encuentros_asistir)
├── screen-ajustes.jsx      # Ajustes overlay
├── screen-difusion.jsx     # Flujo difusión 1×1 overlay
├── screen-papelera-leads.jsx # Leads borrados overlay
├── screen-comprobantes.jsx # Comprobantes pendientes (admin) overlay
├── screen-preinscripciones.jsx # Listado global de preinscripciones (overlay)
├── screen-leads-descartados.jsx # Históricos de leads marcados no interesados
├── screen-clase-inscripciones.jsx # Admin de la clase abierta activa (cupos + lista)
├── screen-estudio.jsx        # Módulo Estudio: pantalla principal
├── screen-estudio-onboarding.jsx # Wizard alta de estudiante
├── screen-estudio-ficha.jsx  # Ficha individual + sub-sheets
├── screen-estudio-asistencia.jsx # Tomar asistencia a clases del estudio
├── screen-estudio-config.jsx # Ajustes del estudio
├── screen-estudio-comprobantes.jsx # Validar/rechazar comprobantes del estudio
├── clase-publica.jsx       # Form público /clase/<slug> con contador de cupos en vivo
├── voice-button.jsx        # Mic flotante + modal multi-turn
├── preinscripcion-public.jsx # Form público /preinscripcion/<token>
├── comprobante-public.jsx  # Form público /comprobante y /comprobante/<token>
├── forms.jsx               # Inputs + ContactPanel + PreinscripcionAdminPanel + ComprobanteTokenAdminPanel
└── forms-sheets.jsx        # Sheets: AlumnaForm, LeadForm, PagoForm
```

Hay 4 tabs en bottom bar: **Hoy, Inscritos, Pagos, Leads**. (Tab "Chat/CRM" fue eliminado — sin integración WA/IG no aportaba.)

### Patrón híbrido `window` + ES modules

Cada `.jsx` registra su componente en `window.X` al final (legado de la versión Babel-inline). `app.jsx` lee `window.X` en lugar de hacer imports porque mantiene compatibilidad con la arquitectura original. **No refactorices a imports puros sin razón** — funciona y es estable.

`main.jsx` carga TODOS los módulos en paralelo con `Promise.all` (28+ imports). Antes era secuencial → bloqueaba first paint ~1-2s. Funciona porque cada módulo solo registra globals en `window.X` sin dependencias de orden entre sí. App.jsx se carga al final por separado (su export es lo que se renderiza).

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

Migraciones aplicadas (en orden cronológico):
- `schema.sql` — base inicial
- `migration-002-mensajes.sql` — tabla mensajes
- `migration-003-fix-rls-security-invoker.sql` — fix crítico is_authorized()
- `migration-004-instagram-handle.sql` — campo `instagram` en alumnas/leads
- `migration-005-preinscripcion.sql` — tabla preinscripción + RPCs públicas
- `migration-006-inscripciones-parciales.sql` — `tipo_inscripcion` y `encuentros_asistir` en alumnas
- `migration-007-leads-archive.sql` — tabla `leads_archive` + trigger BEFORE DELETE + RPC `restaurar_lead`
- `migration-008-comprobantes-pago.sql` — tabla `comprobantes_pago` + bucket Storage `comprobantes` + preserva preinscripciones al borrar
- `migration-009-comprobante-tokens.sql` — tabla `comprobante_tokens` + RPCs anon
- `migration-010-fix-storage-policy-public.sql` — fix policy storage para anon + authenticated
- `migration-011-eventos-alumna.sql` — tabla `eventos_alumna` para timeline trazable (silla, conversiones, etc.)
- `migration-012-bucket-material.sql` — bucket Storage `material` (público lectura) para PDFs compartibles
- `migration-013-alumnas-archive.sql` — papelera de estudiantes + RPC `restaurar_alumna_como_lead`
- `migration-014-comprobantes-pago-id.sql` — FK `comprobantes_pago.pago_id` → `pagos(id)` para auto-reverso
- `migration-015-update-plantillas.sql` — actualización de plantillas WhatsApp (transferencia, maps, sin reserva)
- `migration-016-pagos-forma.sql` — columna `forma` en `pagos` (transferencia/efectivo/payphone/canje)
- `migration-017-modulo-estudio.sql` — **nuevo módulo Estudio**: `planes_catalogo`, `estudiantes_estudio`, `membresias`, `pagos_estudio` + RPCs `crear_estudiante_con_membresia`, `renovar_membresia` + seed de 8 planes típicos
- `migration-018-comprobantes-pago-estudio.sql` — comprobantes del estudio: tabla `comprobantes_pago_estudio` + RPCs `subir_comprobante_estudio` (anon), `validar_comprobante_estudio`, `rechazar_comprobante_estudio` + trigger BEFORE DELETE para auto-reverso del pago. Reusa bucket Storage `comprobantes`.
- `migration-019-asistencia-congelaciones.sql` — asistencia ad-hoc (`clases_realizadas`, `asistencia_estudio` con UNIQUE estudiante×clase + triggers que descuentan/restauran `clases_usadas`) y congelación de membresías (`congelaciones_membresia` + RPCs `congelar_membresia`, `descongelar_membresia`, `marcar_asistencia_estudio`)
- `migration-020-emilia-pronto-pago.sql` — fix puntual (alumna Emilia: regla pronto-pago)
- `migration-021-plantilla-casita.sql` — plantilla WhatsApp "Casita del Yoga" (link Google Maps de la dirección)
- `migration-022-clases-abiertas.sql` — sistema de **clases abiertas**: tablas `clases_abiertas` (con slug, fecha, cupos, `activa`) y `clase_inscripciones`; RPCs anon `obtener_clase_publica(slug)` y `inscribirse_a_clase(slug, nombre, email)`. Columna `leads.clase_link_enviada_at` para tracking. Seed inicial: clase del 16-mayo-2026 (yoga-16-mayo)
- `migration-023→028` — clases abiertas v2: inscripción manual desde admin, plantilla recordatorio, follow-up tracking (`leads.followup_clase_enviado_at`)
- `migration-030-plan-pagos.sql` — columna `alumnas.plan_pagos text` para nota libre del plan de pagos
- `migration-031-proyectos-borradores.sql` — tabla `proyectos_borradores` (alimentada por el wizard, status `borrador|activado`)
- `migration-032-taller-drop-in-modular.sql` — **patrón nuevo "taller drop-in modular"** (namespace `taller_*` aislado del módulo formación). Tablas: `proyectos` (genérico), `taller_encuentros`, `taller_inscritos` (con `comprobante_token` único), `taller_inscripciones_encuentros` (n-a-m con asistencia booleana), `taller_preinscripciones` (tokens), `taller_pagos`, `taller_eventos`. RPCs públicos: `taller_obtener_publico`, `taller_cargar_preinscripcion`, `taller_crear_preinscripcion` (admin), `taller_completar_preinscripcion` (con token), `taller_inscripcion_publica` (sin token), `taller_obtener_por_comprobante_token`. Seed: proyecto "Refinar la Práctica" (slug `refinar-la-practica`) con 6 sábados jul-nov 2026, cupos 22 c/u, tiers $80/150/210/390

Tablas:

| Tabla | Notas |
|---|---|
| `alumnas` | Inscritas. Campos extra: `instagram`, `tipo_inscripcion` (completa/dos_encuentros/un_encuentro), `encuentros_asistir int[]` |
| `leads` | CRM básico. fuente: instagram \| whatsapp \| referido \| otro. Campo `instagram`. |
| `leads_archive` | Papelera. Trigger BEFORE DELETE en `leads` archiva auto. Restaurar via RPC `restaurar_lead`. |
| `pagos` | Audit trail. Cada pago aplicado a alumna actualiza también `alumnas.pagado` y `alumnas.pago` |
| `asistencia` | UNIQUE(alumna_id, dia_idx). Toggle ciclo: undefined → true → false → undefined |
| `ajustes` | Singleton (id=1). `data` jsonb con todo (precios, plantillas WA, días formación) |
| `mensajes` | Feed de WhatsApp/IG. Por ahora se popula manualmente |
| `preinscripcion` | Form público con token UUID. FK ON DELETE SET NULL + `lead_nombre_snapshot` para sobrevivir borrado |
| `comprobantes_pago` | Comprobantes subidos vía link público. FK opcional a alumna/lead. Estado: pendiente/validado/rechazado. **`pago_id` (FK a pagos) permite auto-reverso al borrar** |
| `comprobante_tokens` | Token único reusable por persona. RPCs anon: `crear_comprobante_token`, `obtener_comprobante_token`, `subir_comprobante_con_token` |
| `eventos_alumna` | Timeline trazable. Eventos: inscrita, inscrita_desde_lead, silla_asignada_auto/manual, silla_renunciada. UI mergea con `pagos` ordenado por fecha |
| `alumnas_archive` | Papelera de estudiantes borrados. Trigger BEFORE DELETE en `alumnas`. RPC `restaurar_alumna_como_lead` (vuelven como lead nuevo, no como alumna) |
| `planes_catalogo` | **(Estudio)** Catálogo editable de planes (mensualidad/paquete/drop_in/trimestral/semestral). `activo=false` = soft-delete (preserva membresías históricas vía snapshot) |
| `estudiantes_estudio` | **(Estudio)** Estudiantes del estudio (separadas de `alumnas`). `archivada` = soft-archive |
| `membresias` | **(Estudio)** Instancia de plan asignado a estudiante. `plan_snapshot` jsonb preserva snapshot al momento de la compra. Renovar = nueva fila. La "actual" es la más reciente por `fecha_inicio`. Estado: `activa \| cancelada` (vencida se DERIVA en frontend) |
| `pagos_estudio` | **(Estudio)** Audit trail de pagos. Mismo `forma` que formación (transferencia/efectivo/payphone/canje) |
| `comprobantes_pago_estudio` | **(Estudio)** Comprobantes del estudio. Reusa bucket Storage `comprobantes`. `pago_id` permite auto-reverso al borrar. RPCs `validar`/`rechazar` |
| `clases_realizadas` | **(Estudio)** Instancia ad-hoc de clase puntual (fecha + hora + nombre). MVP sin horarios recurrentes |
| `asistencia_estudio` | **(Estudio)** UNIQUE(estudiante, clase_realizada). Triggers AFTER INSERT/DELETE descuentan/restauran `clases_usadas` en la membresía si es paquete |
| `congelaciones_membresia` | **(Estudio)** Historial de pausas. `hasta=NULL` = activamente congelada (UNIQUE INDEX parcial). Al descongelar, RPC calcula días y extiende `fecha_fin` |
| `clases_abiertas` | Eventos públicos (clase de prueba gratuita, etc.). `slug` = última parte del URL `/clase/<slug>`. `activa=true` = la que se muestra en el panel admin. RPCs anon `obtener_clase_publica`, `inscribirse_a_clase` |
| `clase_inscripciones` | Inscripciones al evento. Solo nombre + email (sin teléfono). Realtime → contador de cupos en vivo en el form público |
| `proyectos_borradores` | **(Wizard)** Borradores guardados por Sofí desde el wizard de nuevo proyecto. Estado `borrador|activado`. NO hay UI para listarlos todavía (TODO) |
| `proyectos` | **(Multi-proyecto)** Genérico: `slug`, `nombre`, `tipo` (taller_drop_in, formacion, estudio), `estado` (activo/archivado), `config` jsonb con precios/cupos/etc. Referencia opcional al `borrador_id` que lo originó |
| `taller_encuentros` | **(Taller)** Las N sesiones de un taller. Cupos por encuentro |
| `taller_inscritos` | **(Taller)** 1 fila por persona inscrita a un proyecto-taller. `comprobante_token` único para link público de comprobantes |
| `taller_inscripciones_encuentros` | **(Taller)** n-a-m: qué encuentros eligió cada inscrita. `asistio` booleano por encuentro |
| `taller_preinscripciones` | **(Taller)** Tokens para link personalizado (origen='admin') o público (origen='publico'). Se cierra con `completada_at` + `inscrito_id` |
| `taller_pagos` | **(Taller)** Audit trail. RLS público por `comprobante_token` permite INSERT desde la página personal de la inscrita |
| `taller_eventos` | **(Taller)** Timeline. Tipos: `inscripcion_publica`, `inscripcion_manual`, `pago_registrado`, `comprobante_validado`, etc. |

**Storage buckets**:
- `comprobantes` (privado): anon INSERT permitido, SELECT/DELETE solo authorized.
- `material` (público lectura): para PDFs compartibles (programa, contrato). Solo authenticated puede subir/actualizar.

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
- **NO refactorizar `window.X` → imports puros** en las screens. Funciona, es estable, y romperlo gratis cuesta tiempo.
- **NO confiar en `localStorage`** para datos persistentes — todo va a Supabase ahora. Solo el panel de Tweaks usa localStorage para preferencias de UI.
- **NO dejar `proyectoId` fuera de las deps de un `useCallback`.** El proyecto
  activo cambia DESPUÉS del primer render (app.jsx arranca en 2), así que un
  callback con `[]` escribe siempre al proyecto viejo. Bug real: un inscrito
  del Seminario guardado dentro de la formación (11 ago 2026).
- **NO tragarse errores en las acciones del usuario.** Un `catch` con sólo
  `console.error` + un `finally` que cierra la hoja hace que una operación
  fallida parezca exitosa. Pasó con la conversión lead → inscrito del
  Seminario (11 ago 2026): nadie lo notó hasta que faltaron inscritas.
- **NO usar `SECURITY DEFINER` en funciones SQL llamadas desde RLS policies** (como `is_authorized()`). Bajo SECURITY DEFINER, `auth.jwt()` no devuelve el JWT del caller real y la función retorna NULL → todos los inserts/updates fallan silenciosamente. Usar `SECURITY INVOKER` (default) + `STABLE`. Ver `migration-003-fix-rls-security-invoker.sql` para el incidente del 2026-04-29.
- **NO llamar hooks de React después de un early return.** Todos los `use*` deben ir antes de cualquier `if (cond) return ...`. Una violación rompe el render entero (root vacío, sin error visible). Bug histórico: `usePullToRefresh` puesto después del auth gate, root quedó en blanco. Ver app.jsx líneas iniciales.
- **Patrón `window.X` → cuando un componente A registrado en window es consumido por un archivo B**, hay que declararlo explícito al inicio de B con `const X = window.X` — NO funciona como variable global automática en módulos ES (strict mode). Si olvidas, ReferenceError silencioso al renderizar. Aplica también a hooks: `const useX = window.useX` antes de usar dentro de otro componente.

## Lógica de fechas (home.jsx)

`getFormationContext()` calcula la fase actual con `new Date()`:

| Fase | Cuándo | Eyebrow del hero | Acción primaria |
|---|---|---|---|
| `before` | hoy < 6 jun 2026 | "Faltan X días" | Ver inscritas |
| `today` | hoy ∈ {6,7,13,14,20,21} jun | "Encuentro N · Día M de 6" | Tomar asistencia |
| `during` | hoy entre encuentros | "En X días · Día N" | Ver inscritas |
| `after` | hoy > 21 jun 2026 | "Formación completa" | Ver resumen |

Las fechas están **duplicadas** en `home.jsx` (`DIAS_FECHAS`) y `useAjustes.js` (`DEFAULT_AJUSTES.diasFormacion`). Si cambian, actualizar ambas. **TODO**: unificar en un solo source.

## Responsive web

La app renderiza siempre como `<App />` directo (sin frame de iPhone). El layout se adapta vía CSS:

- **Mobile (<700px):** `.app` ocupa todo el viewport (`height: 100dvh`), tabbar `position: absolute` dentro. Body con `overflow: hidden`, scroll real ocurre en `.app-scroll`.
- **Desktop (>=700px):** `.app` con `max-width: 720px` centrada con sombra y border-radius. Body scroll normal.
- **Pantallas grandes (>=1024px):** `max-width: 880px` para más aire.

CSS específico para cada breakpoint en `styles.css`. Las rutas públicas (`/preinscripcion/*`, `/comprobante/*`) usan `body.public-route` para anular las restricciones de scroll del modo app.

El frame `<IOSDevice>` ya NO se usa en producción — el archivo `ios-frame.jsx` queda solo por compatibilidad con la versión Babel-inline legacy de la raíz.

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

## Control por voz (Web Speech + Claude Haiku 4.5)

Botón de micrófono flotante junto al FAB. Sofía habla un comando, Claude Haiku interpreta con tool use, modal de confirmación antes de ejecutar.

**Stack:**
- Web Speech API (es-EC) en el browser → texto. Gratis, nativo. NO funciona en webviews de WhatsApp/Instagram (Apple bloqueo) — detectamos y mostramos guía para abrir en Safari.
- Edge Function `voice-command` en Supabase llama a `claude-haiku-4-5-20251001` con tool use.
- Secret `ANTHROPIC_API_KEY` en Supabase Edge Functions secrets.
- Costo: ~$0.0001 por comando (~$2-3/mes uso típico).

**14 tools (acciones):** crear_lead, crear_estudiante, registrar_pago, cambiar_estado_lead, convertir_lead_a_estudiante, marcar_asistencia, marcar_dia_completo, asignar_silla, renunciar_silla, eliminar_registro, generar_preinscripcion, abrir_ficha, consultar, preguntar_clarificacion.

**10 consultas:** cupos_disponibles, pagos_pendientes, leads_nuevos, total_inscritos, asistencia_hoy, bono_silla_estado, comprobantes_pendientes, consolidado_financiero, preinscripciones_pendientes, papelera_total.

**Multi-turn:** el frontend acumula history con tool_use blocks correctos. Cada turno user que sigue a un assistant turn con tool_use DEBE wrappear con `tool_result` block (Anthropic exige). Ver `useVoiceCommand.js` y `voice-button.jsx`.

**Componentes clave:**
- `src/hooks/useVoiceCommand.js` — captura voz + multi-turn
- `src/voice-button.jsx` — UI con chips clickeables para clarificaciones
- `src/lib/voice-executor.js` — traduce {tool, params} a llamadas al store
- `supabase/functions/voice-command/index.ts` — Edge Function. Re-deploy con `npm run deploy:voice` (script en `scripts/deploy-voice-command.sh`, requiere `supabase login` una vez).

## Rutas públicas (sin auth)

Detectadas por pathname en `main.jsx`:

| Ruta | Función |
|---|---|
| `/preinscripcion/<token>` | Formación: confirmar inscripción de lead específico |
| `/comprobante` | Formación: form público anónimo para subir comprobante |
| `/comprobante/<token>` | Formación: form personalizado por persona (no pide nombre) |
| `/clase/<slug>` | Clase abierta: inscripción gratuita con cupos en vivo via realtime |
| `/taller/<slug>` | Taller drop-in modular: inscripción pública abierta (cualquiera) |
| `/taller/<slug>/i/<token>` | Taller: inscripción con link personalizado (prellenado por admin) |
| `/taller-comprobante/<token>` | Taller: página privada para subir comprobantes (1 por inscrita) |

Las rutas públicas añaden `body.public-route` al DOM para que el CSS anule las restricciones de scroll del modo app. Suben archivos a Supabase Storage bucket `comprobantes` (privado, anon INSERT permitido por policy).

## PWA + Open Graph

- **PWA**: `public/manifest.json` + `public/sw.js` (mínimo) + íconos en `public/icon-{192,512}.png`. `theme-color: #B5563A`. Instalable en home screen con UI standalone.
- **Open Graph / link previews**: meta tags en `index.html` apuntando a `public/og-image.jpg` (página 1 del flyer marketing). Antes WhatsApp/IG mostraban la "mancha terracotta" del PWA al compartir un link. **WhatsApp cachea previews agresivamente** — para forzar refresh tras cambiar la imagen, agregar `?v=N` al link compartido.

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
| Supabase project | https://supabase.com/dashboard/project/orceickorgdynlsbskvx (org `pukgsagqllaezjeaiyzu`, cuenta `jotacelira@gmail.com` vía GitHub) |
| Google OAuth client | https://console.cloud.google.com/auth/clients?project=jclira-lab |
| SQL Editor (correr migrations) | https://supabase.com/dashboard/project/orceickorgdynlsbskvx/sql/new |

---

<!-- Última revisión compound: 2026-06-23 (PM) -->
<!--
Sesión 2026-06-23 (post-handoff Opus 4.8):
- Launcher SIEMPRE abre como home (cold start ignora localStorage). app.jsx:
  useState('launcher') directo. Antes guardaba último módulo visitado, pero
  ese comportamiento dejaba a Sofí/JC fuera de la nueva pantalla de inicio.

- NUEVO PATRÓN: "taller drop-in modular" (migration-032). Namespace `taller_*`
  aislado de la formación. Tablas:
    proyectos (genérico: slug, nombre, tipo, estado, config jsonb)
    taller_encuentros (las N sesiones del taller)
    taller_inscritos (1 fila por persona)
    taller_inscripciones_encuentros (relación n-a-m + asistencia booleana)
    taller_preinscripciones (tokens para link personalizado/público)
    taller_pagos
    taller_eventos (timeline)
  RLS: admin via is_authorized() + policies abiertas por slug activo o
  comprobante_token. RPCs públicos: taller_obtener_publico,
  taller_cargar_preinscripcion, taller_crear_preinscripcion (admin),
  taller_completar_preinscripcion (con token), taller_inscripcion_publica
  (sin token, link genérico /taller/<slug>), taller_obtener_por_comprobante_token.

- Primer proyecto activado en este patrón: "Refinar la Práctica" (slug
  refinar-la-practica). 6 sábados jul-nov 2026, cupos 22 c/u por sábado,
  tiers $80/150/210/390. Creado desde el borrador #1 del wizard.

- Frontend nuevo:
    src/hooks/useTaller.js  — hook con inscritos enriquecidos (saldo derivado,
                              encuentros, pagos), encuentros con cupos en vivo,
                              mutaciones. Realtime un canal por proyecto.
    src/screen-taller.jsx   — admin con tabs Encuentros/Inscritas/Pagos,
                              ficha individual con sub-tabs info/pagos/asistencia,
                              generador de link personalizado (abre WA con prefill),
                              registro y validación de pagos, precio especial
                              con motivo + evento timeline.
    src/taller-publico.jsx  — /taller/<slug> y /taller/<slug>/i/<token>,
                              cupos en vivo, redirect al comprobante post-submit.
    src/taller-comprobante.jsx — /taller-comprobante/<token>, sube archivos al
                              bucket Storage 'comprobantes' bajo prefix
                              taller/<slug>/, RLS permite INSERT por
                              comprobante_token válido.

- Launcher ahora tiene 4 tarjetas:
    Estudio · Refinar la Práctica (activo) · Formación archivada · Nuevo proyecto

- UX gap conocido: el wizard guarda en proyectos_borradores pero NO hay UI
  para listar/editar borradores. Hoy se descubre rápido sólo si Sofí no ve
  sus respuestas y JC pregunta. La tarjeta "Nuevo proyecto" debería mostrar
  borradores existentes antes del CTA de crear nuevo. TODO.

- Aplicados aprendizajes previos: window.open SÍNCRONO antes de awaits (iOS
  PWA), window.Icon leído render-time, useState al tope (Rules of Hooks),
  realtime canal único por feature, bucket comprobantes reutilizado, RLS
  con is_authorized() + lectura pública por token.
-->

<!-- Última revisión compound: 2026-06 -->
<!--
Sesión 2026-05/06 features añadidas:
- Clases abiertas (mig-022→028): tablas + RPCs anon + admin manual + cierre por hora_fin.
  Ruta /clase/<slug> con cupos en vivo. Inscripción manual desde lead.
- Follow-up post-clase: panel admin "Inscripciones recibidas" en Leads,
  botón verde por inscrito → busca/crea lead, genera token, abre WA.
  Tracking leads.followup_clase_enviado_at.
- UI rename "preinscripción" → "inscripción" (solo strings).
- Silla 30 → 40 en diferencial.
- PagoForm reforma: producto picker (pronto pago/completo/2enc/1enc),
  precio especial con motivo obligatorio + evento timeline,
  "solo validar comprobante" sin sumar al pago.
- TelInput sin auto-593, prefijo + solo.
- main.jsx parallel imports (Promise.all). CUIDADO: race con window.Icon
  si se lee a nivel módulo. Patrón: leer dentro del componente render.
- Perf iOS PWA: touch-action manipulation + DeferMount para paneles
  dentro de Sheet + window.open SÍNCRONO antes del await (sino bloqueado).
- Plan de pagos (mig-030): alumnas.plan_pagos text + editor en ficha.
- helpers en lib/precios.js: estadoPago(a), esProntoPagoProducto(a, precioPP).
  Filtros pendientes ya no usan etiqueta a.pago, usan pagado < total.
- PWA + Open Graph (manifest, og-image, sw noop).
- src/lib/wa.js: helpers WA/IG centralizados.
-->

<!-- Última revisión compound: 2026-05-07 -->
<!--
Sesión 2026-05-07 (compound review):
- main.jsx: 21 awaits secuenciales → Promise.all paralelo (first paint -50%)
- src/lib/wa.js: helpers WhatsApp/IG centralizados (DRY entre forms.jsx y screen-difusion.jsx)
- screen-estudio-placeholder.jsx: importación retirada de main.jsx (legacy, archivo conservado)
- vite.config.js: emptyOutDir true
- package.json: engines node >=18.18
- public/og-image.jpg + meta tags Open Graph (preview WhatsApp con flyer real)
- migration-022-clases-abiertas.sql: clases abiertas + clase_inscripciones + RPCs anon
- Texto plantilla WA clase abierta actualizado (clase gratuita de prueba)
-->

<!-- Última revisión anterior: 2026-04-30 -->
<!--
Sesión 2026-04-30 features añadidas:
- Modal de pago unificado (4 atajos + opción sin pago) con regla pronto-pago = precio FIJO
- Auto-asignación de bono silla a primeros 6 con tipo='completa' y pago>=$200
- Timeline trazable por estudiante (eventos_alumna + pagos) con revertir
- Sección Comprobantes en ficha + tab Pagos con segmented Cobros/Comprobantes (badge pendientes)
- ValidarSheet soporta leads → convierte automáticamente al validar
- PDF programa en Storage `material` + plantilla virtual auto-inyectada
- Papelera unificada (leads + alumnas borradas) → restaurar SIEMPRE crea lead nuevo
- InstaInput (@ fijo) + TelInput (+593 9 default + toggle internacional)
- Leads: buscador, orden alfabético, badge de preinscripción
- Auto-reverso pago al borrar comprobante validado (vía pago_id FK)
- Voz: 14 tools y 10 consultas (3 + 4 añadidas en esta sesión)
- Lenguaje UI genérico (estudiantes/inscritos/personas)
-->

