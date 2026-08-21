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

// ──────────────────────────────────────────────────────────────
// Cuentas de destino del dinero.
//
// En el Seminario hay tres: la de Sofía y las de los dos centros que hospedan
// los retiros. El abono de reserva se paga DIRECTO al centro, así que esa
// plata nunca pasa por Sofía y no debe sumar en su estado de cuenta — pero sí
// cuenta como pagado para el estudiante. Los nombres salen de
// `config.reglaPagos.destinos` para no hardcodear aliados.
// ──────────────────────────────────────────────────────────────
export const DESTINO_PROPIO = 'sofia';

export function etiquetaDestino(ajustes, destino) {
  if (!destino || destino === DESTINO_PROPIO) return 'A tu cuenta';
  const mapa = (ajustes && ajustes.reglaPagos && ajustes.reglaPagos.destinos) || {};
  return mapa[destino] || destino;
}

// ¿Este proyecto cobra a más de una cuenta? Si no, no tiene sentido mostrar
// ningún desglose por destino (formación, estudio).
export function tieneCuentasAliadas(ajustes) {
  const mapa = (ajustes && ajustes.reglaPagos && ajustes.reglaPagos.destinos) || {};
  return Object.keys(mapa).filter(k => k !== DESTINO_PROPIO).length > 0;
}
