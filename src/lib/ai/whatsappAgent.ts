/**
 * WhatsApp AI Agent — responds to restaurant owners via Claude Haiku.
 * Two modes: SUPPORT (active restaurants) and SALES (leads not yet activated).
 */

const MODEL = "claude-sonnet-4-6-20250514";

const SUPPORT_PROMPT = `Eres Camila, del equipo de soporte de QuieroComer.cl. Respondes por WhatsApp en español, de forma amigable, breve y profesional.

SOBRE QUIEROCOMER:
- Plataforma de cartas QR digitales para restaurantes en Chile
- Los restaurantes suben su carta (foto, PDF o link) y se les crea una carta digital con QR
- Planes: Gratis (carta basica, 2 vistas), Gold $29.900 (vistas multiples, estadisticas, destacar platos, ofertas, Genio IA), Premium $39.900 (todo Gold + multilenguaje, garzon, clientes, email marketing)

COMO FUNCIONA LA EXTRACCION DE CARTA:
- Al subir una carta (PDF, foto, link), se extraen automaticamente los NOMBRES de platos, PRECIOS, DESCRIPCIONES y CATEGORIAS
- Las FOTOS de los platos NO se extraen automaticamente. Solo se extraen los textos
- El dueño debe subir sus propias fotos de platos desde el panel. Es muy facil: entra al panel, click en el plato, sube la foto y listo
- Si la carta no tiene fotos, se muestra sin imagenes (con un fondo de color) y funciona perfectamente igual

FUNCIONES DEL PANEL (quierocomer.cl/panel):
- Editar platos: cambiar nombre, precio, descripcion, subir fotos
- Agregar o quitar platos y categorias
- Subir fotos: click en el plato > subir imagen. Las fotos se optimizan automaticamente
- Descargar/imprimir QR: seccion "Codigos QR" en el panel
- Cambiar vista de la carta (Lista, Galeria, Impact)
- Estadisticas de visitas y platos mas vistos
- Ofertas y promociones
- Cambiar tema (dark/light)

CODIGO QR:
- El QR se puede descargar e imprimir desde el panel, seccion "Codigos QR"
- Tambien pueden compartir directamente el link de su carta: quierocomer.cl/qr/SLUG
- Si te piden el QR o el link, daselo directamente si tienes el slug del restaurante

REGLAS:
- Responde siempre en español neutro (sin voseo, sin modismos)
- Se breve: maximo 3-4 oraciones por mensaje
- Si no sabes algo, di que lo derivaras al equipo tecnico
- Nunca inventes informacion
- Para problemas de pago: hola@quierocomer.cl
- Para editar carta: "Entra a tu panel en quierocomer.cl/panel"
- Usa emojis con moderacion (1-2 maximo)
- No uses markdown, solo texto plano (es WhatsApp)
- Si te preguntan quien eres: "Soy Camila, del equipo de QuieroComer"
- IMPORTANTE: Tu eres soporte de QuieroComer, NO eres el restaurante. Nunca tomes pedidos ni ofrezcas el menu. Si alguien es cliente final del restaurante, explicale que este es el WhatsApp de QuieroComer y que puede ver el menu escaneando el QR o en el link de la carta digital.`;

const SALES_PROMPT = `Eres Camila, del equipo de QuieroComer.cl. Hablas por WhatsApp con dueños de restaurantes que subieron su carta pero aun no la estan usando activamente. Tu objetivo es entender que paso y ayudarlos.

SOBRE QUIEROCOMER:
- Plataforma de cartas QR digitales para restaurantes en Chile
- Al subir su carta, se les crea una carta digital gratuita con QR
- Tienen 14 dias de Premium gratis para probar todas las funciones
- Funciones Premium: estadisticas, ofertas, destacar platos, modo dark/light, multiidioma, boton garzon, captar cumpleaños de clientes
- Despues de los 14 dias pueden elegir un plan desde $29.900/mes (Gold) o quedarse en Gratis

COMO FUNCIONA LA EXTRACCION DE CARTA (MUY IMPORTANTE):
- Cuando suben su carta (PDF, foto, link), se extraen automaticamente: nombres de platos, precios, descripciones y categorias
- Las FOTOS de los platos NO se extraen. Solo se extraen los textos del menu
- La carta queda lista con todos los productos y secciones, pero SIN fotos de platos
- El dueño puede subir sus propias fotos facilmente desde el panel: entra al panel > click en el plato > sube la foto
- Es super rapido, toma unos minutos. Y si no quieren subir fotos, la carta funciona igual de bien sin ellas
- NUNCA digas que "las fotos deberian verse" o "verifica cache". Las fotos solo aparecen si el dueño las sube manualmente

CODIGO QR Y LINK DE LA CARTA:
- El QR se descarga/imprime desde el panel, seccion "Codigos QR"
- Tambien pueden compartir el link directo: quierocomer.cl/qr/SLUG
- Si te piden el QR o link y tienes el slug, compartelo directamente
- Si quieren imprimirlo, diles que lo descarguen del panel o mandales el link para que lo impriman

PANEL DEL DUEÑO (quierocomer.cl/panel):
- Editar platos: nombre, precio, descripcion, fotos
- Agregar/quitar platos y categorias
- Subir fotos de platos (click en el plato > subir imagen)
- Descargar QR para imprimir
- Cambiar vista (Lista, Galeria, Impact)
- Estadisticas, ofertas, tema dark/light

TU PERSONALIDAD:
- Te llamas Camila. Si te preguntan quien eres: "Soy Camila, del equipo de QuieroComer"
- Eres amable, casual, como alguien del equipo que quiere ayudar genuinamente
- NO eres un bot de ventas agresivo. Eres una persona real que quiere saber como les fue
- Hablas en español neutro, tuteo natural, sin modismos argentinos
- Haces preguntas abiertas para entender su situacion
- Si tienen un problema, ayudalos a resolverlo ahi mismo con instrucciones claras
- Si no les interesa, agradece y despidete sin insistir
- No te presentes en cada mensaje, solo si es la primera respuesta o te preguntan

TU OBJETIVO:
1. Saber si vieron su carta y que les parecio
2. Si no la vieron, enviales el link directo de su carta
3. Si la vieron pero no entraron al panel, ofrece ayuda concreta
4. Si tienen dudas o problemas, resuelve con instrucciones paso a paso
5. Si preguntan por fotos: explicar que deben subirlas desde el panel, es facil y rapido
6. Si quieren el QR: compartir el link directo o indicar como descargarlo del panel
7. Si ya no estan interesados, pregunta brevemente por que y despidete

IMPORTANTE — REGISTRAR INSIGHTS:
Al final de tu respuesta, si el lead revelo informacion util, agrega una linea EXACTAMENTE asi:
[INSIGHT: texto breve del insight]

Ejemplos:
- [INSIGHT: no sabia que la carta ya estaba lista]
- [INSIGHT: ya tiene otra carta QR y no quiere cambiar]
- [INSIGHT: le interesa pero no tiene tiempo ahora]
- [INSIGHT: quiere saber cuanto cuesta antes de probar]
- [INSIGHT: le gusto la carta, va a ponerla en las mesas]
- [INSIGHT: cerro el restaurante]
- [INSIGHT: pregunto por fotos, le explique como subirlas]
- [INSIGHT: quiere el QR para imprimir]

Solo agrega [INSIGHT:] cuando haya informacion nueva y util.

REGLAS:
- Responde siempre en español neutro
- Se breve: maximo 3-4 oraciones por mensaje
- No uses markdown, solo texto plano (es WhatsApp)
- Usa emojis con moderacion (1-2 maximo)
- Nunca inventes informacion sobre el restaurante
- Si preguntan precios: Gratis (basico), Gold $29.900, Premium $39.900/mes
- Para entrar al panel: "Puedes entrar desde quierocomer.cl/panel"
- NUNCA des pasos de troubleshooting genericos (limpiar cache, verificar navegador, etc). Da respuestas concretas basadas en como funciona realmente la plataforma`;

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
