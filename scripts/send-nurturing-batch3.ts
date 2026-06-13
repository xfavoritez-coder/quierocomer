import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://quierocomer.cl";
const KEY = process.env.SEED_SECRET;
if (!KEY) { console.error("SEED_SECRET not found"); process.exit(1); }

// Stage determines scenario:
// LEAD_VIO_NO_ACTIVO / DEMO → carta_no_revisada
// TRIAL_ACTIVO / TRIAL_DORMIDO / LEAD_PROCESANDO → no_volvio
const TARGETS = [
  { phone: "+56996710189", name: "Lufin", scenario: "no_volvio" },
  { phone: "+56982670252", name: "Viafara", scenario: "no_volvio" },
  { phone: "+56968027830", name: "Kiuvo", scenario: "vio_no_activo" },
  { phone: "+56999790424", name: "Panamericano", scenario: "no_volvio" },
  { phone: "+56933710034", name: "Koibito", scenario: "no_volvio" },
  { phone: "+56996333410", name: "La Fábrica", scenario: "carta_no_revisada" },
  { phone: "+56983119155", name: "Huapo Street", scenario: "no_volvio" },
  { phone: "+56976323134", name: "Chilmex", scenario: "no_volvio" },
  { phone: "+56952433979", name: "El Parron", scenario: "no_volvio" },
  { phone: "+56974653979", name: "Pollizonte", scenario: "no_volvio" },
  { phone: "+56989891234", name: "Paz", scenario: "vio_no_activo" },
  { phone: "+56939201763", name: "Alto gourmet", scenario: "vio_no_activo" },
];

async function main() {
  let sent = 0, failed = 0;
  for (const t of TARGETS) {
    const url = `${BASE}/api/cron/nurturing?key=${KEY}&test=${encodeURIComponent(t.phone)}&scenario=${t.scenario}`;
    process.stdout.write(`${t.name.padEnd(20)} (${t.scenario})... `);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.sid) { console.log("OK"); sent++; }
      else { console.log(`FAIL: ${JSON.stringify(data)}`); failed++; }
    } catch (e: any) { console.log(`ERROR: ${e.message}`); failed++; }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`\nDone: ${sent} sent, ${failed} failed`);
}
main();
