// ────────────────────────────────────────────────────────────────────────
// Mock data + helpers — Yoga Sofía Lira
// Formación 50 horas · Junio 6-21 2026 · Domo Soulspace, Tumbaco
// ────────────────────────────────────────────────────────────────────────

// Precio regular $640, pronto pago $484 (hasta 10 mayo), reserva $200
// Bono silla: primeros 6 inscritos reciben silla de yoga profesional gratis
// Capacidad: 25

const MOCK_ALUMNAS = [
  { id: 1, nombre: 'María Fernanda Castro', iniciales: 'MF', tel: '+593 99 234 5678', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '14 abr', notas: 'Llega siempre puntual. Pregunta mucho sobre pranayama.', bonoSilla: true, avatar: 'oklch(0.78 0.06 60)' },
  { id: 2, nombre: 'Andrea Pacheco Luna', iniciales: 'AP', tel: '+593 98 988 1122', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '02 abr', notas: 'Muy avanzada en asanas, tímida con grupos.', bonoSilla: true, avatar: 'oklch(0.72 0.08 30)' },
  { id: 3, nombre: 'Lucía Rendón', iniciales: 'LR', tel: '+593 96 544 7788', pago: 'pendiente', total: 640, pagado: 200, asistencia: [1,0,0,0,0,0], inscrita: '20 abr', notas: 'Reservó hace 5 semanas. Falta cubrir el saldo.', bonoSilla: true, avatar: 'oklch(0.74 0.05 80)' },
  { id: 4, nombre: 'Daniela Soto Mora', iniciales: 'DS', tel: '+593 99 766 3322', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '08 abr', notas: '', bonoSilla: true, avatar: 'oklch(0.76 0.07 45)' },
  { id: 5, nombre: 'Paulina Velázquez', iniciales: 'PV', tel: '+593 98 122 3344', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '11 abr', notas: 'Recomendada por María Fernanda.', bonoSilla: true, avatar: 'oklch(0.70 0.08 20)' },
  { id: 6, nombre: 'Renata Aguilar', iniciales: 'RA', tel: '+593 99 899 6655', pago: 'parcial', total: 484, pagado: 300, asistencia: [1,1,0,0,0,0], inscrita: '15 abr', notas: 'Pago en 2 partes. Falta segunda mitad.', bonoSilla: true, avatar: 'oklch(0.78 0.05 70)' },
  { id: 7, nombre: 'Camila Ortega', iniciales: 'CO', tel: '+593 96 433 5566', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '01 abr', notas: 'Profe de pilates. Quiere certificarse.', avatar: 'oklch(0.72 0.08 50)' },
  { id: 8, nombre: 'Valeria Mendoza', iniciales: 'VM', tel: '+593 99 233 4455', pago: 'pendiente', total: 640, pagado: 200, asistencia: [0,1,0,0,0,0], inscrita: '22 abr', notas: '', avatar: 'oklch(0.74 0.06 40)' },
  { id: 9, nombre: 'Sofía Reyes Bonilla', iniciales: 'SR', tel: '+593 98 677 8899', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '06 abr', notas: 'Llega con su propia mat siempre.', avatar: 'oklch(0.76 0.07 25)' },
  { id: 10, nombre: 'Adriana Limón', iniciales: 'AL', tel: '+593 96 988 7766', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '04 abr', notas: '', avatar: 'oklch(0.78 0.05 55)' },
  { id: 11, nombre: 'Ximena Tapia', iniciales: 'XT', tel: '+593 99 344 5566', pago: 'parcial', total: 484, pagado: 350, asistencia: [1,1,0,0,0,0], inscrita: '17 abr', notas: 'Falta poco para terminar pago.', avatar: 'oklch(0.74 0.07 65)' },
  { id: 12, nombre: 'Mariana Quiroga', iniciales: 'MQ', tel: '+593 98 544 3322', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '10 abr', notas: '', avatar: 'oklch(0.72 0.06 35)' },
  { id: 13, nombre: 'Isabel Carrillo', iniciales: 'IC', tel: '+593 99 122 9988', pago: 'pendiente', total: 640, pagado: 200, asistencia: [1,1,0,0,0,0], inscrita: '24 abr', notas: 'Confirmar saldo antes del Encuentro 2.', avatar: 'oklch(0.76 0.05 50)' },
  { id: 14, nombre: 'Fernanda Olvera', iniciales: 'FO', tel: '+593 96 344 5566', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '12 abr', notas: '', avatar: 'oklch(0.78 0.06 75)' },
  { id: 15, nombre: 'Regina Solís', iniciales: 'RS', tel: '+593 99 877 6655', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '07 abr', notas: 'Lleva 3 años practicando. Muy comprometida.', avatar: 'oklch(0.70 0.08 28)' },
  { id: 16, nombre: 'Beatriz Navarro', iniciales: 'BN', tel: '+593 98 655 4433', pago: 'parcial', total: 640, pagado: 400, asistencia: [1,0,0,0,0,0], inscrita: '18 abr', notas: '', avatar: 'oklch(0.74 0.05 45)' },
  { id: 17, nombre: 'Laura Hinojosa', iniciales: 'LH', tel: '+593 96 455 6677', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '09 abr', notas: '', avatar: 'oklch(0.76 0.07 38)' },
  { id: 18, nombre: 'Natalia Ruiz', iniciales: 'NR', tel: '+593 99 233 4455', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '05 abr', notas: 'Trae a su hermana al curso siguiente.', avatar: 'oklch(0.72 0.08 22)' },
  { id: 19, nombre: 'Alejandra Domínguez', iniciales: 'AD', tel: '+593 98 988 7766', pago: 'pendiente', total: 640, pagado: 200, asistencia: [1,1,0,0,0,0], inscrita: '23 abr', notas: '', avatar: 'oklch(0.78 0.05 65)' },
  { id: 20, nombre: 'Karla Esquivel', iniciales: 'KE', tel: '+593 96 544 3322', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '13 abr', notas: '', avatar: 'oklch(0.74 0.06 30)' },
  { id: 21, nombre: 'Jimena Aguirre', iniciales: 'JA', tel: '+593 99 788 9900', pago: 'pronto-pago', total: 484, pagado: 484, asistencia: [1,1,0,0,0,0], inscrita: '03 abr', notas: 'Profe de hatha. Busca refinar ajustes.', avatar: 'oklch(0.76 0.07 42)' },
  { id: 22, nombre: 'Constanza Bravo', iniciales: 'CB', tel: '+593 98 122 3344', pago: 'parcial', total: 640, pagado: 450, asistencia: [1,1,0,0,0,0], inscrita: '19 abr', notas: '', avatar: 'oklch(0.78 0.05 32)' },
];

const MOCK_LEADS = [
  { id: 101, nombre: 'Mónica Salinas', tel: '+593 99 432 8765', fuente: 'instagram', estado: 'nuevo', mensaje: 'Hola, vi tu post de la formación, ¿quedan cupos?', tiempo: 'hace 12 min' },
  { id: 102, nombre: 'Daniela Cruz', tel: '+593 98 876 4321', fuente: 'whatsapp', estado: 'nuevo', mensaje: '¿Cuánto cuesta el curso completo?', tiempo: 'hace 38 min' },
  { id: 103, nombre: 'Jessica Romo', tel: '+593 96 121 3434', fuente: 'referido', estado: 'interesado', mensaje: 'María Fernanda me recomendó. Cuéntame más por favor 🙏', tiempo: 'hoy' },
  { id: 104, nombre: 'Gabriela Tovar', tel: '+593 99 556 7788', fuente: 'instagram', estado: 'interesado', mensaje: 'Quiero apartar. ¿Cómo pago la reserva de $200?', tiempo: 'ayer' },
  { id: 105, nombre: 'Verónica Páez', tel: '+593 98 909 1212', fuente: 'whatsapp', estado: 'reservado', mensaje: 'Ya hice transferencia de los $200, te paso comprobante', tiempo: 'ayer' },
  { id: 106, nombre: 'Patricia Olmos', tel: '+593 99 303 4040', fuente: 'instagram', estado: 'frío', mensaje: 'Lo voy a pensar, gracias', tiempo: 'hace 5 días' },
  { id: 107, nombre: 'Tatiana Vega', tel: '+593 96 808 9090', fuente: 'referido', estado: 'nuevo', mensaje: '¿Sigues abriendo cupos para junio?', tiempo: 'hace 2 h' },
];

// Hoy = sábado 6 de junio (Día 1, Encuentro 1)
const HORARIO_HOY = [
  { hora: '07:30', tipo: 'Práctica y teoría', dur: '4 h', estado: 'siguiente' },
  { hora: '11:30', tipo: 'Almuerzo', dur: '2 h 30', tipoPausa: true },
  { hora: '14:00', tipo: 'Laboratorio técnico', dur: '2 h 30' },
  { hora: '16:30', tipo: 'Yogasana — práctica y teoría', dur: '1 h 30' },
];

const ENCUENTROS = [
  { num: 1, sabado: '6 jun', domingo: '7 jun', estado: 'hoy' },
  { num: 2, sabado: '13 jun', domingo: '14 jun', estado: 'futuro' },
  { num: 3, sabado: '20 jun', domingo: '21 jun', estado: 'futuro' },
];

// 6 días totales — sáb+dom de cada encuentro
const DIAS_FORMACION = [
  { idx: 0, fecha: '6 jun', label: 'Día 1', encuentro: 1, estado: 'hoy' },
  { idx: 1, fecha: '7 jun', label: 'Día 2', encuentro: 1, estado: 'futuro' },
  { idx: 2, fecha: '13 jun', label: 'Día 3', encuentro: 2, estado: 'futuro' },
  { idx: 3, fecha: '14 jun', label: 'Día 4', encuentro: 2, estado: 'futuro' },
  { idx: 4, fecha: '20 jun', label: 'Día 5', encuentro: 3, estado: 'futuro' },
  { idx: 5, fecha: '21 jun', label: 'Día 6', encuentro: 3, estado: 'futuro' },
];

const MENSAJES_RECIENTES = [
  { id: 1, alumna: 'Lucía Rendón', preview: 'Profe, ¿llevamos algo especial mañana?', tiempo: '14:32', sinLeer: true },
  { id: 2, alumna: 'Mónica Salinas', preview: 'Hola, vi tu post de la formación...', tiempo: '13:08', sinLeer: true, esLead: true },
  { id: 3, alumna: 'Andrea Pacheco', preview: 'Gracias por la sesión de hoy 🙏', tiempo: '11:45', sinLeer: false },
  { id: 4, alumna: 'Renata Aguilar', preview: 'Te paso comprobante de la segunda parte', tiempo: '09:20', sinLeer: false },
  { id: 5, alumna: 'Daniela Cruz', preview: '¿Cuánto cuesta el curso completo?', tiempo: 'ayer', sinLeer: true, esLead: true },
];

// 10 pilares de la formación (PDF)
const PILARES = [
  'El Arte de Sostener el Espacio',
  'Biomecánica Universal y Alineación',
  'Lectura de Cuerpos y Variaciones',
  'El Arte de los Ajustes',
  'Secuenciación Inteligente',
  'Anatomía Energética',
  'Uso Creativo de Props',
  'Psicología del Profesor y Narrativa',
  'Pedagogía Viva y Liderazgo',
  'El Cuerpo como Laboratorio',
];

Object.assign(window, {
  MOCK_ALUMNAS, MOCK_LEADS, HORARIO_HOY, ENCUENTROS, DIAS_FORMACION,
  MENSAJES_RECIENTES, PILARES,
});
