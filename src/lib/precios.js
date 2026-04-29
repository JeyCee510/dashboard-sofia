// ─────────────────────────────────────────────────────────────────────
// Cálculo de precios según tipo de inscripción + bono silla.
// Centralizado aquí para que la lógica viva en un solo lugar.
// ─────────────────────────────────────────────────────────────────────

// Defaults — pueden ser sobrescritos por ajustes.precios
export const PRECIOS_DEFAULT = {
  completa: { sin_silla: 610, con_silla: 640 },
  dos_encuentros: { sin_silla: 370, con_silla: 410 },
  un_encuentro: { sin_silla: 185, con_silla: 225 },
  reserva: 200,
  pronto_pago_completa: 484, // descuento solo aplica a completa
};

export const TIPOS_INSCRIPCION = [
  { value: 'completa', label: 'Completa (50h · 3 encuentros)' },
  { value: 'dos_encuentros', label: '2 encuentros' },
  { value: 'un_encuentro', label: '1 encuentro' },
];

export const ENCUENTROS = [
  { num: 1, label: 'Encuentro 1', fechas: '6 y 7 jun', dias: [0, 1] },
  { num: 2, label: 'Encuentro 2', fechas: '13 y 14 jun', dias: [2, 3] },
  { num: 3, label: 'Encuentro 3', fechas: '20 y 21 jun', dias: [4, 5] },
];

// Calcula el total esperado según tipo + silla. Permite override desde ajustes.
export function calcularTotal({ tipo, bonoSilla, ajustes }) {
  const precios = (ajustes && ajustes.precios) || PRECIOS_DEFAULT;
  const tipoMap = precios[tipo] || PRECIOS_DEFAULT[tipo] || PRECIOS_DEFAULT.completa;
  return bonoSilla ? tipoMap.con_silla : tipoMap.sin_silla;
}

// Resuelve qué días (0..5) debería atender una alumna según sus encuentros_asistir
export function diasAsistencia(encuentrosAsistir) {
  const set = new Set();
  (encuentrosAsistir || [1, 2, 3]).forEach(num => {
    const e = ENCUENTROS.find(x => x.num === num);
    if (e) e.dias.forEach(d => set.add(d));
  });
  return [...set].sort((a, b) => a - b);
}

// Para un día (0..5), devuelve el número del encuentro al que pertenece
export function encuentroDelDia(diaIdx) {
  const e = ENCUENTROS.find(x => x.dias.includes(diaIdx));
  return e ? e.num : null;
}

// ¿Le toca a esta alumna asistir el día diaIdx?
export function alumnaAsisteDia(alumna, diaIdx) {
  const enc = encuentroDelDia(diaIdx);
  if (enc === null) return false;
  const lista = alumna.encuentros_asistir || alumna.encuentrosAsistir || [1, 2, 3];
  return lista.includes(enc);
}
