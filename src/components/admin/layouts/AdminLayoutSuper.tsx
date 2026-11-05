"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const F = "var(--font-display, system-ui)";
const GOLD = "#F4A623";

type NavItem = { icon: string; label: string; href: string; badge?: boolean };
type NavSection = { key: string; label: string; items: NavItem[] };

const NAV_TOP: NavItem[] = [
  { icon: "📊", label: "Dashboard", href: "/admin" },
  { icon: "🔄", label: "Lifecycle", href: "/admin/lifecycle" },
  { icon: "👤", label: "Owners", href: "/admin/owners" },
  { icon: "🎯", label: "Funnel", href: "/admin/funnel" },
  { icon: "🧪", label: "Tests A/B", href: "/admin/tests-ab" },
  { icon: "✉️", label: "Mail Marketing", href: "/admin/mailmarketing" },
  { icon: "💬", label: "WhatsApp", href: "/admin/whatsapp" },
];

const NAV_SECTIONS: NavSection[] = [
  {
    key: "ecommerce",
    label: "Ecommerce",
    items: [
      { icon: "📈", label: "Dashboard", href: "/admin/ecommerce/dashboard" },
      { icon: "🛒", label: "Pedidos", href: "/admin/ecommerce/pedidos" },
      { icon: "👥", label: "Clientes", href: "/admin/ecommerce/usuarios" },
    ],
  },
  {
    key: "cartaqr",
    label: "Carta QR",
    items: [
      { icon: "📊", label: "Analytics", href: "/admin/carta-qr/dashboard" },
      { icon: "👤", label: "Usuarios", href: "/admin/carta-qr/usuarios" },
    ],
  },
  {
    key: "general",
    label: "General",
    items: [
      { icon: "🧾", label: "Facturación", href: "/admin/facturas" },
      { icon: "📦", label: "Planes", href: "/admin/planes" },
      { icon: "🎧", label: "Soporte", href: "/admin/soporte", badge: true },
      { icon: "⚙️", label: "Ajustes", href: "/admin/ajustes" },
    ],
  },
];

interface Props {
  name: string;
  logout: () => void;
  children: React.ReactNode;
}

export default function AdminLayoutSuper({ name, logout, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    // Auto-open the section that contains the current route
    const active = new Set<string>();
    for (const s of NAV_SECTIONS) {
      if (s.items.some(i => pathname.startsWith(i.href))) active.add(s.key);
    }
    return active;
  });
  const [unreadSupport, setUnreadSupport] = useState(0);

  const isActive = (h: string) => h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);

  // Auto-open section when navigating to a route inside it
  useEffect(() => {
    setMenuOpen(false);
    for (const s of NAV_SECTIONS) {
      if (s.items.some(i => pathname.startsWith(i.href))) {
        setOpenSections(prev => new Set([...prev, s.key]));
      }
    }
  }, [pathname]);

  useEffect(() => { document.title = "QuieroComer.com - Panel Administración"; }, []);

  useEffect(() => {
    fetch("/api/admin/soporte?countOnly=1")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.unread) setUnreadSupport(d.unread); })
      .catch(() => {});
  }, [pathname]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const itemStyle = (href: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
    textDecoration: "none", fontFamily: F, fontSize: "0.82rem",
    color: isActive(href) ? GOLD : "#888",
    background: isActive(href) ? "rgba(244,166,35,0.08)" : "transparent",
    borderLeft: isActive(href) ? `3px solid ${GOLD}` : "3px solid transparent",
  });

  const subItemStyle = (href: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 28px",
    textDecoration: "none", fontFamily: F, fontSize: "0.79rem",
    color: isActive(href) ? GOLD : "#777",
    background: isActive(href) ? "rgba(244,166,35,0.07)" : "transparent",
    borderLeft: isActive(href) ? `3px solid ${GOLD}` : "3px solid transparent",
  });

  const NavContent = () => (
    <>
      {NAV_TOP.map(n => (
        <Link key={n.href} href={n.href} style={itemStyle(n.href)}>
          <span>{n.icon}</span>
          <span>{n.label}</span>
        </Link>
      ))}

      {NAV_SECTIONS.map(section => {
        const isOpen = openSections.has(section.key);
        const sectionActive = section.items.some(i => isActive(i.href));
        return (
          <div key={section.key} style={{ borderTop: "1px solid #2A2A2A", marginTop: 2 }}>
            <button
              onClick={() => toggleSection(section.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 14px 9px 16px", background: "none", border: "none", cursor: "pointer",
                fontFamily: F, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                color: sectionActive ? GOLD : "#666", textTransform: "uppercase",
              }}
            >
              <span>{section.label}</span>
              <span style={{ fontSize: "0.6rem", color: sectionActive ? GOLD : "#555", transition: "transform 0.15s", display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
            </button>
            <div style={{ overflow: "hidden", maxHeight: isOpen ? "300px" : "0", transition: "max-height 0.2s ease" }}>
              {section.items.map(n => (
                <Link key={n.href} href={n.href} style={subItemStyle(n.href)}>
                  <span>{n.icon}</span>
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {n.badge && unreadSupport > 0 && (
                    <span style={{ fontSize: "0.58rem", fontWeight: 800, padding: "1px 5px", borderRadius: 50, background: "#dc2626", color: "#fff" }}>{unreadSupport}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="theme-dark" style={{ display: "flex", minHeight: "100vh", background: "#111111", overflowX: "hidden" }}>
      {/* Mobile top bar */}
      <div className="adm-mobilebar">
        <Link href="/admin" style={{ fontFamily: F, fontSize: "1.1rem", color: GOLD, textDecoration: "none" }}>🧞 Admin</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unreadSupport > 0 && (
            <Link href="/admin/soporte" style={{ fontSize: "0.65rem", fontWeight: 800, padding: "3px 8px", borderRadius: 50, background: "#dc2626", color: "#fff", textDecoration: "none" }}>
              🎧 {unreadSupport}
            </Link>
          )}
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "1px solid #2A2A2A", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: "1.2rem", cursor: "pointer" }}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (<>
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998 }} />
        <div className="adm-mobilemenu">
          <NavContent />
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", width: "100%", textAlign: "left", fontFamily: F, fontSize: "1.05rem", color: "#ff8080", background: "none", border: "none", borderTop: "1px solid #2A2A2A", cursor: "pointer" }}>🚪 Cerrar sesión</button>
        </div>
      </>)}

      {/* Desktop sidebar */}
      <aside className="adm-sidebar">
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #2A2A2A", flexShrink: 0 }}>
          <Link href="/admin" style={{ fontFamily: F, fontSize: "0.9rem", color: GOLD, textDecoration: "none" }}>🧞 Admin</Link>
          <div style={{ fontSize: "0.68rem", color: "#666", fontFamily: F, marginTop: 4 }}>{name}</div>
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          <NavContent />
        </nav>
        <button onClick={logout} style={{ padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid #2A2A2A", color: "#ff6b6b", fontFamily: F, fontSize: "0.78rem", cursor: "pointer", textAlign: "left", flexShrink: 0 }}>🚪 Cerrar sesión</button>
      </aside>

      <main className="adm-main">{children}</main>

      <style>{`
        .adm-sidebar {
          width: 200px; flex-shrink: 0;
          background: #1A1A1A; border-right: 1px solid #2A2A2A;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; overflow: hidden;
        }
        .adm-sidebar a:hover { background: rgba(255,255,255,0.03); }
        .adm-main { flex: 1; margin-left: 200px; padding: 24px 32px; min-height: 100vh; }
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
            padding: 14px 18px; background: #111111; border-bottom: 1px solid #2A2A2A;
            justify-content: space-between; align-items: center;
          }
          .adm-main { margin-left: 0; padding: 80px 16px 32px; overflow-x: hidden; }
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
          .adm-main { margin-left: 0; padding: 12px 16px; }
        }
      `}</style>
    </div>
  );
}
