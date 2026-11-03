// ═══════════════════════════════════════════════════════════
//  Cliente server-side del panel de Delifast (admin.delifast.cl).
//  Inicia sesión con el login del local (email/clave) y consulta
//  qd_listado_ventas_funciones.php para enriquecer el seguimiento
//  del reparto en el POS: repartidor, estado, ETA, PIN, ubicación
//  en vivo y timeline. La cookie de sesión se cachea en memoria y
//  se renueva sola cuando expira.
// ═══════════════════════════════════════════════════════════
import type { DelifastCreds } from "@/lib/ecommerce/config";

const BASE = "https://admin.delifast.cl";
const SESSION_TTL_MS = 20 * 60 * 1000; // re-login preventivo cada 20 min

// Cookie de sesión por local (keyed por email para compartir entre sucursales
// del mismo login de Delifast).
const sessions = new Map<string, { cookie: string; at: number }>();

export interface DelifastTracking {
  idVenta: string;
  idViaje: string | null;
  status: string | null;          // estado crudo del viaje (Asignado, En Local, En Camino…)
  provider: string | null;        // proveedor del reparto (Uber…)
  vehicle: string | null;         // tipo de vehículo (Motorista…)
  eta: string | null;             // minutos estimados para llegar al local
  driver: { name: string | null; photo: string | null; phone: string | null } | null;
  pin: string | null;             // PIN de entrega
  statusUrl: string | null;       // link público de seguimiento
  deliveryPhoto: string | null;   // foto de la ENTREGA en casa del cliente (dropoff)
  codigoOrigen: string | null;    // = nuestro orderNumber
  location: { lat: number; lng: number; at: string | null } | null; // ubicación del repartidor
  store: { lat: number; lng: number } | null;
  customer: { lat: number; lng: number } | null;
  timeline: {
    confirmacion: string | null;
    inicioPickup: string | null;
    llegadaLocal: string | null;
    inicioDropoff: string | null;
    llegadaCasa: string | null;
    entregado: string | null;
    cancelado: string | null;
  };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s !== "0000-00-00 00:00:00" ? s : null;
}
// URL de imagen del repartidor: puede venir relativa al panel.
function absUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  if (/^https?:\/\//.test(s)) return s;
  return `${BASE}/${s.replace(/^\/+/, "")}`;
}
function pt(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = num(lat), b = num(lng);
  return a != null && b != null ? { lat: a, lng: b } : null;
}

// ── Sesión ───────────────────────────────────────────────────────

async function login(creds: DelifastCreds): Promise<string> {
  const body = new URLSearchParams();
  body.set("email", creds.email || "");
  body.set("pass", creds.password || "");
  const res = await fetch(`${BASE}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  // getSetCookie() en runtimes modernos (undici); fallback al header combinado.
  const setCookies = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .filter((c) => /=/.test(c) && !/=deleted|=;?$/.test(c))
    .join("; ");
  if (!cookie) throw new Error("Delifast: login sin cookie (¿credenciales inválidas?)");
  return cookie;
}

async function getSession(key: string, creds: DelifastCreds, force = false): Promise<string> {
  const cached = sessions.get(key);
  if (!force && cached && Date.now() - cached.at < SESSION_TTL_MS) return cached.cookie;
  const cookie = await login(creds);
  sessions.set(key, { cookie, at: Date.now() });
  return cookie;
}

// ── Llamadas a la API interna de Delifast ────────────────────────

async function callFuncion(
  cookie: string,
  funcion: string,
  params: Record<string, string>,
): Promise<unknown> {
  const body = new URLSearchParams();
  body.set("funcion", funcion);
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  const res = await fetch(`${BASE}/qd_listado_ventas_funciones.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookie,
    },
    body: body.toString(),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Respuesta no-JSON (p. ej. la página de login) → sesión expirada.
    throw new SessionExpired();
  }
}

class SessionExpired extends Error {}

/** Resuelve el seguimiento completo de un pedido por su id de venta Delifast. */
export async function getDelifastTracking(
  restaurantId: string,
  creds: DelifastCreds,
  idVenta: string,
): Promise<DelifastTracking | null> {
  const key = (creds.email || restaurantId).toLowerCase();
  const plataforma = creds.plataforma || "";

  const run = async (cookie: string) => {
    const venta = (await callFuncion(cookie, "getVentaDetalle", { id_venta: idVenta, plataforma })) as Record<string, unknown>;
    if (!venta || typeof venta !== "object") return null;

    const viajes = Array.isArray(venta.viajes) ? (venta.viajes as Record<string, unknown>[]) : [];
    const principal = viajes.find((v) => v && (v.es_principal === true || String(v.es_principal) === "1")) || viajes[viajes.length - 1] || null;
    const idViaje = principal ? str(principal.id) : null;

    // Datos en vivo del viaje (repartidor, estado, ETA, ubicación).
    let viaje: Record<string, unknown> = principal || {};
    if (idViaje) {
      const vd = (await callFuncion(cookie, "getViajeDetalle", { id_viaje: idViaje, plataforma })) as Record<string, unknown>;
      if (vd && typeof vd === "object") viaje = { ...viaje, ...vd };
    }

    const loc = (viaje.last_location || {}) as Record<string, unknown>;
    const tracking: DelifastTracking = {
      idVenta,
      idViaje,
      status: str(viaje.status),
      provider: str(viaje.proveedor) || str(venta.proveedor_reparto),
      vehicle: str(viaje.tipo_vehiculo) || str(venta.tipo_vehiculo),
      eta: str(viaje.pickup_eta),
      driver: {
        name: str(viaje.repartidor),
        photo: absUrl(viaje.repartidor_imagen),
        phone: str(viaje.telefono_publico),
      },
      pin: str(viaje.pincode),
      statusUrl: str(venta.url_status),
      // Foto que saca el repartidor al entregar en la casa del cliente (Uber POD).
      deliveryPhoto: str(viaje.dropoff_imagen),
      codigoOrigen: str(venta.codigo_origen),
      location: pt(loc.lat, loc.lng) ? { ...pt(loc.lat, loc.lng)!, at: str(viaje.timestamp_last_location) } : null,
      store: pt(venta.lat_local, venta.lng_local),
      customer: pt(venta.lat, venta.lng),
      timeline: {
        confirmacion: str(venta.timestamp_confirmacion),
        inicioPickup: str(viaje.timestamp_inicio_pickup) || str(venta.timestamp_inicio_pickup),
        llegadaLocal: str(viaje.timestamp_llegada_local),
        inicioDropoff: str(viaje.timestamp_inicio_dropoff),
        llegadaCasa: str(viaje.timestamp_llegada_casa),
        entregado: str(viaje.timestamp_entregado),
        cancelado: str(viaje.timestamp_cancelado) || str(venta.timestamp_anulacion),
      },
    };
    // Si el repartidor no trae nada, lo dejamos en null (aún sin asignar).
    if (tracking.driver && !tracking.driver.name && !tracking.driver.phone && !tracking.driver.photo) tracking.driver = null;
    return tracking;
  };

  try {
    return await run(await getSession(key, creds));
  } catch (e) {
    if (e instanceof SessionExpired) {
      // Reintento con sesión nueva (una vez).
      return await run(await getSession(key, creds, true));
    }
    throw e;
  }
}

/** Resuelve el id_venta de Delifast a partir de nuestro orderNumber (= codigo_origen),
 *  buscándolo en el listado (texto_buscado). Independiente del worker/Pusher: sirve
 *  cuando el pedido todavía no avanzó de estado y no tenemos el id guardado. */
export async function resolveDelifastVentaId(
  restaurantId: string,
  creds: DelifastCreds,
  orderNumber: string | number,
): Promise<string | null> {
  const key = (creds.email || restaurantId).toLowerCase();
  const plataforma = creds.plataforma || "";
  const num = String(orderNumber).trim();
  if (!num) return null;

  const run = async (cookie: string): Promise<string | null> => {
    const url = `${BASE}/listado_ventas.php?plataforma=${encodeURIComponent(plataforma)}&texto_buscado=${encodeURIComponent(num)}`;
    const res = await fetch(url, { headers: { Cookie: cookie } });
    const html = await res.text();
    // Página de login => sesión expirada.
    if (/name=["']pass["']/.test(html) && /name=["']email["']/.test(html)) throw new SessionExpired();
    // Candidatos: ids de abrirDetalle(<id>, '<dominio>') que aparecen en las tarjetas.
    const ids = [...new Set([...html.matchAll(/abrirDetalle\((\d+)/g)].map((m) => m[1]))].slice(0, 8);
    for (const id of ids) {
      const v = (await callFuncion(cookie, "getVentaDetalle", { id_venta: id, plataforma })) as Record<string, unknown>;
      if (v && String(v.codigo_origen) === num) return id;
    }
    return null;
  };

  try {
    return await run(await getSession(key, creds));
  } catch (e) {
    if (e instanceof SessionExpired) return await run(await getSession(key, creds, true));
    throw e;
  }
}
