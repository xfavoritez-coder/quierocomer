"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, X, MapPin, Store, ChevronDown, ChevronLeft, ChevronRight, Pencil, Menu as MenuIcon, Heart, Home, User, MessageCircle, Clock, Motorbike, Lock, UtensilsCrossed } from "lucide-react";
import CustomerMenu, { type CustomerMenuView } from "./CustomerMenu";
import type { StoreTenant, StoreCategory, StoreProduct, BrandBranch } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { computeDistanceFee, type DistanceFeeResult } from "@/lib/ecommerce/delivery";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import { formatPlaceAddress, placeAddressParts, type AddressParts } from "@/lib/ecommerce/address";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import { useCloseAnimation } from "@/lib/ecommerce/useCloseAnimation";
import ProductModal from "./ProductModal";
import StoreStyles from "./StoreStyles";
import { trackStoreView, trackDishView, trackCartAdd, trackCartView, trackSessionEnd, trackScrollCategory, trackSearch, trackModifierOpen } from "@/lib/ecommerce/storeAnalytics";

// Controles de "marca" (multisucursal): la tienda se muestra directo en
// /ecommerce/marca/<brand> con el menú compartido, pero la sucursal se elige recién
// al querer agregar algo (dirección → delivery / retiro). Cuando se pasan estos
// controles, StoreFront no liga el carrito por sí mismo (lo hace el contenedor de
// marca vía adoptRestaurant) e intercepta agregar/checkout hasta que haya sucursal.
export interface BrandControls {
  hasBranch: boolean;
  branchLabel: string | null;
  onRequireBranch: (product?: StoreProduct | null) => void;
  resolving?: boolean;       // true mientras se carga la sucursal guardada (evita flash)
  openBranchLabel?: string | null; // nombre de sucursal abierta alternativa (si la actual está cerrada)
}

interface Props {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
  basePath?: string; // ruta base de la tienda ("" en dominio propio, /ecommerce/<slug> en el principal)
  brandControls?: BrandControls;
  siblings?: BrandBranch[]; // otras sucursales de la misma marca (para mostrar en pickup)
}

// Muestra solo hasta la primera coma de la dirección
export function shortAddr(address: string) {
  return address.split(",")[0].trim();
}

// Fuente del storefront (sans limpio, estilo Servio 1.0). Se fija localmente
// porque la app global define --font-body/--font-display solo por página, y en
// esta ruta quedarían vacíos (la regla global caería a Times/serif).
export const STORE_SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const storeFontVars: React.CSSProperties = {
  fontFamily: STORE_SANS,
  ["--font-body" as string]: STORE_SANS,
  ["--font-display" as string]: STORE_SANS,
  ["--font-category" as string]: STORE_SANS,
  ["--font-product-name" as string]: STORE_SANS,
  ["--font-product-detail" as string]: STORE_SANS,
} as React.CSSProperties;

function fbTrack(event: string, params?: Record<string, unknown>) {
  try { (window as any).fbq?.("track", event, params); } catch {}
}

// ¿El color (hex) es oscuro? Fórmula YIQ de brillo percibido.
function isDarkHex(hex?: string): boolean {
  if (!hex) return false;
  const m = hex.replace("#", "").trim();
  const s = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (s.length < 6) return false;
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

export default function StoreFront({ tenant, categories, products, basePath, brandControls, siblings }: Props) {
  const storeBase = basePath ?? `/ecommerce/${tenant.slug}`;
  const brandMode = !!brandControls;
  const hasBranch = brandControls?.hasBranch ?? false;
  const primaryColor = tenant.primaryColor;
  const categoryColor = tenant.categoryColor;
  // Si el fondo del header es oscuro, los íconos sobre él (menú) deben ir en blanco.
  const headerDark = isDarkHex(tenant.headerBgColor);
  useFavicon(tenant.faviconUrl || tenant.logoUrl);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const selectedProductRef = useRef<StoreProduct | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<CustomerMenuView>("root");
  const [menuLoginExpanded, setMenuLoginExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "favorites" | "contact" | "profile">("home");
  const openMenu = useCallback((v: CustomerMenuView) => { setMenuView(v); setMenuLoginExpanded(false); setMenuOpen(true); }, []);
  const dishOpenAtRef = useRef<number>(0);
  const dishAddedToCartRef = useRef<boolean>(false);
  const sessionStartRef = useRef<number>(Date.now());
  const dishesViewedRef = useRef<number>(0);
  const openProduct = useCallback((p: StoreProduct) => {
    selectedProductRef.current = p;
    dishOpenAtRef.current = Date.now();
    dishAddedToCartRef.current = false;
    dishesViewedRef.current += 1;
    setSelectedProduct(p);
    fbTrack("ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency: "CLP" });
    if (p.option_groups && p.option_groups.length > 0) trackModifierOpen(tenant.id, p.id, p.name);
  }, [tenant.id]);
  const [cartBump, setCartBump] = useState(false);
  // Modal de horarios: se auto-abre al entrar si la tienda está cerrada y el local
  // NO acepta pedidos programados (si los acepta, el cliente puede programar igual).
  const [hoursModalOpen, setHoursModalOpen] = useState(
    () => !brandControls?.resolving && !(brandControls && !brandControls.hasBranch) && !tenant.openStatus.open && !tenant.scheduledOrdersEnabled && !!tenant.weeklyHours
  );
  const [mounted, setMounted] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = aún sin verificar

  const headerRef = useRef<HTMLElement>(null);
  const catNavRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const lockSpyRef = useRef(false);

  // Flechas < > para desplazar las categorías cuando no caben.
  const [catScroll, setCatScroll] = useState({ left: false, right: false });
  const updateCatScroll = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) { setCatScroll({ left: false, right: false }); return; }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCatScroll({ left: el.scrollLeft > 4, right: el.scrollLeft < maxScroll - 4 });
  }, []);
  const scrollCats = (dir: 1 | -1) => {
    const el = catScrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };
  useEffect(() => {
    updateCatScroll();
    const el = catScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateCatScroll, { passive: true });
    window.addEventListener("resize", updateCatScroll);
    return () => { el.removeEventListener("scroll", updateCatScroll); window.removeEventListener("resize", updateCatScroll); };
  }, [updateCatScroll, categories.length, searchOpen]);

  const setRestaurantId = useCartStore((s) => s.setRestaurantId);
  const repriceItems = useCartStore((s) => s.repriceItems);
  const itemCount = useCartStore((s) => s.itemCount());

  useEffect(() => {
    setMounted(true);
    trackStoreView(tenant.id);
  }, [tenant.id]);

  // Scroll category tracking via IntersectionObserver.
  // Fires trackScrollCategory once per category, >50% visible for ≥2s.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.id.replace("cat-", "");
        if (entry.isIntersecting) {
          if (!timers.has(id)) {
            timers.set(id, setTimeout(() => {
              trackScrollCategory(tenant.id, id, catMap.get(id) ?? id);
              timers.delete(id);
            }, 2000));
          }
        } else {
          const t = timers.get(id);
          if (t) { clearTimeout(t); timers.delete(id); }
        }
      }
    }, { threshold: 0.5 });
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => { observer.disconnect(); timers.forEach(clearTimeout); };
  }, [tenant.id, categories]);
  // En modo marca el contenedor liga el carrito a la sucursal elegida (adoptRestaurant),
  // así que aquí NO lo hacemos (evita que setRestaurantId vacíe el carrito al cambiar
  // el catálogo representante → sucursal). En modo normal, se liga a este tenant.
  useEffect(() => { if (brandMode) return; setRestaurantId(tenant.id); repriceItems(products); }, [tenant.id, products, setRestaurantId, repriceItems, brandMode]);

  // Clic en el selector de entrega. En modo MARCA siempre abre el selector de
  // sucursal (BranchPicker): así, al escribir/cambiar la dirección, se re-evalúa
  // qué sucursal cubre esa dirección (re-pivoteo). En tienda normal abre el modal
  // de entrega de siempre.
  const openDelivery = useCallback(() => {
    if (brandMode) { brandControls!.onRequireBranch(null); return; }
    setDeliveryModalOpen(true);
  }, [brandMode, brandControls]);

  // Ir al checkout: en modo marca sin sucursal, primero se elige sucursal.
  const goCheckout = useCallback(() => {
    if (brandMode && !hasBranch) { brandControls!.onRequireBranch(null); return; }
    const cartValue = useCartStore.getState().subtotal?.() ?? 0;
    trackCartView(tenant.id, useCartStore.getState().itemCount(), cartValue);
    window.location.href = `${storeBase}/checkout`;
  }, [brandMode, hasBranch, brandControls, storeBase, tenant.id]);

  // Si se llega con ?menu=<vista> (p.ej. desde la página de seguimiento del
  // pedido), abrir el menú en esa vista y limpiar la URL para que no reabra al
  // navegar hacia atrás.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get("menu");
      if (!m) return;
      const tab = m === "favorites" ? "favorites" : m === "contact" ? "contact" : "profile";
      const view: CustomerMenuView = m === "favorites" ? "favorites" : m === "contact" ? "contact" : "root";
      setActiveTab(tab);
      openMenu(view);
      sp.delete("menu");
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    } catch { /* noop */ }
  }, [openMenu]);

  // Favorito que el usuario intentó marcar sin sesión: se aplica automáticamente
  // en cuanto inicia sesión.
  const pendingFavRef = useRef<string | null>(null);

  // Favoritos del cliente + estado de sesión (si el local tiene favoritos habilitados).
  // Los favoritos requieren cuenta iniciada (no invitado), así que verificamos /user/me.
  // Secuencial: verifica sesión → aplica favorito pendiente → recarga la lista final.
  const loadFavState = useCallback(async () => {
    if (!tenant.favoritesEnabled) return;
    let isLogged = false;
    try { const d = await fetch("/api/qr/user/me").then((r) => (r.ok ? r.json() : null)); isLogged = !!d?.user; } catch {}
    setLoggedIn(isLogged);
    const pend = pendingFavRef.current;
    if (pend && isLogged) {
      pendingFavRef.current = null;
      await fetch("/api/qr/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId: pend, restaurantId: tenant.id }) }).catch(() => {});
    }
    try {
      const f = await fetch("/api/qr/favorites").then((r) => (r.ok ? r.json() : null));
      if (Array.isArray(f?.dishIds)) setFavIds(new Set(f.dishIds));
    } catch {}
  }, [tenant.favoritesEnabled, tenant.id]);
  useEffect(() => { loadFavState(); }, [loadFavState]);

  // Pide iniciar sesión (abre el menú de cuenta con el login desplegado) y recuerda
  // el producto para marcarlo al volver con sesión.
  const promptLogin = useCallback((dishId: string) => {
    pendingFavRef.current = dishId;
    setMenuView("root");
    setMenuLoginExpanded(true);
    setActiveTab("profile");
    setMenuOpen(true);
    toast("Inicia sesión para guardar tus favoritos");
  }, []);

  const toggleFav = useCallback((dishId: string) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      const isFav = next.has(dishId);
      if (isFav) { next.delete(dishId); fetch(`/api/qr/favorites?dishId=${encodeURIComponent(dishId)}`, { method: "DELETE" }).catch(() => {}); }
      else { next.add(dishId); fetch("/api/qr/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId, restaurantId: tenant.id }) }).catch(() => {}); }
      return next;
    });
  }, [tenant.id]);

  useEffect(() => {
    function handleAdded() {
      setCartBump(true);
      setTimeout(() => setCartBump(false), 450);
      const p = selectedProductRef.current;
      if (p) {
        dishAddedToCartRef.current = true;
        fbTrack("AddToCart", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency: "CLP" });
        trackCartAdd(tenant.id, p.id, p.name, p.price);
      }
    }
    window.addEventListener("cart:item-added", handleAdded);
    return () => window.removeEventListener("cart:item-added", handleAdded);
  }, [tenant.id]);

  // Session end: fire on page unload (sendBeacon guarantees delivery)
  useEffect(() => {
    const getCartValue = () => {
      try { return useCartStore.getState().subtotal?.() ?? 0; } catch { return 0; }
    };
    const handleUnload = () => {
      trackSessionEnd(tenant.id, Date.now() - sessionStartRef.current, dishesViewedRef.current, getCartValue());
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [tenant.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [products, search]);

  // Búsqueda sin resultados: esperar 1s para evitar spam mientras el usuario escribe
  useEffect(() => {
    if (!search.trim() || filtered.length > 0) return;
    const t = setTimeout(() => trackSearch(tenant.id, search.trim()), 1000);
    return () => clearTimeout(t);
  }, [search, filtered.length, tenant.id]);

  const byCategory = useMemo(() => {
    const map = new Map<string, StoreProduct[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const p of filtered) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    return map;
  }, [filtered, categories]);

  // Siempre alinea el chip activo a la IZQUIERDA de la barra (su inicio queda a
  // la vista), nunca centrado: así la 1ª categoría no se corta y la activa se
  // lee desde el principio.
  const alignCatChip = useCallback((catId: string) => {
    const cont = catScrollRef.current;
    if (!cont) return;
    const chip = cont.querySelector<HTMLElement>(`[data-cat="${catId}"]`);
    if (!chip) return;
    // Posición del chip relativa al borde visible del contenedor (robusto sin
    // importar cuál sea el offsetParent — offsetLeft daba valores erróneos al
    // agregar los chevrons y hacía scroll de más, cortando la 1ª categoría).
    const delta = chip.getBoundingClientRect().left - cont.getBoundingClientRect().left;
    cont.scrollTo({ left: Math.max(0, cont.scrollLeft + delta - 8), behavior: "smooth" });
  }, []);

  const scrollToCategory = useCallback((catId: string) => {
    const el = document.getElementById(`cat-${catId}`);
    if (!el) return;
    const offset = (catNavRef.current?.offsetHeight ?? 56) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    setActiveCat(catId);
    alignCatChip(catId);
    lockSpyRef.current = true;
    setTimeout(() => { lockSpyRef.current = false; }, 700);
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [alignCatChip]);

  useEffect(() => {
    function onScroll() {
      if (lockSpyRef.current) return;
      const offset = (catNavRef.current?.offsetHeight ?? 56) + 16;
      let current: string | null = null;
      for (const cat of categories) {
        const el = document.getElementById(`cat-${cat.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = cat.id;
        else break;
      }
      if (!current && categories.length) current = categories[0].id;
      if (current) {
        setActiveCat((prev) => {
          if (prev !== current) alignCatChip(current!);
          return current;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [categories, alignCatChip]);

  // Status bar nativo (app Capacitor): reloj/íconos legibles sobre la franja del
  // header. En iOS el layout lo resuelve el CSS (env safe-area); en Android se usa
  // barra sólida no-superpuesta (más fiable que env en Android 15 edge-to-edge).
  // En web (sin Capacitor) no hace nada.
  useEffect(() => {
    const Cap = (window as unknown as { Capacitor?: Record<string, any> }).Capacitor;
    const SB = Cap?.Plugins?.StatusBar;
    if (!SB || !Cap?.isNativePlatform?.()) return;
    (async () => {
      try {
        // Capacitor: Style.Dark = texto/íconos CLAROS (para fondos oscuros);
        // Style.Light = texto OSCURO (para fondos claros).
        await SB.setStyle({ style: headerDark ? "DARK" : "LIGHT" });
        if (Cap.getPlatform?.() === "android") {
          if (tenant.headerBgColor) await SB.setBackgroundColor({ color: tenant.headerBgColor });
          await SB.setOverlaysWebView({ overlay: false });
        }
      } catch {}
    })();
  }, [headerDark, tenant.headerBgColor]);

  const badge = mounted ? itemCount : 0;

  return (
    <div className="qc-storefront min-h-screen bg-gray-50" style={{ ...storeFontVars, paddingTop: "env(safe-area-inset-top)" }}>
      {/* Overscroll (rubber-band) en la app: el documento pinta su fondo con el color
          del header, así al tirar hacia abajo no se ve el BLANCO detrás del status bar.
          Inline (no useEffect) para que aplique desde el primer paint, sin ventana blanca.
          El selector queda activo mientras el storefront está montado. */}
      <style dangerouslySetInnerHTML={{ __html: `html{background:${tenant.headerBgColor || "#ffffff"};overscroll-behavior-y:none}body{overscroll-behavior-y:none}` }} />
      {/* Franja que cubre el área del status bar (notch) en la app nativa iOS/Android.
          En web sin safe-area env()=0px → altura 0, invisible, sin regresión. */}
      <div aria-hidden className="fixed top-0 inset-x-0 z-[35]" style={{ height: "env(safe-area-inset-top)", background: tenant.headerBgColor || "#ffffff" }} />
      <StoreStyles />
      <Toaster position="top-center" richColors offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} />

      {/* ── Header — logo centrado, NO sticky (se scrollea) ────── */}
      <header ref={headerRef} className="shadow-sm" style={{ background: tenant.headerBgColor }}>
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-center relative">
          <div className="flex items-center">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
            ) : (
              <span className="font-black text-xl text-gray-900">{tenant.name}</span>
            )}
          </div>
          {/* Acceso a cuenta/menú — solo desktop (en móvil está el menú flotante) */}
          <button onClick={() => openMenu("root")} aria-label="Menú" className={`hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-xl transition ${headerDark ? "text-white hover:bg-white/15" : "text-gray-700 hover:bg-black/5"}`}>
            <MenuIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ── Barra de marca: elegir / cambiar sucursal (solo /ecommerce/marca) ──
          Solo desktop: en móvil la entrada única es la barra "¿Cómo quieres
          pedir?" (MobileDeliveryBar), para no duplicar el mismo botón. */}
      {brandMode && (
        <button
          onClick={() => brandControls!.onRequireBranch(null)}
          className="hidden sm:flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
          style={{ background: primaryColor }}
        >
          {hasBranch ? (
            <><Store className="w-4 h-4 shrink-0" /> Pidiendo en {brandControls!.branchLabel || "tu sucursal"} · <span className="underline">Cambiar</span></>
          ) : (
            <><MapPin className="w-4 h-4 shrink-0" /> Elige tu sucursal para pedir</>
          )}
        </button>
      )}

      {/* ── Hero: banner completo, sin recorte ni capa oscura ────── */}
      {tenant.bannerUrl && (
        <div className="w-full overflow-hidden">
          <img src={tenant.bannerUrl} alt="" className="block w-full h-auto" />
        </div>
      )}

      {/* ── Banner de tienda cerrada ─────────────────────────────── */}
      {/* Suprimido mientras resolving=true (flash) o sin sucursal elegida en marca (misleading) */}
      {!tenant.openStatus.open && !brandControls?.resolving && !(brandMode && !hasBranch) && (
        <>
          <button
            type="button"
            onClick={() => tenant.weeklyHours && setHoursModalOpen(true)}
            className={`w-full bg-gray-900 text-white text-center py-3 px-4 ${tenant.weeklyHours ? "cursor-pointer hover:bg-gray-800 transition" : "cursor-default"}`}
          >
            {tenant.openStatus.closedByClosure && tenant.openStatus.closure ? (
              <span className="text-sm font-bold inline-flex items-center gap-1.5"><Lock size={14} className="shrink-0" /> Cerrado · {tenant.openStatus.closure.reason}</span>
            ) : (
              <>
                {(() => {
                  const t = tenant.openStatus.today;
                  const branch = brandMode && tenant.branchName ? tenant.branchName : null;
                  let msg: string;
                  if (tenant.openStatus.opensAt) msg = `Abre hoy a las ${tenant.openStatus.opensAt} hrs`;
                  else if (t && t.open) msg = `Horario de hoy: ${t.from} – ${t.to === "00:00" ? "medianoche" : t.to}`;
                  else msg = "Hoy no atendemos";
                  return branch ? (
                    <span className="text-sm font-bold inline-flex items-center gap-1.5"><Lock size={14} className="shrink-0" /> Sucursal {branch} cerrada · <span className="font-normal text-gray-300">{msg}</span></span>
                  ) : (
                    <><span className="text-sm font-bold inline-flex items-center gap-1.5"><Lock size={14} className="shrink-0" /> Estamos cerrados ahora</span><span className="text-sm text-gray-300"> · {msg}</span></>
                  );
                })()}
              </>
            )}
          </button>

        </>
      )}

      {/* ── Aviso de cierre parcial (un método bloqueado, la tienda sigue abierta) ── */}
      {tenant.openStatus.open && tenant.openStatus.closure && (tenant.openStatus.closure.affectsDelivery || tenant.openStatus.closure.affectsPickup) && (
        <div className="bg-amber-50 text-amber-900 border-b border-amber-200 text-center py-2.5 px-4">
          <span className="text-sm font-semibold">
            {tenant.openStatus.closure.affectsDelivery && !tenant.openStatus.closure.affectsPickup && "Delivery no disponible"}
            {tenant.openStatus.closure.affectsPickup && !tenant.openStatus.closure.affectsDelivery && "Retiro no disponible"}
            {" · "}{tenant.openStatus.closure.reason}
          </span>
        </div>
      )}

      {/* ── Selector de entrega — solo mobile (en sm+ va en el carrito lateral) ─── */}
      <div className="sm:hidden bg-white border-b border-gray-100 px-4 py-3">
        <MobileDeliveryBar tenant={tenant} primaryColor={primaryColor} onOpen={openDelivery} />
      </div>

      {/* ── Barra de categorías — sticky al top (el header se scrollea) ── */}
      <div ref={catNavRef} className="sticky z-30 bg-white border-b border-gray-100 shadow-sm" style={{ top: "env(safe-area-inset-top)" }}>
        <div className="max-w-6xl mx-auto px-4 flex items-center">
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }}
            className="shrink-0 p-3 text-gray-400 hover:text-gray-700 transition"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
          {searchOpen ? (
            <input
              autoFocus
              type="text"
              placeholder="Buscar productos…"
              className="flex-1 py-2.5 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : (
            <div className="flex-1 flex items-center min-w-0">
              {catScroll.left && (
                <button onClick={() => scrollCats(-1)} aria-label="Anterior" className="shrink-0 p-1.5 text-gray-400 hover:text-gray-800 transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div ref={catScrollRef} className="no-scrollbar flex overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    data-cat={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`shrink-0 px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap ${activeCat === cat.id ? "border-current" : "border-transparent text-gray-400 hover:text-gray-800"}`}
                    style={activeCat === cat.id ? { color: categoryColor, borderColor: categoryColor } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              {catScroll.right && (
                <button onClick={() => scrollCats(1)} aria-label="Siguiente" className="shrink-0 p-1.5 text-gray-400 hover:text-gray-800 transition">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido principal ─────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-6">
        <div className="flex gap-6 items-start">
          {/* Columna productos */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            {categories.map((cat) => {
              const catProducts = byCategory.get(cat.id) ?? [];
              if (!catProducts.length) return null;
              return (
                <section key={cat.id} id={`cat-${cat.id}`}>
                  <h2 className="text-base font-black uppercase tracking-widest mb-3" style={{ color: categoryColor }}>{cat.name}</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {catProducts.map((p) => (
                      <ProductCard key={p.id} product={p} primaryColor={primaryColor} onClick={() => openProduct(p)} showFav={tenant.favoritesEnabled && loggedIn === true} isFav={favIds.has(p.id)} onToggleFav={() => toggleFav(p.id)} favNeedsLogin={loggedIn === false} onRequireLogin={promptLogin} />
                    ))}
                  </div>
                </section>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Search className="mx-auto mb-2 text-gray-300" size={40} strokeWidth={1.5} />
                <p className="text-sm">No encontramos productos para tu búsqueda</p>
              </div>
            )}
          </div>

          {/* Carrito lateral — sm+ (tablets y pantalla interna del iPhone Duo). En el
              rango del iPhone Duo ocupa la mitad (alineado al pliegue); desde lg
              vuelve a ancho fijo para que no quede muy ancho en escritorio. */}
          <div className="hidden sm:block w-1/2 lg:w-80 shrink-0 sticky top-[72px]">
            <CartPanel
              tenant={tenant}
              primaryColor={primaryColor}
              cartBump={cartBump}
              mounted={mounted}
              storeBase={storeBase}
              onOpenDeliveryModal={openDelivery}
              onCheckout={goCheckout}
            />
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      {/* pb extra en móvil para que el texto quede por encima del menú flotante */}
      <footer className="border-t border-gray-100 bg-white pt-12 pb-32 sm:pt-14 sm:pb-14">
        <p className="text-center text-xs text-gray-400">powered by QuieroComer · 2026</p>
      </footer>

      {/* Modal producto */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          primaryColor={primaryColor}
          onClose={() => {
            const p = selectedProductRef.current;
            if (p) {
              const dwellMs = Date.now() - dishOpenAtRef.current;
              trackDishView(tenant.id, p.id, p.name, dwellMs > 500 ? dwellMs : undefined, dishAddedToCartRef.current);
            }
            setSelectedProduct(null);
          }}
          scrollImage
          intercept={brandMode && !hasBranch}
          onIntercept={() => { const p = selectedProduct; setSelectedProduct(null); brandControls!.onRequireBranch(p); }}
        />
      )}

      {/* Modal delivery/retiro */}
      {deliveryModalOpen && (
        <DeliveryModal tenant={tenant} primaryColor={primaryColor} onClose={() => setDeliveryModalOpen(false)} siblings={siblings} />
      )}

      {menuOpen && (
        <CustomerMenu tenant={tenant} primaryColor={primaryColor} onClose={() => { setMenuOpen(false); setActiveTab("home"); setMenuLoginExpanded(false); loadFavState(); }} products={products} initialView={menuView} initialLoginExpanded={menuLoginExpanded} variant="sheet" />
      )}

      {/* ── Menú flotante inferior — solo móvil ──────────────────── */}
      {/* 5 iconos planos e iguales (estilo Instagram), con nuestro color en el
          activo. El carrito es uno más de la fila y lleva su badge de cantidad. */}
      <nav className="sm:hidden fixed inset-x-4 z-40 flex justify-center pointer-events-none" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="pointer-events-auto relative flex items-center justify-around w-full max-w-md mx-auto bg-white/95 backdrop-blur rounded-full shadow-[0_10px_34px_rgba(0,0,0,0.20)] border border-gray-100 px-2 h-16">
          <FabBtn label="Inicio" color={primaryColor} active={activeTab === "home"} onClick={() => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Home className="w-6 h-6" /></FabBtn>
          <FabBtn label="Favoritos" color={primaryColor} active={activeTab === "favorites"} onClick={() => { if (loggedIn === false) { promptLogin(""); return; } setActiveTab("favorites"); openMenu("favorites"); }}><Heart className="w-6 h-6" /></FabBtn>
          {/* Carrito — plano como el resto; conserva el badge y la animación cart-bump. */}
          <FabBtn label="Ver carrito" color={primaryColor} onClick={goCheckout}>
            <span className={`relative inline-flex ${cartBump ? "cart-bump" : ""}`}>
              <ShoppingCart className="w-6 h-6" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow" style={{ background: primaryColor }}>{badge}</span>
              )}
            </span>
          </FabBtn>
          <FabBtn label="Contacto" color={primaryColor} active={activeTab === "contact"} onClick={() => { setActiveTab("contact"); openMenu("contact"); }}><MessageCircle className="w-6 h-6" /></FabBtn>
          <FabBtn label="Perfil" color={primaryColor} active={activeTab === "profile"} onClick={() => { setActiveTab("profile"); openMenu("root"); }}><User className="w-6 h-6" /></FabBtn>
        </div>
      </nav>

      {/* ── Modal de horarios (tienda cerrada) ───────────────────── */}
      {hoursModalOpen && tenant.weeklyHours && (
        <HoursModal
          weeklyHours={tenant.weeklyHours}
          primaryColor={primaryColor}
          branchName={brandMode ? (tenant.branchName ?? null) : null}
          onClose={() => setHoursModalOpen(false)}
        />
      )}

    </div>
  );
}

// ── Modal de horarios de atención (se muestra cuando la tienda está cerrada) ──
// Estilo referencia: ícono de reloj, título, lista Lun→Dom con rango horario.
function HoursModal({ weeklyHours, primaryColor, branchName, onClose }: { weeklyHours: import("@/lib/ecommerce/hours").DayHours[]; primaryColor: string; branchName?: string | null; onClose: () => void }) {
  // weeklyHours viene indexado 0=Dom … 6=Sáb. Se muestra Lun→Dom (como la referencia).
  const DISPLAY = [1, 2, 3, 4, 5, 6, 0];
  const LABELS: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };
  // Día de hoy en Chile para resaltar su fila.
  const today = (() => { try { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay(); } catch { return -1; } })();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 transition">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${primaryColor}1a` }}>
            <Clock className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-xl font-black text-gray-900 leading-tight">Estamos cerrados<br />momentáneamente</h2>
          {branchName && <p className="text-sm font-semibold text-gray-500 mt-1">Sucursal {branchName}</p>}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">Nuestros horarios de atención son:</p>
        </div>
        <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden mb-5">
          {DISPLAY.map((idx) => {
            const d = weeklyHours[idx];
            const isToday = idx === today;
            return (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 ${isToday ? "bg-gray-50" : ""}`}>
                <span className={`text-sm ${isToday ? "font-black text-gray-900" : "font-semibold text-gray-700"}`}>{LABELS[idx]}</span>
                {d?.open ? (
                  <span className={`text-sm ${isToday ? "font-black" : "font-semibold"}`} style={{ color: isToday ? primaryColor : "#374151" }}>
                    {d.from} - {d.to === "00:00" ? "Medianoche" : d.to}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-rose-500">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full py-3.5 rounded-2xl border border-gray-200 text-gray-800 font-bold hover:bg-gray-50 transition">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Botón del menú flotante (móvil) — solo icono, estilo referencia ──
// Cuando está activo se pinta con el color de la tienda (los iconos lucide usan
// currentColor, así que basta con fijar el color del texto del botón).
function FabBtn({ children, label, onClick, active, color }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; color: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`w-11 h-11 flex items-center justify-center rounded-full transition active:scale-90 ${active ? "" : "text-gray-400 hover:text-gray-700"}`}
      style={active ? { color } : undefined}
    >
      {children}
    </button>
  );
}

// ── Barra mobile de selección de entrega ────────────────────────
function MobileDeliveryBar({ tenant, primaryColor, onOpen }: { tenant: StoreTenant; primaryColor: string; onOpen: () => void }) {
  const { deliveryType, deliveryAddress, deliverySelected } = useCartStore();
  const estimatedTime = deliverySelected ? ((deliveryType === "delivery" ? tenant.waitTimeDelivery : tenant.waitTimePickup) || tenant.waitTime || "") : "";

  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={onOpen} className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition">
        {!deliverySelected ? (
          <>
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-500">¿Cómo quieres pedir?</span>
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          </>
        ) : deliveryType === "delivery" && deliveryAddress ? (
          <>
            <MapPin className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold text-gray-700 truncate max-w-[220px]">{shortAddr(deliveryAddress.address)}</span>
            <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </>
        ) : (
          <>
            <Store className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold text-gray-700 truncate">{tenant.branchName ? `Retiro · ${tenant.branchName}` : "Retiro en tienda"}</span>
            <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </>
        )}
      </button>
      {deliverySelected && estimatedTime && (
        <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
          <Clock className="w-3.5 h-3.5 shrink-0" /> Tiempo estimado: <span className="font-bold" style={{ color: primaryColor }}>{estimatedTime} min</span>
        </p>
      )}
    </div>
  );
}

// ── Tarjeta de producto ──────────────────────────────────────────
// Estilo referencia: miniatura a la izquierda, nombre + descripción + precio
// apilados, y un botón + a la derecha (abre el producto). Sin estrellas.
function ProductCard({ product, primaryColor, onClick, showFav, isFav, onToggleFav, favNeedsLogin, onRequireLogin }: { product: StoreProduct; primaryColor: string; onClick: () => void; showFav?: boolean; isFav?: boolean; onToggleFav?: () => void; favNeedsLogin?: boolean; onRequireLogin?: (dishId: string) => void }) {
  const soldOut = product.is_sold_out;
  const [heartPop, setHeartPop] = useState(false);
  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Sin sesión iniciada: pedir login antes de favoritear (no togglea ni anima).
    if (favNeedsLogin) { onRequireLogin?.(product.id); return; }
    const willFav = !isFav;
    onToggleFav?.();
    if (willFav) { setHeartPop(true); setTimeout(() => setHeartPop(false), 340); }
  };
  return (
    <div className={`relative bg-white rounded-2xl shadow-sm p-2.5 flex items-center gap-3 transition-shadow ${soldOut ? "opacity-60" : "hover:shadow-md"}`}>
      {/* Favorito — esquina superior derecha de la tarjeta */}
      {showFav && (
        <button
          onClick={handleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          className="absolute top-1.5 right-1.5 z-10 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 transition"
        >
          <Heart className={`w-5 h-5 ${heartPop ? "qc-heart-pop" : ""}`} fill={isFav ? primaryColor : "none"} color={isFav ? primaryColor : "#cbd5e1"} />
        </button>
      )}
      {/* Miniatura — SIEMPRE cuadrada (se recorta con object-cover, sin importar la imagen). */}
      <button onClick={soldOut ? undefined : onClick} disabled={soldOut} aria-label={product.name} className="relative w-28 sm:w-32 aspect-square rounded-xl overflow-hidden shrink-0 self-center bg-gray-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed size={28} className="text-gray-300" strokeWidth={1.5} /></div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-white/55 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-900/80 text-white">Agotado</span>
          </div>
        )}
        {!soldOut && product.daily_badge && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: 80, height: 80 }}>
            <div style={{ position: 'absolute', top: 17, left: -18, width: 96, textAlign: 'center', background: 'linear-gradient(90deg,#f97316,#ef4444)', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 0', transform: 'rotate(-45deg)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
              Solo hoy
            </div>
          </div>
        )}
        {!soldOut && !product.daily_badge && product.new_badge && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: 80, height: 80 }}>
            <div style={{ position: 'absolute', top: 17, left: -18, width: 96, textAlign: 'center', background: 'linear-gradient(90deg,#f59e0b,#d97706)', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 0', transform: 'rotate(-45deg)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
              Nuevo
            </div>
          </div>
        )}
      </button>

      {/* Texto (nombre · descripción · precio) */}
      <button onClick={soldOut ? undefined : onClick} disabled={soldOut} className="flex-1 min-w-0 flex flex-col justify-center text-left">
        <p className="font-bold text-gray-900 text-base leading-snug">{product.name}</p>
        {product.description && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-black text-base" style={{ color: primaryColor }}>{clp(product.price)}</span>
          {product.original_price ? (
            <span className="text-sm text-gray-400 line-through">{clp(product.original_price)}</span>
          ) : null}
        </div>
      </button>

      {/* Columna derecha: reserva el espacio del corazón (arriba) y el botón
          agregar abajo. Se muestra si hay favorito o botón agregar. */}
      {(showFav || !soldOut) && (
        <div className="self-stretch flex flex-col items-end justify-end shrink-0 w-9">
          {!soldOut && (
            <button
              onClick={onClick}
              aria-label={`Agregar ${product.name}`}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm hover:opacity-90 transition active:scale-90"
              style={{ background: primaryColor }}
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel carrito (desktop) ──────────────────────────────────────
function CartPanel({ tenant, primaryColor, cartBump, mounted, onOpenDeliveryModal, storeBase, onCheckout }: {
  tenant: StoreTenant; primaryColor: string; cartBump: boolean; mounted: boolean; onOpenDeliveryModal: () => void; storeBase: string; onCheckout?: () => void;
}) {
  const { items, deliveryType, deliveryAddress, deliverySelected, updateQty } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());
  const deliveryFee = deliveryType === "delivery" ? deliveryAddress?.fee ?? 0 : 0;
  const estimatedTime = deliverySelected ? ((deliveryType === "delivery" ? tenant.waitTimeDelivery : tenant.waitTimePickup) || tenant.waitTime || "") : "";
  const showItems = mounted && items.length > 0;
  const minPerType = deliveryType === "delivery" ? (deliveryAddress?.minOrder ?? tenant.minOrderDelivery) : tenant.minOrderPickup;
  const minReq = minPerType && minPerType > 0 ? minPerType : null;
  const belowMin = minReq != null && subtotal < minReq;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Selector de tipo de entrega */}
      <div>
        <button onClick={onOpenDeliveryModal} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition group text-left">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition">
            {deliverySelected && deliveryType === "delivery" ? <MapPin className="w-4 h-4 text-gray-500" /> : deliverySelected && deliveryType === "pickup" ? <Store className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            {!deliverySelected ? (
              <p className="text-sm font-semibold text-gray-500">¿Cómo quieres pedir?</p>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1"><Motorbike size={13} className="shrink-0" /> Delivery</p>
                <p className="text-xs text-gray-500 truncate">{shortAddr(deliveryAddress.address)}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1"><Store size={13} className="shrink-0" /> {tenant.branchName ? `Retiro · ${tenant.branchName}` : "Retiro en tienda"}</p>
                {tenant.address && <p className="text-xs text-gray-400 truncate">{tenant.address}</p>}
              </>
            )}
          </div>
          {deliverySelected && <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        </button>
        {deliverySelected && estimatedTime && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5 shrink-0" /> Tiempo estimado: <span className="font-bold" style={{ color: primaryColor }}>{estimatedTime} min</span></p>
          </div>
        )}
      </div>

      {/* Título */}
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className={`font-black text-base text-gray-900 inline-block ${cartBump ? "cart-bump" : ""}`}>Tu Carrito</h2>
      </div>

      {!showItems ? (
        <div className="px-5 py-10 text-center">
          <ShoppingCart className="mx-auto mb-3 text-gray-300" size={40} strokeWidth={1.5} />
          <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
          <p className="text-xs mt-1 text-gray-300">Los productos que agregues aparecerán aquí</p>
        </div>
      ) : (
        <>
          <div className="p-4 flex flex-col gap-3 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.product_id}-${item.options.map((o) => o.value_id).join(",")}`} className="flex gap-2 items-center">
                {item.image_url ? (
                  <img src={item.image_url} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><UtensilsCrossed size={18} className="text-gray-400" strokeWidth={1.5} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs font-black mt-0.5" style={{ color: primaryColor }}>{clp(item.unit_price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.product_id, item.options, -1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.options, 1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{clp(subtotal)}</span></div>
            {deliveryType === "delivery" && (
              <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{deliveryAddress ? clp(deliveryFee) : "—"}</span></div>
            )}
            <div className="flex justify-between font-black text-base text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span style={{ color: primaryColor }}>{clp(total)}</span></div>
            {!tenant.openStatus.open && !tenant.scheduledOrdersEnabled ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs flex items-center justify-center gap-1.5"><Lock size={13} className="shrink-0" /> Cerrado por ahora</div>
            ) : !deliverySelected ? (
              <button onClick={onOpenDeliveryModal} className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
                {tenant.pickupEnabled && tenant.deliveryEnabled ? "Elige cómo recibir tu pedido" : tenant.deliveryEnabled ? "Ingresa tu dirección de entrega" : "Confirmar retiro"} →
              </button>
            ) : belowMin ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs text-center">Monto mínimo: {clp(minReq!)}</div>
            ) : (
              <button onClick={() => (onCheckout ? onCheckout() : (window.location.href = `${storeBase}/checkout`))} className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
                Continuar con mi pedido →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Mini-mapa con la ubicación del cliente (pin arrastrable) ────
function AddressMiniMap({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps || !ref.current) return;
    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(ref.current, {
        center: { lat, lng }, zoom: 16, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy",
      });
      markerRef.current = new g.maps.Marker({ position: { lat, lng }, map: mapRef.current, draggable: true });
      markerRef.current.addListener("dragend", (e: any) => {
        const p = e.latLng; if (p) onMoveRef.current(p.lat(), p.lng());
      });
    } else {
      mapRef.current.setCenter({ lat, lng });
      markerRef.current?.setPosition({ lat, lng });
    }
  }, [lat, lng]);

  return <div ref={ref} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 170 }} />;
}

// ── Modal selección de entrega (retiro / delivery) ──────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DeliveryModal({ tenant, primaryColor, onClose, siblings }: { tenant: StoreTenant; primaryColor: string; onClose: () => void; siblings?: BrandBranch[] }) {
  const { closing, requestClose } = useCloseAnimation(onClose);
  const { deliveryType, deliveryAddress, confirmPickup, setDeliveryAddress } = useCartStore();
  const zones = tenant.deliveryZones;
  const distanceMode = tenant.deliveryConfig.mode === "distance";
  const uberMode = tenant.deliveryConfig.mode === "uber";
  const mapMode = distanceMode || uberMode; // ambos usan dirección en el mapa
  const [tab, setTab] = useState<"pickup" | "delivery">(
    !tenant.pickupEnabled ? "delivery" : !tenant.deliveryEnabled ? "pickup" : deliveryType,
  );
  const [details, setDetails] = useState(deliveryAddress?.details ?? "");

  // Modo comuna
  const [address, setAddress] = useState(deliveryAddress?.address ?? "");
  const [zoneId, setZoneId] = useState(() => zones.find((z) => z.name === deliveryAddress?.zoneName)?.id ?? (zones.length === 1 ? zones[0].id : ""));
  const selectedZone = zones.find((z) => z.id === zoneId) ?? null;

  // Modo distancia (Google Maps autocomplete)
  const gmapsReady = useGoogleMaps(mapMode ? tenant.googleMapsKey : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; address: string; parts?: AddressParts; hasNumber?: boolean } | null>(null);
  const [feeResult, setFeeResult] = useState<DistanceFeeResult | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Calcula el costo para un destino: por distancia (local) o cotizando a Uber
  // Direct en vivo (modo "uber"), vía el endpoint del servidor.
  const computeFeeFor = useCallback(async (d: { lat: number; lng: number; address: string }) => {
    if (!uberMode) { setFeeResult(computeDistanceFee(tenant.deliveryConfig, d)); return; }
    setFeeLoading(true); setFeeResult(null);
    try {
      const r = await fetch("/api/ecommerce/delivery/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: tenant.id, address: d.address, lat: d.lat, lng: d.lng }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setFeeResult({ available: true, fee: j.fee, distanceKm: 0 });
      else setFeeResult({ available: false, fee: 0, distanceKm: 0, reason: j.error || "No se pudo cotizar el despacho a esa dirección" });
    } catch { setFeeResult({ available: false, fee: 0, distanceKm: 0, reason: "No se pudo cotizar el despacho" }); }
    setFeeLoading(false);
  }, [uberMode, tenant.deliveryConfig, tenant.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Usa la ubicación del dispositivo para pre-rellenar la dirección vía reverse geocoding.
  const handleGeolocate = useCallback(async () => {
    if (!tenant.googleMapsKey || !navigator.geolocation) return;
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${tenant.googleMapsKey}&language=es&region=cl`);
          const j = await r.json();
          const result = j.results?.[0];
          if (!result) { setGeoError("No se pudo obtener tu dirección."); setGeoLoading(false); return; }
          const components: { types: string[]; long_name: string; short_name: string }[] = result.address_components ?? [];
          const hasNumber = components.some((c) => c.types.includes("street_number"));
          const cleanAddr = formatPlaceAddress({ address_components: components, formatted_address: result.formatted_address }, result.formatted_address);
          const parts = placeAddressParts({ address_components: components }, result.formatted_address);
          const d = { lat, lng, address: cleanAddr, parts, hasNumber };
          setDest(d);
          if (inputRef.current) inputRef.current.value = cleanAddr;
          computeFeeFor(d);
        } catch { setGeoError("Error al obtener tu dirección."); }
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? "Permiso de ubicación denegado." : "No se pudo obtener tu ubicación.");
        setGeoLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [tenant.googleMapsKey, computeFeeFor]);

  // Adjunta el autocompletado cuando el SDK está listo y estamos en delivery+distancia.
  useEffect(() => {
    if (!mapMode || tab !== "delivery" || !gmapsReady || !inputRef.current) return;
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["cl"] },
      types: ["address"],
      fields: ["formatted_address", "address_components", "geometry"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) return;
      // Dirección armada desde los componentes (calle número, comuna, ciudad, región, país)
      // con comas; quita el código postal chileno de 7 dígitos.
      const cleanAddr = formatPlaceAddress(place, inputRef.current!.value);
      // ¿La dirección elegida trae numeración de calle? (componente street_number).
      // Sin número no se permite continuar: una calle sin numeración no es válida.
      const hasNumber = Array.isArray(place?.address_components) && place.address_components.some((c: { types?: string[] }) => c.types?.includes("street_number"));
      const d = { lat: loc.lat(), lng: loc.lng(), address: cleanAddr, parts: placeAddressParts(place, inputRef.current!.value), hasNumber };
      setDest(d);
      computeFeeFor(d);
    });
    inputRef.current.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    return () => { g.maps.event?.removeListener?.(listener); };
  }, [mapMode, tab, gmapsReady, computeFeeFor]);

  // En modo comuna la dirección es texto libre: exigimos al menos un dígito (numeración).
  const zoneAddrHasNumber = /\d/.test(address);
  const deliveryReady = mapMode
    ? !!(feeResult?.available && dest && dest.hasNumber)
    : (!!selectedZone && !!address.trim() && zoneAddrHasNumber);

  // Al arrastrar el pin en el mapa: actualiza la ubicación y recalcula el despacho.
  function onMapMove(lat: number, lng: number) {
    setDest((d) => { const next = d ? { ...d, lat, lng } : { lat, lng, address: "" }; computeFeeFor(next); return next; });
  }

  function confirm() {
    if (tab === "pickup") { confirmPickup(); requestClose(); return; }
    if (mapMode) {
      if (!feeResult?.available || !dest || !dest.hasNumber) return;
      setDeliveryAddress({ address: dest.address, details: details.trim(), lat: dest.lat, lng: dest.lng, fee: feeResult.fee, zoneName: null, minOrder: null, parts: dest.parts ?? null });
      requestClose();
      return;
    }
    if (!selectedZone || !address.trim() || !/\d/.test(address)) return;
    setDeliveryAddress({ address: `${address.trim()}, ${selectedZone.name}`, details: details.trim(), lat: null, lng: null, fee: selectedZone.fee, zoneName: selectedZone.name, minOrder: selectedZone.minOrder ?? null, parts: { street: address.trim(), comuna: selectedZone.name, city: "", region: "", country: "Chile" } });
    requestClose();
  }

  const noZones = !mapMode && zones.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 bg-black/50 ${closing ? "qc-fade-out" : "qc-fade-in"}`} onClick={requestClose} />
      <div className={`relative bg-white w-full rounded-3xl max-w-md shadow-2xl flex flex-col max-h-[90dvh] overflow-y-auto ${closing ? "qc-modal-out" : "qc-modal-in"}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
          <h2 className="font-black text-lg text-gray-900">¿Cómo quieres tu pedido?</h2>
          <button onClick={requestClose} className="qc-glass-x w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 transition active:scale-90"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4">
          {tenant.pickupEnabled && (
            <button onClick={() => setTab("pickup")} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition flex items-center justify-center gap-2 ${tab === "pickup" ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`} style={tab === "pickup" ? { background: primaryColor } : {}}>
              <Store className="w-4 h-4" /> Retiro
            </button>
          )}
          {tenant.deliveryEnabled && (
            <button onClick={() => setTab("delivery")} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition flex items-center justify-center gap-2 ${tab === "delivery" ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`} style={tab === "delivery" ? { background: primaryColor } : {}}>
              <MapPin className="w-4 h-4" /> Delivery
            </button>
          )}
        </div>

        <div className="px-4 pb-4 flex flex-col gap-3">
          {tab === "pickup" ? (
            (() => {
              // Todas las sucursales pickup-enabled: la actual + las siblings (misma marca)
              const allBranches: Array<{ id: string; name: string; branchName: string | null; address: string | null; lat: number | null; lng: number | null; isCurrent: boolean; open: boolean; opensAt: string | null }> = [
                { id: tenant.id, name: tenant.name, branchName: tenant.branchName, address: tenant.address, lat: null, lng: null, isCurrent: true, open: tenant.openStatus.open, opensAt: tenant.openStatus.opensAt },
                ...(siblings ?? []).filter((s) => s.pickupEnabled).map((s) => ({ id: s.id, name: s.name, branchName: s.branchName, address: s.address, lat: s.lat, lng: s.lng, isCurrent: false, open: s.open, opensAt: s.opensAt })),
              ].sort((a, b) => {
                if (a.open !== b.open) return a.open ? -1 : 1;
                return (a.branchName || a.name).localeCompare(b.branchName || b.name);
              });
              const refLat = dest?.lat ?? null;
              const refLng = dest?.lng ?? null;
              return (
                <div className="flex flex-col gap-2">
                  {allBranches.map((b) => {
                    const distKm = refLat != null && refLng != null && b.lat != null && b.lng != null
                      ? haversineKm(refLat, refLng, b.lat, b.lng)
                      : null;
                    return (
                      <div key={b.id} className={`rounded-xl border p-4 ${b.open ? "bg-gray-50 border-gray-100" : "bg-gray-50/60 border-gray-100 opacity-75"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-700">{b.branchName ? `${b.name} — ${b.branchName}` : b.name}</p>
                            {b.address ? <p className="text-sm text-gray-500 mt-0.5">{b.address}</p> : <p className="text-sm text-gray-400 mt-0.5">Dirección disponible al confirmar.</p>}
                            {!b.open && (
                              <p className="text-xs font-semibold mt-1" style={{ color: b.opensAt ? "#d97706" : "#9ca3af" }}>
                                {b.opensAt ? `Abre hoy a las ${b.opensAt}` : "Cerrado por hoy"}
                              </p>
                            )}
                          </div>
                          {distKm != null && (
                            <span className="text-xs font-bold whitespace-nowrap mt-0.5 shrink-0" style={{ color: primaryColor }}>
                              {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                            </span>
                          )}
                        </div>
                        {b.isCurrent && allBranches.length === 1 && (
                          <p className="text-xs text-gray-400 mt-1">Retiras en tienda.</p>
                        )}
                      </div>
                    );
                  })}
                  {refLat == null && allBranches.length > 1 && (
                    <p className="text-xs text-gray-400 px-1">Ingresa tu dirección en delivery para ver la distancia a cada sucursal.</p>
                  )}
                </div>
              );
            })()
          ) : mapMode ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dirección de entrega</span>
                <input ref={inputRef} defaultValue={deliveryAddress?.address ?? ""} placeholder={gmapsReady ? "Escribe tu dirección…" : "Cargando mapa…"} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                {dest && !dest.hasNumber && <span className="text-[11px] text-red-500 font-semibold">Falta la numeración: elige la dirección con su número de calle.</span>}
              </label>
              {tenant.googleMapsKey && (
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="flex items-center gap-2 text-sm font-semibold transition disabled:opacity-50 self-start -mt-1"
                  style={{ color: primaryColor }}
                >
                  {geoLoading ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2z" strokeDasharray="2 4" strokeDashoffset="2"/></svg>
                  )}
                  {geoLoading ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
                </button>
              )}
              {geoError && <span className="text-[11px] text-red-500 font-semibold -mt-1">{geoError}</span>}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Depto / casa / referencia</span>
                <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Opcional" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </label>
              {dest && (
                <>
                  <AddressMiniMap lat={dest.lat} lng={dest.lng} onMove={onMapMove} />
                  <p className="text-[11px] text-gray-400 px-1 -mt-1">Arrastra el pin para ajustar tu ubicación exacta.</p>
                </>
              )}
              {!tenant.googleMapsKey && <p className="text-xs text-red-500 px-1">El local aún no configuró Google Maps.</p>}
              {feeLoading && <p className="text-xs text-gray-400 px-1">Cotizando despacho…</p>}
              {feeResult && !feeResult.available && <p className="text-xs text-red-500 px-1">{feeResult.reason}</p>}
              {feeResult?.available && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-gray-500">Costo de despacho</span>
                  <span className="font-black" style={{ color: primaryColor }}>{feeResult.fee > 0 ? clp(feeResult.fee) : "Gratis"}</span>
                </div>
              )}
            </>
          ) : noZones ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-500">
              Este local aún no configuró zonas de delivery. Elige <span className="font-bold">Retiro</span> o vuelve más tarde.
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comuna / sector</span>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white">
                  <option value="">Elige tu comuna…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name} · {clp(z.fee)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dirección</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle y número" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                {address.trim() && !zoneAddrHasNumber && <span className="text-[11px] text-red-500 font-semibold">Agrega la numeración de la calle para continuar.</span>}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Depto / casa / referencia</span>
                <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Opcional" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </label>
              {selectedZone && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-gray-500">Costo de despacho{selectedZone.estimatedTime ? ` · ${selectedZone.estimatedTime}` : ""}</span>
                  <span className="font-black" style={{ color: primaryColor }}>{selectedZone.fee > 0 ? clp(selectedZone.fee) : "Gratis"}</span>
                </div>
              )}
              {selectedZone?.minOrder ? (
                <p className="text-xs text-gray-400 px-1 -mt-1">Pedido mínimo en {selectedZone.name}: {clp(selectedZone.minOrder)}</p>
              ) : null}
            </>
          )}

          <button onClick={confirm} disabled={tab === "delivery" && !deliveryReady} className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90 disabled:opacity-40" style={{ background: primaryColor }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
