import { supabase } from './supabase.js';

// ──────────────────────────────────────────────────────────────
// Notificaciones push (Web Push) para el equipo.
//
// Flujo: la persona activa las notificaciones → el navegador crea una
// suscripción → la guardamos en `push_subscriptions` → la Edge Function
// `enviar-push` las usa para avisar (lead nuevo, pago, comprobante).
//
// iOS: sólo funciona si la PWA está INSTALADA en la pantalla de inicio
// (iOS 16.4+). En Safari normal el navegador ni siquiera ofrece el permiso;
// por eso `estadoPush()` distingue ese caso y la UI puede explicarlo.
// ──────────────────────────────────────────────────────────────

export const VAPID_PUBLIC_KEY = 'BCA1_f_zM5fevP_D3fg65V48o0AEW91LI1b1DTIK81a2G3sw4WwXRfVd1d7n0f-K-mpQ8kDusecasUMADcrbq28';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const esPWAInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// 'no-soportado' | 'requiere-instalar' | 'denegado' | 'activo' | 'disponible'
export async function estadoPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return esIOS() && !esPWAInstalada() ? 'requiere-instalar' : 'no-soportado';
  }
  if (Notification.permission === 'denied') return 'denegado';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) return 'activo';
  } catch { /* ignorar */ }
  if (esIOS() && !esPWAInstalada()) return 'requiere-instalar';
  return 'disponible';
}

// Pide permiso, se suscribe y guarda en Supabase. Devuelve el estado final.
export async function activarPush(email, proyectoId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este dispositivo no soporta notificaciones.');
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para notificaciones.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    email: (email || '').toLowerCase().trim(),
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 300),
    proyecto_id: proyectoId || null,
    activo: true,
  }, { onConflict: 'endpoint' });
  if (error) throw error;
  return 'activo';
}

export async function desactivarPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) { console.warn('[push] desactivar', e); }
  return 'disponible';
}

// Envía un aviso al equipo (lo hace la Edge Function, que tiene la clave privada)
export async function enviarAvisoPush({ titulo, cuerpo, url, excluirEmail, proyectoId, tag }) {
  try {
    const { error } = await supabase.functions.invoke('enviar-push', {
      body: { titulo, cuerpo, url, excluirEmail, proyectoId, tag },
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[push] no se pudo enviar', e);
    return false;
  }
}
