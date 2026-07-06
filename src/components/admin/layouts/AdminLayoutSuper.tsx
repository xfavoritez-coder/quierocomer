"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { icon: "📊", label: "Dashboard", href: "/admin" },
  { icon: "🔄", label: "Lifecycle", href: "/admin/lifecycle" },
  { icon: "🧑‍💼", label: "Clientes", href: "/admin/clientes" },
  { icon: "👤", label: "Owners", href: "/admin/owners" },
  { icon: "👥", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "🧪", label: "Tests A/B", href: "/admin/tests-ab" },
  { icon: "🎯", label: "Funnel", href: "/admin/funnel" },
  { icon: "📣", label: "FB Ads", href: "/admin/facebook-ads" },
  { icon: "💬", label: "WhatsApp", href: "/admin/whatsapp" },
  { icon: "🎧", label: "Soporte", href: "/admin/soporte", badge: true },
];

interface Props {
  name: string;
  logout: () => void;
  children: React.ReactNode;
}

export default function AdminLayoutSuper({ name, logout, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadSupport, setUnreadSupport] = useState(0);

  const isActive = (h: string) => h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    fetch("/api/admin/soporte?countOnly=1")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.unread) setUnreadSupport(d.unread); })
      .catch(() => {});
  }, [pathname]);

  const navItem = (n: typeof NAV[0], style: React.CSSProperties) => (
    <Link key={n.href} href={n.href} style={style}>
      <span>{n.icon}</span>
      <span>{n.label}</span>
      {n.badge && unreadSupport > 0 && (
        <span style={{
          marginLeft: "auto", fontSize: "0.6rem", fontWeight: 800,
          padding: "2px 6px", borderRadius: 50,
          background: "#dc2626", color: "#fff", lineHeight: 1.3,
        }}>{unreadSupport}</span>
      )}
    </Link>
  );

  return (
    <div className="theme-dark" style={{ display: "flex", minHeight: "100vh", background: "#111111" }}>
      {/* Mobile top bar */}
      <div className="adm-mobilebar">
        <div>
          <Link href="/admin" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#F4A623", textDecoration: "none" }}>🧞 Admin</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unreadSupport > 0 && (
            <Link href="/admin/soporte" style={{ fontSize: "0.65rem", fontWeight: 800, padding: "3px 8px", borderRadius: 50, background: "#dc2626", color: "#fff", textDecoration: "none" }}>
              🎧 {unreadSupport}
            </Link>
          )}
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "1px solid #2A2A2A", borderRadius: "10px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", color: "#F4A623", fontSize: "1.2rem", cursor: "pointer" }}>{menuOpen ? "✕" : "☰"}</button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (<>
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998 }} />
        <div className="adm-mobilemenu">
          {NAV.map(n => navItem(n, {
            display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px",
            textDecoration: "none", fontFamily: "var(--font-display)", fontSize: "1.05rem",
            color: isActive(n.href) ? "#F4A623" : "#888888",
            background: isActive(n.href) ? "rgba(255,214,0,0.1)" : "transparent",
            borderBottom: "1px solid #2A2A2A",
          }))}
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 24px", width: "100%", textAlign: "left", fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "#ff8080", background: "none", border: "none", cursor: "pointer" }}>🚪 Cerrar sesión</button>
        </div>
      </>)}

      {/* Desktop sidebar */}
      <aside className="adm-sidebar">
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #2A2A2A" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Link href="/admin" style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "#F4A623", textDecoration: "none" }}>🧞 Admin</Link>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#666", fontFamily: "var(--font-display)" }}>{name}</div>
        </div>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV.map(n => navItem(n, {
            display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
            textDecoration: "none", fontFamily: "var(--font-display)", fontSize: "0.82rem",
            color: isActive(n.href) ? "#F4A623" : "#888888",
            background: isActive(n.href) ? "rgba(255,214,0,0.1)" : "transparent",
            borderLeft: isActive(n.href) ? "3px solid #F4A623" : "3px solid transparent",
          }))}
        </nav>
        <button onClick={logout} style={{ padding: "14px 16px", background: "none", border: "none", borderTop: "1px solid #2A2A2A", color: "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer", textAlign: "left" }}>🚪 Cerrar sesión</button>
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
          .adm-grid-2 { grid-template-columns: 1fr !important; }
          .adm-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .adm-flex-wrap { flex-wrap: wrap !important; }
          .adm-flex-col { flex-direction: column !important; }
          .adm-w-full { width: 100% !important; }
          .adm-btn-row { flex-direction: column !important; }
          .adm-btn-row > * { width: 100% !important; flex: none !important; }
        }
        @media (orientation: landscape) and (max-height: 500px) {
          .adm-sidebar { display: none; }
          .adm-mobilebar { display: none; }
          .adm-main { margin-left: 0; padding: 12px 16px 12px; }
        }
      `}</style>
    </div>
  );
}
