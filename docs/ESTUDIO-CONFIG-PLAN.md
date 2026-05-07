# Plan — Pantalla Config del Módulo Estudio

> Documento vivo. Define qué entra al MVP, qué crece después, y cómo
> evitar deuda técnica al añadir cosas. **No es código aún** — es la
> guía para construir `screen-estudio-ajustes.jsx` cuando lleguemos a
> ese paso del MVP.

---

## Filosofía

La Config es el "panel de control" del negocio. Tiene que cumplir tres cosas:

1. **Sofía edita sin pedir ayuda.** Todo lo que ve está en español, con valores que entiende.
2. **Lo que se edita aquí es la fuente única de verdad.** Si un precio sale en 4 pantallas, sale del mismo lugar.
3. **Crece sin romperse.** Cada sección es independiente. Añadir una nueva no obliga a tocar las demás.

Patrón existente que ya funciona en formación: `useAjustes.js` con un singleton `ajustes(id=1).data` jsonb. Lo replicamos para el estudio con su propio namespace.

---

## Estructura general

Vista en pestaña/secciones colapsables (mobile-first). Una columna sola, scroll vertical. Cada sección es una `<details>` o un acordeón.

```
┌─────────────────────────────────────────┐
│  ← Estudio · Ajustes                    │
├─────────────────────────────────────────┤
│                                         │
│  [▼] Información del estudio            │  ← MVP
│  [▼] Planes y precios                   │  ← MVP
│  [▼] Vencimientos y alertas             │  ← MVP
│  [▼] WhatsApp · plantillas              │  ← MVP
│  [▼] Datos de transferencia             │  ← MVP
│  [▼] Horarios y clases          (futuro)│
│  [▼] Profesoras y permisos      (futuro)│
│  [▼] Reportes y exportación     (futuro)│
│  [▼] Integraciones              (futuro)│
│  [▼] Avanzado                   (futuro)│
│                                         │
│  Versión 0.1 · Volver al estudio        │
└─────────────────────────────────────────┘
```

---

## Secciones del MVP (las que construimos en el paso "Config")

### 1. Información del estudio

**Qué edita Sofía:**
- Nombre del estudio (ej: "Sofía Lira Yoga")
- Lugar / dirección
- Maps URL (texto pegable)
- Bio corta (para futuras integraciones públicas)

**Dónde vive:**
`ajustes.data.estudio.info = { nombre, direccion, mapsUrl, bio }`

**Por qué importa:** se usa en plantillas WhatsApp ("Hola, soy de [estudio]…") y en el header del módulo.

---

### 2. Planes y precios

**Qué edita Sofía:**
- Lista de los planes activos del catálogo (`planes_catalogo`).
- Por plan: nombre, tipo, precio, duración (días), número de clases, descripción.
- Botones: editar, archivar (soft-delete), reactivar archivados.
- Botón "Crear plan nuevo" abre un sheet con el formulario.

**Dónde vive:**
Tabla `planes_catalogo` (no en `ajustes.data`). Es estructurada y crece.
La pantalla es CRUD sobre `usePlanes`.

**Por qué tabla y no jsonb:** los planes referencian membresías históricas vía `plan_snapshot`. Una tabla relacional con `activo` flag es la forma correcta. (El jsonb funciona para listas cortas inmutables tipo plantillas WA; los planes no son inmutables.)

**Detalles UX:**
- Campo "tipo" como segmented control (mensualidad / paquete / drop-in / trimestral / semestral).
- "Número de clases": campo solo aparece si tipo ≠ ilimitado. Placeholder = "ilimitado".
- Cambio de precio NO afecta membresías existentes (gracias al snapshot).

---

### 3. Vencimientos y alertas

**Qué edita Sofía:**
- **Ventana de alerta** (días antes de vencer): default 7. Configurable: 3 / 7 / 14 / custom.
- **Texto del banner** "Vence pronto" (con placeholder `{nombre}` y `{dias}`).
- Toggle: ¿incluir paquetes "casi consumidos" (clases_restantes ≤ 2) en alertas? Default: sí.

**Dónde vive:**
`ajustes.data.estudio.vencimientos = { ventanaDias, alertaPaqueteCerca, mensajeBanner }`

**Por qué importa:** controla la pregunta clave que hace Sofía cada lunes ("¿a quién se le caduca pronto?"). Que sea editable evita hardcodear "7 días" en 3 lugares.

---

### 4. WhatsApp · plantillas (estudio)

**Qué edita Sofía:**
- Lista de plantillas con `id` interno, título y cuerpo.
- Drag para reordenar.
- Placeholders soportados: `{nombre}`, `{plan}`, `{vence}`, `{dias}`, `{clases}`, `{monto}`.

**Plantillas seed (las cargamos de fábrica):**
1. **Bienvenida** — primera vez que entra al estudio.
2. **Recordatorio de vencimiento** — "Hola {nombre}, tu plan {plan} vence en {dias} días…"
3. **Plan vencido** — "Hola {nombre}, tu plan {plan} venció el {vence}…"
4. **Confirmación de pago** — "Recibimos tu pago de ${monto}, tu plan está activo hasta {vence}."
5. **Datos de transferencia** — reusa los mismos datos que formación (single source).

**Dónde vive:**
`ajustes.data.estudio.plantillasWA = [{ id, titulo, cuerpo }]`

**Por qué jsonb:** lista corta (~6 plantillas), edición simple, sin relaciones.

---

### 5. Datos de transferencia

**Qué edita Sofía:**
- Banco, cuenta, cédula, email asociado.
- (Reusa exactamente los mismos datos que el módulo formación.)

**Dónde vive:**
`ajustes.data.transferencia = { banco, cuenta, cedula, email }` — **compartido** con formación. Si Sofía cambia el banco, cambia en ambos módulos. Eso es lo que queremos.

**Por qué compartido:** Sofía es una sola persona, su cuenta es una sola. El plantillas seed apuntan al mismo objeto.

---

## Secciones futuras (planear hueco visual y de schema)

### 6. Horarios y clases (próxima iteración grande)

**Qué traerá:**
- Catálogo de clases recurrentes (ej: Lunes 7am Hatha, Miércoles 6pm Vinyasa).
- Reserva de cupos por clase.
- Asistencia que descuenta automáticamente del paquete.

**Schema futuro estimado:**
- `horarios` (clase recurrente: dia_semana, hora, duracion, tipo_yoga, capacidad)
- `clases_realizadas` (instancia de un horario en una fecha concreta)
- `asistencia_estudio` (estudiante, clase_realizada, presente)

**Lo que reservo en Config hoy:** un placeholder visual "Próximamente" o lo dejo fuera de la UI hasta que se construya. **Recomendación:** dejarlo fuera. Sin código no hay fricción.

---

### 7. Profesoras y permisos

**Qué traerá:**
- Si Sofía contrata otra profesora, dar acceso limitado (solo ver su agenda).
- Whitelist editable desde la UI (hoy es código en `is_authorized()`).

**Bloqueador:** la whitelist actual está en SQL + JS. Mover a tabla `usuarios_autorizados` requiere migración. No es MVP.

---

### 8. Reportes y exportación

**Qué traerá:**
- Exportar pagos del mes a CSV / PDF.
- Reporte fiscal (Ecuador: facturación electrónica si Sofía emite RIDE).
- Cuadre de caja diario (efectivo recibido).

---

### 9. Integraciones

**Candidatas:**
- WhatsApp Business API (hoy es manual).
- Google Calendar (sincronizar horarios).
- Pasarela de pago (Payphone está en formación; replicar para que el público pague el plan online).

---

### 10. Avanzado / Zona peligrosa

- Borrar todos los pagos (con doble confirmación).
- Resetear catálogo de planes al seed inicial.
- Exportar backup completo del estudio (JSON).

---

## Patrón de "fuente única de verdad"

Para evitar el problema de `DIAS_FORMACION` (hoy duplicado en 3 sitios — ver `AGENTS.md` línea 179):

| Dato | Vive en | Lo lee |
|---|---|---|
| Planes activos | `planes_catalogo` (tabla) | `usePlanes` |
| Ventana de alertas | `ajustes.data.estudio.vencimientos.ventanaDias` | `useAjustes` |
| Plantillas WA estudio | `ajustes.data.estudio.plantillasWA` | `useAjustes` |
| Datos de transferencia | `ajustes.data.transferencia` (compartido) | `useAjustes` |
| Info del estudio | `ajustes.data.estudio.info` | `useAjustes` |

**Regla de oro:** ningún componente del módulo estudio define un valor por defecto inline. Todo viene de `useAjustes` o `usePlanes`. Si falta, se cae al `DEFAULT_AJUSTES.estudio` definido en `useAjustes.js`.

### Extensión necesaria a `useAjustes.js`

Hoy `DEFAULT_AJUSTES` solo tiene cosas de formación. Cuando construyamos la Config, hay que añadir:

```js
const DEFAULT_AJUSTES_ESTUDIO = {
  estudio: {
    info: {
      nombre: 'Sofía Lira Yoga',
      direccion: '',
      mapsUrl: '',
      bio: '',
    },
    vencimientos: {
      ventanaDias: 7,
      alertaPaqueteCerca: true,
      mensajeBanner: 'A {nombre} le quedan {dias} días',
    },
    plantillasWA: [
      { id: 'bienvenida', titulo: 'Bienvenida', cuerpo: '...' },
      { id: 'vence_pronto', titulo: 'Vence pronto', cuerpo: '...' },
      { id: 'vencido', titulo: 'Plan vencido', cuerpo: '...' },
      { id: 'confirmacion_pago', titulo: 'Confirmación de pago', cuerpo: '...' },
    ],
  },
  // `transferencia` ya existe en formación, se comparte
};
```

Merge profundo: `{ ...DEFAULT_AJUSTES, ...DEFAULT_AJUSTES_ESTUDIO, ...data.data }`.

---

## Jerarquía de navegación propuesta

```
Tab bar del Estudio (cuando construyamos las pantallas):
  [Hoy]  [Estudiantes]  [Pagos]  [Vencimientos]   ← 4 tabs principales
            ┌─ FAB (botón flotante "+")
            └─ Ajustes (icono engranaje en header)
```

La Config se accede desde el header (icono engranaje), no es un tab. Mismo patrón que `screen-ajustes.jsx` actual.

---

## Wireframe textual del MVP (sección por sección)

```
┌─────────────────────────────────────────────────────┐
│  ← Estudio · Ajustes                          [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▼ INFORMACIÓN DEL ESTUDIO                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ Nombre del estudio                          │    │
│  │ [Sofía Lira Yoga          ]                 │    │
│  │                                             │    │
│  │ Dirección                                   │    │
│  │ [Domo Soulspace · Tumbaco ]                 │    │
│  │                                             │    │
│  │ Maps URL                                    │    │
│  │ [https://maps.app.goo.gl/...]               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▼ PLANES Y PRECIOS                                 │
│  ┌─────────────────────────────────────────────┐    │
│  │  Mensualidad 1x/sem      $35    [Editar]    │    │
│  │  Mensualidad 2x/sem      $60    [Editar]    │    │
│  │  Mensualidad ilimitada   $90    [Editar]    │    │
│  │  Paquete 10 clases       $90    [Editar]    │    │
│  │  Paquete 20 clases       $160   [Editar]    │    │
│  │  Drop-in                 $12    [Editar]    │    │
│  │  Trimestral ilimitada    $240   [Editar]    │    │
│  │  Semestral ilimitada     $450   [Editar]    │    │
│  │                                             │    │
│  │  + Crear plan nuevo                         │    │
│  │  Ver archivados (2)                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▼ VENCIMIENTOS Y ALERTAS                           │
│  ┌─────────────────────────────────────────────┐    │
│  │ Ventana de alerta                           │    │
│  │ ◯ 3 días   ● 7 días   ◯ 14 días   ◯ Otro    │    │
│  │                                             │    │
│  │ ☑ Alertar también cuando queden ≤2 clases   │    │
│  │   en paquetes                               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▼ WHATSAPP · PLANTILLAS                            │
│  ┌─────────────────────────────────────────────┐    │
│  │  ≡ Bienvenida                    [Editar]   │    │
│  │  ≡ Vence pronto                  [Editar]   │    │
│  │  ≡ Plan vencido                  [Editar]   │    │
│  │  ≡ Confirmación de pago          [Editar]   │    │
│  │                                             │    │
│  │  + Nueva plantilla                          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▼ DATOS DE TRANSFERENCIA                           │
│  ┌─────────────────────────────────────────────┐    │
│  │ ⓘ Compartidos con formación                 │    │
│  │                                             │    │
│  │ Banco: [Produbanco        ]                 │    │
│  │ Cuenta:[12054049429       ] [Ahorro ▼]      │    │
│  │ Cédula:[1709369225        ]                 │    │
│  │ Email: [sofilira@gmail.com]                 │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Reglas para crecer sin deuda

1. **Cada sección nueva** = 1 PR / 1 entrega. No se mezcla con cambios en otras secciones.
2. **Antes de hardcodear un valor**, preguntar: "¿esto va a ser editable algún día?". Si sí → en `ajustes.data.estudio` o tabla propia desde el día 1.
3. **Cuando una sección de Config crezca >50 líneas**, mover a su propio archivo (`screen-estudio-ajustes-planes.jsx`, etc.) e importarlo desde `screen-estudio-ajustes.jsx`. Mismo patrón que `forms.jsx` actual.
4. **No mezclar lectura y escritura.** La Config solo escribe en `useAjustes` / `usePlanes`. El resto de pantallas solo lee.
5. **Documentar aquí** cada sección nueva ANTES de codearla. Este archivo es la fuente.

---

## Checklist al construir la pantalla (siguiente entrega del MVP)

- [ ] Crear `src/screen-estudio-ajustes.jsx` con el shell de las 5 secciones.
- [ ] Extender `DEFAULT_AJUSTES` con el namespace `estudio.*`.
- [ ] Cada sección es un componente separado dentro del archivo (o archivo aparte si crece).
- [ ] CRUD de planes usa `usePlanes` directo (no pasa por `useAjustes`).
- [ ] Plantillas WA: editor en sheet con preview de placeholders.
- [ ] Botón "Volver al estudio" cierra la pantalla y vuelve al home del estudio.
- [ ] Ningún valor hardcodeado. Si falta default, va a `DEFAULT_AJUSTES.estudio`.
