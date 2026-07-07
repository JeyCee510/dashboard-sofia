// ─────────────────────────────────────────────────────────────────────
// Cálculo de precios según tipo de inscripción + bono silla.
// Centralizado aquí para que la lógica viva en un solo lugar.
// ─────────────────────────────────────────────────────────────────────

// Defaults — pueden ser sobrescritos por ajustes.precios.
// Descuento por renunciar a silla = $40 en todos los tipos.
export const PRECIOS_DEFAULT = {
  completa: { sin_silla: 600, con_silla: 640 },
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

// ─────────────────────────────────────────────────────────────────────
// Modo TALLER drop-in (aditivo, no afecta la formación):
// cada encuentro es independiente y el precio depende del NÚMERO de
// encuentros elegidos (tiers). Los encuentros y tiers vienen de la config
// del proyecto (ajustes: tipo='taller', diasFormacion[], tiers{}).
// ─────────────────────────────────────────────────────────────────────
export function esTaller(ajustes) {
  return ajustes?.tipo === 'taller' && Array.isArray(ajustes?.diasFormacion);
}

// Encuentros del proyecto. Formación → ENCUENTROS fijo (3, pares de días).
// Taller → uno por cada día de ajustes.diasFormacion.
export function encuentrosDeAjustes(ajustes) {
  if (esTaller(ajustes)) {
    return ajustes.diasFormacion.map((d, i) => ({
      num: i + 1,
      label: d.label || `Encuentro ${i + 1}`,
      fechas: d.fecha || '',
      dias: [d.idx ?? i],
    }));
  }
  return ENCUENTROS;
}

// Precio por número de encuentros elegidos (tiers del taller).
export function precioTaller(nEncuentros, ajustes) {
  const tiers = ajustes?.tiers || {};
  const total = ajustes?.diasFormacion?.length || 6;
  // Si eligió todos → precio del paquete completo si existe.
  if (nEncuentros >= total && tiers[String(total)] != null) return Number(tiers[String(total)]);
  return Number(tiers[String(nEncuentros)] ?? tiers.default ?? 0);
}

// Calcula el total esperado según tipo + silla. Permite override desde ajustes.
export function calcularTotal({ tipo, bonoSilla, ajustes }) {
  const precios = (ajustes && ajustes.precios) || PRECIOS_DEFAULT;
  const tipoMap = precios[tipo] || PRECIOS_DEFAULT[tipo] || PRECIOS_DEFAULT.completa;
  return bonoSilla ? tipoMap.con_silla : tipoMap.sin_silla;
}

// Resuelve qué días debería atender una alumna según sus encuentros_asistir.
// `encuentros` opcional: por defecto ENCUENTROS (formación); el taller pasa los suyos.
export function diasAsistencia(encuentrosAsistir, encuentros = ENCUENTROS) {
  const set = new Set();
  (encuentrosAsistir || [1, 2, 3]).forEach(num => {
    const e = encuentros.find(x => x.num === num);
    if (e) e.dias.forEach(d => set.add(d));
  });
  return [...set].sort((a, b) => a - b);
}

// Para un día, devuelve el número del encuentro al que pertenece
export function encuentroDelDia(diaIdx, encuentros = ENCUENTROS) {
  const e = encuentros.find(x => x.dias.includes(diaIdx));
  return e ? e.num : null;
}

// ¿Le toca a esta alumna asistir el día diaIdx?
export function alumnaAsisteDia(alumna, diaIdx, encuentros = ENCUENTROS) {
  const enc = encuentroDelDia(diaIdx, encuentros);
  if (enc === null) return false;
  const lista = alumna.encuentros_asistir || alumna.encuentrosAsistir || [1, 2, 3];
  return lista.includes(enc);
}

// ─────────────────────────────────────────────────────────────────────
// Estado de pago derivado · NO leer alumna.pago directo. Antes
// dependía de una etiqueta que se desincronizaba (alguien con pago=
// 'pronto-pago' pero pagado<total se contaba como pagado). Ahora es pura
// función de (pagado, total).
// ─────────────────────────────────────────────────────────────────────
export function estadoPago(a) {
  const total = Number(a?.total) || 0;
  const pagado = Number(a?.pagado) || 0;
  if (total === 0) return 'pendiente';
  if (pagado >= total) return 'completo';
  if (pagado > 0) return 'parcial';
  return 'pendiente';
}

// ¿El PRODUCTO comprado fue pronto pago? Se detecta por precio total ===
// precio pronto pago. Útil para etiquetar en la UI (pill, listados).
export function esProntoPagoProducto(a, precioProntoPago) {
  const pp = Number(precioProntoPago) || 484;
  return a?.tipo_inscripcion === 'completa' && Number(a?.total) === pp;
}
