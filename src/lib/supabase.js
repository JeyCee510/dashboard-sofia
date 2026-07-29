import { createClient } from '@supabase/supabase-js';

// Estas variables vienen de .env.local en local y de Vercel env vars en producción.
// El prefijo VITE_ es obligatorio para que Vite las exponga al frontend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Mensaje claro para Sofía / Juan Cristóbal si olvidan configurar las env vars
  console.error(
    '⚠️ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
    'Crea un archivo .env.local con estas variables (ver .env.example).'
  );
}

export const supabase = createClient(url || 'http://placeholder.local', anonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Whitelist de emails autorizados a entrar al dashboard.
// Desde la migración 037 la fuente de verdad es la tabla `app_usuarios`
// (con roles y acceso por proyecto). Esta lista queda como RESPALDO para el
// caso en que la consulta falle (sin red / DB fría): así los admin nunca se
// quedan fuera. El RLS en la base es quien realmente restringe los datos.
export const ALLOWED_EMAILS = [
  'sofilira@gmail.com',
  'jclira@gmail.com',
  'micaela@educacionparalapaz.net', // colaboradora · solo Seminario Angelo
];

export const isEmailAllowed = (email) => {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
};

// Validación contra `app_usuarios` (fuente de verdad). Devuelve el usuario
// {email, nombre, rol} si está activo; null si no. Si la consulta falla,
// cae al respaldo de arriba para no bloquear el acceso.
export async function fetchUsuarioApp(email) {
  if (!email) return null;
  const mail = email.toLowerCase().trim();
  try {
    const { data, error } = await supabase
      .from('app_usuarios')
      .select('email, nombre, rol, activo')
      .eq('email', mail)
      .maybeSingle();
    if (error) throw error;
    if (data && data.activo) return data;
    // Sin fila (o inactivo): permitir sólo si está en el respaldo
    return isEmailAllowed(mail) ? { email: mail, nombre: null, rol: 'admin' } : null;
  } catch (e) {
    console.warn('[auth] no se pudo leer app_usuarios, usando respaldo', e);
    return isEmailAllowed(mail) ? { email: mail, nombre: null, rol: 'admin' } : null;
  }
}
