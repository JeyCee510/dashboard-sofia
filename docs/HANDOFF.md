# Handoff · Dashboard Sofía — 28 julio 2026

Estado del proyecto para quien retome (persona o agente). Complementa `AGENTS.md`
(convenciones y stack) y `docs/arquitectura-multiproyecto.md` (el modelo objetivo).

Producción: https://dashboard-sofia.vercel.app · Supabase: `orceickorgdynlsbskvx`

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
- **12 plantillas de WhatsApp** en `config.plantillasWA`, ordenadas por el flujo
  real: primer contacto e info (Sofía) → detalle por sede → recordar pronto
  pago, cómo apartar cupo, seguimiento, becas (Micaela) → bienvenida y saldo.
  Se personalizan con `[Nombre]`.
- Operación acordada: **Sofía hace el primer contacto y crea el lead; Micaela
  retoma pagos y logística, con supervisión de Sofía** (de ahí la bitácora).

---

## 5. Lo que falta

- **Datos bancarios de Izhcayluma y Wisdom Forest** → único pendiente que
  depende de Sofía/JC; completa la plantilla "cómo apartar el cupo".
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
- Probar en vivo con Micaela: que entre y confirme que sólo ve el Seminario.

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

## Migraciones de esta etapa
`031` proyectos_borradores · `032` taller drop-in · `033` personas+participaciones ·
`034` backfill dedup · `035` sync taller→personas · `036` formación por proyecto ·
`037` usuarios/roles/actividad + seminario · `038` RLS por proyecto ·
`fix_recursion_es_admin` · `pagos_destino` · `archives_por_proyecto`
