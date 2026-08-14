import * as XLSX from "xlsx";
import { createHash } from "crypto";

export type ParsedRow = {
  date: Date;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  externalKey: string;
};

// ── Número serial de Excel → Date ──────────────────────────────────────────
function excelDateToJS(serial: number): Date {
  const utcDays = serial - 25569;
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

// ── Parsear número chileno "1.234.567" → 1234567 ───────────────────────────
function parseCLP(s: string): number {
  return parseInt(s.replace(/\./g, ""), 10);
}

function makeKey(date: Date, desc: string, debit: number | null, credit: number | null) {
  return createHash("sha1")
    .update(`${date.toISOString()}|${desc}|${debit ?? ""}|${credit ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

// ── XLSX de BCI ─────────────────────────────────────────────────────────────
// Columnas: Fecha Transacción | Fecha Contable | Descripción | Egreso (-) | Ingreso (+) | Saldo
export function parseBCIXLSX(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const headerIdx = raw.findIndex((r) => r && typeof r[2] === "string" && /descrip/i.test(r[2]));
  if (headerIdx === -1) return [];

  const result: ParsedRow[] = [];
  for (const row of raw.slice(headerIdx + 1)) {
    if (!row || !row[0] || !row[2]) continue;
    const dateRaw = row[0];
    const desc = String(row[2]).trim();
    if (!desc) continue;

    let date: Date;
    if (typeof dateRaw === "number") {
      date = excelDateToJS(dateRaw);
    } else {
      const s = String(dateRaw).trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) date = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0, 0));
      else continue;
    }

    const debit = row[3] && row[3] !== "" ? Math.round(Number(row[3])) : null;
    const credit = row[4] && row[4] !== "" ? Math.round(Number(row[4])) : null;
    const balance = row[5] ? Math.round(Number(row[5])) : null;
    if (!debit && !credit) continue;

    result.push({ date, description: desc, debit, credit, balance, externalKey: makeKey(date, desc, debit, credit) });
  }
  return result;
}

// ── PDF de BCI ──────────────────────────────────────────────────────────────
// Estrategia: extraer texto, buscar líneas con fecha DD/MM/YYYY,
// extraer números en formato chileno y usar cambio de saldo para determinar egreso/ingreso.
export async function parseBCIPDF(buffer: Buffer): Promise<ParsedRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);

  // Regex para número chileno (ej: "1.234.567" o "50.000")
  const CLP_RE = /\d{1,3}(?:\.\d{3})+/g;
  // Regex para fecha chilena
  const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.*)/;

  const lines: string[] = data.text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  type RawItem = {
    date: Date;
    description: string;
    amounts: number[];
  };

  const items: RawItem[] = [];

  for (const line of lines) {
    const dm = line.match(DATE_RE);
    if (!dm) continue;
    const [, dd, mm, yyyy, rest] = dm;
    const date = new Date(Date.UTC(+yyyy, +mm - 1, +dd, 12, 0, 0));

    // Extraer todos los montos en formato chileno
    const amounts = [...rest.matchAll(CLP_RE)].map((m) => parseCLP(m[0]));
    if (amounts.length === 0) continue;

    // Descripción: texto antes del primer número
    const firstNumIdx = rest.search(CLP_RE);
    const description = (firstNumIdx > 0 ? rest.slice(0, firstNumIdx) : rest).trim().replace(/\s+/g, " ");
    if (!description) continue;

    items.push({ date, description, amounts });
  }

  const result: ParsedRow[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { date, description, amounts } = item;

    // El último número suele ser el saldo; el anterior es el monto de la transacción
    const balance = amounts.length >= 1 ? amounts[amounts.length - 1] : null;
    const txAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : (amounts[0] ?? null);

    if (!txAmount) continue;

    // Determinar signo usando cambio de saldo con la fila siguiente (si existe)
    let debit: number | null = null;
    let credit: number | null = null;

    const prevBalance = i > 0 ? (result[result.length - 1]?.balance ?? null) : null;

    if (prevBalance !== null && balance !== null) {
      const diff = balance - prevBalance;
      if (diff < 0) {
        debit = txAmount;
      } else if (diff > 0) {
        credit = txAmount;
      } else {
        // Sin cambio neto, asumir egreso
        debit = txAmount;
      }
    } else {
      // Sin balance previo para comparar, asumir egreso (más común)
      debit = txAmount;
    }

    result.push({
      date,
      description,
      debit,
      credit,
      balance,
      externalKey: makeKey(date, description, debit, credit),
    });
  }

  return result;
}

// ── Detectar tipo y parsear ─────────────────────────────────────────────────
export async function parseBankFile(buffer: Buffer, filename: string): Promise<ParsedRow[]> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return parseBCIPDF(buffer);
  return parseBCIXLSX(buffer);
}
