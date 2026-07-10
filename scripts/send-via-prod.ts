import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://quierocomer.com";
const KEY = process.env.SEED_SECRET;

if (!KEY) { console.error("SEED_SECRET not found in .env.local"); process.exit(1); }

const TARGETS = [
  { phone: "+56954085483", name: "Rosa", rest: "Paulista", scenario: "carta_no_revisada" },
  { phone: "+56928254931", name: "Josefa", rest: "Madara sushi", scenario: "carta_no_revisada" },
  { phone: "+56979226775", name: "Javier", rest: "Dubliness café", scenario: "carta_no_revisada" },
  { phone: "+56962630150", name: "Alexis", rest: "Sensei del sushi", scenario: "carta_no_revisada" },
  { phone: "+56977977216", name: "Cristobal", rest: "Bocalago", scenario: "carta_no_revisada" },
  { phone: "+56931987171", name: "Keity", rest: "El Carrito Azul", scenario: "carta_no_revisada" },
  { phone: "+56935883244", name: "Diego", rest: "Steakhouse Restobar", scenario: "carta_no_revisada" },
  { phone: "+56992190784", name: "Jaime", rest: "Tricahue", scenario: "carta_no_revisada" },
  { phone: "+56965720471", name: "Fabian", rest: "Los Fabulosos", scenario: "carta_no_revisada" },
  { phone: "+56966755571", name: "Camilo", rest: "La parada sureña", scenario: "carta_no_revisada" },
  { phone: "+56973046443", name: "Simón", rest: "Tres toques", scenario: "no_volvio" },
  { phone: "+56950463340", name: "Freddy", rest: "Heladería Italia", scenario: "no_volvio" },
  { phone: "+56930350448", name: "Patricio", rest: "Casa de campo", scenario: "carta_no_revisada" },
  { phone: "+56954036360", name: "Lissette", rest: "Beer house Atacama", scenario: "carta_no_revisada" },
  { phone: "+56929966404", name: "Luis", rest: "Festin limeño", scenario: "carta_no_revisada" },
  { phone: "+56940959137", name: "Juanito", rest: "Tablon", scenario: "carta_no_revisada" },
  { phone: "+56993502372", name: "María", rest: "El talquino", scenario: "carta_no_revisada" },
  { phone: "+56999333286", name: "Hugo", rest: "Mishi sushi express", scenario: "carta_no_revisada" },
  { phone: "+56985845133", name: "Gilary", rest: "La bolivianita", scenario: "carta_no_revisada" },
  { phone: "+56986231842", name: "Juliana", rest: "Entre Maderos", scenario: "carta_no_revisada" },
];

async function main() {
  let sent = 0, failed = 0;

  for (const t of TARGETS) {
    const url = `${BASE}/api/cron/nurturing?key=${KEY}&test=${encodeURIComponent(t.phone)}&scenario=${t.scenario}`;
    console.log(`Sending to ${t.name} (${t.rest}) — ${t.scenario}...`);

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.sid) {
        console.log(`  OK: ${data.sid}`);
        sent++;
      } else {
        console.log(`  FAILED: ${JSON.stringify(data)}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDone: ${sent} sent, ${failed} failed`);
}
main();
