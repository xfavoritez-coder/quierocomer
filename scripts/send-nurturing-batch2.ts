import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://quierocomer.com";
const KEY = process.env.SEED_SECRET;
if (!KEY) { console.error("SEED_SECRET not found"); process.exit(1); }

const TARGETS = [
  { phone: "+56940654742", scenario: "vio_no_activo" },
  { phone: "+56996309579", scenario: "vio_no_activo" },
  { phone: "+56933331189", scenario: "no_volvio" },
  { phone: "+56998410759", scenario: "vio_no_activo" },
  { phone: "+56989464703", scenario: "no_volvio" },
  { phone: "+56959323734", scenario: "vio_no_activo" },
  { phone: "+56982403093", scenario: "vio_no_activo" },
  { phone: "+56966369589", scenario: "no_volvio" },
  { phone: "+56951473257", scenario: "no_volvio" },
  { phone: "+56997469594", scenario: "vio_no_activo" },
  { phone: "+56984150995", scenario: "vio_no_activo" },
  { phone: "+56944241930", scenario: "vio_no_activo" },
  { phone: "+56940475435", scenario: "no_volvio" },
  { phone: "+56930800921", scenario: "vio_no_activo" },
  { phone: "+56984095639", scenario: "vio_no_activo" },
  { phone: "+56997093547", scenario: "vio_no_activo" },
  { phone: "+56994029494", scenario: "vio_no_activo" },
  { phone: "+56992920928", scenario: "vio_no_activo" },
  { phone: "+56987952009", scenario: "vio_no_activo" },
  { phone: "+56959028621", scenario: "no_volvio" },
];

async function main() {
  let sent = 0, failed = 0;
  for (const t of TARGETS) {
    const url = `${BASE}/api/cron/nurturing?key=${KEY}&test=${encodeURIComponent(t.phone)}&scenario=${t.scenario}`;
    process.stdout.write(`${t.phone} (${t.scenario})... `);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.sid) { console.log(`OK`); sent++; }
      else { console.log(`FAIL: ${JSON.stringify(data)}`); failed++; }
    } catch (e: any) { console.log(`ERROR: ${e.message}`); failed++; }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`\nDone: ${sent} sent, ${failed} failed`);
}
main();
