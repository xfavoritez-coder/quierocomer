"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { ShoppingCart, Search, Plus, Minus, X, MapPin, Store, ChevronDown, Pencil } from "lucide-react";
import type { StoreTenant, StoreCategory, StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { computeDistanceFee, type DistanceFeeResult } from "@/lib/ecommerce/delivery";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import ProductModal from "./ProductModal";
import CartDrawer from "./CartDrawer";
import StoreStyles from "./StoreStyles";

interface Props {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
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

export default function StoreFront({ tenant, categories, products }: Props) {
  const primaryColor = tenant.primaryColor;
  const categoryColor = tenant.categoryColor;
  useFavicon(tenant.logoUrl);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [mounted, setMounted] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const catNavRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const lockSpyRef = useRef(false);

  const setRestaurantId = useCartStore((s) => s.setRestaurantId);
  const itemCount = useCartStore((s) => s.itemCount());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setRestaurantId(tenant.id); }, [tenant.id, setRestaurantId]);

  useEffect(() => {
    function handleAdded() {
      setCartBump(true);
      setTimeout(() => setCartBump(false), 450);
    }
    window.addEventListener("cart:item-added", handleAdded);
    return () => window.removeEventListener("cart:item-added", handleAdded);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, StoreProduct[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const p of filtered) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    return map;
  }, [filtered, categories]);

  const centerCatChip = useCallback((catId: string) => {
    const cont = catScrollRef.current;
    if (!cont) return;
    const chip = cont.querySelector<HTMLElement>(`[data-cat="${catId}"]`);
    if (!chip) return;
    const target = chip.offsetLeft - (cont.clientWidth - chip.clientWidth) / 2;
    cont.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, []);

  const scrollToCategory = useCallback((catId: string) => {
    const el = document.getElementById(`cat-${catId}`);
    if (!el) return;
    const offset = (headerRef.current?.offsetHeight ?? 80) + (catNavRef.current?.offsetHeight ?? 48) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    setActiveCat(catId);
    centerCatChip(catId);
    lockSpyRef.current = true;
    setTimeout(() => { lockSpyRef.current = false; }, 700);
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [centerCatChip]);

  useEffect(() => {
    function onScroll() {
      if (lockSpyRef.current) return;
      const offset = (headerRef.current?.offsetHeight ?? 80) + (catNavRef.current?.offsetHeight ?? 48) + 16;
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
          if (prev !== current) centerCatChip(current!);
          return current;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [categories, centerCatChip]);

  const badge = mounted ? itemCount : 0;

  return (
    <div className="qc-storefront min-h-screen bg-gray-50" style={storeFontVars}>
      <StoreStyles />
      <Toaster position="top-center" richColors />

      {/* ── Header — solo logo ─────────────────────────────────── */}
      <header ref={headerRef} className="sticky top-0 z-40 shadow-sm" style={{ background: tenant.headerBgColor }}>
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-16 w-auto object-contain" />
            ) : (
              <span className="font-black text-xl text-gray-900">{tenant.name}</span>
            )}
          </div>
          {/* Carrito móvil */}
          <button
            onClick={() => setCartOpen(true)}
            className={`relative lg:hidden flex items-center gap-1.5 rounded-xl px-3 py-2 text-white font-bold text-sm shadow transition hover:opacity-90 whitespace-nowrap ${cartBump ? "cart-bump" : ""}`}
            style={{ background: primaryColor }}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>Mi pedido</span>
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center shadow" style={{ color: primaryColor }}>
                {badge}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      {tenant.bannerUrl && (
        <div className="relative h-44 sm:h-64 overflow-hidden">
          <img src={tenant.bannerUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} />
        </div>
      )}

      {/* ── Banner de tienda cerrada ─────────────────────────────── */}
      {!tenant.openStatus.open && (
        <div className="bg-gray-900 text-white text-center py-3 px-4">
          <span className="text-sm font-bold">🔒 Estamos cerrados ahora</span>
          {(() => {
            const t = tenant.openStatus.today;
            let msg: string;
            if (tenant.openStatus.opensAt) msg = `Abrimos hoy a las ${tenant.openStatus.opensAt}`;
            else if (t && t.open) msg = `Horario de hoy: ${t.from} – ${t.to === "00:00" ? "medianoche" : t.to}`;
            else msg = "Hoy no atendemos";
            return <span className="text-sm text-gray-300"> · {msg}</span>;
          })()}
        </div>
      )}

      {/* ── Selector de entrega — solo mobile ─── */}
      <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3">
        <MobileDeliveryBar tenant={tenant} primaryColor={primaryColor} onOpen={() => setDeliveryModalOpen(true)} />
      </div>

      {/* ── Barra de categorías — sticky bajo el header ─────────── */}
      <div ref={catNavRef} className="sticky top-20 z-30 bg-white border-b border-gray-100 shadow-sm">
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
            <div ref={catScrollRef} className="no-scrollbar flex overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
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
          )}
        </div>
      </div>

      {/* ── Contenido principal ─────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* Columna productos */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            {categories.map((cat) => {
              const catProducts = byCategory.get(cat.id) ?? [];
              if (!catProducts.length) return null;
              return (
                <section key={cat.id} id={`cat-${cat.id}`}>
                  <h2 className="text-base font-black uppercase tracking-widest mb-3" style={{ color: categoryColor }}>{cat.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catProducts.map((p) => (
                      <ProductCard key={p.id} product={p} primaryColor={primaryColor} onClick={() => setSelectedProduct(p)} />
                    ))}
                  </div>
                </section>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-sm">No encontramos productos para tu búsqueda</p>
              </div>
            )}
          </div>

          {/* Carrito lateral — solo desktop */}
          <div className="hidden lg:block w-80 shrink-0 sticky top-[136px]">
            <CartPanel
              tenant={tenant}
              primaryColor={primaryColor}
              cartBump={cartBump}
              mounted={mounted}
              onOpenDeliveryModal={() => setDeliveryModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Modal producto */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} primaryColor={primaryColor} onClose={() => setSelectedProduct(null)} />
      )}

      {/* Modal delivery/retiro */}
      {deliveryModalOpen && (
        <DeliveryModal tenant={tenant} primaryColor={primaryColor} onClose={() => setDeliveryModalOpen(false)} />
      )}

      {/* Drawer carrito (mobile) */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        tenant={tenant}
        primaryColor={primaryColor}
        onOpenDeliveryModal={() => { setCartOpen(false); setDeliveryModalOpen(true); }}
      />
    </div>
  );
}

// ── Barra mobile de selección de entrega ────────────────────────
function MobileDeliveryBar({ tenant, primaryColor, onOpen }: { tenant: StoreTenant; primaryColor: string; onOpen: () => void }) {
  const { deliveryType, deliveryAddress, deliverySelected } = useCartStore();
  const estimatedTime = deliverySelected ? tenant.waitTime ?? "" : "";

  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={onOpen} className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition">
        {!deliverySelected ? (
          <>
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-500">¿Dónde quieres pedir?</span>
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
            <span className="text-sm font-semibold text-gray-700">Retiro en tienda</span>
            <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </>
        )}
      </button>
      {deliverySelected && estimatedTime && (
        <p className="text-center text-xs text-gray-500">
          ⏱ Tiempo estimado: <span className="font-bold" style={{ color: primaryColor }}>{estimatedTime} min</span>
        </p>
      )}
    </div>
  );
}

// ── Tarjeta de producto ──────────────────────────────────────────
function ProductCard({ product, primaryColor, onClick }: { product: StoreProduct; primaryColor: string; onClick: () => void }) {
  const soldOut = product.is_sold_out;
  return (
    <button
      onClick={soldOut ? undefined : onClick}
      disabled={soldOut}
      className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow group grid grid-cols-[1fr_8rem] sm:grid-cols-[1fr_9rem] min-h-[8rem] w-full text-left ${soldOut ? "opacity-60 cursor-not-allowed" : "hover:shadow-md"}`}
    >
      {/* Texto */}
      <div className="p-4 flex flex-col justify-between">
        <div>
          <p className="font-bold text-gray-900 text-sm leading-snug">{product.name}</p>
          {product.description && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-3 leading-relaxed">{product.description}</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {soldOut ? (
            <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-gray-200 text-gray-500">Agotado</span>
          ) : product.original_price ? (
            <>
              <span className="text-[12px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: primaryColor }}>OFERTA {clp(product.price)}</span>
              <span className="text-[12px] text-gray-600 line-through">{clp(product.original_price)}</span>
            </>
          ) : (
            <span className="font-black text-[13px]" style={{ color: primaryColor }}>{clp(product.price)}</span>
          )}
        </div>
      </div>
      {/* Imagen */}
      <div className="relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover block" />
        ) : (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-4xl">🍱</div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-white/55 flex items-center justify-center">
            <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-gray-900/80 text-white">Agotado</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Panel carrito (desktop) ──────────────────────────────────────
function CartPanel({ tenant, primaryColor, cartBump, mounted, onOpenDeliveryModal }: {
  tenant: StoreTenant; primaryColor: string; cartBump: boolean; mounted: boolean; onOpenDeliveryModal: () => void;
}) {
  const router = useRouter();
  const { items, deliveryType, deliveryAddress, deliverySelected, updateQty } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());
  const deliveryFee = deliveryType === "delivery" ? deliveryAddress?.fee ?? 0 : 0;
  const estimatedTime = deliverySelected ? tenant.waitTime ?? "" : "";
  const showItems = mounted && items.length > 0;
  const belowMin = tenant.minAmount != null && subtotal < tenant.minAmount;

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
              <p className="text-sm font-semibold text-gray-500">¿Dónde quieres pedir?</p>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <p className="text-xs font-bold text-gray-700">🛵 Delivery</p>
                <p className="text-xs text-gray-500 truncate">{shortAddr(deliveryAddress.address)}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-700">🏠 Retiro en tienda</p>
                {tenant.address && <p className="text-xs text-gray-400 truncate">{tenant.address}</p>}
              </>
            )}
          </div>
          {deliverySelected && <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        </button>
        {deliverySelected && estimatedTime && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">⏱ Tiempo estimado: <span className="font-bold" style={{ color: primaryColor }}>{estimatedTime} min</span></p>
          </div>
        )}
      </div>

      {/* Título */}
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className={`font-black text-base text-gray-900 inline-block ${cartBump ? "cart-bump" : ""}`}>Tu Carrito</h2>
      </div>

      {!showItems ? (
        <div className="px-5 py-10 text-center">
          <p className="text-4xl mb-3">🛒</p>
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
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">🍱</div>
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
            {!tenant.openStatus.open ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs text-center">🔒 Cerrado por ahora</div>
            ) : belowMin ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs text-center">Monto mínimo: {clp(tenant.minAmount!)}</div>
            ) : (
              <button onClick={() => router.push(`/ecommerce/${tenant.slug}/checkout`)} className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
                Continuar con mi pedido →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal selección de entrega (retiro / delivery) ──────────────
function DeliveryModal({ tenant, primaryColor, onClose }: { tenant: StoreTenant; primaryColor: string; onClose: () => void }) {
  const { deliveryType, deliveryAddress, confirmPickup, setDeliveryAddress } = useCartStore();
  const zones = tenant.deliveryZones;
  const distanceMode = tenant.deliveryConfig.mode === "distance";
  const [tab, setTab] = useState<"pickup" | "delivery">(
    !tenant.pickupEnabled ? "delivery" : !tenant.deliveryEnabled ? "pickup" : deliveryType,
  );
  const [details, setDetails] = useState(deliveryAddress?.details ?? "");

  // Modo comuna
  const [address, setAddress] = useState(deliveryAddress?.address ?? "");
  const [zoneId, setZoneId] = useState(() => zones.find((z) => z.name === deliveryAddress?.zoneName)?.id ?? (zones.length === 1 ? zones[0].id : ""));
  const selectedZone = zones.find((z) => z.id === zoneId) ?? null;

  // Modo distancia (Google Maps autocomplete)
  const gmapsReady = useGoogleMaps(distanceMode ? tenant.googleMapsKey : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [feeResult, setFeeResult] = useState<DistanceFeeResult | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Adjunta el autocompletado cuando el SDK está listo y estamos en delivery+distancia.
  useEffect(() => {
    if (!distanceMode || tab !== "delivery" || !gmapsReady || !inputRef.current) return;
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["cl"] },
      types: ["address"],
      fields: ["formatted_address", "geometry"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) return;
      const d = { lat: loc.lat(), lng: loc.lng(), address: place.formatted_address || inputRef.current!.value };
      setDest(d);
      setFeeResult(computeDistanceFee(tenant.deliveryConfig, d));
    });
    inputRef.current.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    return () => { g.maps.event?.removeListener?.(listener); };
  }, [distanceMode, tab, gmapsReady, tenant.deliveryConfig]);

  const deliveryReady = distanceMode ? !!(feeResult?.available && dest) : (!!selectedZone && !!address.trim());

  function confirm() {
    if (tab === "pickup") { confirmPickup(); onClose(); return; }
    if (distanceMode) {
      if (!feeResult?.available || !dest) return;
      setDeliveryAddress({ address: dest.address, details: details.trim(), lat: dest.lat, lng: dest.lng, fee: feeResult.fee, zoneName: null, minOrder: null });
      onClose();
      return;
    }
    if (!selectedZone || !address.trim()) return;
    setDeliveryAddress({ address: `${address.trim()}, ${selectedZone.name}`, details: details.trim(), lat: null, lng: null, fee: selectedZone.fee, zoneName: selectedZone.name, minOrder: selectedZone.minOrder ?? null });
    onClose();
  }

  const noZones = !distanceMode && zones.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-3xl sm:max-w-md shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
          <h2 className="font-black text-lg text-gray-900">¿Cómo quieres tu pedido?</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition"><X className="w-5 h-5" /></button>
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
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-sm font-bold text-gray-700 mb-1">🏠 Retiras en tienda</p>
              {tenant.address ? <p className="text-sm text-gray-500">{tenant.address}</p> : <p className="text-sm text-gray-400">Dirección disponible al confirmar el pedido.</p>}
            </div>
          ) : distanceMode ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dirección de entrega</span>
                <input ref={inputRef} defaultValue={deliveryAddress?.address ?? ""} placeholder={gmapsReady ? "Escribe tu dirección…" : "Cargando mapa…"} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                <span className="text-[11px] text-gray-400">Elige una opción de la lista para calcular el despacho.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Depto / casa / referencia</span>
                <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Opcional" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </label>
              {!tenant.googleMapsKey && <p className="text-xs text-red-500 px-1">El local aún no configuró Google Maps.</p>}
              {feeResult && !feeResult.available && <p className="text-xs text-red-500 px-1">{feeResult.reason}</p>}
              {feeResult?.available && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-gray-500">Despacho · {feeResult.distanceKm.toFixed(1)} km</span>
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
