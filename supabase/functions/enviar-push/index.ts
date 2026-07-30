// Edge Function `enviar-push`
//
// Envía una notificación Web Push a las suscripciones del equipo.
// La llama el frontend (lib/push.js → enviarAvisoPush) cuando ocurre algo
// relevante: lead nuevo, pago registrado, comprobante recibido.
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY_YOGA, VAPID_PRIVATE_KEY_YOGA, VAPID_SUBJECT_YOGA
//   SUPABASE_URL y SERVICE_ROLE_KEY ya vienen inyectados.
//
// ⚠ Este proyecto Supabase lo comparten varias apps de JC. Los secretos
// genéricos VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY YA EXISTEN y los usa otra
// función (`push-on-new-movement`, de otra app). NO reutilizarlos ni
// sobrescribirlos: por eso aquí van con sufijo _YOGA.
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
    const { titulo, cuerpo, url, excluirEmail, proyectoId, tag } = await req.json();

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:jclira@gmail.com';
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'Faltan las claves VAPID' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Destinatarios: suscripciones activas del proyecto (o todas si no se
    // especifica), excluyendo a quien disparó la acción.
    let q = admin.from('push_subscriptions').select('*').eq('activo', true);
    if (proyectoId) q = q.or(`proyecto_id.eq.${proyectoId},proyecto_id.is.null`);
    if (excluirEmail) q = q.neq('email', String(excluirEmail).toLowerCase());
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

    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviadas++;
      } catch (e: any) {
        // 404/410 = el navegador invalidó la suscripción: se limpia sola
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
