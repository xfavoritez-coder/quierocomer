"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const F = "var(--font-display)";

const TABS = [
  { href: "/panel/loyalty", label: "Configuración" },
  { href: "/panel/loyalty/miembros", label: "Miembros" },
  { href: "/panel/loyalty/escanear", label: "Escanear" },
  { href: "/panel/loyalty/cercania", label: "Cercanía" },
  { href: "/panel/loyalty/notificaciones", label: "Notificaciones" },
];

export default function LoyaltyNav() {
  const pathname = usePathname();

  return (
    <nav
      className="loyalty-nav"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--adm-card-border)",
        marginBottom: 24,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "8px 14px",
              marginBottom: -1,
              flexShrink: 0,
              whiteSpace: "nowrap",
              borderBottom: `2px solid ${active ? "#F4A623" : "transparent"}`,
              fontFamily: F,
              fontSize: "0.85rem",
              fontWeight: 600,
              color: active ? "var(--adm-text)" : "var(--adm-text3)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
      <style>{`.loyalty-nav::-webkit-scrollbar{display:none}`}</style>
    </nav>
  );
}
