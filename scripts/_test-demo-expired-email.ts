import { sendAdminEmail, demoExpiredEmailHtml } from "@/lib/email/sendAdminEmail";

async function main() {
  const html = demoExpiredEmailHtml({
    ownerName: "Jaime",
    restaurantName: "Club de Campo San Fernando",
    slug: "varas-oportus",
    panelUrl: "https://quierocomer.com/panel",
  });

  await sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: "Tu periodo de prueba de Club de Campo San Fernando ha finalizado",
    purpose: "demo_expired_test",
    html,
  });
  console.log("Email sent to favoritez@gmail.com!");
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
