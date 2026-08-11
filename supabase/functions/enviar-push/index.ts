// Edge Function `enviar-push` (Dashboard Sofía)
// Envía notificaciones Web Push al equipo (Sofía / Micaela).
//
// OJO: este proyecto Supabase lo comparten varias apps. Otra app ya usa
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (función push-on-new-movement), así que
// aquí se leen secretos con nombre propio (_YOGA) para no interferir.
//
// Destinatarios:
//   · por defecto → todo el equipo del proyecto (menos `excluirEmail`)
//   · `paraEmail` → SÓLO esa persona. Se usa al pasar la posta de un lead:
//     el aviso es para quien queda a cargo, no para todos.
//
// Deploy:  supabase functions deploy enviar-push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { titulo, cuerpo, url, excluirEmail, paraEmail, proyectoId, tag } = await req.json();

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY_YOGA');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY_YOGA');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT_YOGA') ?? 'mailto:jclira@gmail.com';
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'Faltan VAPID_PUBLIC_KEY_YOGA / VAPID_PRIVATE_KEY_YOGA' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = admin.from('push_subscriptions').select('*').eq('activo', true);
    if (paraEmail) {
      // Aviso dirigido: ignora el filtro por proyecto (si la persona tiene la
      // app instalada, hay que alcanzarla igual) y manda sólo a ella.
      q = q.eq('email', String(paraEmail).toLowerCase().trim());
    } else {
      if (proyectoId) q = q.or(`proyecto_id.eq.${proyectoId},proyecto_id.is.null`);
      if (excluirEmail) q = q.neq('email', String(excluirEmail).toLowerCase());
    }
    const { data: subs, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({
      titulo: titulo || 'Dashboard Sofía',
      cuerpo: cuerpo || '',
      url: url || '/',
      tag: tag || 'general',
    });

    let enviadas = 0;
    const caducadas: number[] = [];

    await Promise.all((subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviadas++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) caducadas.push(s.id);
        else console.error('[push] fallo', e?.statusCode, e?.message);
      }
    }));

    if (caducadas.length) {
      await admin.from('push_subscriptions').delete().in('id', caducadas);
    }

    return new Response(JSON.stringify({ enviadas, limpiadas: caducadas.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
