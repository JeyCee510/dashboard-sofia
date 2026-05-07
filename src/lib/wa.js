// ─────────────────────────────────────────────────────────────────────
// Helpers compartidos para WhatsApp e Instagram deep-links.
// Antes vivían duplicados en forms.jsx y screen-difusion.jsx.
// ─────────────────────────────────────────────────────────────────────

// Limpia un teléfono a solo dígitos (ej "+593 99 234 5678" → "593992345678")
export function cleanPhone(tel) {
  return (tel || '').replace(/[^\d]/g, '');
}

// Limpia un handle de IG: quita @, espacios, https://instagram.com/, etc.
export function cleanInstagram(h) {
  if (!h) return '';
  let s = h.trim();
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  s = s.replace(/^@/, '');
  s = s.split(/[/?#]/)[0]; // por si pegan URL completa con path
  return s;
}

// Devuelve null si el teléfono no es usable. `mensaje` es opcional.
export function buildWaUrl(tel, mensaje) {
  const phone = cleanPhone(tel);
  if (!phone) return null;
  const text = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${phone}${text}`;
}

// ig.me/m/<handle> abre DM en la app si el handle es correcto; fallback al perfil.
// Instagram NO soporta texto pre-cargado en deep link (limitación de Meta).
export function buildIgUrl(handle) {
  const h = cleanInstagram(handle);
  if (!h) return null;
  return `https://ig.me/m/${h}`;
}
