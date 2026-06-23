# Arquitectura multi-proyecto (objetivo) — 2026-06-23

> Documento de convergencia. Decidido con Juan Cristóbal: **un solo modelo** para todos los
> proyectos (formación, taller, estudio, futuros), con **base de personas/leads compartida**
> y el **shell familiar de la formación** (pestañas Hoy / Inscritos / Pagos / Leads).
> Este doc es la fuente de verdad del refactor. Si vas a tocar proyectos, sigue esto y no
> crees patrones paralelos.

## Contexto: por qué este doc

A lo largo del 2026-06-23 se construyeron, en sesiones distintas, **dos patrones que compiten**:

1. **Formación** (legado): `alumnas` + `leads` + `pagos` + `asistencia`. Shell con pestañas
   Hoy/Inscritos/Pagos/Leads. Es el que Sofía ya domina. Formación de junio = **archivada**.
2. **Taller drop-in modular** (`taller_*`, migración 032): tablas propias (`taller_inscritos`,
   `taller_pagos`, `taller_encuentros`, …), pantalla `screen-taller.jsx` (3 tabs), proyecto
   "Refinar la Práctica" publicado. **Aislado**: no comparte leads ni reusa el shell de la formación.

El pedido de Juan es que los proyectos nuevos **se sientan como la formación** y que **leads y
personas se compartan** entre todos. Eso es incompatible con mantener el taller aislado. Convergemos.

Estado que habilita el refactor sin riesgo: "Refinar la Práctica" tiene **0 inscritos / 0 pagos**
(solo 6 encuentros configurados). Migrarlo no arriesga data de participantes.

## Modelo de datos objetivo

Separar **identidad** (la persona) de **participación** (su rol en cada proyecto).

```
personas            ← base ÚNICA y COMPARTIDA de seres humanos (la "agenda")
  id, nombre, tel, instagram, email, avatar, iniciales, notas, created_at, updated_at

proyectos           ← ya existe (mig 032). Un proyecto = un producto.
  id, slug, nombre, tipo, estado(activo|archivado|borrador), shell(formacion|estudio),
  descripcion, config(jsonb: precios/tiers/fechas/cupos/ubicacion…), borrador_id, …

participaciones     ← relación persona ↔ proyecto (reemplaza el "ser alumna/inscrito de X")
  id, persona_id → personas, proyecto_id → proyectos,
  rol(lead|inscrito), estado, tipo_inscripcion, total, pagado, bono_silla,
  notas, plan_pagos, fecha_inscripcion, config(jsonb por-proyecto), created_at, updated_at
  UNIQUE(persona_id, proyecto_id)

pagos               ← persona/participación + proyecto_id (ya soportado por taller_pagos / pagos)
asistencia/encuentros ← por proyecto. Para talleres modulares: encuentros + asistencia por encuentro.
```

Claves:
- **Leads = personas con una participación rol='lead'** (o sin participación de inscripción).
  Se ven en TODOS los proyectos (pool global), filtrables por proyecto de interés.
- Una persona puede ser lead del taller, inscrita de la formación y miembro del estudio:
  **una fila en `personas`, N filas en `participaciones`**. Cero duplicación de contacto.
- `taller_encuentros` + asistencia-por-encuentro se quedan (el "drop-in modular" es un buen patrón);
  solo cambia que el inscrito ahora es `participaciones` apuntando a `personas`, no `taller_inscritos`.

## Shell de UI (lo que ve Sofía)

Un **único shell** parametrizado por `proyecto_id` activo, idéntico al de la formación:
**Hoy · Inscritos · Pagos · Leads** (barra inferior). 

- Para proyectos **modulares** (taller/formación con encuentros): la pestaña Inscritos muestra
  qué encuentros tomó cada persona; "Hoy" muestra el próximo encuentro.
- Para proyectos **recurrentes** (estudio): el shell puede variar a membresías, pero comparte
  la misma base de personas/leads.
- **Leads** es la misma pestaña en todos: pool compartido de `personas`.

El launcher (home) lista los `proyectos` (estado != borrador) como tarjetas; entrar a uno setea
`proyectoActivo` (localStorage) y carga el shell con ese `proyecto_id`.

## Plan de migración (aditivo, por fases, sin romper prod)

**Regla:** nunca DROP/DELETE de tablas con datos. Las viejas quedan de respaldo hasta validar.

- **Fase 0 — Lock + backup.** Este doc + `backups/backup-2026-06-23.json` (217 filas). ✅
- **Fase 1 — Foundation (DB, aditiva).** Crear `personas` + `participaciones`. Extender `proyectos`
  con `shell`, `modalidad`, `ubicacion`, `cupos`, `precio_base`, `updated_at`. Seed proyectos
  `formacion-junio-2026` (archivado) y `estudio`. Backfill `personas` deduplicado desde
  `leads` + `alumnas` + `estudiantes_estudio` + `taller_inscritos` (match por tel/IG/email/nombre).
  Backfill `participaciones` desde alumnas (rol=inscrito, proyecto=formación), leads (rol=lead),
  estudiantes (proyecto=estudio), taller (proyecto=refinar). **No toca el frontend; la app sigue igual.**
- **Fase 2 — Frontend lectura.** Hooks nuevos `usePersonas`, `useParticipaciones`, `useProyectos`
  + `proyectoActivo`. El shell de la formación se vuelve plantilla por `proyecto_id`. Probar en
  **rama git → preview de Vercel** antes de main.
- **Fase 3 — Reapuntar taller + estudio** al shell único y a personas/participaciones. Recrear
  "Refinar la Práctica" en el modelo nuevo (no tiene inscritos, es trivial).
- **Fase 4 — Wizard publica** un borrador como `proyecto` real (estado activo) con su shell.
- **Fase 5 — Cleanup** (solo tras validar en vivo varios días): congelar `taller_*`/`alumnas`/`leads`
  legacy como respaldo. NO borrar sin OK explícito de Juan.

## Qué NO hacer
- No crear más namespaces aislados por producto (`taller_*`, `retiro_*`, …). Todo va a
  `personas` + `participaciones` + `proyectos`.
- No DROP/DELETE de datos vivos.
- No mergear frontend a `main` sin probar en preview.
