// ──────────────────────────────────────────────────────────────
// Alcance de las features por proyecto.
//
// No todo el motor de la formación aplica a los demás proyectos. Las tablas
// `clases_abiertas` / `clase_inscripciones` NO tienen `proyecto_id`: nacieron
// para la clase regalo de la formación de junio y son globales. Si una
// pantalla las consulta sin preguntar en qué proyecto está, el Seminario
// termina mostrando gente inscrita a una clase de mayo de otro módulo
// (pasó el 11 ago 2026 con Gabriela Moyano y Karina Pinto).
//
// Regla: la clase abierta sólo existe para la formación (proyecto 2).
// ──────────────────────────────────────────────────────────────

export const PROYECTO_FORMACION = 2;

// Proyecto activo. Lo setea app.jsx en cada render; se lee en tiempo de
// ejecución (nunca a nivel de módulo: main.jsx carga todo en paralelo).
export function proyectoActivoId() {
  return window.PROYECTO_ID || PROYECTO_FORMACION;
}

// ¿Este proyecto usa la "clase abierta" (clase regalo de prueba)?
export function usaClasesAbiertas() {
  return proyectoActivoId() === PROYECTO_FORMACION;
}

// ¿Este proyecto lleva asistencia por día?
// El Seminario son 3 encuentros en sedes distintas y Sofía no la toma: la
// tarjeta y la grilla sólo ensuciaban la ficha. Se apaga por configuración
// (`config.usaAsistencia = false`) para no atarlo a un id de proyecto.
export function usaAsistencia(ajustes) {
  return (ajustes && ajustes.usaAsistencia === false) ? false : true;
}
