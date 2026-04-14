"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { label: "Concursos",   href: "/concursos"   },
  { label: "Promociones", href: "/promociones" },
  { label: "Locales",     href: "/locales"     },
];

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled,  setScrolled]  = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [localSession, setLocalSession] = useState<{ id: string; slug?: string; nombre: string; logoUrl?: string } | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notifs, setNotifs] = useState<any[]>([]);
  const { user, isAuthenticated, logout } = useAuth();
  const notifRef = useRef<HTMLDivElement>(null);
  const notifRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const ls = JSON.parse(localStorage.getItem("quierocomer_local_session") ?? "{}");
      if (ls?.id && ls?.nombre && ls?.loggedIn) {
        setLocalSession({ id: ls.id, slug: ls.slug, nombre: ls.nombre, logoUrl: ls.logoUrl });
        // Always fetch fresh data (logo may have been added after login)
        fetch(`/api/locales/${ls.id}`).then(r => r.ok ? r.json() : null).then(data => {
          if (data) {
            const logoUrl = data.logoUrl || null;
            const slug = data.slug || ls.slug;
            setLocalSession(prev => prev ? { ...prev, logoUrl, slug } : prev);
            if (logoUrl !== ls.logoUrl || slug !== ls.slug) {
              ls.logoUrl = logoUrl;
              ls.slug = slug;
              localStorage.setItem("quierocomer_local_session", JSON.stringify(ls));
            }
          }
        }).catch(() => {});
      }
    } catch {}
  }, []);

  // Scroll listener only on home for transparent→solid transition
  useEffect(() => {
    if (!isHome) { setScrolled(false); return; }
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const [reenvioVerif, setReenvioVerif] = useState<"idle" | "sending" | "sent">("idle");

  const verifNotif = { id: "verif-pendiente", tipo: "verificacion", mensaje: "⚠️ Tu cuenta no está verificada. Verifica tu email para participar en concursos y sumar puntos.", leida: false, createdAt: new Date().toISOString(), esVerificacion: true };

  const processNotifs = useCallback((notifsBD: any[], noLeidas: number) => {
    const needsVerif = user && !user.emailVerificado;
    if (needsVerif) notifsBD = [verifNotif, ...notifsBD.filter(n => n.id !== "verif-pendiente")];
    setNotifs(notifsBD);
    setNotifCount(needsVerif ? Math.max(1, noLeidas + 1) : noLeidas);
  }, [user?.emailVerificado]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/notificaciones?userId=${user.id}`)
      .then(r => r.json())
      .then(d => processNotifs(d.notificaciones ?? [], d.noLeidas ?? 0))
      .catch(() => {});
  }, [user?.id, user?.emailVerificado, processNotifs]);

  useEffect(() => {
    if (!showNotifs) return;
    const handleClick = (e: MouseEvent) => {
      const inDesktop = notifRef.current?.contains(e.target as Node);
      const inMobile = notifRef2.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setShowNotifs(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifs]);

  const [needsComidas, setNeedsComidas] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      const s = JSON.parse(localStorage.getItem("quierocomer_session") ?? "{}");
      if (s.comidasFavoritas && s.comidasFavoritas.length > 0) { setNeedsComidas(false); return; }
      // Check DB
      fetch(`/api/usuarios/${s.id || user.id}/perfil`).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.comidasFavoritas?.length > 0) {
          s.comidasFavoritas = d.comidasFavoritas;
          localStorage.setItem("quierocomer_session", JSON.stringify(s));
          setNeedsComidas(false);
        } else {
          setNeedsComidas(true);
        }
      }).catch(() => {});
    } catch {}
  }, [isAuthenticated, user]);

  const initials = user?.nombre
    ? user.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const displayName = user?.nombre?.split(" ")[0] ?? "";
  const isLocalLoggedIn = !!localSession;
  const localInitials = localSession?.nombre?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "L";
  const localName = localSession?.nombre?.split(" ")[0] ?? "";
  const handleLocalLogout = () => { localStorage.removeItem("quierocomer_local_session"); sessionStorage.removeItem("quierocomer_local_session"); localStorage.removeItem("quierocomer_session"); localStorage.removeItem("quierocomer_user_birthday"); setLocalSession(null); setMenuOpen(false); window.location.href = "/"; };

  return (
    <>
      {/* Spacer to push content below fixed navbar (not on home) */}
      {!isHome && <div className="dc-nav-spacer" />}

      {/* Banner completar perfil */}
      {needsComidas && !isHome && pathname !== "/perfil" && (
        <div style={{ background: "linear-gradient(135deg, rgba(232,168,76,0.12), rgba(232,168,76,0.06))", borderBottom: "1px solid rgba(232,168,76,0.2)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>🍽️</span>
          <span style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.7)" }}>Completa tu perfil para recomendarte mejor</span>
          <a href="/perfil?completar=comidas" style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.7rem", color: "#e8a84c", textDecoration: "none", border: "1px solid rgba(232,168,76,0.3)", borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap" }}>Completar →</a>
        </div>
      )}
      <nav className={`dc-nav${isHome ? (scrolled ? " dc-nav--solid" : " dc-nav--transparent") : ""}`}>
        <a href="/" className="dc-nav-logo">🏮 QuieroComer</a>

        {/* Desktop links */}
        <div className="dc-nav-links">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return <Link key={label} href={href} className={`dc-nav-link${isActive ? " dc-nav-link--active" : ""}`}>{label}</Link>;
          })}

          {/* Auth */}
          {mounted && (
            isLocalLoggedIn ? (
              <div className="dc-nav-user">
                <Link href={`/locales/${localSession?.slug || localSession?.id}`} style={{ width: "32px", height: "32px", borderRadius: "50%", background: localSession?.logoUrl ? "transparent" : "linear-gradient(135deg, #2a7a6f, #3db89e)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-cinzel)", fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0, textDecoration: "none", overflow: "hidden" }}>{localSession?.logoUrl ? <img src={localSession.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : localInitials}</Link>
                <Link href={`/locales/${localSession?.slug || localSession?.id}`} className="dc-nav-username" style={{ textDecoration: "none" }}>{localName}</Link>
                <Link href="/panel" style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#3db89e", textDecoration: "none", padding: "6px 14px", borderRadius: "20px", border: "1px solid rgba(61,184,158,0.4)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px" }}>🏪 Mi Panel</Link>
                <button onClick={handleLocalLogout} className="dc-nav-logout">Salir</button>
              </div>
            ) : isAuthenticated && user ? (
              <div className="dc-nav-user">
                <div ref={notifRef} style={{ position: "relative" }}>
                  <button onClick={() => { if (showNotifs) { setShowNotifs(false); } else { setShowNotifs(true); if (user?.id) { fetch(`/api/notificaciones?userId=${user.id}`).then(r => r.json()).then(d => { const nots = d.notificaciones ?? []; processNotifs(nots, 0); if ((d.noLeidas ?? 0) > 0) { fetch("/api/notificaciones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marcarTodas: true, userId: user?.id }) }).catch(() => {}); } }).catch(() => {}); } } }} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: "4px" }}>
                    <span style={{ fontSize: "1.1rem" }}>🔔</span>
                    {notifCount > 0 && (
                      <span style={{ position: "absolute", top: -2, right: -2, background: "#ff6b6b", color: "#fff", fontSize: "0.6rem", fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount > 9 ? "9+" : notifCount}</span>
                    )}
                  </button>
                  {showNotifs && (
                    <div style={{ position: "absolute", top: "100%", right: 0, width: "min(300px, 85vw)", maxHeight: 320, overflowY: "auto", background: "rgba(10,8,18,0.98)", border: "1px solid rgba(232,168,76,0.25)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 1000 }}>
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(232,168,76,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notificaciones</span>
                        {notifCount > 0 && <button onClick={async () => { await fetch("/api/notificaciones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marcarTodas: true, userId: user?.id }) }); setNotifCount(0); setNotifs(n => n.map(x => ({ ...x, leida: true }))); }} style={{ background: "none", border: "none", fontFamily: "var(--font-lato)", fontSize: "0.72rem", color: "rgba(240,234,214,0.3)", cursor: "pointer" }}>Marcar todas</button>}
                      </div>
                      {notifs.length === 0 ? (
                        <p style={{ padding: 20, textAlign: "center", fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.3)" }}>Sin notificaciones</p>
                      ) : notifs.slice(0, 8).map(n => (
                        n.esVerificacion ? (
                          <div key={n.id} style={{ padding: "12px 14px", borderBottom: "1px solid rgba(224,85,85,0.15)", background: "rgba(224,85,85,0.06)" }}>
                            <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "#e05555", lineHeight: 1.4, margin: 0 }}>{n.mensaje}</p>
                            <button onClick={async (e) => { e.stopPropagation(); if (reenvioVerif !== "idle") return; setReenvioVerif("sending"); try { await fetch("/api/emails/verificacion-reenvio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user?.email }) }); setReenvioVerif("sent"); setTimeout(() => setReenvioVerif("idle"), 5000); } catch { setReenvioVerif("idle"); } }} style={{ marginTop: 8, background: reenvioVerif === "sent" ? "transparent" : "#e05555", color: reenvioVerif === "sent" ? "#3db89e" : "#fff", fontFamily: "var(--font-cinzel)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", borderRadius: 16, padding: "5px 12px", cursor: reenvioVerif === "idle" ? "pointer" : "default" }}>{reenvioVerif === "sending" ? "Enviando..." : reenvioVerif === "sent" ? "✓ Enviado" : "Reenviar verificación →"}</button>
                          </div>
                        ) : (
                          <div key={n.id} onClick={() => { const d = (n as any).datos; const href = d?.link || (d?.concursoSlug ? `/concursos/${d.concursoSlug}${d?.abrirVerificarTel ? "?verificar=tel" : ""}` : null); if (href) window.location.href = href; setShowNotifs(false); }} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(232,168,76,0.06)", cursor: "pointer", background: n.leida ? "transparent" : "rgba(232,168,76,0.04)" }}>
                            <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.7)", lineHeight: 1.4, margin: 0 }}>{n.mensaje}</p>
                            <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.68rem", color: "rgba(240,234,214,0.2)", marginTop: 4 }}>{new Date(n.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
                <Link href="/perfil" className="dc-nav-avatar" title={user.nombre} style={{ textDecoration: "none" }}>{initials}</Link>
                <Link href="/perfil" className="dc-nav-username" style={{ textDecoration: "none" }}>{displayName}</Link>
                <button onClick={logout} className="dc-nav-logout">Salir</button>
              </div>
            ) : (
              <Link href="/login" className="dc-nav-cta">Entrar</Link>
            )
          )}
        </div>

        {/* Mobile: avatar/logo + bell + hamburger grouped together */}
        <div className="dc-nav-mobile-right">
          {mounted && isLocalLoggedIn && (
            <Link href="/panel" style={{ textDecoration: "none", width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(61,184,158,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, background: localSession?.logoUrl ? "transparent" : "linear-gradient(135deg, #2a7a6f, #3db89e)" }}>
              {localSession?.logoUrl ? (
                <img src={localSession.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : (
                <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.6rem", fontWeight: 700, color: "#fff" }}>{localInitials}</span>
              )}
            </Link>
          )}
          {!isLocalLoggedIn && isAuthenticated && user && (
            <Link href="/perfil" className="dc-nav-avatar dc-nav-avatar--mobile" style={{ textDecoration: "none", width: 30, height: 30, fontSize: "0.65rem" }}>{user.nombre?.charAt(0).toUpperCase() ?? "U"}</Link>
          )}
          {isAuthenticated && user && (
            <div ref={notifRef2} style={{ position: "relative" }}>
              <button onClick={() => { if (showNotifs) { setShowNotifs(false); } else { setShowNotifs(true); if (user?.id) { fetch(`/api/notificaciones?userId=${user.id}`).then(r => r.json()).then(d => { const nots = d.notificaciones ?? []; processNotifs(nots, 0); if ((d.noLeidas ?? 0) > 0) { fetch("/api/notificaciones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marcarTodas: true, userId: user?.id }) }).catch(() => {}); } }).catch(() => {}); } } }} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: "4px", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" as any }}>
                <span style={{ fontSize: "1.1rem" }}>🔔</span>
                {notifCount > 0 && (
                  <span style={{ position: "absolute", top: -2, right: -2, background: "#ff6b6b", color: "#fff", fontSize: "0.6rem", fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount > 9 ? "9+" : notifCount}</span>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: "absolute", top: "100%", right: 0, width: "min(300px, 85vw)", maxHeight: 320, overflowY: "auto", background: "rgba(10,8,18,0.98)", border: "1px solid rgba(232,168,76,0.25)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 1000 }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(232,168,76,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notificaciones</span>
                    {notifCount > 0 && <button onClick={async () => { await fetch("/api/notificaciones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marcarTodas: true, userId: user?.id }) }); setNotifCount(0); setNotifs(n => n.map(x => ({ ...x, leida: true }))); }} style={{ background: "none", border: "none", fontFamily: "var(--font-lato)", fontSize: "0.72rem", color: "rgba(240,234,214,0.3)", cursor: "pointer" }}>Marcar todas</button>}
                  </div>
                  {notifs.length === 0 ? (
                    <p style={{ padding: 20, textAlign: "center", fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.3)" }}>Sin notificaciones</p>
                  ) : notifs.slice(0, 8).map(n => (
                    n.esVerificacion ? (
                      <div key={n.id} style={{ padding: "12px 14px", borderBottom: "1px solid rgba(224,85,85,0.15)", background: "rgba(224,85,85,0.06)" }}>
                        <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "#e05555", lineHeight: 1.4, margin: 0 }}>{n.mensaje}</p>
                        <button onClick={async (e) => { e.stopPropagation(); if (reenvioVerif !== "idle") return; setReenvioVerif("sending"); try { await fetch("/api/emails/verificacion-reenvio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user?.email }) }); setReenvioVerif("sent"); setTimeout(() => setReenvioVerif("idle"), 5000); } catch { setReenvioVerif("idle"); } }} style={{ marginTop: 8, background: reenvioVerif === "sent" ? "transparent" : "#e05555", color: reenvioVerif === "sent" ? "#3db89e" : "#fff", fontFamily: "var(--font-cinzel)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", borderRadius: 16, padding: "5px 12px", cursor: reenvioVerif === "idle" ? "pointer" : "default" }}>{reenvioVerif === "sending" ? "Enviando..." : reenvioVerif === "sent" ? "✓ Enviado" : "Reenviar verificación →"}</button>
                      </div>
                    ) : (
                      <div key={n.id} onClick={async () => { if (!n.leida) { await fetch("/api/notificaciones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificacionId: n.id }) }); setNotifCount(c => Math.max(0, c - 1)); setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x)); } }} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(232,168,76,0.06)", cursor: "pointer", background: n.leida ? "transparent" : "rgba(232,168,76,0.04)" }}>
                        <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.7)", lineHeight: 1.4, margin: 0 }}>{n.mensaje}</p>
                        <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.68rem", color: "rgba(240,234,214,0.2)", marginTop: 4 }}>{new Date(n.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className="dc-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            onTouchEnd={(e) => { e.preventDefault(); setMenuOpen(o => !o); }}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(320px, 80vw)", background: "rgba(13,7,3,0.98)", borderLeft: "1px solid rgba(232,168,76,0.15)", zIndex: 1001, display: "flex", flexDirection: "column", animation: "dc-drawer-in 0.25s ease both", overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(232,168,76,0.08)" }}>
              <Link href="/" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--font-cinzel-decorative)", fontSize: "1rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>🏮 QuieroComer</Link>
              <button onClick={() => setMenuOpen(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "1rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* Nav links */}
            <nav style={{ padding: "8px 0" }}>
              {[
                { href: "/concursos", label: "Concursos", icon: "🏆" },
                { href: "/promociones", label: "Promociones", icon: "⚡" },
                { href: "/locales", label: "Locales", icon: "🍽️" },
              ].map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 24px", fontFamily: "var(--font-cinzel)", fontSize: "1rem", letterSpacing: "0.1em", color: active ? "var(--accent)" : "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid rgba(232,168,76,0.06)", background: active ? "rgba(232,168,76,0.06)" : "transparent", fontWeight: active ? 700 : 500 }}>
                    <span style={{ fontSize: "1.1rem", width: "24px" }}>{item.icon}</span>{item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Separator + User section — right after nav links */}
            <div style={{ height: 1, background: "rgba(232,168,76,0.12)", margin: "4px 24px" }} />
            <div style={{ padding: "16px 24px" }}>
              {mounted && isLocalLoggedIn ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: localSession?.logoUrl ? "transparent" : "linear-gradient(135deg, #2a7a6f, #3db89e)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-cinzel)", fontSize: "0.9rem", fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" }}>{localSession?.logoUrl ? <img src={localSession.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : localInitials}</div>
                    <div><p style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.85rem", color: "#3db89e", margin: 0 }}>{localName}</p><p style={{ fontFamily: "var(--font-lato)", fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>Local asociado</p></div>
                  </div>
                  {[
                    { href: "/panel", label: "Mi Panel", color: "#3db89e" },
                    { href: `/locales/${localSession?.slug || localSession?.id}`, label: "Ver mi local público", color: "var(--text-primary)" },
                    { href: "/panel/concursos", label: "Mis concursos", color: "var(--text-primary)" },
                    { href: "/panel/promociones", label: "Mis promociones", color: "var(--text-primary)" },
                  ].map(item => (
                    <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", fontFamily: "var(--font-lato)", fontSize: "0.9rem", color: item.color, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{item.label}</Link>
                  ))}
                  <button onClick={handleLocalLogout} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", background: "none", border: "none", fontFamily: "var(--font-lato)", fontSize: "0.9rem", color: "#ff6b6b", cursor: "pointer", width: "100%", textAlign: "left", marginTop: "4px" }}>Cerrar sesión</button>
                </div>
              ) : mounted && isAuthenticated && user ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #c4853a, #e8a84c)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-cinzel)", fontSize: "0.9rem", fontWeight: 700, color: "#1a0e05", flexShrink: 0 }}>
                      {user.nombre?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <p style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.85rem", color: "var(--accent)", margin: 0 }}>{displayName}</p>
                      <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>Miembro de QuieroComer</p>
                    </div>
                  </div>
                  {[
                    { href: "/perfil", label: "Mi perfil", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,214,0.5)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
                    { href: "/perfil?tab=favoritos", label: "Mis favoritos", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,214,0.5)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 21C12 21 3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 13-9 13z"/></svg> },
                    { href: "/perfil?tab=concursos", label: "Mis concursos", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,214,0.5)" strokeWidth="1.5" strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4H4v4c0 2.2 1.8 4 4 4h8c2.2 0 4-1.8 4-4V4h-3"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/></svg> },
                  ].map(item => (
                    <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", fontFamily: "var(--font-lato)", fontSize: "0.9rem", color: "var(--text-primary)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ width: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>{item.svg}</span>{item.label}
                    </Link>
                  ))}
                  <button onClick={() => { logout(); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", background: "none", border: "none", fontFamily: "var(--font-lato)", fontSize: "0.9rem", color: "#ff6b6b", cursor: "pointer", width: "100%", textAlign: "left", marginTop: "4px" }}>
                    <span style={{ width: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,107,0.7)" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>Cerrar sesión
                  </button>
                </div>
              ) : mounted ? (
                <div>
                  <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "12px", textAlign: "center" }}>Únete gratis o inicia sesión</p>
                  <Link href="/login" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "14px 20px", background: "var(--accent)", borderRadius: "12px", fontFamily: "var(--font-cinzel)", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bg-primary)", textDecoration: "none", textAlign: "center", fontWeight: 700 }}>Entrar</Link>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      <style>{`
        .dc-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 20px 60px;
          display: flex; justify-content: space-between; align-items: center;
          background: rgba(10,8,18,0.97);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border-color);
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .dc-nav--transparent {
          background: transparent !important;
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
        }
        .dc-nav--solid {
          background: rgba(10,8,18,0.97);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border-color);
        }
        .dc-nav-logo {
          font-family: var(--font-cinzel-decorative); font-size: 1.1rem;
          color: #e8a84c; text-decoration: none;
          letter-spacing: 0.08em;
          flex-shrink: 0;
          cursor: pointer;
          position: relative;
          z-index: 10;
          pointer-events: auto;
        }
        .dc-nav-links {
          display: flex; gap: 32px; align-items: center;
          position: relative;
          z-index: 1;
        }
        .dc-nav-link {
          font-family: var(--font-cinzel); font-size: 0.82rem;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--text-muted); text-decoration: none; white-space: nowrap;
          font-weight: 500; transition: color 0.2s;
          padding-bottom: 2px; border-bottom: 2px solid transparent;
        }
        .dc-nav-link:hover { color: var(--text-primary); }
        .dc-nav-link--active {
          color: var(--accent); font-weight: 700;
          border-bottom: 2px solid var(--accent);
        }
        .dc-nav-cta {
          font-family: var(--font-cinzel); font-size: 0.82rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: linear-gradient(135deg, var(--oasis-teal), var(--oasis-bright));
          color: var(--bg-primary); padding: 10px 24px; border-radius: 30px;
          text-decoration: none; font-weight: 700; white-space: nowrap;
          min-height: 40px; display: inline-flex; align-items: center;
        }

        /* Auth user area */
        .dc-nav-user {
          display: flex; align-items: center; gap: 10px;
        }
        .dc-nav-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: color-mix(in srgb, var(--accent) 25%, var(--bg-secondary));
          border: 1px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-cinzel); font-size: 0.7rem;
          font-weight: 700; color: var(--accent);
          flex-shrink: 0;
        }
        .dc-nav-avatar--lg { width: 40px; height: 40px; font-size: 0.75rem; }
        .dc-nav-username {
          font-family: var(--font-cinzel); font-size: 0.78rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-primary); white-space: nowrap;
        }
        .dc-nav-panel {
          font-family: var(--font-cinzel); font-size: 0.75rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--oasis-bright); text-decoration: none;
          padding: 6px 12px; border-radius: 20px;
          border: 1px solid rgba(61,184,158,0.35);
          white-space: nowrap;
        }
        .dc-nav-logout {
          font-family: var(--font-cinzel); font-size: 0.75rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: none; border: 1px solid var(--border-color);
          color: var(--text-muted); padding: 6px 14px;
          border-radius: 20px; cursor: pointer; white-space: nowrap;
          transition: border-color 0.2s, color 0.2s;
        }
        .dc-nav-logout:hover { border-color: #ff6b6b; color: #ff6b6b; }
        /* Hamburger button */
        .dc-hamburger {
          display: none;
          width: 44px; height: 44px;
          background: none; border: 1px solid var(--border-color);
          border-radius: 10px; cursor: pointer; padding: 0;
          align-items: center; justify-content: center;
          color: var(--accent); font-size: 1.25rem; line-height: 1;
          flex-shrink: 0;
          position: relative; z-index: 10;
          -webkit-tap-highlight-color: rgba(232,168,76,0.15);
          touch-action: manipulation;
        }

        @keyframes dc-drawer-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        .dc-nav-spacer { height: 68px; }
        .dc-nav-mobile-right { display: none; }
        @media (max-width: 767px) {
          .dc-nav { padding: 14px 16px; }
          .dc-nav-links { display: none !important; visibility: hidden; pointer-events: none; position: absolute; }
          .dc-nav-mobile-right { display: flex; align-items: center; gap: 6px; }
          .dc-hamburger { display: flex; }
          .dc-nav-spacer { height: 56px; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .dc-nav { padding: 18px 32px; }
          .dc-nav-links { gap: 16px; }
          .dc-nav-link { font-size: 0.7rem; }
          .dc-nav-username { display: none; }
        }
      `}</style>
    </>
  );
}
