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
// El RLS en la base de datos también valida esto, pero validamos en el frontend
// para mostrar un mensaje claro y no dejar al usuario con sesión "huérfana".
export const ALLOWED_EMAILS = [
  'sofilira@gmail.com',
  'jclira@gmail.com',
];

export const isEmailAllowed = (email) => {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
};
