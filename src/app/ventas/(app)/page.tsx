import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSeller } from "@/lib/ventas/session";
import { statusInfo } from "@/lib/ventas/status";

export const dynamic = "force-dynamic";

export default async function VentasHomePage() {
  const seller = (await getCurrentSeller())!; // el layout ya exige sesión
  const isAdmin = seller.role === "ADMIN";

  // SELLER ve solo sus leads; ADMIN ve todos los de terreno (los que tienen vendedor).
  const leads = await prisma.lead.findMany({
    where: { ...(isAdmin ? { sellerId: { not: null } } : { sellerId: seller.id }), NOT: { captureSource: "example" } },
    select: { id: true, localName: true, commune: true, cuisine: true, crmStatus: true, crmFollowUpAt: true, createdAt: true, updatedAt: true, seller: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const fmt = (d: Date) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", timeZone: "America/Santiago" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Hola, {seller.name.split(" ")[0]}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 14 }}>
            <span className="ventas-mono">{leads.length}</span> {leads.length === 1 ? "local" : "locales"} {isAdmin ? "del equipo" : "capturados por ti"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/ventas/demo-ficticia" className="ventas-btn ghost" style={{ fontSize: 15, padding: "13px 18px" }}>▶ Demo de ejemplo</Link>
          <Link href="/ventas/nuevo" className="ventas-btn" style={{ fontSize: 16, padding: "14px 24px" }}>+ Nuevo local</Link>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="ventas-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Aún no hay locales</div>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "8px 0 18px" }}>Captura tu primer local con una foto de su carta, un link o solo su nombre.</p>
          <Link href="/ventas/nuevo" className="ventas-btn">Capturar un local</Link>
        </div>
      ) : (
        <div className="ventas-card" style={{ overflow: "hidden" }}>
          {leads.map((l, i) => {
            const st = statusInfo(l.crmStatus);
            return (
              <Link key={l.id} href={`/ventas/${l.id}`} className="ventas-row" style={{ borderTop: i ? "1px solid var(--line)" : "none", color: "inherit", textDecoration: "none" }}>
                <div className="who">
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{l.localName || "Leyendo su carta…"}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    {[l.cuisine, l.commune].filter(Boolean).join(" · ") || "Sin datos"}
                    {isAdmin && l.seller ? ` · ${l.seller.name}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: `${st.color}18`, color: st.color, whiteSpace: "nowrap", justifySelf: "end" }}>{st.label}</span>
                <div className="when">
                  {st.next && <span>{st.next}{l.crmFollowUpAt ? ` · ${fmt(l.crmFollowUpAt)}` : ""}</span>}
                  <span className="ventas-mono" style={{ marginLeft: 8, whiteSpace: "nowrap" }}>act. {fmt(l.updatedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
