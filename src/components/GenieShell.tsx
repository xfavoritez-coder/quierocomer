"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { icon: "🔍", label: "Descubrir", href: "/" },
  { icon: "🍽", label: "Explorar", href: "/explorar" },
  { icon: "👥", label: "Grupo", href: "/grupo" },
  { icon: "👤", label: "Perfil", href: "/perfil" },
];

export default function GenieShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  // Don't render shell for admin or auth pages
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/registro");

  useEffect(() => {
    if (isAdmin || isAuth) { setReady(true); return; }

    // Init session
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("genie_session_id")) {
        localStorage.setItem("genie_session_id", crypto.randomUUID());
      }
      if (!sessionStorage.getItem("genieVisitId")) {
        sessionStorage.setItem("genieVisitId", crypto.randomUUID());
      }
    }
    setReady(true);
  }, [isAdmin, isAuth]);

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D" }}>🧞</p>
    </div>
  );

  // Admin and auth pages render without shell
  if (isAdmin || isAuth) return <>{children}</>;

  const hideNav = false; // Nav always visible

  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF", paddingBottom: hideNav ? 0 : 72, position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>

      {!hideNav && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #EEEEEE", display: "flex", justifyContent: "center", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {NAV.map(n => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 6px", textDecoration: "none" }}>
                <div style={{ width: 20, height: 3, borderRadius: 99, background: active ? "#FFD600" : "transparent", marginBottom: 2 }} />
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span className="font-display" style={{ fontSize: "0.58rem", letterSpacing: "0.06em", fontWeight: active ? 700 : 400, color: active ? "#0D0D0D" : "#888888" }}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
