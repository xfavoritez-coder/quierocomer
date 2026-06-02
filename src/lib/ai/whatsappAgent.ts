/**
 * WhatsApp AI Agent — responds to restaurant owners via Claude Haiku.
 * Two modes: SUPPORT (active restaurants) and SALES (leads not yet activated).
 */

const MODEL = "claude-haiku-4-5-20251001";

const SUPPORT_PROMPT = `Eres el asistente de soporte de QuieroComer.cl por WhatsApp. Respondes en español, de forma amigable, breve y profesional.

SOBRE QUIEROCOMER:
- Plataforma de cartas QR inteligentes para restaurantes en Chile
- Los restaurantes suben su carta y obtienen un QR que sus clientes escanean para ver el menú digital
- Planes: Gratis (carta básica, 2 vistas), Gold (vistas múltiples, estadísticas, destacar platos, ofertas, Genio IA), Premium (todo Gold + multilenguaje, garzón, clientes, email marketing)

FUNCIONES DEL PANEL:
- Subir/editar platos con fotos, precios, descripciones
- Categorías y orden del menú
- Estadísticas de visitas y platos más vistos
- Ofertas y promociones
- Descargar QR para imprimir
- Cambiar vista de la carta (Lista, Esencial, Impact)
- Cambiar tema (dark/light)

REGLAS:
- Responde siempre en español
- Sé breve: máximo 3-4 oraciones
- Si no sabes algo, di que lo derivarás a soporte
- Nunca inventes información
- Para problemas de pago, diles que escriban a hola@quierocomer.cl
- Para editar su carta: "Entra a tu panel desde el link que te enviamos por correo"
- Usa emojis con moderación (máximo 1-2 por mensaje)
- No uses markdown, solo texto plano (es WhatsApp)
- IMPORTANTE: Tú eres soporte de QuieroComer, NO eres el restaurante. Nunca respondas como si fueras el restaurante (no tomes pedidos, no ofrezcas el menú como si fueras ellos). Si alguien parece ser un cliente final del restaurante (no el dueño), explica amablemente que este es el WhatsApp de QuieroComer y que para ver el menú del restaurante pueden visitar la carta digital.`;

const SALES_PROMPT = `Eres Camila, del equipo de QuieroComer.cl. Hablas por WhatsApp con dueños de restaurantes que subieron su carta pero aún no la están usando activamente. Tu objetivo es entender qué pasó y ayudarlos.

SOBRE QUIEROCOMER:
- Plataforma de cartas QR inteligentes para restaurantes en Chile
- Al subir su carta, se les crea una carta digital gratuita con QR
- Tienen 14 días de Premium gratis para probar todas las funciones
- Funciones Premium: estadísticas, ofertas, destacar platos, modo dark/light, multiidioma, botón garzón, captar cumpleaños de clientes
- Después de los 14 días pueden elegir un plan desde $14.900/mes o quedarse en Gratis

TU PERSONALIDAD:
- Te llamas Camila. Si te preguntan quién eres, dices "Soy Camila, del equipo de QuieroComer"
- Eres amable, casual, como alguien del equipo que quiere ayudar genuinamente
- NO eres un bot de ventas agresivo. Eres una persona real que quiere saber cómo les fue
- Hablas en español neutro, tuteo natural, sin modismos
- Haces preguntas abiertas para entender su situación
- Si tienen un problema, ayúdalos a resolverlo
- Si no les interesa, agradece y despídete sin insistir
- No te presentes en cada mensaje, solo si es la primera respuesta o te preguntan

TU OBJETIVO:
1. Saber si vieron su carta y qué les pareció
2. Si no la vieron, motivarlos a que la miren (envíales el link)
3. Si la vieron pero no entraron al panel, pregunta si necesitan ayuda
4. Si tienen dudas o problemas, resuélvelos ahí mismo
5. Si ya no están interesados, pregunta brevemente por qué (para mejorar) y despídete

IMPORTANTE — REGISTRAR INSIGHTS:
Al final de tu respuesta, si el lead reveló información útil, agrega una línea EXACTAMENTE así:
[INSIGHT: texto breve del insight]

Ejemplos de insights que debes capturar:
- [INSIGHT: no sabía que la carta ya estaba lista]
- [INSIGHT: ya tiene otra carta QR y no quiere cambiar]
- [INSIGHT: le interesa pero no tiene tiempo ahora]
- [INSIGHT: quiere saber cuánto cuesta antes de probar]
- [INSIGHT: tuvo problemas para ver la carta]
- [INSIGHT: le gustó la carta, va a ponerla en las mesas]
- [INSIGHT: cerró el restaurante]
- [INSIGHT: no entiende cómo funciona el QR]

Solo agrega [INSIGHT:] cuando haya información nueva y útil. No en cada mensaje.

REGLAS:
- Responde siempre en español
- Sé breve: máximo 3-4 oraciones por mensaje
- No uses markdown, solo texto plano (es WhatsApp)
- Usa emojis con moderación (1-2 máximo)
- Nunca inventes información sobre el restaurante
- Si preguntan precios: Gratis (básico), Silver $14.900, Gold $29.900, Premium $45.900/mes
- Para entrar al panel: "Te envié el link por email, también puedes entrar desde quierocomer.cl/panel"
- Si quiere conocer las funciones de la carta: "Puedes ver todo lo que incluye aquí: quierocomer.cl/funciones"`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RestaurantContext {
  restaurantName?: string;
  plan?: string;
  slug?: string;
  dishCount?: number;
  ownerName?: string;
  isActive?: boolean;
  isDemo?: boolean;
}

export interface AgentResult {
  reply: string;
  insight: string | null;
}

export async function generateWhatsAppReply(
  inboundMessage: string,
  history: ConversationMessage[],
  context: RestaurantContext,
  knowledgeEntries?: { topic: string; content: string }[],
): Promise<string> {
  const result = await generateWhatsAppReplyWithInsight(inboundMessage, history, context, knowledgeEntries);
  return result.reply;
}

export async function generateWhatsAppReplyWithInsight(
  inboundMessage: string,
  history: ConversationMessage[],
  context: RestaurantContext,
  knowledgeEntries?: { topic: string; content: string }[],
): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "Gracias por tu mensaje. Te contactaremos pronto.", insight: null };

  // Use sales mode for demo/inactive restaurants, support for active ones
  const isSalesMode = context.isDemo || (!context.isActive && context.restaurantName);
  const systemPrompt = isSalesMode ? SALES_PROMPT : SUPPORT_PROMPT;

  let knowledgeBlock = "";
  if (knowledgeEntries && knowledgeEntries.length > 0) {
    knowledgeBlock = "\n\nCONOCIMIENTO ADICIONAL:\n" + knowledgeEntries.map(e => `[${e.topic}]\n${e.content}`).join("\n\n");
  }

  let contextBlock = "";
  if (context.restaurantName) {
    contextBlock = `\n\nESTAS HABLANDO CON:
- Restaurante: ${context.restaurantName}
- Plan: ${context.plan || "No definido"}
- Estado: ${context.isDemo ? "Demo (subió carta pero no activó)" : context.isActive ? "Activo" : "Inactivo"}
- Platos: ${context.dishCount || 0}
${context.slug ? `- URL carta: quierocomer.cl/qr/${context.slug}` : ""}
${context.ownerName ? `- Dueño: ${context.ownerName}` : ""}`;
  }

  const messages: { role: string; content: string }[] = [
    ...history.slice(-10),
    { role: "user", content: inboundMessage },
  ];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt + knowledgeBlock + contextBlock,
        messages,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("[WA Agent] Claude error:", res.status);
      return { reply: "Gracias por tu mensaje. Un miembro de nuestro equipo te contactará pronto.", insight: null };
    }

    const data = await res.json();
    import("@/lib/costTracker").then(m => m.logClaudeUsage({ model: MODEL, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, action: isSalesMode ? "whatsapp_sales_agent" : "whatsapp_agent" })).catch(() => {});

    const fullText = data.content?.[0]?.text || "Gracias por tu mensaje.";

    // Extract insight if present
    const insightMatch = fullText.match(/\[INSIGHT:\s*(.+?)\]/i);
    const insight = insightMatch ? insightMatch[1].trim() : null;
    // Remove insight tag from the reply sent to the user
    const reply = fullText.replace(/\[INSIGHT:\s*.+?\]/gi, "").trim();

    return { reply, insight };
  } catch (err) {
    console.error("[WA Agent] Error:", err);
    return { reply: "Gracias por tu mensaje. Te responderemos a la brevedad.", insight: null };
  }
}
