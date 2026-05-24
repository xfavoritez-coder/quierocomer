/**
 * WhatsApp AI Agent — responds to restaurant owners via Claude Haiku.
 */

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Eres el asistente de soporte de QuieroComer.cl por WhatsApp. Respondes en español, de forma amigable, breve y profesional.

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
- No uses markdown, solo texto plano (es WhatsApp)`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface RestaurantContext {
  restaurantName?: string;
  plan?: string;
  slug?: string;
  dishCount?: number;
  ownerName?: string;
  isActive?: boolean;
  isDemo?: boolean;
}

export async function generateWhatsAppReply(
  inboundMessage: string,
  history: ConversationMessage[],
  context: RestaurantContext,
  knowledgeEntries?: { topic: string; content: string }[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "Gracias por tu mensaje. Te contactaremos pronto.";

  // Build custom knowledge block from admin-defined entries
  let knowledgeBlock = "";
  if (knowledgeEntries && knowledgeEntries.length > 0) {
    knowledgeBlock = "\n\nCONOCIMIENTO ADICIONAL:\n" + knowledgeEntries.map(e => `[${e.topic}]\n${e.content}`).join("\n\n");
  }

  let contextBlock = "";
  if (context.restaurantName) {
    contextBlock = `\n\nESTAS HABLANDO CON:
- Restaurante: ${context.restaurantName}
- Plan: ${context.plan || "No definido"}
- Estado: ${context.isDemo ? "Demo (aún no activa)" : context.isActive ? "Activo" : "Inactivo"}
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
        max_tokens: 300,
        system: SYSTEM_PROMPT + knowledgeBlock + contextBlock,
        messages,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("[WA Agent] Claude error:", res.status);
      return "Gracias por tu mensaje. Un miembro de nuestro equipo te contactará pronto.";
    }

    const data = await res.json();
    return data.content?.[0]?.text || "Gracias por tu mensaje.";
  } catch (err) {
    console.error("[WA Agent] Error:", err);
    return "Gracias por tu mensaje. Te responderemos a la brevedad.";
  }
}
