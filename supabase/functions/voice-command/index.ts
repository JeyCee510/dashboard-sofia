// ─────────────────────────────────────────────────────────────────────────
// Edge Function: voice-command
// Recibe { text, history? } y devuelve la acción del LLM (Claude Haiku 4.5)
// con tool use. Soporta conversación multi-turno: el frontend envía el
// history previo cuando el usuario responde a una clarificación.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Tools (acciones del dashboard) ───
const TOOLS = [
  {
    name: "crear_lead",
    description: "Registrar un nuevo lead. REQUIERE al menos uno de: tel o instagram. Si Sofía no los menciona, usa preguntar_clarificacion con opciones [WhatsApp, Instagram, Ambos] antes de crear.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tel: { type: "string", description: "Con +593 si Ecuador" },
        instagram: { type: "string", description: "Handle sin @" },
        fuente: { type: "string", enum: ["instagram", "whatsapp", "referido", "otro"] },
        estado: { type: "string", enum: ["nuevo", "interesado", "reservado", "frío"], default: "nuevo" },
        mensaje: { type: "string" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "crear_estudiante",
    description: "Inscribir nuevo estudiante. REQUIERE al menos uno de: tel o instagram. También REQUIERE tipo_inscripcion. Si Sofía no especifica el tipo o cuáles encuentros, usa preguntar_clarificacion antes de crear. Si dice 'inscribe a X' sin más detalle, asume completa con [1,2,3].",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tel: { type: "string" },
        instagram: { type: "string" },
        bonoSilla: { type: "boolean", default: false },
        notas: { type: "string" },
        tipo_inscripcion: {
          type: "string",
          enum: ["completa", "dos_encuentros", "un_encuentro"],
          description: "completa = los 3 encuentros (50h), dos_encuentros = 2, un_encuentro = solo 1.",
          default: "completa",
        },
        encuentros_asistir: {
          type: "array",
          items: { type: "integer", enum: [1, 2, 3] },
          description: "Qué encuentros asiste. Para 'completa' usa [1,2,3]. Para parciales pregunta cuáles si Sofía no lo dice.",
          default: [1, 2, 3],
        },
      },
      required: ["nombre", "tipo_inscripcion"],
    },
  },
  {
    name: "registrar_pago",
    description: "Registrar un pago recibido de una alumna existente.",
    input_schema: {
      type: "object",
      properties: {
        nombre_alumna: { type: "string" },
        monto: { type: "number" },
        tipo: { type: "string", enum: ["reserva", "parcial", "pronto-pago", "saldo"], default: "parcial" },
      },
      required: ["nombre_alumna", "monto"],
    },
  },
  {
    name: "cambiar_estado_lead",
    description: "Mover un lead a otro estado del embudo.",
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
      properties: { nombre_lead: { type: "string" } },
      required: ["nombre_lead"],
    },
  },
  {
    name: "marcar_asistencia",
    description: "Marcar a una alumna como presente o ausente en un día.",
    input_schema: {
      type: "object",
      properties: {
        nombre_alumna: { type: "string" },
        dia: { type: "string", description: "'hoy', 'día 1'…'día 6', o '6 jun'" },
        presente: { type: "boolean", default: true },
      },
      required: ["nombre_alumna"],
    },
  },
  {
    name: "eliminar_registro",
    description: "Borrar un lead o un estudiante. Requiere confirmación visual del usuario antes de ejecutar.",
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
    description: "Abrir la ficha del lead para generar y enviar el link de preinscripción por WhatsApp.",
    input_schema: {
      type: "object",
      properties: { nombre_lead: { type: "string" } },
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
        tipo: { type: "string", enum: ["estudiante", "lead"] },
      },
      required: ["nombre"],
    },
  },
  {
    name: "consultar",
    description: "Responder preguntas sobre el estado actual del dashboard.",
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
    description: "Pedir información que falta. Usa esta tool SIEMPRE que falte un dato crítico (especialmente tel/instagram al crear lead/estudiante). Si la respuesta tiene opciones predefinidas, ponlas en `opciones` (chips tocables). Si es respuesta abierta (ej. nombre, número), deja `opciones` vacío.",
    input_schema: {
      type: "object",
      properties: {
        pregunta: { type: "string", description: "Pregunta clara y corta en español" },
        opciones: {
          type: "array",
          items: { type: "string" },
          description: "2-5 opciones cortas tocables. Vacío si la respuesta es abierta.",
        },
        contexto: {
          type: "string",
          description: "Una frase con lo que ya sabemos para darle contexto al usuario. Ej: 'Vamos a registrar a Mónica como lead.'",
        },
      },
      required: ["pregunta"],
    },
  },
];

const SYSTEM_PROMPT = `Eres un asistente de voz que opera el dashboard de Sofía Lira, profesora de yoga en Tumbaco, Ecuador.

Sofía te dicta comandos en español para gestionar leads, estudiantes, pagos y asistencia de su formación de 50 horas.

Tu ÚNICA respuesta debe ser una llamada a tool. Nunca respondas en texto plano.

REGLA CLAVE — contacto obligatorio:
- Al crear un lead o estudiante, SIEMPRE necesitas tel o instagram (uno de los dos mínimo).
- Si Sofía no los menciona, NO crees el registro. Llama preguntar_clarificacion con:
  pregunta: "¿Tienes su WhatsApp o Instagram?"
  opciones: ["Tengo WhatsApp", "Tengo Instagram", "Tengo ambos", "No tengo ninguno"]
  contexto: "Vamos a crear el lead de [nombre]."
- Si Sofía contesta "tengo whatsapp" o similar, vuelve a preguntar el número con preguntar_clarificacion (sin opciones, respuesta abierta).
- Si responde "no tengo ninguno", crea el registro igual pero adviérteselo en el siguiente paso.

REGLA — tipo de inscripción al crear estudiante:
- La formación tiene 3 encuentros: E1 (6-7 jun), E2 (13-14 jun), E3 (20-21 jun).
- Si Sofía dice "inscríbela completa" o no especifica → tipo_inscripcion="completa", encuentros_asistir=[1,2,3].
- Si dice "solo al primer encuentro" / "solo al E2" / "solo el último" → tipo="un_encuentro", encuentros=[N].
- Si dice "dos encuentros, el 1 y el 3" → tipo="dos_encuentros", encuentros=[1,3].
- Si dice "parcial" o "media formación" sin más detalle → preguntar_clarificacion con opciones:
  pregunta: "¿Cuáles encuentros asistirá?"
  opciones: ["Solo Encuentro 1 (6-7 jun)", "Solo Encuentro 2 (13-14 jun)", "Solo Encuentro 3 (20-21 jun)", "Encuentros 1 y 2", "Encuentros 1 y 3", "Encuentros 2 y 3"]
  contexto: "Estudiante parcial, no asiste a todo."

Conversación multi-turno (CRÍTICO):
- Recibirás el HISTORIAL COMPLETO de la conversación con todos los turnos previos.
- NUNCA olvides información que ya recolectaste en turnos anteriores.
- Si en turno 1 Sofía dijo "inscribe a Mónica", en turno 5 sigues construyendo el registro de Mónica. NO vuelvas a preguntar el nombre.
- Cuando ya tengas todos los datos necesarios (nombre + tel o instagram), EJECUTA la acción definitiva (crear_lead/crear_estudiante/etc.). No sigas preguntando.
- Cuando preguntes por algo, sé EXPLÍCITA en el contexto: "Vamos a crear el lead de Mónica. ¿Cuál es su número de WhatsApp?" — así si Sofía relee no se pierde.

Reglas generales:
- Convierte montos: "doscientos" → 200, "cuatrocientos ochenta y cuatro" → 484.
- Teléfonos ecuatorianos sin prefijo → agrega "+593 ".
- "Insta" / "Instagram" → fuente "instagram". "Wasap" → "whatsapp".
- Preguntas como "cuántos cupos quedan" → consultar.
- "Borra/elimina X" → eliminar_registro (siempre con tipo).
- Nombres parciales como "Mari Fer" → pásalos tal cual, el frontend hace match aproximado.
- Si el comando es totalmente ambiguo, preguntar_clarificacion con opciones de las acciones más probables.

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

  // Recibimos messages completos del frontend (que ya construye tool_result blocks
  // cuando aplica). Backwards compat: si solo viene `text`, lo wrappeamos como user simple.
  let messages: any[] = [];
  if (Array.isArray(payload?.messages)) {
    messages = payload.messages;
  } else if (payload?.text) {
    messages = [{ role: "user", content: String(payload.text) }];
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "Missing messages" }), {
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

  // Para el campo transcript en la respuesta, extrae el último input del usuario
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  const text = typeof lastUser?.content === "string"
    ? lastUser.content
    : (Array.isArray(lastUser?.content) ? lastUser.content.find((c: any) => c.type === "tool_result")?.content || "" : "");

  const anthropicReq = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: "any" },
    messages,
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
      parameters: { pregunta: "No te entendí, ¿puedes repetirlo?", opciones: [] },
      transcript: text,
      assistant_turn: data.content,
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // El assistant_turn permite al frontend acumular history para multi-turno.
  // En la siguiente request, el frontend mandará history con role:"user" + role:"assistant"
  // (este turn) + role:"user" (nueva respuesta de Sofía).
  return new Response(JSON.stringify({
    tool_name: toolUse.name,
    parameters: toolUse.input,
    transcript: text,
    tool_use_id: toolUse.id,
    assistant_turn: data.content, // todo el contenido del turno (incluye el tool_use)
    usage: data.usage,
  }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
