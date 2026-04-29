// ─────────────────────────────────────────────────────────────────────────
// Edge Function: voice-command
// Recibe { text } (transcripción de Web Speech API) y devuelve la acción
// más probable usando Claude Haiku 4.5 con tool use.
// La key Anthropic vive en ANTHROPIC_API_KEY (configurada como secret).
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Definición de las 11 herramientas (acciones del dashboard) ───
const TOOLS = [
  {
    name: "crear_lead",
    description: "Registrar un nuevo lead (persona interesada que aún no se inscribe).",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del lead" },
        tel: { type: "string", description: "Teléfono con prefijo +593 si es Ecuador. Opcional." },
        instagram: { type: "string", description: "Handle sin @ si Sofía lo menciona. Opcional." },
        fuente: { type: "string", enum: ["instagram", "whatsapp", "referido", "otro"], description: "Cómo llegó" },
        estado: { type: "string", enum: ["nuevo", "interesado", "reservado", "frío"], default: "nuevo" },
        mensaje: { type: "string", description: "Lo que dijo el lead, si Sofía lo cuenta. Opcional." },
      },
      required: ["nombre"],
    },
  },
  {
    name: "crear_estudiante",
    description: "Inscribir un nuevo estudiante (persona que ya confirmó participación en la formación).",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tel: { type: "string", description: "Con +593 si es Ecuador. Opcional." },
        instagram: { type: "string", description: "Handle. Opcional." },
        bonoSilla: { type: "boolean", description: "Si Sofía dice que recibe bono silla", default: false },
        notas: { type: "string", description: "Notas opcionales" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "registrar_pago",
    description: "Registrar un pago recibido de una alumna existente.",
    input_schema: {
      type: "object",
      properties: {
        nombre_alumna: { type: "string", description: "Nombre o parte del nombre de la alumna que pagó" },
        monto: { type: "number", description: "Monto en USD. Convertir 'doscientos' → 200, 'cuatrocientos ochenta y cuatro' → 484" },
        tipo: { type: "string", enum: ["reserva", "parcial", "pronto-pago", "saldo"], default: "parcial" },
      },
      required: ["nombre_alumna", "monto"],
    },
  },
  {
    name: "cambiar_estado_lead",
    description: "Mover un lead a otro estado en el embudo.",
    input_schema: {
      type: "object",
      properties: {
        nombre_lead: { type: "string" },
        nuevo_estado: { type: "string", enum: ["nuevo", "interesado", "reservado", "frío"] },
      },
      required: ["nombre_lead", "nuevo_estado"],
    },
  },
  {
    name: "convertir_lead_a_estudiante",
    description: "Convertir un lead existente en estudiante inscrito.",
    input_schema: {
      type: "object",
      properties: {
        nombre_lead: { type: "string" },
      },
      required: ["nombre_lead"],
    },
  },
  {
    name: "marcar_asistencia",
    description: "Marcar a una alumna como presente o ausente en un día específico.",
    input_schema: {
      type: "object",
      properties: {
        nombre_alumna: { type: "string" },
        dia: { type: "string", description: "Puede ser 'hoy', 'día 1', 'día 2'... 'día 6', o una fecha como '6 jun'" },
        presente: { type: "boolean", default: true },
      },
      required: ["nombre_alumna"],
    },
  },
  {
    name: "eliminar_registro",
    description: "Borrar un lead o un estudiante. SIEMPRE requiere confirmación visual del usuario antes de ejecutar.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tipo: { type: "string", enum: ["lead", "estudiante"] },
      },
      required: ["nombre", "tipo"],
    },
  },
  {
    name: "generar_preinscripcion",
    description: "Generar y enviar el link de preinscripción a un lead por WhatsApp.",
    input_schema: {
      type: "object",
      properties: {
        nombre_lead: { type: "string" },
      },
      required: ["nombre_lead"],
    },
  },
  {
    name: "abrir_ficha",
    description: "Abrir la ficha detallada de una alumna o lead.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tipo: { type: "string", enum: ["estudiante", "lead"], description: "Si Sofía no especifica, intentar primero estudiante" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "consultar",
    description: "Responder preguntas sobre el estado actual: cupos, pagos pendientes, asistencia, leads nuevos.",
    input_schema: {
      type: "object",
      properties: {
        pregunta: { type: "string", enum: [
          "cupos_disponibles",
          "pagos_pendientes",
          "leads_nuevos",
          "total_inscritos",
          "asistencia_hoy",
          "bono_silla_estado",
        ]},
      },
      required: ["pregunta"],
    },
  },
  {
    name: "preguntar_clarificacion",
    description: "Usar cuando no estás segura del comando o falta información clave. Pide a Sofía que clarifique.",
    input_schema: {
      type: "object",
      properties: {
        pregunta: { type: "string", description: "La pregunta de clarificación, en español natural" },
      },
      required: ["pregunta"],
    },
  },
];

const SYSTEM_PROMPT = `Eres un asistente de voz que opera el dashboard de Sofía Lira, profesora de yoga en Tumbaco, Ecuador.

Sofía te dicta comandos en español para gestionar leads, estudiantes, pagos y asistencia de su formación de 50 horas.

Tu ÚNICA respuesta debe ser una llamada a una de las tools disponibles. Nunca respondas en texto plano.

Reglas:
- Convierte montos hablados a números: "doscientos" → 200, "cuatrocientos ochenta y cuatro" → 484, "640" → 640.
- Para teléfonos ecuatorianos sin prefijo, agrega "+593 ".
- Para nombres, usa lo que Sofía haya dicho aunque suene incompleto (ej "Mari Fer" → "Mari Fer", el frontend hará match aproximado).
- Si el comando es ambiguo o falta info crítica (ej "registra un pago" sin nombre o monto), usa preguntar_clarificacion.
- Si Sofía dice "Insta" interpreta como "instagram", "Wasap"/"Whatsapp" como "whatsapp".
- Si dice "anota a X que me escribió por...", típicamente es crear_lead.
- Si dice "inscribe a X" o "registra a X como estudiante", es crear_estudiante.
- "X pagó Y" → registrar_pago.
- "borra a X" → eliminar_registro (siempre con tipo).
- "manda preinscripción" / "envíale el formulario" → generar_preinscripcion.
- "ábreme la ficha de" / "muéstrame a" → abrir_ficha.
- "cuántos cupos quedan", "quién no ha pagado", etc → consultar.

Hoy es ${new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const text = (payload?.text || "").trim();
  if (!text) {
    return new Response(JSON.stringify({ error: "Missing text" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server config: missing ANTHROPIC_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const anthropicReq = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: text }],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(anthropicReq),
  });

  if (!r.ok) {
    const errText = await r.text();
    console.error("Anthropic error:", r.status, errText);
    return new Response(JSON.stringify({ error: "LLM call failed", detail: errText }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const data = await r.json();
  const toolUse = (data.content || []).find((c: any) => c.type === "tool_use");

  if (!toolUse) {
    return new Response(JSON.stringify({
      tool_name: "preguntar_clarificacion",
      parameters: { pregunta: "No entendí, ¿puedes repetirlo?" },
      transcript: text,
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    tool_name: toolUse.name,
    parameters: toolUse.input,
    transcript: text,
    usage: data.usage,
  }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
