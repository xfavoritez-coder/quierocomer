// ═══════════════════════════════════════════════════════════
//  Worker Pusher de Delifast → POS QuieroComer
//
//  Se suscribe al Pusher de Delifast (mismo que usa su panel para
//  las "Notificaciones en Vivo") y, por cada `cambio-estado`, hace
//  POST a /api/pos/delivery-status para mover el opsStage del pedido.
//
//  Es un proceso SIEMPRE ENCENDIDO (websocket persistente). Desplegar
//  en Railway / Fly.io / Render / un VPS (NO en Vercel serverless).
// ═══════════════════════════════════════════════════════════
import Pusher from "pusher-js";
import WS from "ws";

// pusher-js necesita un WebSocket global en Node (algunas versiones ya lo traen).
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WS;

const KEY = process.env.DELIFAST_PUSHER_KEY || "dc0518c6de20140ed532";
const CLUSTER = process.env.DELIFAST_PUSHER_CLUSTER || "us2";
const ENDPOINT = process.env.QC_ENDPOINT || "https://quierocomer.com/api/pos/delivery-status";
const SECRET = process.env.DELIFAST_WEBHOOK_SECRET;

// Mapa canal Pusher → restaurantId nuestro. Ej:
//   {"local-335":"cmvcjbx090001jn074i0eg9zu","local-999":"<id La Florida>"}
let CHANNELS = {};
try {
  CHANNELS = JSON.parse(process.env.DELIFAST_CHANNELS || "{}");
} catch {
  console.error("DELIFAST_CHANNELS no es JSON válido");
  process.exit(1);
}

if (!SECRET) {
  console.error("Falta DELIFAST_WEBHOOK_SECRET");
  process.exit(1);
}
if (Object.keys(CHANNELS).length === 0) {
  console.error('Falta DELIFAST_CHANNELS, ej: {"local-335":"<restaurantId>"}');
  process.exit(1);
}

const pusher = new Pusher(KEY, { cluster: CLUSTER, forceTLS: true });

pusher.connection.bind("state_change", (s) =>
  console.log(`[pusher] ${s.previous} -> ${s.current}`),
);
pusher.connection.bind("error", (e) =>
  console.error("[pusher error]", JSON.stringify(e?.error?.data || e)),
);

async function forward(restaurantId, data) {
  const body = {
    secret: SECRET,
    restaurantId,
    idVenta: data?.id_venta ?? data?.idVenta ?? null,
    orderNumber: data?.codigo_origen ?? data?.orderNumber ?? null,
    cliente: data?.cliente ?? data?.customerName ?? null,
    estado: data?.nuevo_estado ?? data?.estado ?? null,
  };
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    console.log(`[forward] ${restaurantId} "${body.estado}" -> ${r.status} ${txt.slice(0, 200)}`);
  } catch (e) {
    console.error("[forward error]", e.message);
  }
}

for (const [channelName, restaurantId] of Object.entries(CHANNELS)) {
  const ch = pusher.subscribe(channelName);
  ch.bind("pusher:subscription_succeeded", () =>
    console.log(`[subscribed] ${channelName} -> ${restaurantId}`),
  );
  ch.bind("pusher:subscription_error", (st) =>
    console.error(`[subscription_error] ${channelName}`, JSON.stringify(st)),
  );
  // El evento que nos interesa.
  ch.bind("cambio-estado", (data) => {
    console.log(`[cambio-estado] ${channelName}`, JSON.stringify(data));
    forward(restaurantId, data);
  });
  // Log de TODOS los eventos (descubrir payloads de nueva-venta / Nuevo-Pedido-QD / La Florida).
  ch.bind_global((event, data) => {
    if (event.startsWith("pusher:") || event === "cambio-estado") return;
    console.log(`[evento ${event}] ${channelName}`, JSON.stringify(data).slice(0, 300));
  });
  console.log(`[subscribing] ${channelName}`);
}

console.log(`Delifast worker arrancado. Canales: ${Object.keys(CHANNELS).join(", ")}`);

// Mantener vivo el proceso.
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
