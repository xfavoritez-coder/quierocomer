"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, UtensilsCrossed, Tag, Grid3X3, ChevronRight, X, LogOut, Lock, Mail, BarChart3, Bell, Users, Zap, Store, UserCog, Megaphone } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Restaurant { id: string; name: string; slug: string; logoUrl?: string | null; plan?: string; }

interface Props {
  name: string;
  restaurants: Restaurant[];
  selectedRestaurantId: string | null;
  setSelectedRestaurant: (id: string) => void;
  logout: () => void;
  basePath?: string; // "/admin" or "/panel"
  activePlan?: string;
  children: React.ReactNode;
}

function buildNav(base: string) {
  const SIDEBAR_NAV = [
    { icon: Home, label: "Inicio", href: base },
    { icon: UtensilsCrossed, label: "Mi Carta", href: `${base}/menus` },
    { icon: BarChart3, label: "Analytics", href: `${base}/analytics` },
    { icon: Users, label: "Clientes", href: `${base}/clientes` },
    { icon: Tag, label: "Ofertas", href: `${base}/promociones` },
    { icon: Megaphone, label: "Anuncios", href: `${base}/anuncios` },
    { icon: Bell, label: "Garzón", href: `${base}/garzon` },
    { icon: Zap, label: "Automatizaciones", href: `${base}/automatizaciones` },
    { icon: Mail, label: "Campañas", href: `${base}/campanias` },
    { icon: Store, label: "Mi Restaurante", href: `${base}/mi-restaurante` },
  ];
  const BOTTOM_TABS = [
    { icon: Home, label: "Inicio", href: base },
    { icon: UtensilsCrossed, label: "Mi Carta", href: `${base}/menus` },
    { icon: BarChart3, label: "Analytics", href: `${base}/analytics` },
    { icon: Grid3X3, label: "Más", href: "__more__" },
  ] as const;
  const MORE_ITEMS = SIDEBAR_NAV.filter(n => !BOTTOM_TABS.some(t => t.href === n.href));
  return { SIDEBAR_NAV, BOTTOM_TABS, MORE_ITEMS };
}

export default function AdminLayoutOwner({ name, restaurants, selectedRestaurantId, setSelectedRestaurant, logout, basePath = "/admin", activePlan, children }: Props) {
  const pathname = usePathname();
  const { SIDEBAR_NAV, BOTTOM_TABS, MORE_ITEMS } = buildNav(basePath);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const isActive = (href: string) => href === basePath ? pathname === basePath : pathname.startsWith(href);
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const activeRest = restaurants.find(r => r.id === selectedRestaurantId) || restaurants[0];
  const restInitials = activeRest?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const RestLogo = ({ size = 36 }: { size?: number }) => (
    activeRest?.logoUrl
      ? <img src={activeRest.logoUrl} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      : <div style={{ width: size, height: size, borderRadius: 8, background: "#1a5f3f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.39, fontWeight: 700, fontFamily: F, flexShrink: 0 }}>{restInitials}</div>
  );

  // Drawer helpers
  const openMore = () => { setMoreOpen(true); requestAnimationFrame(() => setMoreVisible(true)); };
  const closeMore = () => { setMoreVisible(false); setTimeout(() => setMoreOpen(false), 250); };
  const openAccount = () => { setAccountOpen(true); requestAnimationFrame(() => setAccountVisible(true)); };
  const closeAccount = () => { setAccountVisible(false); setTimeout(() => setAccountOpen(false), 250); };

  // Auto-close drawers on viewport change
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { setMoreOpen(false); setMoreVisible(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleChangePassword = async () => {
    setPwError("");
    if (pwNew.length < 8) { setPwError("Mínimo 8 caracteres"); return; }
    if (!/\d/.test(pwNew)) { setPwError("Debe contener al menos 1 número"); return; }
    if (pwNew !== pwConfirm) { setPwError("Las contraseñas no coinciden"); return; }
    setPwLoading(true);
    try {
      const pwEndpoint = basePath === "/panel" ? "/api/panel/change-password" : "/api/admin/me/change-password";
      const res = await fetch(pwEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); setPwLoading(false); return; }
      setPwSuccess(true);
      setTimeout(() => { setPwOpen(false); setPwSuccess(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }, 2000);
    } catch { setPwError("Error de conexión"); }
    setPwLoading(false);
  };

  return (
    <div className="theme-light" style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      {/* ── Desktop Sidebar (≥768px) ── */}
      <aside className="owl-sidebar">
        {/* Header */}
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #E8D0A0" }}>
          <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <RestLogo size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: "16px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                <p style={{ fontFamily: F, fontSize: "11.5px", color: "#888", fontWeight: 500, margin: 0 }}>QuieroComer</p>
                {activePlan && basePath === "/panel" && (
                  <span style={{ fontFamily: F, fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.3px",
                    background: activePlan === "PREMIUM" ? "#F3E8FF" : activePlan === "GOLD" ? "#FFF8E7" : "#f5f5f5",
                    color: activePlan === "PREMIUM" ? "#7c3aed" : activePlan === "GOLD" ? "#92400e" : "#888",
                  }}>
                    {activePlan === "PREMIUM" ? "Premium" : activePlan === "GOLD" ? "Gold" : "Free"}
                  </span>
                )}
              </div>
            </div>
          </Link>
          {restaurants.length > 1 && (
            <select value={selectedRestaurantId || ""} onChange={(e) => setSelectedRestaurant(e.target.value)}
              style={{ marginTop: 10, width: "100%", padding: "5px 8px", background: "white", border: "1px solid #E8D0A0", borderRadius: 6, fontFamily: FB, fontSize: "0.72rem", color: "#1a1a1a", outline: "none", cursor: "pointer" }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {SIDEBAR_NAV.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => { if (active) window.dispatchEvent(new CustomEvent("nav-same-page")); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 44, textDecoration: "none",
                background: active ? "#FDEFC7" : "transparent", color: active ? GOLD : "#8a7550",
                fontFamily: FB, fontSize: "0.84rem", fontWeight: 500, borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
              }}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {/* Account */}
        <button onClick={openAccount} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", width: "100%",
          background: "none", border: "none", borderTop: "1px solid #E8D0A0", cursor: "pointer", textAlign: "left",
        }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: F, fontSize: "0.75rem", fontWeight: 700 }}>{initial}</div>
          <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "#1a1a1a", flex: 1 }}>{name}</span>
        </button>
      </aside>

      {/* ── Mobile Header (<768px) ── */}
      <header className="owl-mobile-header">
        <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <RestLogo size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
              {activePlan && basePath === "/panel" && (
                <span style={{ fontFamily: F, fontSize: "8px", fontWeight: 700, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.3px",
                  background: activePlan === "PREMIUM" ? "#F3E8FF" : activePlan === "GOLD" ? "#FFF8E7" : "#f5f5f5",
                  color: activePlan === "PREMIUM" ? "#7c3aed" : activePlan === "GOLD" ? "#92400e" : "#888",
                  flexShrink: 0,
                }}>
                  {activePlan === "PREMIUM" ? "PRO" : activePlan === "GOLD" ? "GOLD" : "FREE"}
                </span>
              )}
            </div>
            <p style={{ fontFamily: F, fontSize: "10.5px", color: "#888", fontWeight: 500, margin: "1px 0 0" }}>QuieroComer</p>
          </div>
        </Link>
        {restaurants.length > 1 && (
          <select value={selectedRestaurantId || ""} onChange={(e) => setSelectedRestaurant(e.target.value)}
            style={{ padding: "6px 10px", background: "white", border: "1px solid #E8D0A0", borderRadius: 8, fontFamily: FB, fontSize: "0.78rem", color: "#1a1a1a", outline: "none", maxWidth: 140, cursor: "pointer", flexShrink: 0 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <button onClick={openAccount} style={{ width: 34, height: 34, borderRadius: "50%", background: GOLD, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, flexShrink: 0 }}>
          {initial}
        </button>
      </header>

      {/* ── Content ── */}
      <main className="owl-main">
        {children}
      </main>

      {/* ── Mobile Bottom Nav (<768px) ── */}
      <nav className="owl-bottom-nav">
        {BOTTOM_TABS.map((tab) => {
          const active = tab.href === "__more__" ? moreOpen : isActive(tab.href);
          const Icon = tab.icon;
          if (tab.href === "__more__") {
            return (
              <button key="more" onClick={() => moreOpen ? closeMore() : openMore()} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                background: "none", border: "none", cursor: "pointer", padding: "8px 12px", minWidth: 64, minHeight: 44,
              }}>
                <Icon size={22} color={active ? GOLD : "#8a7550"} strokeWidth={active ? 2.5 : 1.8} />
                <span style={{ fontFamily: FB, fontSize: "0.65rem", fontWeight: 500, color: active ? GOLD : "#8a7550" }}>{tab.label}</span>
              </button>
            );
          }
          return (
            <Link key={tab.href} href={tab.href} onClick={() => { if (isActive(tab.href)) window.dispatchEvent(new CustomEvent("nav-same-page")); }} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              textDecoration: "none", padding: "8px 12px", minWidth: 64, minHeight: 44,
            }}>
              <Icon size={22} color={active ? GOLD : "#8a7550"} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontFamily: FB, fontSize: "0.65rem", fontWeight: 500, color: active ? GOLD : "#8a7550" }}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Drawer "Más" (bottom sheet, mobile only) ── */}
      {moreOpen && (<>
        <div onClick={closeMore} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, opacity: moreVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201, background: "white", borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 16px)", transform: moreVisible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.25s ease-out", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd" }} />
          </div>
          <div style={{ padding: "8px 16px 16px" }}>
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={closeMore} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFF4E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={GOLD} />
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.88rem", color: "#1a1a1a", flex: 1 }}>{item.label}</span>
                  <ChevronRight size={16} color="#ccc" />
                </Link>
              );
            })}
          </div>
        </div>
      </>)}

      {/* ── Account Drawer (right slide, both mobile and desktop) ── */}
      {accountOpen && (<>
        <div onClick={closeAccount} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, opacity: accountVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(320px, 85vw)", zIndex: 301, background: "white", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", transform: accountVisible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease-out", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0" }}>
            <button onClick={closeAccount} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}><X size={20} color="#999" /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: F, fontSize: "1.1rem", fontWeight: 700 }}>{initial}</div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{name}</p>
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "#999", margin: "2px 0 0" }}>Owner</p>
              </div>
            </div>
          </div>
          {restaurants.length > 1 && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0" }}>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Mis locales</p>
              {restaurants.map(r => (
                <button key={r.id} onClick={() => { setSelectedRestaurant(r.id); closeAccount(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.id === selectedRestaurantId ? GOLD : "#ddd" }} />
                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: r.id === selectedRestaurantId ? "#1a1a1a" : "#888" }}>{r.name}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: "8px 20px", flex: 1 }}>
            <a href="/panel/perfil" onClick={closeAccount} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", background: "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left", textDecoration: "none" }}>
              <UserCog size={18} color="#8a7550" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a" }}>Mi perfil</span>
            </a>
            {basePath === "/panel" && (
              <button onClick={() => { closeAccount(); window.dispatchEvent(new CustomEvent("show-plan-modal")); }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", background: "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left" }}>
                <Zap size={18} color={activePlan === "PREMIUM" ? "#7c3aed" : activePlan === "GOLD" ? "#92400e" : "#888"} />
                <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a" }}>Mi plan</span>
                <span style={{ marginLeft: "auto", fontFamily: F, fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: activePlan === "PREMIUM" ? "#F3E8FF" : activePlan === "GOLD" ? "#FFF8E7" : "#f5f5f5",
                  color: activePlan === "PREMIUM" ? "#7c3aed" : activePlan === "GOLD" ? "#92400e" : "#888",
                }}>
                  {activePlan === "PREMIUM" ? "Premium" : activePlan === "GOLD" ? "Gold" : "Free"}
                </span>
              </button>
            )}
            <button onClick={() => setPwOpen(true)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", background: "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left" }}>
              <Lock size={18} color="#8a7550" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a" }}>Cambiar contraseña</span>
            </button>
            <a href="mailto:soporte@quierocomer.cl?subject=Ayuda%20con%20mi%20panel%20QuieroComer" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
              <Mail size={18} color="#8a7550" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a" }}>Ayuda / Soporte</span>
            </a>
          </div>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "none", border: "none", borderTop: "1px solid #f0f0f0", cursor: "pointer", width: "100%" }}>
            <LogOut size={18} color="#ef4444" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#ef4444" }}>Cerrar sesión</span>
          </button>
        </div>
      </>)}

      {/* ── Change Password Modal ── */}
      {pwOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, position: "relative" }}>
            <button onClick={() => { setPwOpen(false); setPwError(""); setPwSuccess(false); }} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#999" /></button>
            <h3 style={{ fontFamily: F, fontSize: "1rem", color: "#1a1a1a", margin: "0 0 16px" }}>Cambiar contraseña</h3>
            {pwSuccess ? (
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#16a34a", textAlign: "center", padding: "20px 0" }}>¡Contraseña actualizada!</p>
            ) : (<>
              {pwError && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#ef4444", margin: "0 0 12px", background: "#FEF2F2", padding: "8px 12px", borderRadius: 6 }}>{pwError}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="password" placeholder="Contraseña actual" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E0E0E0", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }} />
                <input type="password" placeholder="Nueva contraseña (mín. 8 chars, 1 número)" value={pwNew} onChange={e => setPwNew(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E0E0E0", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }} />
                <input type="password" placeholder="Confirmar nueva contraseña" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E0E0E0", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }} />
                <button onClick={handleChangePassword} disabled={pwLoading} style={{ width: "100%", padding: 12, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>
                  {pwLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ── Responsive CSS ── */}
      <style>{`
        /* Desktop ≥768px */
        .owl-sidebar {
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; width: 220px; z-index: 50;
          background: #FFF9ED; border-right: 1px solid #E8D0A0;
        }
        .owl-sidebar a:hover { background: #FFF3D4; }
        .owl-mobile-header { display: none; }
        .owl-bottom-nav { display: none; }
        .owl-main {
          margin-left: 220px; padding: 24px 32px; min-height: 100vh;
          zoom: 1.03;
        }

        /* Mobile <768px */
        @media (max-width: 767px) {
          .owl-sidebar { display: none; }
          .owl-mobile-header {
            display: flex; position: sticky; top: 0; z-index: 100;
            height: 56px; align-items: center; justify-content: space-between;
            padding: 0 16px; background: #FFF9ED; border-bottom: 1px solid #E8D0A0;
          }
          .owl-bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
            height: 64px; padding-bottom: env(safe-area-inset-bottom, 0px);
            background: white; border-top: 1px solid #E8D0A0;
            align-items: center; justify-content: space-around;
          }
          .owl-main {
            margin-left: 0; padding: 20px 16px 96px; min-height: calc(100vh - 56px);
            zoom: 1.03;
          }
        }
      `}</style>
    </div>
  );
}
