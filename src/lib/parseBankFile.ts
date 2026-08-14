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
// Formato BCI: "YYYY-MM-DD YYYY-MM-DD Descripción $Monto $Saldo"
// Las filas vienen de más reciente a más antigua.
// El signo (cargo/abono) se determina comparando el saldo con la fila siguiente.
export async function parseBCIPDF(buffer: Buffer): Promise<ParsedRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractText } = require("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

  // Formato: YYYY-MM-DD YYYY-MM-DD Descripción $1.234.567 $9.876.543
  const ROW_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s+\$(\d{1,3}(?:\.\d{3})*)\s+\$(\d{1,3}(?:\.\d{3})*)$/;

  const lines: string[] = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  type RawItem = { date: Date; description: string; amount: number; balance: number };
  const items: RawItem[] = [];

  for (const line of lines) {
    const m = line.match(ROW_RE);
    if (!m) continue;
    const [, dateStr, , desc, amtStr, balStr] = m;
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
    items.push({
      date,
      description: desc.trim(),
      amount: parseCLP(amtStr),
      balance: parseCLP(balStr),
    });
  }

  if (items.length === 0) return [];

  const result: ParsedRow[] = [];

  for (let i = 0; i < items.length; i++) {
    const { date, description, amount, balance } = items[i];
    // La fila siguiente tiene el saldo ANTES de esta transacción
    const prevBalance = i + 1 < items.length ? items[i + 1].balance : null;

    let debit: number | null = null;
    let credit: number | null = null;

    if (prevBalance !== null) {
      if (balance < prevBalance) {
        debit = amount;   // saldo bajó → cargo
      } else {
        credit = amount;  // saldo subió → abono
      }
    } else {
      // Última fila sin referencia: inferir por descripción
      const desc = description.toLowerCase();
      if (desc.includes("abono") || desc.includes("pago recibido") || desc.includes("transferencia recibida")) {
        credit = amount;
      } else {
        debit = amount;
      }
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
