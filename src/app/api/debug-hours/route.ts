import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "el-menu-de-la-esquina";
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { orderingBusinessHours: true } });
  const rawBH = (r as any)?.orderingBusinessHours;

  const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const day = chileNow.getDay();
  const nowMins = chileNow.getHours() * 60 + chileNow.getMinutes();
  const dayConfig = rawBH ? (rawBH as any)[String(day)] : null;

  let isClosed = false;
  let reason = "no business hours configured";
  if (rawBH && dayConfig) {
    if (!dayConfig.open) { isClosed = true; reason = "day marked closed"; }
    else {
      const parseMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
      const fromMins = parseMins(dayConfig.from || "00:00");
      const rawTo = dayConfig.to || "23:59";
      const toMins = rawTo === "00:00" ? 1440 : parseMins(rawTo);
      if (fromMins <= toMins) {
        isClosed = nowMins < fromMins || nowMins >= toMins;
        reason = `normal range ${dayConfig.from}-${rawTo}: nowMins=${nowMins} fromMins=${fromMins} toMins=${toMins}`;
      } else {
        isClosed = nowMins < fromMins && nowMins >= toMins;
        reason = `crosses midnight ${dayConfig.from}-${rawTo}: nowMins=${nowMins}`;
      }
    }
  }

  return NextResponse.json({
    chileTime: `${chileNow.getHours()}:${String(chileNow.getMinutes()).padStart(2,"0")}`,
    day,
    dayName: ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"][day],
    dayConfig,
    nowMins,
    isClosed,
    reason,
    rawBHKeys: rawBH ? Object.keys(rawBH) : null,
  });
}
