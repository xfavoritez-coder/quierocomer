"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { icon: "📊", label: "Dashboard", href: "/admin" },
  { icon: "🏠", label: "Locales", href: "/admin/locales" },
  { icon: "📋", label: "Menús", href: "/admin/menus" },
  { icon: "🧞", label: "Behavior", href: "/admin/genie" },
  { icon: "⚙️", label: "Ajustes", href: "/admin/ajustes" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setOk(true); return; }
    try {
      const s = JSON.parse(sessionStorage.getItem("admin_session") ?? "{}");
      if (!s.loggedIn) router.replace("/admin/login"); else setOk(true);
    } catch { router.replace("/admin/login"); }
  }, [pathname, router]);

  if (!ok) return <div style={{ minHeight: "100vh", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#FFD600", fontFamily: "var(--font-display)", fontSize: "0.8rem" }}>🧞 Cargando...</p></div>;
  if (pathname === "/admin/login") return <>{children}</>;

  const isActive = (h: string) => h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);
  const handleLogout = () => { sessionStorage.removeItem("admin_session"); router.push("/admin/login"); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#111111" }}>
      {/* Mobile top bar */}
      <div className="adm-mobilebar">
        <Link href="/admin" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#FFD600", textDecoration: "none" }}>🧞 Admin</Link>
        <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "1px solid #2A2A2A", borderRadius: "10px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFD600", fontSize: "1.2rem", cursor: "pointer" }}>{menuOpen ? "✕" : "☰"}</button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (<>
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998 }} />
        <div className="adm-mobilemenu">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px", textDecoration: "none", fontFamily: "var(--font-display)", fontSize: "1.05rem", color: isActive(n.href) ? "#FFD600" : "#888888", background: isActive(n.href) ? "rgba(255,214,0,0.1)" : "transparent", borderBottom: "1px solid #2A2A2A" }}>
              <span style={{ fontSize: "1.2rem" }}>{n.icon}</span> {n.label}
            </Link>
          ))}
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px", width: "100%", textAlign: "left", fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "#ff8080", background: "none", border: "none", cursor: "pointer" }}>🚪 Cerrar sesión</button>
        </div>
      </>)}

      {/* Desktop sidebar */}
      <aside className="adm-sidebar">
        <Link href="/admin" style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "#FFD600", textDecoration: "none", padding: "20px 16px 16px", borderBottom: "1px solid #2A2A2A", display: "block" }}>🧞 Admin</Link>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", textDecoration: "none", fontFamily: "var(--font-display)", fontSize: "0.82rem", color: isActive(n.href) ? "#FFD600" : "#888888", background: isActive(n.href) ? "rgba(255,214,0,0.1)" : "transparent", borderLeft: isActive(n.href) ? "3px solid #FFD600" : "3px solid transparent" }}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} style={{ padding: "14px 16px", background: "none", border: "none", borderTop: "1px solid #2A2A2A", color: "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer", textAlign: "left" }}>🚪 Cerrar sesión</button>
      </aside>

      <main className="adm-main">{children}</main>

      <style>{`
        .adm-sidebar {
          width: 200px; flex-shrink: 0;
          background: #1A1A1A;
          border-right: 1px solid #2A2A2A;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
        }
        .adm-main {
          flex: 1; margin-left: 200px; padding: 24px 32px; min-height: 100vh;
        }
        .adm-mobilebar { display: none; }
        .adm-mobilemenu {
          position: fixed; top: 64px; right: 0; width: min(300px, 85vw); bottom: 0;
          background: #1A1A1A; border-left: 1px solid #2A2A2A;
          z-index: 999; overflow-y: auto;
        }
        @media (max-width: 767px) {
          .adm-sidebar { display: none; }
          .adm-mobilebar {
            display: flex; position: fixed; top: 0; left: 0; right: 0; z-index: 999;
            padding: 14px 18px; background: #111111;
            border-bottom: 1px solid #2A2A2A;
            justify-content: space-between; align-items: center;
          }
          .adm-main { margin-left: 0; padding: 80px 16px 32px; }
        }
      `}</style>
    </div>
  );
}
