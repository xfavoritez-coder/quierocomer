"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, UtensilsCrossed, Tag, ChevronDown, X, LogOut, BarChart3, Bell, ContactRound, UsersRound, Store, UserCog, Megaphone, Settings, Sun, Moon, Printer, Calculator, HelpCircle, ShoppingCart, Gift, Menu as MenuIcon } from "lucide-react";
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
  basePath?: string;
  activePlan?: string;
  isDemo?: boolean;
  hasLoyalty?: boolean;
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
const LIVE_HIDDEN = ["horusvegan"];
const CONTROL_HIDDEN = ["horusvegan"];

type NavItem = { icon: any; labelKey: string; href: string; badge?: string };
type NavSection = { key: string; label: string; items: NavItem[] };

function buildNav(base: string, opts: { hasToteat?: boolean; plan?: string | null; hasControl?: boolean; slug?: string; hasLoyalty?: boolean } = {}) {
  const showLive = opts.hasToteat && opts.plan === "PREMIUM" && !LIVE_HIDDEN.includes(opts.slug ?? "");

  const SECTIONS: NavSection[] = [
    {
      key: "carta",
      label: "Carta QR",
      items: [
        { icon: Home, labelKey: "nav_home", href: base },
        { icon: UtensilsCrossed, labelKey: "nav_menu", href: `${base}/menus` },
        { icon: BarChart3, labelKey: "nav_analytics", href: `${base}/analytics` },
        { icon: ContactRound, labelKey: "nav_clients", href: `${base}/clientes` },
        { icon: Tag, labelKey: "nav_offers", href: `${base}/promociones` },
        { icon: Megaphone, labelKey: "nav_announcements", href: `${base}/anuncios` },
        ...(opts.hasControl && !CONTROL_HIDDEN.includes(opts.slug ?? "") ? [{ icon: Calculator, labelKey: "nav_control", href: `${base}/control` }] : []),
        { icon: Printer, labelKey: "nav_export", href: `${base}/exportar` },
        { icon: Bell, labelKey: "nav_waiter", href: `${base}/garzon` },
        { icon: UsersRound, labelKey: "nav_users", href: `${base}/usuarios` },
        { icon: Settings, labelKey: "nav_settings", href: `${base}/ajustes` },
      ],
    },
    {
      key: "ordering",
      label: "Pedidos Online",
      items: [
        { icon: ShoppingCart, labelKey: "nav_ordering", href: `${base}/pedir-online`, badge: "Nuevo" },
        ...(showLive ? [{ icon: LiveIcon, labelKey: "nav_live", href: `${base}/live` }] : []),
      ],
    },
    {
      key: "loyalty",
      label: "Loyalty",
      items: [
        { icon: Gift, labelKey: "nav_loyalty", href: `${base}/loyalty` },
      ],
    },
    {
      key: "subscription",
      label: "Mi Suscripción",
      items: [
        { icon: Store, labelKey: "nav_restaurant", href: `${base}/mi-restaurante` },
      ],
    },
    {
      key: "support",
      label: "Soporte",
      items: [
        { icon: HelpCircle, labelKey: "nav_support", href: `${base}/ayuda` },
      ],
    },
  ];

  return { SECTIONS };
}

function getActiveSectionKeys(pathname: string, sections: NavSection[], base: string): Set<string> {
  const keys = new Set<string>();
  for (const section of sections) {
    if (section.items.some(item => item.href === base ? pathname === base : pathname.startsWith(item.href + "/"))) {
      keys.add(section.key);
    }
  }
  if (keys.size === 0) keys.add(sections[0]?.key ?? "carta");
  return keys;
}

export default function AdminLayoutOwner({ name, restaurants, selectedRestaurantId, setSelectedRestaurant, logout, basePath = "/admin", activePlan, isDemo, hasLoyalty, children }: Props) {
  const pathname = usePathname();
  const { t } = usePanelLang();
  const selected = restaurants.find((r: any) => r.id === selectedRestaurantId);
  const hasToteat = !!(selected as any)?.hasToteat;
  const plan = (selected as any)?.plan || activePlan;
  const hasControl = !!(selected as any)?.hasControl;
  const { SECTIONS } = buildNav(basePath, { hasToteat, plan, hasControl, slug: selected?.slug, hasLoyalty });

  // Accordion state — open sections
  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSectionKeys(pathname, SECTIONS, basePath));

  // Sync open sections when pathname changes (auto-open the active section)
  useEffect(() => {
    const active = getActiveSectionKeys(pathname, SECTIONS, basePath);
    setOpenSections(prev => {
      const next = new Set(prev);
      active.forEach(k => next.add(k));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Mobile left sidebar drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const openSidebar = () => { setSidebarOpen(true); requestAnimationFrame(() => setSidebarVisible(true)); };
  const closeSidebar = () => { setSidebarVisible(false); setTimeout(() => setSidebarOpen(false), 250); };

  // Account drawer (right side)
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const openAccount = () => { setAccountOpen(true); requestAnimationFrame(() => setAccountVisible(true)); };
  const closeAccount = () => { setAccountVisible(false); setTimeout(() => setAccountOpen(false), 250); };

  // Auto-close mobile sidebar on desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { setSidebarOpen(false); setSidebarVisible(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // "seen" badge for ordering nav
  const [seenOrdering, setSeenOrdering] = useState(true);
  useEffect(() => {
    setSeenOrdering(localStorage.getItem(`qc_ordering_seen_${selectedRestaurantId}`) === "1");
  }, [selectedRestaurantId]);
  useEffect(() => {
    if (pathname.includes("/pedir-online") && !seenOrdering) {
      localStorage.setItem(`qc_ordering_seen_${selectedRestaurantId}`, "1");
      setSeenOrdering(true);
    }
  }, [pathname, selectedRestaurantId, seenOrdering]);

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("qc_panel_theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  const isActive = (href: string) => href === basePath ? pathname === basePath : pathname.startsWith(href);
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const activeRest = restaurants.find(r => r.id === selectedRestaurantId) || restaurants[0];
  const restInitials = activeRest?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const RestLogo = ({ size = 36 }: { size?: number }) => (
    activeRest?.logoUrl
      ? <img src={activeRest.logoUrl} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      : <div style={{ width: size, height: size, borderRadius: 8, background: "#1a5f3f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.39, fontWeight: 700, fontFamily: F, flexShrink: 0 }}>{restInitials}</div>
  );

  const handleChangePassword = async () => {
    setPwError("");
    if (pwNew.length < 8) { setPwError(t("password_min")); return; }
    if (!/\d/.test(pwNew)) { setPwError(t("password_number")); return; }
    if (pwNew !== pwConfirm) { setPwError(t("passwords_mismatch")); return; }
    setPwLoading(true);
    try {
      const endpoint = basePath === "/panel" ? "/api/panel/change-password" : "/api/admin/me/change-password";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); setPwLoading(false); return; }
      setPwSuccess(true);
      setTimeout(() => { setPwOpen(false); setPwSuccess(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }, 2000);
    } catch { setPwError(t("connection_error")); }
    setPwLoading(false);
  };

  // Shared accordion nav — used in both desktop sidebar and mobile drawer
  const AccordionNav = ({ onNavClick }: { onNavClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "4px 0 12px" }}>
      {SECTIONS.map((section) => {
        const isOpen = openSections.has(section.key);
        const hasActiveItem = section.items.some(item => isActive(item.href));
        return (
          <div key={section.key}>
            {/* Section header — clickable */}
            <button
              onClick={() => toggleSection(section.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px 8px", background: "none", border: "none", cursor: "pointer",
                borderTop: "1px solid var(--adm-card-border)",
              }}
            >
              <span style={{
                fontFamily: FB, fontSize: "0.62rem", fontWeight: 800, flex: 1, textAlign: "left",
                color: hasActiveItem ? GOLD : "var(--adm-text3)",
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>{section.label}</span>
              <ChevronDown
                size={13}
                color={hasActiveItem ? GOLD : "var(--adm-text3)"}
                style={{ transition: "transform 0.2s ease", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}
              />
            </button>
            {/* Section items */}
            <div style={{
              overflow: "hidden",
              maxHeight: isOpen ? "600px" : "0",
              transition: "max-height 0.22s ease",
            }}>
              {section.items.map(item => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (active) window.dispatchEvent(new CustomEvent("nav-same-page"));
                      onNavClick?.();
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 16px 0 20px", height: 40, textDecoration: "none",
                      background: active ? "var(--adm-hover)" : "transparent",
                      color: active ? GOLD : "var(--adm-text2)",
                      fontFamily: FB, fontSize: "0.84rem", fontWeight: 500,
                      borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                    }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.6} />
                    <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                    {(item as any).badge && !seenOrdering && (
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, fontFamily: F, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 5px", letterSpacing: ".03em", lineHeight: 1.6, flexShrink: 0 }}>
                        {(item as any).badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const SidebarHeader = () => (
    <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--adm-card-border)" }}>
      <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
        <RestLogo size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
          {activePlan && basePath === "/panel" && (
            <button
              onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { renew: true, initialTab: activePlan === "FREE" ? undefined : activePlan, source: "plan_badge" } })); }}
              style={{ fontFamily: F, fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.3px", border: "none", cursor: "pointer", marginTop: 3,
                background: activePlan === "PREMIUM" ? "rgba(124,58,237,0.12)" : activePlan === "GOLD" ? "rgba(244,166,35,0.12)" : "var(--adm-hover)",
                color: activePlan === "PREMIUM" ? "#a78bfa" : activePlan === "GOLD" ? "#F4A623" : "var(--adm-text3)",
              }}
            >
              {activePlan === "PREMIUM" ? "Carta QR" : activePlan === "GOLD" ? "Gold" : "Ver planes"}
            </button>
          )}
        </div>
      </Link>
    </div>
  );

  const SidebarFooter = ({ onAccountClick }: { onAccountClick: () => void }) => (
    <div style={{ borderTop: "1px solid var(--adm-card-border)" }}>
      {/* Theme toggle */}
      <button
        onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); localStorage.setItem("qc_panel_theme", next); }}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer" }}
      >
        {theme === "dark" ? <Sun size={15} color="var(--adm-text3)" /> : <Moon size={15} color="var(--adm-text3)" />}
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
      </button>
      {/* Account */}
      <button onClick={onAccountClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", width: "100%", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 }}>{initial}</div>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1, textAlign: "left" }}>{name}</span>
      </button>
    </div>
  );

  return (
    <div className={theme === "dark" ? "theme-dark" : "theme-light"} style={{ minHeight: "100vh", background: "var(--adm-bg)" }}>

      {/* ── Desktop Sidebar (≥768px) ── */}
      <aside className="owl-sidebar">
        <SidebarHeader />
        <AccordionNav />
        <SidebarFooter onAccountClick={openAccount} />
      </aside>

      {/* ── Mobile Header (<768px) ── */}
      <header className="owl-mobile-header">
        <button onClick={openSidebar} style={{ width: 40, height: 40, borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MenuIcon size={18} color="var(--adm-text2)" />
        </button>
        <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, margin: "0 10px" }}>
          <RestLogo size={34} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
            <p style={{ fontFamily: F, fontSize: "11px", color: "var(--adm-text3)", fontWeight: 500, margin: "1px 0 0" }}>QuieroComer</p>
          </div>
        </Link>
        <button onClick={openAccount} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(244,166,35,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "0.95rem", fontWeight: 700, flexShrink: 0 }}>
          {initial}
        </button>
      </header>

      {/* ── Content ── */}
      <main className="owl-main" style={{ animation: "panelFadeIn 0.4s ease-out", position: "relative" }}>
        {children}
      </main>
      <style>{`@keyframes panelFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* ── Mobile Left Sidebar Drawer ── */}
      {sidebarOpen && (<>
        <div onClick={closeSidebar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, opacity: sidebarVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: "min(280px, 85vw)",
          zIndex: 201, background: "var(--adm-card)", display: "flex", flexDirection: "column",
          boxShadow: "4px 0 24px rgba(0,0,0,0.2)",
          transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease-out",
        }}>
          {/* Drawer header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--adm-card-border)", flexShrink: 0 }}>
            <Link href={basePath} onClick={closeSidebar} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
              <RestLogo size={32} />
              <p style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
            </Link>
            <button onClick={closeSidebar} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={18} color="var(--adm-text3)" />
            </button>
          </div>
          {/* Accordion nav */}
          <AccordionNav onNavClick={closeSidebar} />
          {/* Footer */}
          <SidebarFooter onAccountClick={() => { closeSidebar(); setTimeout(openAccount, 260); }} />
        </div>
      </>)}

      {/* ── Account Drawer (right slide) ── */}
      {accountOpen && (<>
        <div onClick={closeAccount} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, opacity: accountVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(300px, 85vw)", zIndex: 301, background: "var(--adm-card)", boxShadow: "-4px 0 20px rgba(0,0,0,0.2)", transform: accountVisible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease-out", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--adm-card-border)" }}>
            <button onClick={closeAccount} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}><X size={20} color="var(--adm-text3)" /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "1.1rem", fontWeight: 700 }}>{initial}</div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>{name}</p>
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Owner</p>
              </div>
            </div>
          </div>
          <div style={{ padding: "8px 20px", flex: 1 }}>
            <a href="/panel/perfil" onClick={closeAccount} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 0", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textDecoration: "none" }}>
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
          position: fixed; top: 0; left: 0; bottom: 0; width: 224px; z-index: 50;
          background: var(--adm-card); border-right: 1px solid var(--adm-card-border);
          overflow: hidden;
        }
        .owl-sidebar a:hover, .owl-sidebar button:hover { background: var(--adm-hover); }
        .owl-mobile-header { display: none; }
        .owl-main {
          margin-left: 224px; padding: 24px 32px; min-height: 100vh;
          zoom: 1.03;
        }

        /* Mobile <768px */
        @media (max-width: 767px) {
          .owl-sidebar { display: none; }
          .owl-mobile-header {
            display: flex; position: sticky; top: 0; z-index: 100;
            height: 60px; align-items: center;
            padding: 0 12px; background: var(--adm-card); border-bottom: 1px solid var(--adm-card-border);
          }
          .owl-main {
            margin-left: 0; padding: 20px 16px 40px; min-height: calc(100vh - 60px);
            zoom: 1.03;
          }
        }
      `}</style>
    </div>
  );
}
