import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSeller } from "@/lib/ventas/session";
import EquipoClient from "./EquipoClient";

export const dynamic = "force-dynamic";

export default async function VentasEquipoPage() {
  const me = await getCurrentSeller();
  if (me?.role !== "ADMIN") redirect("/ventas");
  const sellers = await prisma.seller.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, _count: { select: { leads: true } } },
  });
  return (
    <EquipoClient
      meId={me.id}
      initial={sellers.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role, active: s.active, leads: s._count.leads, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))}
    />
  );
}
