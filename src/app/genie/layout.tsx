"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("genie_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("genie_session_id", sid);
  }
  return sid;
}

const NAV = [
  { icon: "🧞", label: "Descubrir", href: "/genie" },
  { icon: "👥", label: "Grupo", href: "/genie/grupo" },
  { icon: "👤", label: "Mi perfil", href: "/genie/perfil" },
];

export default function GenieLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    getSessionId();
    // Generate a new visitId each time the genie is opened
    if (!sessionStorage.getItem("genieVisitId")) {
      sessionStorage.setItem("genieVisitId", crypto.randomUUID());
    }
    setReady(true);
  }, []);

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#0a0812", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily: "var(--font-cinzel)", fontSize: "1.2rem", color: "#e8a84c" }}>🧞</p>
    </div>
  );

  // Hide nav on onboarding, context steps, and group room
  const hideNav = pathname.includes("/context") || pathname.includes("/result") || pathname.includes("/feedback") || (pathname.includes("/grupo/") && pathname.split("/").length > 3);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", paddingBottom: hideNav ? 0 : 72 }}>
      {children}

      {/* Bottom nav bar */}
      {!hideNav && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,8,18,0.95)", borderTop: "1px solid rgba(232,168,76,0.1)", display: "flex", justifyContent: "center", gap: 0, zIndex: 50, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
          {NAV.map(n => {
            const active = n.href === "/genie" ? pathname === "/genie" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 0 8px", textDecoration: "none", color: active ? "#e8a84c" : "rgba(240,234,214,0.3)" }}>
                <span style={{ fontSize: 20 }}>{n.icon}</span>
                <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.6rem", letterSpacing: "0.06em" }}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
