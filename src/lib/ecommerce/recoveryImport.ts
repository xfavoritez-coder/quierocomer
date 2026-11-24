// ═══════════════════════════════════════════════════════════
//  Importación manual de clientes perdidos para Recuperación.
//  El dueño sube un CSV con correos (de su POS viejo, Toteat,
//  una planilla, etc.). El sistema autodetecta la columna de
//  correo y guarda la lista en ecommerceStoreConfig.recoveryImportedClients.
//  Los correos que NO tienen pedidos en el sistema se tratan como
//  clientes PERDIDOS sintéticos y entran al flujo de recuperación
//  (encuesta → cupón) igual que un cliente real inactivo.
//  Se guarda como JSON en la config (sin tocar el esquema Prisma).
// ═══════════════════════════════════════════════════════════
import { normalizeEmail } from "@/lib/ecommerce/store-config";
import type { ClientRow } from "@/lib/ecommerce/client-segmentation";

export interface ImportedClient {
  email: string;
  name?: string;
}

/** Lee la lista de clientes importados desde el JSON crudo de ecommerceStoreConfig. */
export function readImportedClients(storeConfig: unknown): ImportedClient[] {
  const o = (storeConfig && typeof storeConfig === "object" && !Array.isArray(storeConfig))
    ? (storeConfig as Record<string, unknown>) : {};
  const raw = o.recoveryImportedClients;
  if (!Array.isArray(raw)) return [];
  const out: ImportedClient[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (!x) continue;
    if (typeof x === "string") {
      const e = normalizeEmail(x);
      if (e && !seen.has(e)) { seen.add(e); out.push({ email: e }); }
      continue;
    }
    const r = x as Record<string, unknown>;
    const e = normalizeEmail(r.email);
    if (!e || seen.has(e)) continue;
    seen.add(e);
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    out.push({ email: e, ...(name ? { name } : {}) });
  }
  return out;
}

/**
 * Convierte la lista importada en ClientRow[] "perdidos" sintéticos,
 * EXCLUYENDO los correos que ya existen como clientes reales (con pedidos):
 * para esos se usa el dato real (lo maneja la segmentación normal).
 */
export function buildImportedChurnedClients(
  imported: ImportedClient[],
  existingEmails: Set<string>,
  restaurantId: string,
): ClientRow[] {
  const oldIso = new Date(Date.now() - 120 * 86400000).toISOString();
  const out: ClientRow[] = [];
  const seen = new Set<string>();
  for (const it of imported) {
    const em = it.email.toLowerCase();
    if (!em || existingEmails.has(em) || seen.has(em)) continue;
    seen.add(em);
    out.push({
      email: it.email,
      name: it.name || "",
      phone: "",
      orders: 0,
      totalSpent: 0,
      avgTicket: 0,
      lastOrderAt: oldIso,
      firstOrderAt: oldIso,
      daysSinceLastOrder: 120, // > 90 → perdido; supera el umbral de encuesta
      avgFrequencyDays: null,
      status: "churned",
      riskScore: 50,
      score: 0,
      topProduct: null,
      lastRestaurantId: restaurantId,
      imported: true,
    });
  }
  return out;
}

// ── Parseo de CSV con autodetección de la columna de correo ──

/** Divide una línea CSV respetando comillas dobles. */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface EmailCsvResult {
  clients: ImportedClient[];
  /** Nombre (o posición) de la columna de correo detectada; null si no se encontró. */
  emailColumn: string | null;
  /** Celdas no vacías que no eran un correo válido. */
  invalid: number;
  /** Correos repetidos dentro del mismo archivo. */
  duplicatesInFile: number;
  /** Filas de datos leídas. */
  rows: number;
}

const EMAIL_HEADER = /e-?mail|correo|\bmail\b/i;
const NAME_HEADER = /nombre|name|cliente|contacto|titular/i;

/**
 * Parsea el texto de un CSV y devuelve los correos encontrados.
 * Autodetecta delimitador (`,` `;` o tab), si hay fila de encabezado,
 * y qué columna es la de correo (por nombre de encabezado o, si no,
 * por la columna con más celdas que parezcan un email).
 */
export function parseEmailCsv(text: string): EmailCsvResult {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return { clients: [], emailColumn: null, invalid: 0, duplicatesInFile: 0, rows: 0 };

  // Delimitador: el que más aparece en la primera línea.
  const h0 = lines[0];
  const nComma = (h0.match(/,/g) || []).length;
  const nSemi = (h0.match(/;/g) || []).length;
  const nTab = (h0.match(/\t/g) || []).length;
  const delim = nSemi > nComma && nSemi >= nTab ? ";" : nTab > nComma ? "\t" : ",";

  const rows = lines.map((l) => splitCsvLine(l, delim));

  // ¿La primera fila es encabezado? Lo es si NO contiene ya un correo.
  const row0 = rows[0];
  const row0HasEmail = row0.some((c) => !!normalizeEmail(c));
  let headerRow: string[] | null = null;
  let dataRows = rows;
  let emailCol = -1;
  let nameCol = -1;

  if (!row0HasEmail) {
    headerRow = row0;
    dataRows = rows.slice(1);
    emailCol = row0.findIndex((h) => EMAIL_HEADER.test(h));
    nameCol = row0.findIndex((h) => NAME_HEADER.test(h));
  }

  // Si no se detectó por encabezado, buscar la columna con más emails.
  if (emailCol < 0) {
    const maxCols = Math.max(0, ...dataRows.map((r) => r.length));
    let best = -1;
    let bestCount = 0;
    for (let c = 0; c < maxCols; c++) {
      let n = 0;
      for (const r of dataRows) if (r[c] && normalizeEmail(r[c])) n++;
      if (n > bestCount) { bestCount = n; best = c; }
    }
    emailCol = bestCount > 0 ? best : -1;
  }

  if (emailCol < 0) return { clients: [], emailColumn: null, invalid: 0, duplicatesInFile: 0, rows: dataRows.length };

  const seen = new Set<string>();
  const clients: ImportedClient[] = [];
  let invalid = 0;
  let duplicatesInFile = 0;

  for (const r of dataRows) {
    const raw = r[emailCol];
    if (!raw || !raw.trim()) continue;
    const em = normalizeEmail(raw);
    if (!em) { invalid++; continue; }
    if (seen.has(em)) { duplicatesInFile++; continue; }
    seen.add(em);
    const name = nameCol >= 0 ? (r[nameCol] || "").trim().slice(0, 80) : "";
    clients.push({ email: em, ...(name ? { name } : {}) });
  }

  const emailColumn = headerRow && headerRow[emailCol]?.trim()
    ? headerRow[emailCol].trim()
    : `columna ${emailCol + 1}`;

  return { clients, emailColumn, invalid, duplicatesInFile, rows: dataRows.length };
}
