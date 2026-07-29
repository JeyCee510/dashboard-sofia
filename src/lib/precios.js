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

// ── Precio por SEDE (cada encuentro cuesta distinto) ──
// Caso Seminario Angelo: Quito $242/$280, Vilcabamba y Tena $525/$590 c/u.
// Se suma lo elegido. `prontoPago` decide qué columna usar. El descuento por
// venir a varios encuentros se aplica aparte (config.descuentoMultiple).
export function tienePreciosPorEncuentro(ajustes) {
  return !!ajustes?.matrizPrecios
      || (Array.isArray(ajustes?.preciosPorEncuentro) && ajustes.preciosPorEncuentro.length > 0);
}

// ── Matriz de precios (Seminario Angelo) ──
// El precio de CADA sede depende de cuántas sedes toma la persona:
//   3 sedes → Domo 200, Izhcayluma 400, Wisdom 400  (total 1000)
//   2 sedes → 222 / 490 / 490
//   1 sede  → 242 / 525 / 525 (pronto pago) · 280 / 590 / 590 (regular)
// El "descuento por venir a varios" ya está incorporado en la matriz.
export function precioSedeSegunCantidad(sedeN, cantidad, ajustes, { prontoPago = false } = {}) {
  const m = ajustes?.matrizPrecios;
  if (!m) return 0;
  const fila = cantidad >= 3 ? m['3']
             : cantidad === 2 ? m['2']
             : (prontoPago ? m['1_pp'] : m['1']);
  return Number(fila?.[String(sedeN)] ?? 0);
}

export function precioPorEncuentros(encuentrosElegidos, ajustes, { prontoPago = false } = {}) {
  const sel = encuentrosElegidos || [];
  // Caso matriz (precio por sede según cuántas toma) — Seminario Angelo
  if (ajustes?.matrizPrecios) {
    return sel.reduce((s, n) => s + precioSedeSegunCantidad(n, sel.length, ajustes, { prontoPago }), 0);
  }
  const lista = ajustes?.preciosPorEncuentro || [];
  const bruto = lista
    .filter(e => sel.includes(e.n))
    .reduce((s, e) => s + Number(prontoPago ? e.prontoPago : e.regular) || 0, 0);
  // Descuento por múltiples encuentros (si está configurado)
  const d = ajustes?.descuentoMultiple || null;
  if (d && sel.length >= (d.desde || 2)) {
    if (d.monto) return Math.max(0, bruto - Number(d.monto));
    if (d.porcentaje) return Math.round(bruto * (1 - Number(d.porcentaje) / 100));
  }
  return bruto;
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
