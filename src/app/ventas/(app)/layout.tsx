import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSeller } from "@/lib/ventas/session";

export const dynamic = "force-dynamic";

// Todo lo que está bajo /ventas (salvo /ventas/login) exige sesión de vendedor.
export default async function VentasAppLayout({ children }: { children: React.ReactNode }) {
  const seller = await getCurrentSeller();
  if (!seller) redirect("/ventas/login");

  return (
    <>
      <header className="ventas-bar">
        <Link href="/ventas" className="ventas-brand"><span className="mk">Q</span><span className="t">Ventas</span></Link>
        <nav className="ventas-nav">
          <Link href="/ventas">Inicio</Link>
          <Link href="/ventas/nuevo">Nuevo local</Link>
          {seller.role === "ADMIN" && <Link href="/ventas/equipo">Mi equipo</Link>}
        </nav>
        <span className="me" style={{ fontSize: 13, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{seller.name}</span>
        <form action="/api/ventas/logout" method="post">
          <button className="ventas-btn ghost" style={{ padding: "7px 12px", fontSize: 13 }}>Salir</button>
        </form>
      </header>
      <main className="ventas-main">{children}</main>
    </>
  );
}
