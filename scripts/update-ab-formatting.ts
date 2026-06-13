import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Update landing-hero variants with formatting
  const updates: { text: string; newText: string }[] = [
    { text: "Tu carta puede vender más", newText: "Tu carta puede {vender más}" },
    { text: "Tu restaurant puede vender más", newText: "Tu restaurant puede {vender más}" },
    { text: "Transforma tu carta actual en una herramienta que aumenta tus ventas y mejora la experiencia de tus clientes.", newText: "Transforma tu carta actual en una herramienta que {aumenta tus ventas} y mejora la experiencia de tus clientes." },
  ];

  for (const u of updates) {
    const result = await p.abVariant.updateMany({ where: { text: u.text }, data: { text: u.newText } });
    if (result.count > 0) console.log(`Updated: "${u.text.slice(0, 40)}..." → "${u.newText.slice(0, 40)}..."`);
  }

  // Update subircarta-hero variants
  const scUpdates: { text: string; newText: string }[] = [
    { text: "Sube tu carta y mira cómo queda", newText: "Sube tu carta y mira {cómo queda}" },
    { text: "Transforma tu carta en 60 segundos", newText: "Transforma tu carta en {60 segundos}" },
    { text: "Tu carta, pero inteligente", newText: "Tu carta, pero {inteligente}" },
  ];

  for (const u of scUpdates) {
    const result = await p.abVariant.updateMany({ where: { text: u.text }, data: { text: u.newText } });
    if (result.count > 0) console.log(`Updated: "${u.text}" → "${u.newText}"`);
  }

  console.log("Done.");
  await p.$disconnect();
}
main();
