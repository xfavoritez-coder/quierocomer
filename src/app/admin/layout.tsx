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

  if (!ok) return <div style={{ minHeight: "100vh", background: "#0a0812", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#e8a84c", fontFamily: "Georgia", fontSize: "0.8rem" }}>🧞 Cargando...</p></div>;
  if (pathname === "/admin/login") return <>{children}</>;

  const isActive = (h: string) => h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);
  const handleLogout = () => { sessionStorage.removeItem("admin_session"); router.push("/admin/login"); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0812" }}>
      {/* Mobile top bar */}
      <div className="adm-mobilebar">
        <Link href="/admin" style={{ fontFamily: "Georgia", fontSize: "1.1rem", color: "#e8a84c", textDecoration: "none" }}>🧞 Admin</Link>
        <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "1px solid rgba(232,168,76,0.3)", borderRadius: "10px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8a84c", fontSize: "1.2rem", cursor: "pointer" }}>{menuOpen ? "✕" : "☰"}</button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (<>
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998 }} />
        <div className="adm-mobilemenu">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px", textDecoration: "none", fontFamily: "Georgia", fontSize: "1.05rem", color: isActive(n.href) ? "#e8a84c" : "rgba(240,234,214,0.6)", background: isActive(n.href) ? "rgba(232,168,76,0.1)" : "transparent", borderBottom: "1px solid rgba(232,168,76,0.06)" }}>
              <span style={{ fontSize: "1.2rem" }}>{n.icon}</span> {n.label}
            </Link>
          ))}
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px", width: "100%", textAlign: "left", fontFamily: "Georgia", fontSize: "1.05rem", color: "#ff8080", background: "none", border: "none", cursor: "pointer" }}>🚪 Cerrar sesión</button>
        </div>
      </>)}

      {/* Desktop sidebar */}
      <aside className="adm-sidebar">
        <Link href="/admin" style={{ fontFamily: "Georgia", fontSize: "0.9rem", color: "#e8a84c", textDecoration: "none", padding: "20px 16px 16px", borderBottom: "1px solid rgba(232,168,76,0.1)", display: "block" }}>🧞 Admin</Link>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", textDecoration: "none", fontFamily: "Georgia", fontSize: "0.82rem", color: isActive(n.href) ? "#e8a84c" : "rgba(240,234,214,0.5)", background: isActive(n.href) ? "rgba(232,168,76,0.1)" : "transparent", borderLeft: isActive(n.href) ? "3px solid #e8a84c" : "3px solid transparent" }}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} style={{ padding: "14px 16px", background: "none", border: "none", borderTop: "1px solid rgba(232,168,76,0.1)", color: "#ff6b6b", fontFamily: "Georgia", fontSize: "0.78rem", cursor: "pointer", textAlign: "left" }}>🚪 Cerrar sesión</button>
      </aside>

      <main className="adm-main">{children}</main>

      <style>{`
        .adm-sidebar {
          width: 200px; flex-shrink: 0;
          background: rgba(13,7,3,0.98);
          border-right: 1px solid rgba(232,168,76,0.15);
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
        }
        .adm-main {
          flex: 1; margin-left: 200px; padding: 24px 32px; min-height: 100vh;
        }
        .adm-mobilebar { display: none; }
        .adm-mobilemenu {
          position: fixed; top: 64px; right: 0; width: min(300px, 85vw); bottom: 0;
          background: rgba(13,7,3,0.98); border-left: 1px solid rgba(232,168,76,0.15);
          z-index: 999; overflow-y: auto;
        }
        @media (max-width: 767px) {
          .adm-sidebar { display: none; }
          .adm-mobilebar {
            display: flex; position: fixed; top: 0; left: 0; right: 0; z-index: 999;
            padding: 14px 18px; background: rgba(10,8,18,0.98);
            border-bottom: 1px solid rgba(232,168,76,0.15);
            justify-content: space-between; align-items: center;
          }
          .adm-main { margin-left: 0; padding: 80px 16px 32px; }
        }
      `}</style>
    </div>
  );
}
