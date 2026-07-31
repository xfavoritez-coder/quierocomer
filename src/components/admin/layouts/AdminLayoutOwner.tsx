"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, UtensilsCrossed, Tag, ChevronDown, ChevronRight, X, LogOut, BarChart3, Bell, ContactRound, UsersRound, Store, UserCog, Megaphone, Settings, Sun, Moon, Printer, Calculator, HelpCircle, ShoppingCart, Gift, Menu as MenuIcon, CreditCard, Scan, Star, QrCode } from "lucide-react";
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
  seenFeatures?: string[];
  markFeatureSeen?: (feature: string) => void;
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

const LIVE_HIDDEN = ["horusvegan"];
const CONTROL_HIDDEN = ["horusvegan"];
const ORDERING_EXCEPTIONS = ["el-menu-de-la-esquina"];

type NavItem = { icon: any; labelKey: string; href: string; badge?: string };
type NavSection = { key: string; label: string; icon: any; badge?: string; items: NavItem[] };

function buildNav(base: string, opts: { hasToteat?: boolean; plan?: string | null; hasControl?: boolean; slug?: string; hasLoyalty?: boolean } = {}) {
  const showLive = opts.hasToteat && opts.plan === "PREMIUM" && !LIVE_HIDDEN.includes(opts.slug ?? "");

  const SECTIONS: NavSection[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: Home,
      items: [
        { icon: Home, labelKey: "nav_home", href: base },
      ],
    },
    {
      key: "carta",
      label: "Carta QR",
      icon: UtensilsCrossed,
      items: [
        { icon: UtensilsCrossed, labelKey: "nav_menu", href: `${base}/menus` },
        { icon: BarChart3, labelKey: "nav_analytics", href: `${base}/analytics` },
        { icon: ContactRound, labelKey: "nav_clients", href: `${base}/clientes` },
        { icon: Tag, labelKey: "nav_offers", href: `${base}/promociones` },
        { icon: Megaphone, labelKey: "nav_announcements", href: `${base}/anuncios` },
        ...(opts.hasControl && !CONTROL_HIDDEN.includes(opts.slug ?? "") ? [{ icon: Calculator, labelKey: "nav_control", href: `${base}/control` }] : []),
        { icon: Printer, labelKey: "nav_export", href: `${base}/exportar` },
        { icon: Bell, labelKey: "nav_waiter", href: `${base}/garzon` },
        { icon: QrCode, labelKey: "nav_generate_qr", href: `${base}/qr` },
        { icon: Settings, labelKey: "nav_settings", href: `${base}/ajustes` },
      ],
    },
    {
      key: "ordering",
      label: "Pedidos Online",
      icon: ShoppingCart,
      items: [
        { icon: ShoppingCart, labelKey: "nav_ordering", href: `${base}/pedir-online` },
        ...(showLive ? [{ icon: LiveIcon, labelKey: "nav_live", href: `${base}/live` }] : []),
      ],
    },
    {
      key: "loyalty",
      label: "Loyalty",
      icon: Gift,
      badge: "Nuevo",
      items: [
        { icon: HelpCircle, labelKey: "nav_loyalty_how", href: `${base}/loyalty` },
        { icon: CreditCard, labelKey: "nav_loyalty_card", href: `${base}/loyalty/tarjeta` },
        { icon: UsersRound, labelKey: "nav_loyalty_members", href: `${base}/loyalty/miembros` },
        { icon: Bell, labelKey: "nav_loyalty_notif", href: `${base}/loyalty/notificaciones` },
        { icon: Scan, labelKey: "nav_loyalty_scan", href: `${base}/loyalty/escanear` },
      ],
    },
    {
      key: "valoraciones",
      label: "Valoraciones",
      icon: Star,
      badge: "Nuevo",
      items: [
        { icon: Settings, labelKey: "nav_reviews_config", href: `${base}/valoraciones` },
        { icon: Star, labelKey: "nav_reviews_list", href: `${base}/valoraciones/resenas` },
      ],
    },
    {
      key: "config",
      label: "Configuración",
      icon: Settings,
      items: [
        { icon: Settings, labelKey: "nav_config_general", href: `${base}/configuracion/general` },
        { icon: UsersRound, labelKey: "nav_users", href: `${base}/usuarios` },
      ],
    },
    {
      key: "subscription",
      label: "Mi Suscripción",
      icon: Store,
      items: [
        { icon: Store, labelKey: "nav_restaurant", href: `${base}/mi-restaurante` },
      ],
    },
    {
      key: "support",
      label: "Soporte",
      icon: HelpCircle,
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
    if (section.items.some(item => item.href === base ? pathname === base : pathname.startsWith(item.href + "/") || pathname === item.href)) {
      keys.add(section.key);
    }
  }
  if (keys.size === 0) keys.add(sections[0]?.key ?? "carta");
  return keys;
}

export default function AdminLayoutOwner({ name, restaurants, selectedRestaurantId, setSelectedRestaurant, logout, basePath = "/admin", activePlan, isDemo, hasLoyalty, seenFeatures = [], markFeatureSeen, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = usePanelLang();
  const selected = restaurants.find((r: any) => r.id === selectedRestaurantId);
  const hasToteat = !!(selected as any)?.hasToteat;
  const plan = (selected as any)?.plan || activePlan;
  const hasControl = !!(selected as any)?.hasControl;
  const { SECTIONS } = buildNav(basePath, { hasToteat, plan, hasControl, slug: selected?.slug, hasLoyalty });

  // Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSectionKeys(pathname, SECTIONS, basePath));

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

  // Mobile left drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const openSidebar = () => { setSidebarOpen(true); requestAnimationFrame(() => setSidebarVisible(true)); };
  const closeSidebar = () => { setSidebarVisible(false); setTimeout(() => setSidebarOpen(false), 250); };

  // Auto-close on desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { setSidebarOpen(false); setSidebarVisible(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Mark section as seen when user navigates to it
  useEffect(() => {
    if (pathname.includes("/loyalty") && !seenFeatures.includes("loyalty")) {
      markFeatureSeen?.("loyalty");
    }
    if (pathname.includes("/valoraciones") && !seenFeatures.includes("valoraciones")) {
      markFeatureSeen?.("valoraciones");
    }
  }, [pathname, seenFeatures, markFeatureSeen]);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("light");
  useEffect(() => {
    const saved = localStorage.getItem("qc_panel_theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("qc_panel_theme", next);
  };

  const isActive = (href: string) => {
    if (href === basePath) return pathname === basePath;
    // Si hay items hermanos que empiezan con este href, usar exact match (evita falso activo en index de sección)
    const hasSiblings = SECTIONS.some(s => s.items.length > 1 && s.items.some(i => i.href !== href && i.href.startsWith(href + "/")));
    return hasSiblings ? pathname === href : pathname.startsWith(href);
  };
  const isSectionActive = (section: NavSection) => section.items.some(item => isActive(item.href));
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const activeRest = restaurants.find(r => r.id === selectedRestaurantId) || restaurants[0];
  const restInitials = activeRest?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const RestLogo = ({ size = 36 }: { size?: number }) => (
    activeRest?.logoUrl
      ? <img src={activeRest.logoUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      : <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a5f3f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.39, fontWeight: 700, fontFamily: F, flexShrink: 0 }}>{restInitials}</div>
  );

  // Shared accordion nav content
  const AccordionNav = ({ onNavClick }: { onNavClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto" }}>
      {SECTIONS.map((section, si) => {
        const isOpen = openSections.has(section.key);
        const sectionActive = isSectionActive(section);
        const isSingle = section.items.length === 1;
        const singleHref = isSingle ? section.items[0].href : "";
        const singleActive = isSingle && isActive(singleHref);

        const SectionIcon = section.icon;
        return (
          <div key={section.key}>
            {/* Section header */}
            {isSingle ? (
              // Single-item: header IS the link, navigates directly
              <Link
                href={singleHref}
                onClick={() => {
                  if (singleActive) window.dispatchEvent(new CustomEvent("nav-same-page"));
                  onNavClick?.();
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "0 16px", height: 44, textDecoration: "none",
                  borderTop: si === 0 ? "none" : "1px solid var(--adm-card-border)",
                  background: singleActive ? "var(--adm-hover)" : "none",
                  borderLeft: singleActive ? `3px solid ${GOLD}` : "3px solid transparent",
                }}
              >
                <SectionIcon size={13} color={singleActive ? GOLD : "var(--adm-text3)"} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <span style={{
                  fontFamily: FB, fontSize: "0.72rem", fontWeight: 800, flex: 1,
                  color: singleActive ? GOLD : "var(--adm-text2)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{section.label}</span>
                {section.badge && !seenFeatures.includes(section.key) && (
                  <span style={{ fontSize: "0.58rem", fontWeight: 700, fontFamily: F, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 5px", letterSpacing: ".03em", lineHeight: 1.6 }}>
                    {section.badge}
                  </span>
                )}
                <ChevronRight size={13} color={singleActive ? GOLD : "var(--adm-text3)"} />
              </Link>
            ) : (
              // Multi-item: toggles accordion
              <button
                onClick={() => toggleSection(section.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 7,
                  padding: "0 16px", height: 44, background: "none", border: "none", cursor: "pointer",
                  borderTop: si === 0 ? "none" : "1px solid var(--adm-card-border)",
                  borderLeft: "3px solid transparent",
                }}
              >
                <SectionIcon size={13} color={sectionActive ? GOLD : "var(--adm-text3)"} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <span style={{
                  fontFamily: FB, fontSize: "0.72rem", fontWeight: 800, flex: 1, textAlign: "left",
                  color: sectionActive ? GOLD : "var(--adm-text2)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{section.label}</span>
                {section.badge && !seenFeatures.includes(section.key) && (
                  <span style={{ fontSize: "0.58rem", fontWeight: 700, fontFamily: F, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 5px", letterSpacing: ".03em", lineHeight: 1.6, flexShrink: 0 }}>
                    {section.badge}
                  </span>
                )}
                <ChevronDown
                  size={13}
                  color={sectionActive ? GOLD : "var(--adm-text3)"}
                  style={{ transition: "transform 0.2s ease", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}
                />
              </button>
            )}

            {/* Sub-items (only for multi-item sections) */}
            {!isSingle && (
              <div style={{ overflow: "hidden", maxHeight: isOpen ? "800px" : "0", transition: "max-height 0.22s ease" }}>
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
                        padding: "0 16px 0 24px", height: 38, textDecoration: "none",
                        background: active ? "var(--adm-hover)" : "transparent",
                        color: active ? GOLD : "var(--adm-text2)",
                        fontFamily: FB, fontSize: "0.83rem", fontWeight: 500,
                        borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                      }}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.6} />
                      <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  // Footer with theme toggle + user info + logout
  const SidebarFooter = ({ onClose }: { onClose?: () => void }) => (
    <div style={{ borderTop: "1px solid var(--adm-card-border)", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 }}>{initial}</div>
        <Link
          href="/panel/perfil"
          onClick={onClose}
          style={{ flex: 1, fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {name}
        </Link>
        <button onClick={() => { onClose?.(); logout(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
          <LogOut size={15} color="#ef4444" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={theme === "dark" ? "theme-dark" : "theme-light"} style={{ minHeight: "100vh", background: "var(--adm-bg)" }}>

      {/* ── Desktop Sidebar (≥768px) ── */}
      <aside className="owl-sidebar">
        {/* Header — no borderBottom, first section provides the separator */}
        <div style={{ padding: "14px 16px 12px", flexShrink: 0 }}>
          <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <RestLogo size={28} />
            <p style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{activeRest?.name || "Local"}</p>
          </Link>
        </div>
        <AccordionNav />
        <SidebarFooter />
      </aside>

      {/* ── Mobile Header (<768px) ── */}
      <header className="owl-mobile-header">
        <button onClick={openSidebar} style={{ width: 40, height: 40, borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MenuIcon size={18} color="var(--adm-text2)" />
        </button>
        <Link href={basePath} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, margin: "0 12px" }}>
          <RestLogo size={26} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.2, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
          </div>
        </Link>
      </header>

      {/* ── Content ── */}
      <main className="owl-main" style={{ animation: "panelFadeIn 0.4s ease-out", position: "relative" }}>
        {children}
      </main>
      <style>{`@keyframes panelFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* ── Mobile Left Drawer ── */}
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
          <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", flexShrink: 0 }}>
            <Link href={basePath} onClick={closeSidebar} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
              <RestLogo size={26} />
              <p style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeRest?.name || "Local"}</p>
            </Link>
            <button onClick={closeSidebar} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={18} color="var(--adm-text3)" />
            </button>
          </div>
          <AccordionNav onNavClick={closeSidebar} />
          <SidebarFooter onClose={closeSidebar} />
        </div>
      </>)}

      {/* ── Responsive CSS ── */}
      <style>{`
        .owl-sidebar {
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; width: 224px; z-index: 50;
          background: var(--adm-card); border-right: 1px solid var(--adm-card-border);
          overflow: hidden;
        }
        .owl-sidebar a:hover { background: var(--adm-hover); }
        .owl-mobile-header { display: none; }
        .owl-main {
          margin-left: 224px; padding: 24px 32px; min-height: 100vh;
          zoom: 1.03;
        }
        @media (max-width: 767px) {
          .owl-sidebar { display: none; }
          .owl-mobile-header {
            display: flex; position: sticky; top: 0; z-index: 100;
            height: 58px; align-items: center;
            padding: 0 12px; background: var(--adm-card); border-bottom: 1px solid var(--adm-card-border);
          }
          .owl-main {
            margin-left: 0; padding: 20px 16px 36px; min-height: calc(100vh - 58px);
            zoom: 1.03;
          }
        }
      `}</style>
    </div>
  );
}
