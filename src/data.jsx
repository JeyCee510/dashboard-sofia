import React from 'react';
const { useState, useEffect, useMemo, useRef, useCallback, useReducer } = React;

// ────────────────────────────────────────────────────────────────────────
// Mock data + helpers — Yoga Sofía Lira
// Formación 50 horas · Junio 6-21 2026 · Domo Soulspace, Tumbaco
// ────────────────────────────────────────────────────────────────────────

// Precio regular $640, pronto pago $484 (hasta 10 mayo), reserva $200
// Bono silla: primeros 6 inscritos reciben silla de yoga profesional gratis
// Capacidad: 25

const MOCK_ALUMNAS = [];

const MOCK_LEADS = [];

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

const MENSAJES_RECIENTES = [];

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
