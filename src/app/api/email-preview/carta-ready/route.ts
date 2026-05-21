import { NextResponse } from "next/server";
import { cartaReadyEmailHtml } from "@/lib/email/cartaReadyEmailHtml";

export async function GET() {
  const html = cartaReadyEmailHtml({
    ownerName: "Andrés",
    restaurantName: "Juana la Brava",
    logoUrl: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg",
    dishCount: 42,
    clickUrl: "#",
    openPixel: "#",
    activarUrl: "#",
    panelUrl: "#",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
