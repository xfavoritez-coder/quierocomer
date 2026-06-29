/**
 * SimpleFactura API wrapper for Chilean electronic invoicing.
 * Docs: https://documentacion.simplefactura.cl
 */

const BASE_URL = "https://api.simplefactura.cl";
const SUCURSAL = "Casa_Matriz";

// Emisor (QuieroComer / Evolución Gastronómica SpA)
const EMISOR = {
  RUTEmisor: "78123543-1",
  RznSoc: "EVOLUCION GASTRONOMICA SPA",
  GiroEmis: "ACTIVIDADES DE PROGRAMACION INFORMATICA",
  Acteco: [620100],
  DirOrigen: "EMILIO VAISSE 760 DP 2703 TORRE A",
  CmnaOrigen: "Nunoa",
  CiudadOrigen: "Santiago",
  Telefono: [],
  CorreoEmisor: "favoritez@gmail.com",
};

// ── Auth ──

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  // Use static token from env if available
  const staticToken = process.env.SIMPLEFACTURA_TOKEN;
  if (staticToken) return staticToken;

  // Otherwise use JWT flow
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const email = process.env.SIMPLEFACTURA_EMAIL;
  const password = process.env.SIMPLEFACTURA_PASSWORD;
  if (!email || !password) throw new Error("SimpleFactura credentials not configured");

  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SimpleFactura auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.accessToken || data.token,
    expiresAt: new Date(data.expiresAt || Date.now() + 23 * 3600_000).getTime(),
  };
  return cachedToken.token;
}

async function sfFetch(path: string, body: any, method = "POST"): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const contentType = res.headers.get("content-type") || "";

  // PDF endpoint returns binary
  if (contentType.includes("application/pdf") || path.includes("/pdf")) {
    if (!res.ok) throw new Error(`SimpleFactura PDF error: ${res.status}`);
    return { pdf: Buffer.from(await res.arrayBuffer()) };
  }

  const data = await res.json();
  if (!res.ok || data.status >= 400) {
    throw new Error(`SimpleFactura error: ${data.message || JSON.stringify(data.errors || data)}`);
  }
  return data;
}

// ── Date helpers ──

function todayChile(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRut(rut: string): string {
  return rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

// ── Boleta Electrónica (DTE 39) ──

export interface BoletaInput {
  /** Monto total con IVA incluido */
  montoTotal: number;
  /** Items de la boleta */
  items: { nombre: string; cantidad: number; precioUnitario: number; descripcion?: string }[];
  /** RUT del receptor (opcional, "66666666-6" para anónimo) */
  rutReceptor?: string;
  /** Nombre del receptor */
  nombreReceptor?: string;
  /** Email para enviar la boleta */
  emailReceptor?: string;
  /** Fecha de emisión (default: hoy Chile) */
  fecha?: string;
}

export async function emitirBoleta(input: BoletaInput) {
  const fecha = input.fecha || todayChile();

  const body = {
    Documento: {
      Encabezado: {
        IdDoc: {
          TipoDTE: 39,
          IndServicio: 3,
          FchEmis: fecha,
        },
        Emisor: EMISOR,
        Receptor: {
          RUTRecep: input.rutReceptor ? formatRut(input.rutReceptor) : "66666666-6",
          RznSocRecep: input.nombreReceptor || "Consumidor Final",
          CorreoRecep: input.emailReceptor || undefined,
        },
        Totales: {
          MntTotal: input.montoTotal,
        },
      },
      Detalle: input.items.map((item, i) => ({
        NroLinDet: i + 1,
        NmbItem: item.nombre.slice(0, 80),
        DscItem: item.descripcion?.slice(0, 1000) || undefined,
        QtyItem: item.cantidad,
        PrcItem: item.precioUnitario,
        MontoItem: item.cantidad * item.precioUnitario,
      })),
    },
    Observaciones: "Documento emitido por QuieroComer.cl",
  };

  const result = await sfFetch(`/invoiceV2/${SUCURSAL}`, body);
  return {
    folio: result.data?.folio,
    tipoDTE: 39,
    total: input.montoTotal,
    fecha,
    raw: result,
  };
}

// ── Factura Electrónica (DTE 33) ──

export interface FacturaInput {
  /** Monto neto (sin IVA) */
  montoNeto: number;
  /** Items de la factura */
  items: { nombre: string; cantidad: number; precioUnitarioNeto: number; descripcion?: string }[];
  /** Datos del receptor (obligatorios para factura) */
  receptor: {
    rut: string;
    razonSocial: string;
    giro: string;
    direccion: string;
    comuna: string;
    ciudad?: string;
    email?: string;
  };
  /** Fecha de emisión (default: hoy Chile) */
  fecha?: string;
}

export async function emitirFactura(input: FacturaInput) {
  const fecha = input.fecha || todayChile();
  const iva = Math.round(input.montoNeto * 0.19);
  const total = input.montoNeto + iva;

  const body = {
    Documento: {
      Encabezado: {
        IdDoc: {
          TipoDTE: 33,
          FchEmis: fecha,
          FmaPago: 1, // contado
        },
        Emisor: EMISOR,
        Receptor: {
          RUTRecep: formatRut(input.receptor.rut),
          RznSocRecep: input.receptor.razonSocial,
          GiroRecep: input.receptor.giro,
          DirRecep: input.receptor.direccion,
          CmnaRecep: input.receptor.comuna,
          CiudadRecep: input.receptor.ciudad || input.receptor.comuna,
          CorreoRecep: input.receptor.email || undefined,
        },
        Totales: {
          MntNeto: input.montoNeto,
          TasaIVA: 19,
          IVA: iva,
          MntTotal: total,
        },
      },
      Detalle: input.items.map((item, i) => ({
        NroLinDet: i + 1,
        NmbItem: item.nombre.slice(0, 80),
        DscItem: item.descripcion?.slice(0, 1000) || undefined,
        QtyItem: item.cantidad,
        PrcItem: item.precioUnitarioNeto,
        MontoItem: item.cantidad * item.precioUnitarioNeto,
      })),
    },
    Observaciones: "Documento emitido por QuieroComer.cl",
  };

  const result = await sfFetch(`/invoiceV2/${SUCURSAL}`, body);
  return {
    folio: result.data?.folio,
    tipoDTE: 33,
    montoNeto: input.montoNeto,
    iva,
    total,
    fecha,
    raw: result,
  };
}

// ── Descargar PDF ──

export async function descargarPDF(folio: number, tipoDTE: number): Promise<Buffer> {
  const result = await sfFetch("/dte/pdf", {
    credenciales: {
      rutEmisor: EMISOR.RUTEmisor,
      nombreSucursal: "Casa Matriz",
    },
    dteReferenciadoExterno: {
      folio,
      codigoTipoDte: tipoDTE,
      ambiente: 0, // 0=certificacion, 1=produccion
    },
  });
  return result.pdf;
}

// ── Enviar por email ──

export async function enviarPorEmail(folio: number, tipoDTE: number, email: string) {
  return sfFetch("/dte/enviar/mail", {
    credenciales: {
      rutEmisor: EMISOR.RUTEmisor,
      nombreSucursal: "Casa Matriz",
    },
    dteReferenciadoExterno: {
      folio,
      codigoTipoDte: tipoDTE,
      ambiente: 0,
    },
    mail: {
      to: email,
      subject: "Tu boleta electrónica — QuieroComer",
    },
  });
}

// ── Emitir boleta para suscripción QC ──

export interface SuscripcionInput {
  planNombre: string; // "Gold", "Premium"
  montoTotal: number; // con IVA incluido
  rutCliente?: string;
  nombreCliente: string;
  emailCliente: string;
  periodo?: string; // "junio 2026"
}

export async function emitirBoletaSuscripcion(input: SuscripcionInput) {
  const montoNeto = Math.round(input.montoTotal / 1.19);

  const result = await emitirBoleta({
    montoTotal: input.montoTotal,
    items: [{
      nombre: `Suscripción QuieroComer Plan ${input.planNombre}`,
      cantidad: 1,
      precioUnitario: input.montoTotal,
      descripcion: input.periodo ? `Servicio correspondiente al período ${input.periodo}` : undefined,
    }],
    rutReceptor: input.rutCliente,
    nombreReceptor: input.nombreCliente,
    emailReceptor: input.emailCliente,
  });

  return result;
}

export async function emitirFacturaSuscripcion(input: SuscripcionInput & {
  rutEmpresa: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
}) {
  const montoNeto = Math.round(input.montoTotal / 1.19);

  const result = await emitirFactura({
    montoNeto,
    items: [{
      nombre: `Suscripción QuieroComer Plan ${input.planNombre}`,
      cantidad: 1,
      precioUnitarioNeto: montoNeto,
      descripcion: input.periodo ? `Servicio correspondiente al período ${input.periodo}` : undefined,
    }],
    receptor: {
      rut: input.rutEmpresa,
      razonSocial: input.razonSocial,
      giro: input.giro,
      direccion: input.direccion,
      comuna: input.comuna,
      email: input.emailCliente,
    },
  });

  return result;
}
