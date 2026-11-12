"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, X, MapPin, Store, ChevronDown, ChevronLeft, ChevronRight, Pencil, Menu as MenuIcon, Heart, User, Clock, Motorbike, Lock, UtensilsCrossed } from "lucide-react";
import CustomerMenu, { type CustomerMenuView } from "./CustomerMenu";
import type { StoreTenant, StoreCategory, StoreProduct, BrandBranch } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp, slugify } from "@/lib/ecommerce/format";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import ProductModal from "./ProductModal";
import StoreStyles from "./StoreStyles";
import { trackStoreView, trackDishView, trackCartAdd, trackCartView, trackSessionEnd, trackScrollCategory, trackSearch, trackModifierOpen } from "@/lib/ecommerce/storeAnalytics";
import { type BrandControls, shortAddr, DeliveryModal } from "./StoreFront";

const MODERN_SANS = "'DM Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const modernFontVars: React.CSSProperties = {
  fontFamily: MODERN_SANS,
  ["--font-body" as string]: MODERN_SANS,
  ["--font-display" as string]: MODERN_SANS,
  ["--font-category" as string]: MODERN_SANS,
  ["--font-product-name" as string]: MODERN_SANS,
  ["--font-product-detail" as string]: MODERN_SANS,
} as React.CSSProperties;

interface Props {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
  basePath?: string;
  brandControls?: BrandControls;
  siblings?: BrandBranch[];
  initialProductSlug?: string;
}

function fbTrack(event: string, params?: Record<string, unknown>) {
  try { (window as any).fbq?.("track", event, params); } catch {}
}

function isDarkHex(hex?: string): boolean {
  if (!hex) return false;
  const m = hex.replace("#", "").trim();
  const s = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (s.length < 6) return false;
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}


export default function ModernStoreFront({ tenant, categories, products, basePath, brandControls, siblings, initialProductSlug }: Props) {
  const storeBase = basePath ?? `/ecommerce/${tenant.slug}`;
  const communeSlug = tenant.commune ? slugify(tenant.commune) : "";
  const brandMode = !!brandControls;
  const hasBranch = brandControls?.hasBranch ?? false;
  const primaryColor = tenant.primaryColor;
  const categoryColor = tenant.categoryColor;
  const headerDark = isDarkHex(tenant.headerBgColor);
  useFavicon(tenant.faviconUrl || tenant.logoUrl);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"carta" | "locales">(() => {
    try { return window.location.pathname.endsWith("/locales") ? "locales" : "carta"; } catch { return "carta"; }
  });
  // Sync URL with view
  useEffect(() => {
    try {
      const base = storeBase || window.location.pathname.replace(/\/locales$/, "");
      const target = activeView === "locales" ? `${base}/locales` : base;
      if (window.location.pathname !== target) window.history.pushState(null, "", target);
    } catch {}
  }, [activeView, storeBase]);
  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => { setActiveView(window.location.pathname.endsWith("/locales") ? "locales" : "carta"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const selectedProductRef = useRef<StoreProduct | null>(null);
  const viewedCatIdsRef = useRef<Set<string>>(new Set());
  const [viewedProductIds, setViewedProductIds] = useState<Set<string>>(new Set());

  // Load viewed products from localStorage on mount
  const VIEWED_KEY = `qc-viewed:${tenant.id}`;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEWED_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        if (Array.isArray(ids)) {
          setViewedProductIds(new Set(ids.slice(-50))); // keep last 50
          ids.forEach(id => {
            const p = products.find(x => x.id === id);
            if (p) viewedCatIdsRef.current.add(p.category_id);
          });
        }
      }
    } catch {}
  }, [tenant.id, VIEWED_KEY, products]);

  // Save viewed product to localStorage
  const trackViewed = useCallback((productId: string, categoryId: string) => {
    setViewedProductIds(prev => {
      const next = new Set(prev);
      next.add(productId);
      try { localStorage.setItem(VIEWED_KEY, JSON.stringify([...next].slice(-50))); } catch {}
      return next;
    });
    viewedCatIdsRef.current.add(categoryId);
  }, [VIEWED_KEY]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<CustomerMenuView>("root");
  const [menuLoginExpanded, setMenuLoginExpanded] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const openMenu = useCallback((v: CustomerMenuView) => { setMenuView(v); setMenuLoginExpanded(false); setMenuOpen(true); }, []);
  const dishOpenAtRef = useRef<number>(0);
  const dishAddedToCartRef = useRef<boolean>(false);
  const sessionStartRef = useRef<number>(Date.now());
  const dishesViewedRef = useRef<number>(0);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Hamburger drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeDrawer = useCallback(() => {
    setDrawerClosing(true);
    setTimeout(() => { setDrawerOpen(false); setDrawerClosing(false); }, 150);
  }, []);

  // Header scroll blur
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    function onScroll() { setHeaderScrolled(window.scrollY > 10); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openProduct = useCallback((p: StoreProduct) => {
    selectedProductRef.current = p;
    dishOpenAtRef.current = Date.now();
    dishAddedToCartRef.current = false;
    dishesViewedRef.current += 1;
    viewedCatIdsRef.current.add(p.category_id);
    trackViewed(p.id, p.category_id);
    setSelectedProduct(p);
    try {
      const catSlug = slugify(catById.get(p.category_id) ?? "");
      const productSlug = slugify(p.name);
      const segments = [communeSlug, catSlug, productSlug].filter(Boolean);
      window.history.replaceState(null, "", `${storeBase}/${segments.join("/")}`);
    } catch { /* noop */ }
    fbTrack("ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency: "CLP" });
    if (p.option_groups && p.option_groups.length > 0) trackModifierOpen(tenant.id, p.id, p.name);
  }, [tenant.id, catById, communeSlug, storeBase]);

  const [cartBump, setCartBump] = useState(false);
  const [hoursModalOpen, setHoursModalOpen] = useState(
    () => !brandControls?.resolving && !(brandControls && !brandControls.hasBranch) && !tenant.openStatus.open && !tenant.scheduledOrdersEnabled && !!tenant.weeklyHours
  );
  const [mounted, setMounted] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const catNavRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const lockSpyRef = useRef(false);

  // Category scroll arrows
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

  // Scroll category tracking via IntersectionObserver
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

  useEffect(() => { if (brandMode) return; setRestaurantId(tenant.id); repriceItems(products); }, [tenant.id, products, setRestaurantId, repriceItems, brandMode]);

  const openDelivery = useCallback(() => {
    if (brandMode) { brandControls!.onRequireBranch(null); return; }
    setDeliveryModalOpen(true);
  }, [brandMode, brandControls]);

  const goCheckout = useCallback(() => {
    if (brandMode && !hasBranch) { brandControls!.onRequireBranch(null); return; }
    const cartValue = useCartStore.getState().subtotal?.() ?? 0;
    trackCartView(tenant.id, useCartStore.getState().itemCount(), cartValue);
    window.location.href = `${storeBase}/checkout`;
  }, [brandMode, hasBranch, brandControls, storeBase, tenant.id]);

  // Open menu from URL param
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get("menu");
      if (!m) return;
      const view: CustomerMenuView = m === "favorites" ? "favorites" : m === "contact" ? "contact" : "root";
      openMenu(view);
      sp.delete("menu");
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    } catch { /* noop */ }
  }, [openMenu]);

  // Open product from initial slug
  const initialProductOpenedRef = useRef(false);
  useEffect(() => {
    if (initialProductOpenedRef.current) return;
    if (!initialProductSlug) return;
    const product = products.find((p) => slugify(p.name) === initialProductSlug);
    if (product) {
      initialProductOpenedRef.current = true;
      openProduct(product);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductSlug]);

  // Favorites
  const pendingFavRef = useRef<string | null>(null);
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

  const promptLogin = useCallback((dishId: string) => {
    pendingFavRef.current = dishId;
    setMenuView("root");
    setMenuLoginExpanded(true);
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

  // Cart bump animation
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

  // Session end tracking
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

  // Search and filter
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [products, search]);

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

  // "Inspirado en lo que has visto" — sugerencias inteligentes basadas en historial
  // Se recalcula cada vez que viewedProductIds cambia (en vivo al ver productos)
  const suggestions = useMemo(() => {
    const viewedCats = viewedCatIdsRef.current;
    const candidates = products.filter(p => p.image_url && !p.is_sold_out);

    // Necesita al menos 3 productos vistos para tener suficiente contexto
    if (viewedProductIds.size < 3) return [];

    // Calcular qué categorías ha visto más (frecuencia)
    const catFreq = new Map<string, number>();
    for (const id of viewedProductIds) {
      const p = products.find(x => x.id === id);
      if (p) catFreq.set(p.category_id, (catFreq.get(p.category_id) || 0) + 1);
    }

    // Precio promedio de lo que ha visto (para sugerir rango similar)
    const viewedPrices = [...viewedProductIds].map(id => products.find(x => x.id === id)?.price ?? 0).filter(p => p > 0);
    const avgPrice = viewedPrices.length > 0 ? viewedPrices.reduce((a, b) => a + b, 0) / viewedPrices.length : 0;

    // Productos no vistos
    const unseen = candidates.filter(p => !viewedProductIds.has(p.id));

    // Scoring inteligente
    const scored = unseen.map(p => {
      let score = 0;
      // Categoría visitada: más puntos cuantas más veces se visitó esa categoría
      const catVisits = catFreq.get(p.category_id) || 0;
      score += catVisits * 25;
      // Rango de precio similar (+15 si está dentro del ±40% del promedio)
      if (avgPrice > 0 && p.price >= avgPrice * 0.6 && p.price <= avgPrice * 1.4) score += 15;
      // Destacados / promos
      score += (p.is_hero ? 12 : 0) + (p.daily_badge ? 10 : 0) + (p.new_badge ? 8 : 0) + (p.original_price ? 6 : 0);
      return { p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Solo mostrar si hay al menos 3 sugerencias con score > 0
    const relevant = scored.filter(s => s.score > 0);
    return relevant.length >= 3 ? relevant.slice(0, 8).map(s => s.p) : [];
  }, [products, viewedProductIds]);

  const alignCatChip = useCallback((catId: string) => {
    const cont = catScrollRef.current;
    if (!cont) return;
    const chip = cont.querySelector<HTMLElement>(`[data-cat="${catId}"]`);
    if (!chip) return;
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

  // Scroll spy for categories (+ sugeridos)
  useEffect(() => {
    function onScroll() {
      if (lockSpyRef.current) return;
      const offset = (catNavRef.current?.offsetHeight ?? 56) + 16;
      let current: string | null = null;

      // Check if suggestions section is visible first
      const sugEl = document.getElementById("sugeridos");
      if (sugEl && sugEl.getBoundingClientRect().top - offset <= 0) {
        current = "sugeridos";
      }

      for (const cat of categories) {
        const el = document.getElementById(`cat-${cat.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = cat.id;
        else break;
      }

      if (!current) current = sugEl ? "sugeridos" : categories.length ? categories[0].id : null;
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

  // Native status bar (Capacitor)
  useEffect(() => {
    const Cap = (window as unknown as { Capacitor?: Record<string, any> }).Capacitor;
    const SB = Cap?.Plugins?.StatusBar;
    if (!SB || !Cap?.isNativePlatform?.()) return;
    (async () => {
      try {
        await SB.setStyle({ style: headerDark ? "DARK" : "LIGHT" });
        if (Cap.getPlatform?.() === "android") {
          if (tenant.headerBgColor) await SB.setBackgroundColor({ color: tenant.headerBgColor });
          await SB.setOverlaysWebView({ overlay: false });
        }
      } catch {}
    })();
  }, [headerDark, tenant.headerBgColor]);

  const badge = mounted ? itemCount : 0;

  // Quick add to cart (no required modifiers)
  const quickAddToCart = useCallback((p: StoreProduct) => {
    if (brandMode && !hasBranch) { brandControls!.onRequireBranch(p); return; }
    selectedProductRef.current = p;
    useCartStore.getState().addItem({
      product_id: p.id,
      name: p.name,
      unit_price: p.price,
      base_price: p.price,
      quantity: 1,
      image_url: p.image_url ?? null,
      toteat_code: p.toteat_code ?? null,
      is_happy_hour: false,
      promo_id: p.promo_id ?? null,
      options: [],
    });
    window.dispatchEvent(new Event("cart:item-added"));
  }, [brandMode, hasBranch, brandControls]);

  const hasRequiredModifiers = useCallback((p: StoreProduct) => {
    return p.option_groups?.some((g) => g.is_required) ?? false;
  }, []);

  // Delivery bar data
  const { deliveryType, deliveryAddress, deliverySelected } = useCartStore();
  const estimatedTime = deliverySelected ? ((deliveryType === "delivery" ? tenant.waitTimeDelivery : tenant.waitTimePickup) || tenant.waitTime || "") : "";

  return (
    <div className="qc-storefront min-h-screen" style={{ ...modernFontVars, paddingTop: "env(safe-area-inset-top)", background: "#f5f3ee" }}>
      {/* Load DM Sans from Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: `html{background:${tenant.headerBgColor || "#ffffff"};overscroll-behavior-y:none}body{overscroll-behavior-y:none}.qc-storefront,.qc-storefront *,.qc-storefront ::before,.qc-storefront ::after{font-family:${MODERN_SANS}}.qc-storefront button,.qc-storefront a,.qc-storefront [role=button]{cursor:pointer}@keyframes qc-cart-shake{0%{transform:scale(1) rotate(0)}15%{transform:scale(1.08) rotate(-10deg)}30%{transform:scale(1.08) rotate(10deg)}45%{transform:scale(1.05) rotate(-6deg)}60%{transform:scale(1.03) rotate(4deg)}75%{transform:scale(1.01) rotate(-2deg)}100%{transform:scale(1) rotate(0)}}.qc-storefront .cart-bump{animation:qc-cart-shake .6s ease!important}` }} />
      <div aria-hidden className="fixed top-0 inset-x-0 z-[35]" style={{ height: "env(safe-area-inset-top)", background: tenant.headerBgColor || "#ffffff" }} />
      <StoreStyles />
      <Toaster position="top-center" richColors offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} />

      {/* ── Sticky Header with backdrop blur ────── */}
      <header
        className="sticky top-0 z-30 transition-all duration-200"
        style={{
          background: tenant.headerBgColor || "#ffffff",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* ── Mobile header ── */}
        <div className="lg:hidden max-w-5xl mx-auto px-4 h-14 flex items-center justify-between relative">
          <button onClick={() => setDrawerOpen(true)} aria-label="Menú" className={`w-10 h-10 flex items-center justify-center rounded-lg transition ${headerDark ? "text-white hover:bg-white/15" : "text-gray-700 hover:bg-black/5"}`}>
            <MenuIcon className="w-5 h-5" />
          </button>
          <a href={storeBase || "/"} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center" onClick={(e) => { e.preventDefault(); setActiveView("carta"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="w-auto object-contain" style={{ height: 48 }} />
            ) : (
              <span className={`font-black text-xl ${headerDark ? "text-white" : "text-gray-900"}`}>{tenant.name}</span>
            )}
          </a>
          <div className="flex items-center gap-0">
            <button onClick={() => loggedIn ? openMenu("root") : setLoginModalOpen(true)} aria-label="Mi cuenta" className={`w-10 h-10 flex items-center justify-center rounded-lg transition ${headerDark ? "text-white hover:bg-white/15" : "text-gray-700 hover:bg-black/5"}`}>
              <User className="w-5 h-5" />
            </button>
            <button onClick={goCheckout} aria-label="Ver carrito" className={`w-10 h-10 flex items-center justify-center rounded-lg transition relative ${headerDark ? "text-white hover:bg-white/15" : "text-gray-700 hover:bg-black/5"}`}>
              <span className={`relative inline-flex ${cartBump ? "cart-bump" : ""}`}>
                <ShoppingCart className="w-5 h-5" />
                {badge > 0 && <span className="absolute -top-1.5 -right-2 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow bg-red-500">{badge}</span>}
              </span>
            </button>
          </div>
        </div>

        {/* ── Desktop header ── */}
        <div className="hidden lg:flex max-w-5xl mx-auto px-0 h-16 items-center gap-5">
          {/* Logo */}
          <a href={storeBase || "/"} className="shrink-0" onClick={(e) => { e.preventDefault(); setActiveView("carta"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="w-auto object-contain" style={{ height: 44 }} />
            ) : (
              <span className={`font-black text-lg ${headerDark ? "text-white" : "text-gray-900"}`}>{tenant.name}</span>
            )}
          </a>

          {/* Address input */}
          <button
            onClick={openDelivery}
            className="flex items-center gap-2.5 rounded-full px-4 py-2 transition group cursor-pointer"
            style={{ background: headerDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)", flex: "1 1 0%", maxWidth: 420, margin: "0 auto" }}
          >
            {!deliverySelected ? (
              <>
                <MapPin className="w-4 h-4 shrink-0" style={{ opacity: 0.6, color: headerDark ? "#fff" : primaryColor }} />
                <span className={`flex-1 text-left text-[13px] ${headerDark ? "text-white/50" : "text-gray-400"}`}>¿Dónde enviamos tu pedido?</span>
              </>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <Motorbike className="w-4 h-4 shrink-0" style={{ color: headerDark ? "#fff" : primaryColor }} />
                <span className={`flex-1 text-left text-[13px] font-semibold truncate ${headerDark ? "text-white" : "text-gray-700"}`}>{shortAddr(deliveryAddress.address)}</span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${headerDark ? "text-white/40" : "text-gray-400"}`} />
              </>
            ) : (
              <>
                <Store className="w-4 h-4 shrink-0" style={{ color: headerDark ? "#fff" : primaryColor }} />
                <span className={`flex-1 text-left text-[13px] font-semibold truncate ${headerDark ? "text-white" : "text-gray-700"}`}>{tenant.branchName || "Retiro en tienda"}</span>
                {!tenant.openStatus.open && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-2 py-px rounded-full shrink-0">Cerrado</span>}
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${headerDark ? "text-white/40" : "text-gray-400"}`} />
              </>
            )}
          </button>

          {/* Nav links */}
          <button
            onClick={() => { setActiveView("carta"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className={`shrink-0 relative text-[13px] font-semibold px-2 pb-2 transition cursor-pointer ${activeView === "carta" ? (headerDark ? "text-white" : "text-gray-900") : (headerDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-700")}`}
          >
            Carta
            {activeView === "carta" && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: headerDark ? "#fff" : primaryColor }} />}
          </button>
          <button
            onClick={() => { setActiveView("locales"); window.scrollTo({ top: 0 }); }}
            className={`shrink-0 relative text-[13px] font-semibold px-2 pb-2 transition cursor-pointer ${activeView === "locales" ? (headerDark ? "text-white" : "text-gray-900") : (headerDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-700")}`}
          >
            Locales
            {activeView === "locales" && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: headerDark ? "#fff" : primaryColor }} />}
          </button>

          {/* User */}
          <button onClick={() => loggedIn ? openMenu("root") : setLoginModalOpen(true)} aria-label="Mi cuenta" className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition ${headerDark ? "text-white hover:bg-white/15" : "text-gray-600 hover:bg-black/5"}`}>
            <User className="w-[18px] h-[18px]" />
          </button>

          {/* Cart */}
          <button onClick={goCheckout} aria-label="Ver carrito" className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition relative ${headerDark ? "text-white hover:bg-white/15" : "text-gray-600 hover:bg-black/5"}`}>
            <span className={`relative inline-flex ${cartBump ? "cart-bump" : ""}`}>
              <ShoppingCart className="w-[18px] h-[18px]" />
              {badge > 0 && <span className="absolute -top-1.5 -right-2 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow bg-red-500">{badge}</span>}
            </span>
          </button>
        </div>

      </header>

      {/* ── Hamburger Drawer (slide from left) ────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className={`absolute inset-0 bg-black/40 ${drawerClosing ? "qc-fade-out" : "qc-fade-in"}`}
            onClick={closeDrawer}
          />
          <div
            className={`absolute top-0 left-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col ${drawerClosing ? "animate-slide-out-left" : "animate-slide-in-left"}`}
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-3.5 pb-0">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {(tenant.faviconUrl || tenant.logoUrl) && <img src={tenant.faviconUrl || tenant.logoUrl!} alt="" className="w-5 h-5 rounded-full object-cover" />}
                {tenant.name}
              </span>
              <button onClick={closeDrawer} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition shrink-0">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* User account header */}
            <div className="px-5 pt-4 pb-5" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${primaryColor}03)` }}>
              {loggedIn ? (
                <button
                  onClick={() => { closeDrawer(); openMenu("root"); }}
                  className="flex items-center gap-3.5 w-full text-left"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-white">
                    <User className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900">Mi cuenta</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Pedidos, favoritos y más</p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => { closeDrawer(); setTimeout(() => setLoginModalOpen(true), 150); }}
                  className="flex items-center gap-3.5 w-full text-left group"
                >
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900">Inicia sesión</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Guarda favoritos y revisa tus pedidos</p>
                  </div>
                </button>
              )}
            </div>

            {/* Drawer links */}
            <nav className="flex-1 flex flex-col py-3 px-4 gap-0.5">
              <button
                onClick={() => { closeDrawer(); if (activeView !== "carta") setActiveView("carta"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={`flex items-center gap-3 px-3 py-3.5 rounded-xl transition text-left ${activeView === "carta" ? "text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
                style={activeView === "carta" ? { background: `${primaryColor}10` } : {}}
              >
                <span className="text-sm font-semibold flex-1">Carta</span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
              {tenant.favoritesEnabled && (
                <button
                  onClick={() => { closeDrawer(); if (loggedIn === false) { promptLogin(""); return; } openMenu("favorites"); }}
                  className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-gray-50 transition text-left"
                >
                  <span className="text-sm font-semibold flex-1">Favoritos</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              )}
              <button
                onClick={() => { closeDrawer(); setTimeout(() => { setActiveView("locales"); setActiveCat("locales"); window.scrollTo({ top: 0 }); }, 300); }}
                className={`flex items-center gap-3 px-3 py-3.5 rounded-xl transition text-left ${activeView === "locales" ? "text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
                style={activeView === "locales" ? { background: `${primaryColor}10` } : {}}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold">{brandMode ? "Locales" : "Local"}</span>
                  <span className="text-[11px] text-gray-400">Ver área de reparto y horarios</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            </nav>

            {/* Drawer footer */}
            <div className="mt-auto border-t border-gray-100 px-5 py-4 flex flex-col gap-3">
              {(tenant.instagram || (tenant as any).facebook || (tenant as any).tiktok) && (
                <div className="flex items-center gap-2">
                  {tenant.instagram && (
                    <a href={tenant.instagram.startsWith("http") ? tenant.instagram : `https://instagram.com/${tenant.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
                    </a>
                  )}
                  {(tenant as any).facebook && (
                    <a href={(tenant as any).facebook.startsWith("http") ? (tenant as any).facebook : `https://facebook.com/${(tenant as any).facebook}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  )}
                  {(tenant as any).tiktok && (
                    <a href={(tenant as any).tiktok.startsWith("http") ? (tenant as any).tiktok : `https://tiktok.com/@${(tenant as any).tiktok.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.29 8.29 0 0 0 4.84 1.56v-3.5a4.84 4.84 0 0 1-1.08-.06z"/></svg>
                    </a>
                  )}
                </div>
              )}
              <a href="https://quierocomer.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 hover:text-gray-600 transition">
                Creado por <span className="font-semibold">QuieroComer.com</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer slide animations (CSS) ────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        .animate-slide-in-left { animation: slideInLeft 0.18s ease-out forwards; }
        .animate-slide-out-left { animation: slideOutLeft 0.15s ease-in forwards; }
      `}} />

      {/* ── Hero banner ────── */}
      {tenant.bannerUrl && (
        <div className="w-full overflow-hidden">
          <img src={tenant.bannerUrl} alt="" className="block w-full h-auto" />
        </div>
      )}

      {/* ── Closed banner ────── */}
      {/* ── Partial closure notice ────── */}
      {tenant.openStatus.open && tenant.openStatus.closure && (tenant.openStatus.closure.affectsDelivery || tenant.openStatus.closure.affectsPickup) && (
        <div className="bg-amber-50 text-amber-900 border-b border-amber-200 text-center py-2.5 px-4">
          <span className="text-sm font-semibold">
            {tenant.openStatus.closure.affectsDelivery && !tenant.openStatus.closure.affectsPickup && "Delivery no disponible"}
            {tenant.openStatus.closure.affectsPickup && !tenant.openStatus.closure.affectsDelivery && "Retiro no disponible"}
            {" · "}{tenant.openStatus.closure.reason}
          </span>
        </div>
      )}

      {/* ── Address/delivery bar (mobile only, desktop has it in header) ────── */}
      <div style={{ background: "#f0ede7" }} className="relative lg:hidden">
        <div className="max-w-5xl mx-auto px-3 pt-3 pb-2.5">
          <button
            onClick={openDelivery}
            className="w-full flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-sm hover:shadow transition group cursor-pointer"
          >
            {!deliverySelected ? (
              <>
                <MapPin className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                <span className="flex-1 text-left text-sm text-gray-400">¿Dónde enviamos tu pedido?</span>
              </>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <Motorbike className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                <span className="flex-1 text-left text-[13px] font-semibold text-gray-700 truncate flex items-center gap-1.5">{shortAddr(deliveryAddress.address)} <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 inline" /></span>
                {estimatedTime && <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400"><Clock className="w-3.5 h-3.5" />{estimatedTime} min</span>}
              </>
            ) : (
              <>
                <Store className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                <span className="flex-1 text-left text-[13px] font-semibold text-gray-700 truncate flex items-center gap-1.5">
                  {tenant.branchName || "Retiro en tienda"}
                  {!tenant.openStatus.open && <span className="shrink-0 text-[12px] font-semibold text-red-500 bg-red-50 border border-red-200 px-2.5 py-px rounded-full">Cerrado</span>}
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 inline" />
                </span>
                {tenant.openStatus.open && estimatedTime && <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400"><Clock className="w-3.5 h-3.5" />{estimatedTime} min</span>}
                {!tenant.openStatus.open && tenant.weeklyHours && <span onClick={(e) => { e.stopPropagation(); setHoursModalOpen(true); }} className="shrink-0 text-[12px] font-medium text-gray-400 underline underline-offset-2 hover:text-gray-600 transition">Ver horarios</span>}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Category navigation — premium minimal ────── */}
      {activeView === "carta" && <div ref={catNavRef} className="sticky z-20" style={{ top: "calc(env(safe-area-inset-top) + 56px)", background: "#f5f3ee" }}>
        <div className="max-w-5xl mx-auto px-4">
          {searchOpen ? (
            <div className="flex items-center gap-2" style={{ height: 40 }}>
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar en la carta..."
                className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={() => { setSearchOpen(false); setSearch(""); }}
                className="shrink-0 text-xs font-semibold text-gray-400 hover:text-gray-600 transition px-2"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <div ref={catScrollRef} className="no-scrollbar flex overflow-x-auto flex-1 min-w-0 items-center" style={{ scrollbarWidth: "none" }}>
                {suggestions.length > 0 && (
                  <button
                    data-cat="sugeridos"
                    onClick={() => {
                      if (activeView !== "carta") setActiveView("carta");
                      const el = document.getElementById("sugeridos");
                      if (!el) return;
                      const offset = (catNavRef.current?.offsetHeight ?? 56) + 8;
                      const y = el.getBoundingClientRect().top + window.scrollY - offset;
                      setActiveCat("sugeridos");
                      lockSpyRef.current = true;
                      setTimeout(() => { lockSpyRef.current = false; }, 700);
                      window.scrollTo({ top: y, behavior: "smooth" });
                    }}
                    className="shrink-0 relative py-2 transition-colors"
                    style={{ marginRight: 24 }}
                  >
                    <span className={`text-sm tracking-wide transition-all whitespace-nowrap ${activeCat === "sugeridos" ? "font-extrabold" : "font-medium text-gray-400 hover:text-gray-600"}`} style={activeCat === "sugeridos" ? { color: primaryColor } : {}}>
                      Para ti
                    </span>
                    {activeCat === "sugeridos" && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full" style={{ background: primaryColor }} />
                    )}
                  </button>
                )}
                {categories.map((cat) => {
                  const isActive = activeCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      data-cat={cat.id}
                      onClick={() => { if (activeView !== "carta") setActiveView("carta"); scrollToCategory(cat.id); }}
                      className="shrink-0 relative py-2 transition-colors"
                      style={{ marginRight: 24 }}
                    >
                      <span className={`text-sm tracking-wide transition-all ${isActive ? "font-extrabold" : "font-medium text-gray-400 hover:text-gray-600"}`} style={isActive ? { color: primaryColor } : {}}>
                        {cat.name}
                      </span>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full" style={{ background: primaryColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="relative shrink-0 flex items-center">
                <div className="absolute right-full top-0 bottom-0 w-8 pointer-events-none" style={{ background: "linear-gradient(to right, transparent, #f5f3ee)" }} />
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 transition ml-1"
                  style={{ background: "#f5f3ee" }}
                >
                  <Search className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Thin shadow line */}
        <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 20%, rgba(0,0,0,0.06) 80%, transparent)" }} />
      </div>}

      {activeView === "carta" && (<>
      {/* ── "Para ti" suggestions carousel ────── */}
      {suggestions.length > 0 && !search && (
        <SuggestionsCarousel suggestions={suggestions} primaryColor={primaryColor} onOpenProduct={openProduct} onQuickAdd={quickAddToCart} hasRequiredModifiers={hasRequiredModifiers} brandMode={brandMode} hasBranch={hasBranch} brandControls={brandControls} />
      )}

      {/* ── Main content ────── */}
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-6">
        <div className="flex flex-col gap-8">
          {categories.map((cat) => {
            const catProducts = byCategory.get(cat.id) ?? [];
            if (!catProducts.length) return null;
            return (
              <section key={cat.id} id={`cat-${cat.id}`}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500 mb-3">{cat.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catProducts.map((p) => (
                    <ModernProductCard
                      key={p.id}
                      product={p}
                      primaryColor={primaryColor}
                      onClickDetails={() => openProduct(p)}
                      onQuickAdd={() => quickAddToCart(p)}
                      hasRequired={hasRequiredModifiers(p)}
                      showFav={tenant.favoritesEnabled && loggedIn === true}
                      isFav={favIds.has(p.id)}
                      onToggleFav={() => toggleFav(p.id)}
                      favNeedsLogin={loggedIn === false}
                      onRequireLogin={promptLogin}
                      brandIntercept={brandMode && !hasBranch}
                      onBrandIntercept={() => brandControls!.onRequireBranch(p)}
                    />
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
      </div>

      </>)}

      {/* ── Locales view ────── */}
      {activeView === "locales" && (
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
            {siblings && siblings.length > 1 ? "Nuestros locales" : "Nuestro local"}
          </h2>
          <p className="text-[13px] text-gray-400 mb-5">{siblings && siblings.length > 1 ? "Encuentra la sucursal más cercana a ti" : "Encuéntranos aquí"}</p>

          {/* Map with all branches */}
          {siblings && siblings.length > 0 && siblings.some(b => b.lat && b.lng) && (() => {
            const pts = siblings.filter(b => b.lat && b.lng);
            const center = pts.length > 0 ? `${pts.reduce((s, b) => s + b.lat!, 0) / pts.length},${pts.reduce((s, b) => s + b.lng!, 0) / pts.length}` : "";
            return (
              <div className="mb-5 rounded-xl overflow-hidden shadow-sm bg-gray-100">
                <iframe
                  title="Mapa de sucursales"
                  width="100%"
                  height="280"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBs3GBnAu5gBf0TCGCHzHJq-jiiFJCwjNE&center=${center}&zoom=${pts.length > 1 ? 12 : 15}`}
                />
              </div>
            );
          })()}

          <div className="flex flex-col gap-4">
            {siblings && siblings.length > 0 ? (
              siblings.map(b => (
                <BranchCard
                  key={b.id}
                  name={b.branchName || b.name}
                  address={b.address}
                  phone={null}
                  whatsapp={null}
                  lat={b.lat}
                  lng={b.lng}
                  open={b.open}
                  opensAt={b.opensAt}
                  weeklyHours={b.id === tenant.id ? tenant.weeklyHours : null}
                  primaryColor={primaryColor}
                  logoUrl={tenant.faviconUrl || b.logoUrl}
                  onViewHours={b.id === tenant.id ? () => setHoursModalOpen(true) : undefined}
                  current={b.id === tenant.id}
                />
              ))
            ) : (
              <BranchCard
                name={tenant.branchName || tenant.name}
                address={tenant.address}
                phone={tenant.phone}
                whatsapp={tenant.whatsapp}
                lat={null}
                lng={null}
                open={tenant.openStatus.open}
                opensAt={tenant.openStatus.opensAt ?? null}
                weeklyHours={tenant.weeklyHours}
                primaryColor={primaryColor}
                logoUrl={tenant.faviconUrl || tenant.logoUrl}
                onViewHours={() => setHoursModalOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Footer ────── */}
      <footer className="mt-6 pb-28 sm:pb-8" style={{ background: "#1e293b" }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-center">
          <span className="text-[13px] text-gray-500">Creado por <a href="https://quierocomer.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-400 hover:text-white transition">QuieroComer.com</a> · © {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* ── Product modal ────── */}
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
            try { window.history.replaceState(null, "", storeBase || "/"); } catch { /* noop */ }
          }}
          scrollImage
          intercept={brandMode && !hasBranch}
          onIntercept={() => { const p = selectedProduct; setSelectedProduct(null); brandControls!.onRequireBranch(p); }}
        />
      )}

      {/* ── Delivery modal ────── */}
      {deliveryModalOpen && (
        <DeliveryModal tenant={tenant} primaryColor={primaryColor} onClose={() => setDeliveryModalOpen(false)} siblings={siblings} />
      )}

      {/* ── Login modal (modern) ────── */}
      {loginModalOpen && (
        <ModernLoginModal
          tenant={tenant}
          primaryColor={primaryColor}
          onClose={() => setLoginModalOpen(false)}
          onLogged={() => { setLoginModalOpen(false); loadFavState(); }}
        />
      )}

      {/* ── Customer menu (for logged-in users) ────── */}
      {menuOpen && (
        <CustomerMenu tenant={tenant} primaryColor={primaryColor} onClose={() => { setMenuOpen(false); setMenuLoginExpanded(false); loadFavState(); }} products={products} initialView={menuView} initialLoginExpanded={menuLoginExpanded} variant="sheet" />
      )}


      {/* ── WhatsApp floating button ────── */}
      {/* WhatsApp floating — visible si hay whatsapp o phone */}
      {(tenant.whatsapp || tenant.phone) ? (
        <a
          href={`https://wa.me/${(tenant.whatsapp || tenant.phone || "").replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className="fixed z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          style={{ background: "#25D366", right: 16, bottom: 20 }}
        >
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      ) : null}

      {/* ── Hours modal ────── */}
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

// ── Modern Product Card (vertical layout) ──────────────────────
function ModernProductCard({
  product, primaryColor, onClickDetails, onQuickAdd, hasRequired, showFav, isFav, onToggleFav, favNeedsLogin, onRequireLogin, brandIntercept, onBrandIntercept,
}: {
  product: StoreProduct; primaryColor: string;
  onClickDetails: () => void; onQuickAdd: () => void; hasRequired: boolean;
  showFav?: boolean; isFav?: boolean; onToggleFav?: () => void; favNeedsLogin?: boolean; onRequireLogin?: (dishId: string) => void;
  brandIntercept?: boolean; onBrandIntercept?: () => void;
}) {
  const soldOut = product.is_sold_out;
  const [heartPop, setHeartPop] = useState(false);

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (favNeedsLogin) { onRequireLogin?.(product.id); return; }
    const willFav = !isFav;
    onToggleFav?.();
    if (willFav) { setHeartPop(true); setTimeout(() => setHeartPop(false), 340); }
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (soldOut) return;
    if (brandIntercept) { onBrandIntercept?.(); return; }
    if (hasRequired) {
      onClickDetails();
    } else {
      onQuickAdd();
    }
  };

  return (
    <div className={`relative bg-white rounded-lg shadow-sm overflow-hidden flex transition-shadow cursor-pointer ${soldOut ? "opacity-60 cursor-default" : "hover:shadow-md"}`} onClick={soldOut ? undefined : onClickDetails}>
      {/* Photo (left, square, large) */}
      <button onClick={soldOut ? undefined : onClickDetails} disabled={soldOut} className="relative w-36 sm:w-40 shrink-0 aspect-square bg-gray-100 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed size={32} className="text-gray-300" strokeWidth={1.5} /></div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-white/55 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-900/80 text-white">Agotado</span>
          </div>
        )}
        {!soldOut && product.daily_badge && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: 68, height: 68 }}>
            <div style={{ position: "absolute", top: 14, left: -15, width: 84, textAlign: "center", background: "linear-gradient(90deg,#f97316,#ef4444)", color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 0", transform: "rotate(-45deg)", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
              Solo hoy
            </div>
          </div>
        )}
        {!soldOut && !product.daily_badge && product.new_badge && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: 68, height: 68 }}>
            <div style={{ position: "absolute", top: 14, left: -15, width: 84, textAlign: "center", background: "linear-gradient(90deg,#f59e0b,#d97706)", color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 0", transform: "rotate(-45deg)", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
              Nuevo
            </div>
          </div>
        )}
      </button>

      {/* Favorite button */}
      {showFav && (
        <button
          onClick={handleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          className="absolute top-2 left-[152px] sm:left-[172px] z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-50 transition"
        >
          <Heart className={`w-4 h-4 ${heartPop ? "qc-heart-pop" : ""}`} fill={isFav ? primaryColor : "none"} color={isFav ? primaryColor : "#cbd5e1"} />
        </button>
      )}

      {/* Text content (right) */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
        <button onClick={soldOut ? undefined : onClickDetails} disabled={soldOut} className="text-left w-full">
          <p className="font-bold text-gray-900 text-[15px] leading-snug line-clamp-2">{product.name}</p>
          {product.description && (
            <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
          )}
        </button>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-semibold text-[15px] text-gray-600">{clp(product.price)}</span>
          {product.original_price ? (
            <span className="text-[11px] text-gray-400 line-through">{clp(product.original_price)}</span>
          ) : null}
        </div>
        {!soldOut && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleAdd}
              aria-label={`Agregar ${product.name}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm hover:opacity-90 transition active:scale-90 shrink-0 cursor-pointer"
              style={{ background: primaryColor }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modern Cart Panel (desktop sidebar) ──────────────────────
function ModernCartPanel({ tenant, primaryColor, cartBump, mounted, onOpenDeliveryModal, storeBase, onCheckout }: {
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
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      {/* Delivery selector */}
      <div>
        <button onClick={onOpenDeliveryModal} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition group text-left">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition">
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

      {/* Title */}
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
                  <img src={item.image_url} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><UtensilsCrossed size={18} className="text-gray-400" strokeWidth={1.5} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs font-black mt-0.5" style={{ color: primaryColor }}>{clp(item.unit_price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.product_id, item.options, -1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.options, 1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
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
              <div className="mt-1 w-full py-3 rounded-lg bg-gray-100 text-gray-500 font-bold text-xs flex items-center justify-center gap-1.5"><Lock size={13} className="shrink-0" /> Cerrado por ahora</div>
            ) : !deliverySelected ? (
              <button onClick={onOpenDeliveryModal} className="mt-1 w-full py-3 rounded-lg text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
                {tenant.pickupEnabled && tenant.deliveryEnabled ? "Elige cómo recibir tu pedido" : tenant.deliveryEnabled ? "Ingresa tu dirección de entrega" : "Confirmar retiro"} →
              </button>
            ) : belowMin ? (
              <div className="mt-1 w-full py-3 rounded-lg bg-gray-100 text-gray-500 font-bold text-xs text-center">Monto mínimo: {clp(minReq!)}</div>
            ) : (
              <button onClick={() => (onCheckout ? onCheckout() : (window.location.href = `${storeBase}/checkout`))} className="mt-1 w-full py-3 rounded-lg text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
                Continuar con mi pedido →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Hours modal (closed store) ──────────────────────────────
// ── Branch Card (locales section) ──────────────────────
// ── Modern Login Modal ──────────────────────
// ── Suggestions Carousel ──────────────────────
function SuggestionsCarousel({ suggestions, primaryColor, onOpenProduct, onQuickAdd, hasRequiredModifiers, brandMode, hasBranch, brandControls }: {
  suggestions: StoreProduct[]; primaryColor: string;
  onOpenProduct: (p: StoreProduct) => void; onQuickAdd: (p: StoreProduct) => void;
  hasRequiredModifiers: (p: StoreProduct) => boolean;
  brandMode: boolean; hasBranch: boolean; brandControls?: BrandControls;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  useEffect(() => {
    const update = () => setItemsPerPage(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 5);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const totalPages = Math.ceil(suggestions.length / itemsPerPage);

  const scrollToPage = (p: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
    setPage(p);
  };

  const nextPage = () => scrollToPage(Math.min(page + 1, totalPages - 1));
  const prevPage = () => scrollToPage(Math.max(page - 1, 0));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const currentPage = Math.round(el.scrollLeft / el.clientWidth);
      setPage(Math.min(currentPage, totalPages - 1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [totalPages]);

  return (
    <div id="sugeridos" className="max-w-5xl mx-auto pt-6 pb-3 px-4">
      <div className="bg-white rounded-xl shadow-sm relative">
        {/* Header with dots */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Inspirado en lo que has visto</h2>
          {totalPages > 1 && (
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  className={`rounded-full transition-all cursor-pointer ${i === page ? "w-1.5 h-1.5" : "w-1.5 h-1.5 hover:bg-gray-400"}`}
                  style={i === page ? { background: primaryColor } : { background: "#d1d5db" }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Products row */}
        <div ref={scrollRef} className="no-scrollbar flex overflow-x-auto sm:overflow-x-hidden gap-0 px-2 pb-4" style={{ scrollbarWidth: "none" }}>
          {suggestions.map((p, i) => {
            const hasReq = hasRequiredModifiers(p);
            return (
              <button key={p.id} onClick={() => onOpenProduct(p)} className="shrink-0 group text-left cursor-pointer px-2 relative" style={{ width: itemsPerPage <= 2 ? 150 : `${100 / itemsPerPage}%` }}>
                <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-gray-50 relative mb-2.5">
                  <img src={p.image_url!} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (brandMode && !hasBranch) { brandControls!.onRequireBranch(p); return; }
                      if (hasReq) { onOpenProduct(p); } else { onQuickAdd(p); }
                    }}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 cursor-pointer"
                    style={{ background: primaryColor }}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                </div>
                <p className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2 min-h-[32px]">{p.name}</p>
                <p className="mt-1 text-[13px] text-gray-500">{clp(p.price)}</p>
              </button>
            );
          })}
        </div>

        {/* Mobile fade right */}
        <div className="sm:hidden absolute top-0 right-0 bottom-0 w-10 pointer-events-none rounded-r-xl" style={{ background: "linear-gradient(to right, transparent, white)" }} />

        {/* Right arrow (desktop only) */}
        {page < totalPages - 1 && (
          <button
            onClick={nextPage}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center bg-white rounded-full shadow-lg border border-gray-100 text-gray-500 hover:text-gray-800 hover:shadow-xl transition cursor-pointer z-10"
            style={{ right: -4 }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {/* Left arrow (desktop only) */}
        {page > 0 && (
          <button
            onClick={prevPage}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center bg-white rounded-full shadow-lg border border-gray-100 text-gray-500 hover:text-gray-800 hover:shadow-xl transition cursor-pointer z-10"
            style={{ left: -4 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ModernLoginModal({ tenant, primaryColor, onClose, onLogged }: {
  tenant: StoreTenant; primaryColor: string; onClose: () => void; onLogged: () => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const inputStyle = { fontSize: "16px" } as const;

  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  async function send() {
    if (!emailOk || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), storeName: tenant.name, logoUrl: tenant.logoUrl ?? null, primaryColor }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "No se pudo enviar"); setBusy(false); return; }
      setStep("code"); setMsg(d.devCode ? `Código (dev): ${d.devCode}` : null);
    } catch { setMsg("Error de conexión"); }
    setBusy(false);
  }
  async function verify() {
    if (code.trim().length !== 6 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/qr/user/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "Código incorrecto"); setBusy(false); return; }
      toast("¡Sesión iniciada!"); onLogged();
    } catch { setMsg("Error de conexión"); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close */}
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition z-10">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-7 pt-8 pb-5 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)` }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-white shadow-sm">
            <User className="w-7 h-7" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{step === "email" ? "Inicia sesión" : "Verifica tu correo"}</h2>
          <p className="text-[13px] text-gray-400 mt-1">
            {step === "email" ? "Ingresa tu correo para acceder a tu cuenta" : `Enviamos un código de 6 dígitos a ${email}`}
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 flex flex-col gap-3">
          {step === "email" ? (
            <>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                inputMode="email" type="email" style={inputStyle} autoFocus
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-400 text-gray-800 placeholder-gray-400 transition"
              />
              <button
                onClick={send}
                disabled={!emailOk || busy}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 transition hover:opacity-90"
                style={{ background: primaryColor }}
              >
                {busy ? "Enviando..." : "Continuar"}
              </button>
              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400">o continúa con</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {/* Google */}
              <button
                onClick={() => { window.location.href = `/api/qr/user/google?redirect=${encodeURIComponent(window.location.href)}`; }}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-gray-50 transition"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </button>
            </>
          ) : (
            <>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                inputMode="numeric" autoFocus style={inputStyle}
                placeholder="000000"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center tracking-[0.4em] text-lg font-bold outline-none focus:border-gray-400 text-gray-800 transition"
              />
              <button
                onClick={verify}
                disabled={code.length !== 6 || busy}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 transition hover:opacity-90"
                style={{ background: primaryColor }}
              >
                {busy ? "Verificando..." : "Verificar"}
              </button>
              <button onClick={send} disabled={busy} className="text-[12px] text-gray-400 hover:text-gray-600 transition self-center mt-1">
                ¿No llegó? Reenviar código
              </button>
            </>
          )}
          {msg && <p className={`text-[12px] text-center ${msg.includes("incorrecto") || msg.includes("No se pudo") || msg.includes("Error") ? "text-red-500" : "text-gray-500"}`}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}

function BranchCard({ name, address, phone, whatsapp, lat, lng, open, opensAt, weeklyHours, primaryColor, onViewHours, current, logoUrl }: {
  name: string; address: string | null; phone: string | null; whatsapp: string | null;
  lat: number | null; lng: number | null; open: boolean; opensAt: string | null;
  weeklyHours: import("@/lib/ecommerce/hours").DayHours[] | null; primaryColor: string;
  onViewHours?: () => void; current?: boolean; logoUrl?: string | null;
}) {
  const today = (() => { try { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay(); } catch { return -1; } })();
  const todayHours = weeklyHours?.[today];
  const hasMap = lat != null && lng != null;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
      {/* Map preview */}
      {hasMap && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-32 bg-gray-100 relative group overflow-hidden"
        >
          <img
            src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x240&scale=2&markers=color:0x${primaryColor.replace("#", "")}%7C${lat},${lng}&style=feature:all%7Celement:labels.text.fill%7Ccolor:0x616161&style=feature:water%7Celement:geometry%7Ccolor:0xc9c9c9&key=AIzaSyBs3GBnAu5gBf0TCGCHzHJq-jiiFJCwjNE`}
            alt={`Mapa ${name}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Abrir mapa
          </div>
        </a>
      )}

      <div className="p-4">
        {/* Name + status */}
        <div className="flex items-center gap-2.5 mb-2">
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100" />
          )}
          <h3 className="text-[15px] font-bold text-gray-900">{name}</h3>
          {current && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${primaryColor}15`, color: primaryColor }}>Actual</span>}
          {open ? (
            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Abierto</span>
          ) : (
            <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Cerrado</span>
          )}
        </div>

        {/* Info rows */}
        <div className="flex flex-col gap-1.5">
          {address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-[13px] text-gray-600">{address}</span>
            </div>
          )}

          {/* Today's hours */}
          {todayHours && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {todayHours.open ? (
                <span className="text-[13px] text-gray-600">Hoy {todayHours.from} – {todayHours.to === "00:00" ? "00:00" : todayHours.to}</span>
              ) : (
                <span className="text-[13px] text-gray-500">Cerrado hoy{opensAt ? ` · Abre a las ${opensAt}` : ""}</span>
              )}
              {onViewHours && weeklyHours && (
                <button onClick={onViewHours} className="text-[12px] font-medium underline underline-offset-2 text-gray-400 hover:text-gray-600 transition">
                  Ver todos
                </button>
              )}
            </div>
          )}
          {!todayHours && !open && opensAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-[13px] text-gray-500">Abre a las {opensAt}</span>
            </div>
          )}

          {(phone || whatsapp) && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <a href={`tel:${phone || whatsapp}`} className="text-[13px] text-gray-600 hover:text-gray-900 transition">{phone || whatsapp}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursModal({ weeklyHours, primaryColor, branchName, onClose }: { weeklyHours: import("@/lib/ecommerce/hours").DayHours[]; primaryColor: string; branchName?: string | null; onClose: () => void }) {
  const DISPLAY = [1, 2, 3, 4, 5, 6, 0];
  const LABELS: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
  const today = (() => { try { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay(); } catch { return -1; } })();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with background */}
        <div className="relative px-6 pt-6 pb-5 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${primaryColor}12, ${primaryColor}06)` }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm">
            <Clock className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 leading-none mb-1">Horarios</p>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{branchName || "Atención"}</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 hover:text-gray-700 hover:shadow transition z-10">
            <X className="w-4.5 h-4.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Schedule */}
        <div className="px-6 pb-2">
          {DISPLAY.map((idx) => {
            const d = weeklyHours[idx];
            const isToday = idx === today;
            return (
              <div key={idx} className={`flex items-center justify-between py-2.5 rounded-lg ${isToday ? "bg-gray-50" : ""}`} style={{ marginLeft: -8, marginRight: -8, paddingLeft: 8, paddingRight: 8 }}>
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] ${isToday ? "font-bold text-gray-900" : "text-gray-500"}`}>
                    {LABELS[idx]}
                    {isToday && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${primaryColor}20`, color: primaryColor }}>Hoy</span>}
                  </span>
                </div>
                {d?.open ? (
                  <span className={`text-[13px] tabular-nums ${isToday ? "font-bold" : "text-gray-500"}`} style={isToday ? { color: primaryColor } : {}}>
                    {d.from} – {d.to === "00:00" ? "00:00" : d.to}
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-red-400">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
