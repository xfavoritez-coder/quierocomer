"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, UtensilsCrossed, Tag, Menu, ChevronRight, X, LogOut, Lock, BarChart3, Bell, ContactRound, UsersRound, Zap, Store, UserCog, Megaphone, CreditCard, Receipt, Settings, Sun, Moon, Printer, Calculator, HelpCircle, ShoppingCart } from "lucide-react";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Restaurant { id: string; name: string; slug: string; logoUrl?: string | null; plan?: string; hasToteat?: boolean; }

interface Props {
  name: string;
  restaurants: Restaurant[];
  selectedRestaurantId: string | null;
  setSelectedRestaurant: (id: string) => void;
  logout: () => void;
  basePath?: string; // "/admin" or "/panel"
  activePlan?: string;
  isDemo?: boolean;
  children: React.ReactNode;
}

function LiveIcon({ size = 18 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, position: "relative" }}>
      <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 6px rgba(22,163,74,0.6)", animation: "navLivePulse 2s infinite" }} />
      <style>{`@keyframes navLivePulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.25)} }`}</style>
    </span>
  );
}

const ORDERING_EXCEPTIONS = ["el-menu-de-la-esquina"];

function buildNav(base: string, opts: { hasToteat?: boolean; plan?: string | null; hasControl?: boolean; slug?: string } = {}) {
  const showLive = opts.hasToteat && opts.plan === "PREMIUM";
  const showOrdering = opts.plan === "PREMIUM" || ORDERING_EXCEPTIONS.includes(opts.slug ?? "");
  const SIDEBAR_NAV = [
    { icon: Home, labelKey: "nav_home", href: base },
    { icon: ShoppingCart, labelKey: "nav_ordering", href: `${base}/pedir-online`, badge: "Nuevo" },
    ...(showLive ? [{ icon: LiveIcon, labelKey: "nav_live", href: `${base}/live` }] : []),
    { icon: UtensilsCrossed, labelKey: "nav_menu", href: `${base}/menus` },
    { icon: BarChart3, labelKey: "nav_analytics", href: `${base}/analytics` },
    { icon: ContactRound, labelKey: "nav_clients", href: `${base}/clientes` },
    { icon: Tag, labelKey: "nav_offers", href: `${base}/promociones` },
    { icon: Megaphone, labelKey: "nav_announcements", href: `${base}/anuncios` },
    ...(opts.hasControl ? [{ icon: Calculator, labelKey: "nav_control", href: `${base}/control` }] : []),
    { icon: Printer, labelKey: "nav_export", href: `${base}/exportar` },
    { icon: Bell, labelKey: "nav_waiter", href: `${base}/garzon` },
    { icon: UsersRound, labelKey: "nav_users", href: `${base}/usuarios` },
    { icon: Store, labelKey: "nav_restaurant", href: `${base}/mi-restaurante` },
    { icon: Settings, labelKey: "nav_settings", href: `${base}/ajustes` },
    { icon: HelpCircle, labelKey: "nav_support", href: `${base}/ayuda` },
  ];
  const BOTTOM_TABS_RAW = [
    { icon: Home, labelKey: "nav_home", href: base },
    { icon: UtensilsCrossed, labelKey: "nav_menu", href: `${base}/menus` },
    { icon: BarChart3, labelKey: "nav_analytics", href: `${base}/analytics` },
    { icon: Menu, labelKey: "nav_more", href: "__more__" },
  ] as const;
  const MORE_ITEMS = SIDEBAR_NAV.filter(n => !BOTTOM_TABS_RAW.some(tb => tb.href === n.href));
  return { SIDEBAR_NAV, BOTTOM_TABS: BOTTOM_TABS_RAW, MORE_ITEMS };
}

export default function AdminLayoutOwner({ name, restaurants, selectedRestaurantId, setSelectedRestaurant, logout, basePath = "/admin", activePlan, isDemo, children }: Props) {
  const pathname = usePathname();
  const { t } = usePanelLang();
  const selected = restaurants.find((r: any) => r.id === selectedRestaurantId);
  const hasToteat = !!(selected as any)?.hasToteat;
  const plan = (selected as any)?.plan || activePlan;
  const hasControl = !!(selected as any)?.hasControl;
  const { SIDEBAR_NAV, BOTTOM_TABS, MORE_ITEMS } = buildNav(basePath, { hasToteat, plan, hasControl, slug: selected?.slug });
  const [moreOpen, setMoreOpen] = useState(false);

  // localStorage-based "seen" badge for ordering nav
  const [seenOrdering, setSeenOrdering] = useState(true); // assume seen until loaded
  useEffect(() => {
    const key = `qc_ordering_seen_${selectedRestaurantId}`;
    setSeenOrdering(localStorage.getItem(key) === "1");
  }, [selectedRestaurantId]);
  useEffect(() => {
    if (pathname.includes("/pedir-online") && !seenOrdering) {
      const key = `qc_ordering_seen_${selectedRestaurantId}`;
      localStorage.setItem(key, "1");
      setSeenOrdering(true);
    }
  }, [pathname, selectedRestaurantId, seenOrdering]);
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
    if (pwNew.length < 8) { setPwError(t("password_min")); return; }
    if (!/\d/.test(pwNew)) { setPwError(t("password_number")); return; }
    if (pwNew !== pwConfirm) { setPwError(t("passwords_mismatch")); return; }
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
    } catch { setPwError(t("connection_error")); }
    setPwLoading(false);
  };

  // Theme: read from localStorage, default dark
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("qc_panel_theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  return (
    <div className={theme === "dark" ? "theme-dark" : "theme-light"} style={{ minHeight: "100vh", background: "var(--adm-bg)" }}>
      {/* ── Desktop Sidebar (≥768px) ── */}
      <aside className="owl-sidebar">
        {/* Header */}
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--adm-card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <RestLogo size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: "16px", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                {activePlan && basePath === "/panel" && (
                  <button
                    onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { renew: true, initialTab: activePlan === "FREE" ? undefined : activePlan, source: "plan_badge" } })); }}
                    style={{ fontFamily: F, fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.3px", border: "none", cursor: "pointer",
                      background: activePlan === "PREMIUM" ? "rgba(124,58,237,0.12)" : activePlan === "GOLD" ? "rgba(244,166,35,0.12)" : activePlan === "SILVER" ? "rgba(148,163,184,0.12)" : "var(--adm-hover)",
                      color: activePlan === "PREMIUM" ? "#a78bfa" : activePlan === "GOLD" ? "#F4A623" : activePlan === "SILVER" ? "#94a3b8" : "var(--adm-text3)",
                    }}
                  >
                    {activePlan === "PREMIUM" ? "Premium" : activePlan === "GOLD" ? "Gold" : activePlan === "SILVER" ? "Silver" : "Ver planes"}
                  </button>
                )}
              </div>
            </div>
          </Link>
          </div>
          {false && restaurants.length > 1 && (
            <select value={selectedRestaurantId || ""} onChange={(e) => setSelectedRestaurant(e.target.value)}
              style={{ marginTop: 10, width: "100%", padding: "5px 8px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text)", outline: "none", cursor: "pointer" }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {SIDEBAR_NAV.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const badge = (item as any).badge;
            return (
              <Link key={item.href} href={item.href} onClick={() => { if (active) window.dispatchEvent(new CustomEvent("nav-same-page")); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 44, textDecoration: "none",
                background: active ? "var(--adm-hover)" : "transparent", color: active ? GOLD : "var(--adm-text2)",
                fontFamily: FB, fontSize: "0.84rem", fontWeight: 500, borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
              }}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
                <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                {badge && !seenOrdering && <span style={{ fontSize: "0.6rem", fontWeight: 700, fontFamily: F, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 5px", letterSpacing: ".03em", lineHeight: 1.6, flexShrink: 0 }}>{badge}</span>}
              </Link>
            );
          })}
        </nav>
        {/* Account */}
        <button onClick={openAccount} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", width: "100%",
          background: "none", border: "none", borderTop: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left",
        }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "0.75rem", fontWeight: 700 }}>{initial}</div>
          <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1 }}>{name}</span>
        </button>
      </aside>

      {/* ── Mobile Header (<768px) ── */}
      <header className="owl-mobile-header">
        <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <RestLogo size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <p style={{ fontFamily: F, fontSize: "17px", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
              {activePlan && basePath === "/panel" && (
                <button
                  onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { renew: true, initialTab: activePlan === "FREE" ? undefined : activePlan, source: "plan_badge_mobile" } })); }}
                  style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.3px", border: "none", cursor: "pointer", flexShrink: 0,
                    background: activePlan === "PREMIUM" ? "rgba(124,58,237,0.12)" : activePlan === "GOLD" ? "rgba(244,166,35,0.12)" : activePlan === "SILVER" ? "rgba(148,163,184,0.12)" : "var(--adm-hover)",
                    color: activePlan === "PREMIUM" ? "#a78bfa" : activePlan === "GOLD" ? "#F4A623" : activePlan === "SILVER" ? "#94a3b8" : "var(--adm-text3)",
                  }}
                >
                  {activePlan === "PREMIUM" ? "PRO" : activePlan === "GOLD" ? "GOLD" : activePlan === "SILVER" ? "SILVER" : "GRATIS"}
                </button>
              )}
            </div>
            <p style={{ fontFamily: F, fontSize: "12px", color: "var(--adm-text3)", fontWeight: 500, margin: "2px 0 0" }}>QuieroComer</p>
          </div>
        </Link>
        {false && restaurants.length > 1 && (
          <select value={selectedRestaurantId || ""} onChange={(e) => setSelectedRestaurant(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", maxWidth: 140, cursor: "pointer", flexShrink: 0 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <button onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); localStorage.setItem("qc_panel_theme", next); }} className="theme-toggle-btn" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10 }}>
          {theme === "dark" ? <Sun size={16} color="#777" /> : <Moon size={16} color="#bbb" />}
        </button>
        <button onClick={openAccount} style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(244,166,35,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "1rem", fontWeight: 700, flexShrink: 0 }}>
          {initial}
        </button>
      </header>

      {/* ── Content ── */}
      <main className="owl-main" style={{ animation: "panelFadeIn 0.4s ease-out", position: "relative" }}>
        {children}
      </main>
      <style>{`@keyframes panelFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } } @media(max-width:768px){.theme-toggle-btn{display:none!important;}}`}</style>

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
                <Icon size={22} color={active ? GOLD : "var(--adm-text2)"} strokeWidth={active ? 2.5 : 1.8} />
                <span style={{ fontFamily: FB, fontSize: "0.65rem", fontWeight: 500, color: active ? GOLD : "var(--adm-text2)" }}>{t(tab.labelKey)}</span>
              </button>
            );
          }
          return (
            <Link key={tab.href} href={tab.href} onClick={() => { if (isActive(tab.href)) window.dispatchEvent(new CustomEvent("nav-same-page")); }} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              textDecoration: "none", padding: "8px 12px", minWidth: 64, minHeight: 44,
            }}>
              <Icon size={22} color={active ? GOLD : "var(--adm-text2)"} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontFamily: FB, fontSize: "0.65rem", fontWeight: 500, color: active ? GOLD : "var(--adm-text2)" }}>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Drawer "Más" (bottom sheet, mobile only) ── */}
      {moreOpen && (<>
        <div onClick={closeMore} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, opacity: moreVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201, background: "var(--adm-card)", borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 16px)", transform: moreVisible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.25s ease-out", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--adm-card-border)" }} />
          </div>
          <div style={{ padding: "8px 16px 16px" }}>
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const badge = (item as any).badge;
              return (
                <Link key={item.href} href={item.href} onClick={closeMore} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", textDecoration: "none", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <Icon size={18} color={GOLD} />
                    {badge && !seenOrdering && <span style={{ position: "absolute", top: -4, right: -4, fontSize: "0.55rem", fontWeight: 700, fontFamily: F, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 4px", lineHeight: 1.5 }}>{badge}</span>}
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", flex: 1 }}>{t(item.labelKey)}</span>
                  <ChevronRight size={16} color="var(--adm-text3)" />
                </Link>
              );
            })}
          </div>
        </div>
      </>)}

      {/* ── Account Drawer (right slide, both mobile and desktop) ── */}
      {accountOpen && (<>
        <div onClick={closeAccount} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, opacity: accountVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(320px, 85vw)", zIndex: 301, background: "var(--adm-card)", boxShadow: "-4px 0 20px rgba(0,0,0,0.2)", transform: accountVisible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease-out", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--adm-card-border)" }}>
            <button onClick={closeAccount} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}><X size={20} color="var(--adm-text3)" /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "1.1rem", fontWeight: 700 }}>{initial}</div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>{name}</p>
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Owner</p>
              </div>
            </div>
          </div>
          {false && restaurants.length > 1 && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--adm-card-border)" }}>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Mis locales</p>
              {restaurants.map(r => (
                <button key={r.id} onClick={() => { setSelectedRestaurant(r.id); closeAccount(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.id === selectedRestaurantId ? GOLD : "#ddd" }} />
                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: r.id === selectedRestaurantId ? "var(--adm-text)" : "var(--adm-text3)" }}>{r.name}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: "8px 20px", flex: 1 }}>
            <a href="/panel/perfil" onClick={closeAccount} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left", textDecoration: "none" }}>
              <UserCog size={18} color="var(--adm-text2)" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{t("my_profile")}</span>
            </a>
          </div>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "none", border: "none", borderTop: "1px solid var(--adm-card-border)", cursor: "pointer", width: "100%" }}>
            <LogOut size={18} color="#ef4444" /><span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#ef4444" }}>{t("logout")}</span>
          </button>
        </div>
      </>)}

      {/* ── Change Password Modal ── */}
      {pwOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--adm-card)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, position: "relative" }}>
            <button onClick={() => { setPwOpen(false); setPwError(""); setPwSuccess(false); }} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#999" /></button>
            <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", margin: "0 0 16px" }}>{t("change_password")}</h3>
            {pwSuccess ? (
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#16a34a", textAlign: "center", padding: "20px 0" }}>{t("password_updated")}</p>
            ) : (<>
              {pwError && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#ef4444", margin: "0 0 12px", background: "#FEF2F2", padding: "8px 12px", borderRadius: 6 }}>{pwError}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="password" placeholder={t("current_password")} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
                <input type="password" placeholder={t("new_password")} value={pwNew} onChange={e => setPwNew(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
                <input type="password" placeholder={t("confirm_password")} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
                <button onClick={handleChangePassword} disabled={pwLoading} style={{ width: "100%", padding: 12, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>
                  {pwLoading ? t("saving") : t("save")}
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
          background: var(--adm-card); border-right: 1px solid var(--adm-card-border);
        }
        .owl-sidebar a:hover { background: var(--adm-hover); }
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
            height: 64px; align-items: center; justify-content: space-between;
            padding: 0 16px; background: var(--adm-card); border-bottom: 1px solid var(--adm-card-border);
          }
          .owl-bottom-nav {
            display: flex; position: fixed; bottom: 12px; left: 12px; right: 12px; z-index: 100;
            height: 60px; padding: 0 8px; padding-bottom: env(safe-area-inset-bottom, 0px);
            background: var(--adm-card); border: 1px solid var(--adm-card-border);
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            align-items: center; justify-content: space-evenly;
            gap: 12px;
          }
          .owl-main {
            margin-left: 0; padding: 20px 16px 100px; min-height: calc(100vh - 56px);
            zoom: 1.03;
          }
        }

      `}</style>
    </div>
  );
}
