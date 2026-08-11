# Handoff · Dashboard Sofía — 5 agosto 2026

Estado del proyecto para quien retome (persona o agente). Complementa `AGENTS.md`
(convenciones y stack) y `docs/arquitectura-multiproyecto.md` (el modelo objetivo).

Producción: https://dashboard-sofia.vercel.app · Supabase: `orceickorgdynlsbskvx`

> **Si eres un agente empezando aquí (Claude Code u otro): lee este archivo
> completo antes de tocar nada.** El contexto de las sesiones anteriores vivía en
> la memoria de Cowork y NO viaja: este documento es la única fuente de verdad.
> Presta especial atención a la sección 3 (trampas) — son errores ya cometidos.

## Estado en una línea

El foco vivo es **Seminario Angelo** (nov–dic 2026), operado por Sofía (primer
contacto) y Micaela (gestión, con acceso restringido). Está **completo y en
producción**; lo que falta es pulido y validación en uso real (sección 5).

---

## 1. Qué es la app hoy

Dejó de ser "el dashboard de una formación". Hay una tabla **`proyectos`** y el
**motor de la formación corre parametrizado por `proyecto_id`**, así que el mismo
código sirve a varios productos:

| id | slug | qué es | qué shell usa | estado |
|----|------|--------|---------------|--------|
| 1 | `refinar-la-practica` | Taller drop-in · 6 sábados jul–nov | motor propio `taller_*` (`screen-taller.jsx`) | activo |
| 2 | `formacion-junio-2026` | El Arte de Enseñar Yoga (terminada) | motor formación | archivado, `config.oculto=true` → oculto en el home |
| 3 | `estudio` | Membresías y clases | módulo estudio | activo |
| **4** | **`seminario-angelo`** | **Seminario 3 sedes nov–dic 2026** | **motor formación** | **activo — foco actual** |

Ruteo en `app.jsx → abrirProyecto(p)`. El seminario entra al motor de la
formación con `formacionProyectoId = 4`.

### Cómo se propaga el proyecto
- `useStore(proyectoId)` → `useAlumnas/useLeads/useAsistencia/useMensajes/useAjustes`
  filtran e insertan con ese id. Default `2` (formación) = no-op, no cambia su
  comportamiento histórico.
- Globals que leen las screens (se setean en `app.jsx`):
  `window.PROYECTO_ID`, `window.PROYECTO_NOMBRE`, `window.AJUSTES_PROYECTO`,
  `window.DIAS_FORMACION`.

### Ajustes por proyecto
La tabla `ajustes` es **singleton** (constraint `only_one_row`), así que sólo
sirve para la formación. **Los demás proyectos guardan su configuración en
`proyectos.config`** con la misma forma (diasFormacion, plantillasWA, precios…).
`useAjustes({ proyectoId, esFormacion })` elige la fuente.

---

## 2. Multi-usuario y bitácora (nuevo)

Primer caso de la app con dos usuarias de distinto nivel.

- `app_usuarios` (email, rol `admin|colaborador`) y `usuarios_proyectos` (quién
  accede a qué proyecto).
- Funciones: `es_admin()`, `puede_ver_proyecto(pid)`, `puede_entrar()`.
- Policies `<tabla>_por_proyecto` (`TO authenticated`) en alumnas, leads, pagos,
  asistencia, eventos_alumna, preinscripcion, mensajes + `proyectos_visibles`.
  Las viejas `*_all` (con `is_authorized`, rol `public`) se dejaron: las policies
  permisivas se combinan con OR y siguen cubriendo a Sofía y JC.
- **Micaela** (`micatello121314@gmail.com`) es colaboradora con acceso **sólo al
  proyecto 4**. Verificado simulando su JWT: ve 1 proyecto, 0 alumnas de la
  formación, 0 del estudio.
- Bitácora: tabla `actividad` + `lib/actividad.js` (`registrarActividad`,
  `setActorActividad`) + `hooks/useActividad.js` + `screen-actividad.jsx`
  (`ActividadScreen` global, filtrada a lo relevante; `ActividadDeFicha`
  embebida en la ficha del lead). Se registra: crear lead, cambio de estado,
  nota, alta de inscrito y pagos.

---

## 3. Trampas aprendidas — leer antes de tocar RLS o agregar un proyecto

1. **Recursión en policies.** Una función usada en una policy NO debe consultar
   una tabla cuya policy llame a esa misma función → *"stack depth limit
   exceeded"* y el control de acceso queda **inutilizado** (falla abierto en la
   práctica porque la UI no restringe). Pasó con `es_admin()` leyendo
   `app_usuarios`. Fix: `es_admin() = is_authorized()` sin consultar tablas, y
   `puede_ver_proyecto()` como `SECURITY DEFINER`.
2. **Policy sin rol aplica a todos.** `proyectos_lectura_publica` con
   `USING (estado='activo')` y sin `TO anon` permitía que cualquier usuario
   autenticado viera todos los proyectos. Siempre declarar `TO anon` o
   `TO authenticated`.
3. **Parametrizar los hooks no alcanza.** Al conectar el seminario, las
   pantallas seguían mostrando datos de la formación porque tenían valores
   hardcodeados (fechas de junio, precios, bono silla, "Junio · USD",
   "Formación junio") y varios hooks no filtraban por proyecto:
   `useDesglosePagos` (mostraba $4.640 ajenos), `usePreinscripciones`,
   `useArchive`, `screen-leads-descartados`, `useClasesAbiertas`.
   **Al agregar un proyecto: auditar todos los `.from(...)` que no lleven
   `.eq('proyecto_id', …)`.**
4. Las papeleras `leads_archive` / `alumnas_archive` ahora tienen `proyecto_id`
   y el trigger `archive_lead()` lo copia.
5. `git` sobre el mount de Cowork deja `.git/*.lock` huérfanos y rompe los
   comandos siguientes. Usar `scripts/claude-push.sh`, que los limpia.
6. **Los datos "que faltan" suelen ya existir.** La dirección de la Casita del
   Yoga se dio por perdida y estaba en `ajustes.plantillasWA` (formación).
   Antes de pedirle un dato a JC, buscar en `ajustes.data` y en
   `proyectos.config` de los otros proyectos:
   `select … where config::text ilike '%loquesea%'`.
7. **Un texto puede estar hardcodeado aunque exista la plantilla.** El panel de
   inscripción tenía el mensaje "…inscripción a la formación" escrito en el
   código y lo mandaba en TODOS los proyectos. Hoy sale de la plantilla
   `inscripcion` del proyecto. Si algo suena a otro proyecto, buscar el string
   literal en `src/` antes de suponer que es config.
8. **Secretos compartidos entre apps.** Este proyecto Supabase lo usan varias
   apps de JC (schemas `quinche`, `platas_casa`). Antes de crear o reemplazar
   un secreto o una Edge Function, verificar que no exista ya para otra app.
9. **Los CHECK viejos también hay que auditarlos** (no sólo el `proyecto_id`).
   Convertir un lead del Seminario en inscrito no hacía NADA: `PagoForm` manda
   `tipo_inscripcion='taller'` y el CHECK de `alumnas` sólo aceptaba los tres
   productos de la formación. Migración 040. Al reusar el motor de la
   formación en un proyecto nuevo: revisar constraints, no sólo filtros.
10. **Errores tragados = bugs invisibles.** El mismo caso duró días porque el
    `catch` de la conversión sólo hacía `console.error` y el `finally` cerraba
    la hoja igual: para Sofía parecía que había funcionado. Si una acción
    falla, avisar en pantalla y NO cerrar.

---

## 4. Seminario Angelo — configuración cargada

3 encuentros; cada uno es un trabajo completo en sí mismo. Asana con **Angelo
Cecchi**, filosofía con **Siddhartha Krishna**. Contacto: 0986813584 (Sofía).

| Sede | Fechas | Lugar | Incluye |
|------|--------|-------|---------|
| 1 · Quito "Acción" | 20–22 nov | Domo Soul Space, Tumbaco | sin hospedaje · 8h30–12h30 y 14h00–17h30 |
| 2 · Vilcabamba "Interiorización" | 3–6 dic | Izhcayluma Eco-Resort | 4 noches (2–6 dic) + 4 desayunos |
| 3 · Tena "Expansión" | 10–13 dic | Wisdom Forest | 3 noches + 3 comidas diarias |

**Precios: el valor de cada sede depende de cuántas toma la persona** (el
descuento por varios ya está incorporado en la matriz, `config.matrizPrecios`):

| | Domo | Izhcayluma | Wisdom | Total |
|---|---|---|---|---|
| a los 3 | 200 | 400 | 400 | **1000** |
| a 2 | 222 | 490 | 490 | |
| a 1 · pronto pago | 242 | 525 | 525 | |
| a 1 · regular | 280 | 590 | 590 | |

- Pronto pago hasta el **domingo 13 de septiembre** (o hasta agotar etapa 1).
  Los precios de 2 y 3 sedes **no cambian** después de esa fecha.
- Cupos: Domo **55**, Vilcabamba **33**, Tena **33** (`config.cuposPorSede`).
- **Reserva sólo en los retiros:** $170 Izhcayluma, $211 Wisdom Forest. El Domo
  no maneja abono.
- **Flujo de dinero** (`config.reglaPagos`): el abono de reserva de los retiros
  se paga **directo al hospedaje**; el saldo va a Sofía. En el Domo todo a
  Sofía. Por eso `pagos` tiene `destino` y `sede_n`, y el formulario pregunta
  "¿A qué cuenta entró?".
- El monto del pago es **abierto** (hay muchas combinaciones posibles).
- **20 plantillas de WhatsApp** en `config.plantillasWA`, ordenadas por el flujo
  real: link de inscripción, primer contacto, info completa, precios especiales,
  cómo llegar a Vilcabamba, biografías, clases regulares, ubicaciones (Domo y
  Casita del Yoga), 4 botones de pago (uno por cuenta), brochure, seguimiento,
  becas, bienvenida y saldo. Se personalizan con `[Nombre]`.
- **Cuentas** (`config.cuentasPorSede`): Sofía (Produbanco Ahorro 12054049429,
  céd 1709369225) · Izhcayluma (Paladino Vanesa Elines, Guayaquil Ahorro
  0016243820, céd 1754146536) · Wisdom Forest (Benjamin Munro, Pichincha
  Ahorros 3874124900, céd 1500962608).
  ⚠ La cuenta del Domo **cambiará**: Sofía abrirá una cuenta nueva exclusiva
  para los eventos. Hoy apunta a la suya.
- **Formulario de inscripción propio** (`config.formulario`): 9 preguntas
  distintas a las de la formación. El público lo lee vía RPC
  `obtener_preinscripcion`, que devuelve el formulario del proyecto; si un
  proyecto no define `config.formulario`, cae al cuestionario clásico.
- **Brochure oficial**: `public/seminario-angelo-2026.pdf` (14 págs). Su portada
  es ahora `public/og-image.jpg` → la vista previa al compartir cualquier link.
- Ubicaciones: Domo https://maps.app.goo.gl/WrauzvKJot5NbNZF7 ·
  Casita del Yoga https://maps.app.goo.gl/vHP5keN2w66HgTap9
- Operación acordada: **Sofía hace el primer contacto y crea el lead; Micaela
  retoma pagos y logística, con supervisión de Sofía** (de ahí la bitácora).

---

## 4b. Avisos al equipo (WhatsApp + push)

Dos capas, deliberadamente distintas:

1. **Traspaso por WhatsApp** (`src/lib/avisos.js`): en la ficha del lead hay un
   botón "Pasar a Micaela" que abre WhatsApp con el resumen del lead ya armado
   y lo registra en la bitácora. Los destinatarios salen de `config.avisos.equipo`
   (Micaela: +593 98 789 2841). No envía solo: eso exigiría la API de WhatsApp
   Business.
2. **Notificaciones push** (Web Push): `public/sw.js` (handler `push` y
   `notificationclick`), `src/lib/push.js` (suscripción), tabla
   `push_subscriptions`, Edge Function **`enviar-push`**. Se disparan al crear
   un lead y al registrar un pago.
   - ⚠ **Secretos con sufijo `_YOGA`** (`VAPID_PUBLIC_KEY_YOGA`,
     `VAPID_PRIVATE_KEY_YOGA`, `VAPID_SUBJECT_YOGA`). Los genéricos
     `VAPID_*` ya existen y los usa **otra app** de JC (`push-on-new-movement`)
     en el mismo proyecto Supabase: **no tocarlos**.
   - En iPhone sólo funcionan con la PWA instalada en la pantalla de inicio.
3. **UI**: `src/push-banner.jsx` (aviso en el inicio para activar, descartable
   30 días) y `src/notif-bell.jsx` (campana con contador de novedades, lee la
   tabla `actividad`).

### Traspaso con responsable (11 ago 2026)

El botón "Pasar a Micaela" ya no sólo abre WhatsApp: **deja el lead asignado**
(`leads.asignado_a_email/nombre/at`), lo registra en la bitácora (`accion
'asigno'`) y le manda un **push dirigido sólo a esa persona** (parámetro
`paraEmail` nuevo en la Edge Function `enviar-push`, v6).

La ficha del lead muestra un bloque **Responsables**: quién lo creó
(`leads.creado_por_*`, sellado al crear y backfilleado desde `actividad`) y
quién lo tiene hoy, con botón "Me lo quedo yo". En la lista de leads aparece
un chip `→ Micaela`.

### Material compartible por proyecto

`src/material.jsx` — `ajustes.material` es una lista
`[{id,titulo,url,tipo,path}]`. Se sube desde Ajustes → "Material para
compartir" al bucket `material` bajo `proyecto-<id>/` (el card viejo subía
siempre a `programa.pdf`, compartido entre proyectos: reemplazado). Se envía
desde la ficha del lead o de la inscrita por WhatsApp, hoja de compartir del
sistema o copiando el link. El Seminario tiene cargado el brochure final.

⚠ Los **posts de lanzamiento** (PNG en la raíz del repo) NO están cargados:
tienen las fechas de Tena y Vilcabamba cruzadas. Cuando estén corregidos se
suben desde Ajustes, sin tocar código.

---

## 5. Lo que falta

- **Cuenta bancaria nueva del Domo** cuando Sofía la abra → actualizar
  `config.cuentasPorSede.1` y la plantilla `pago_domo`.
- **Validar en uso real con Micaela**: que entre, vea sólo el Seminario, cree un
  lead y registre un pago. Es la prueba pendiente más importante.
- Probar el push de punta a punta (nunca se validó con un dispositivo suscrito).
- Auditar `screen-detail.jsx` (ficha individual) y el flujo de comprobantes:
  probablemente con lenguaje/lógica de formación y sin filtro por proyecto.
- `comprobantes` no tiene `proyecto_id` (Micaela no los ve; denegado por
  defecto, aceptable hoy).
- Refinar sigue en su motor `taller_*`, con trigger (mig 035) que espeja sus
  inscritos a `personas`. Convergerlo del todo quedó pendiente.
- **Dos modelos coexisten:** `personas` + `participaciones` (mig 033/034, 35
  personas backfilleadas y deduplicadas) existe, pero el motor de la formación
  sigue usando `alumnas`/`leads` con `proyecto_id`. Hay que decidir si se
  unifica o se deja así deliberadamente.
- La vista previa de links (og-image) es **una sola para toda la app**: hoy
  muestra el seminario. Si se quiere una por proyecto, hace falta prerender.

---

## 6. Cómo desplegar

```bash
cd "/Users/carabela/Desktop/Claude Workspace/proyectos/dashboardSofi"
bash scripts/claude-push.sh "mensaje del commit"
```

Lee el token de `.claude-gh-token` (gitignored), commitea y pushea a `main`;
Vercel despliega solo. El build local en el sandbox de Cowork falla por
permisos del mount: verificar copiando el proyecto a `/tmp` y corriendo
`npm install && npx vite build` allí.

## Cambios del 11 de agosto 2026

- **Fix crítico del funnel**: convertir lead → inscrito en el Seminario fallaba
  en silencio (migración 040 + el `catch` ahora avisa). Ver trampas 9 y 10.
- **Pago en $0**: monto 0 y precio especial 0 son válidos (beca completa,
  canje, cortesía). Deja fila en `pagos` para que quede constancia, sin
  mandar push. `estadoPago()` y `registrarPago()` tratan total 0 como
  "completo" en vez de "pendiente".
- **Interés por sede** en el lead (`leads.interes_sedes`): chips en la ficha,
  chips en la lista y línea en el mensaje de traspaso.
- **Responsables del lead** y **material compartible** (arriba).
- `restaurar_lead` ya devuelve el `proyecto_id` (antes un lead del Seminario
  restaurado desde la papelera reaparecía en la formación).
- Brochure reemplazado por la versión final; `og-image.jpg` regenerada de esa
  portada (la anterior decía "SIDDHARTA", la final corrige a "SIDDHARTHA").

## Migraciones de esta etapa
`031` proyectos_borradores · `032` taller drop-in · `033` personas+participaciones ·
`034` backfill dedup · `035` sync taller→personas · `036` formación por proyecto ·
`037` usuarios/roles/actividad + seminario · `038` RLS por proyecto ·
`fix_recursion_es_admin` · `pagos_destino` · `archives_por_proyecto` ·
`039` leads interés/creador/asignado (+ fix `restaurar_lead`) ·
`040` `alumnas.tipo_inscripcion` acepta 'taller'
