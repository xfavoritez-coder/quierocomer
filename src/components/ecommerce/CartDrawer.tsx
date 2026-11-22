"use client";
import { useEffect, useState, useCallback } from "react";
import { X, Plus, Minus, MapPin, Store, ChevronRight, Motorbike, ShoppingCart, UtensilsCrossed, Lock, AlertTriangle, Trash2 } from "lucide-react";
import type { StoreTenant, StoreProduct, StoreCategory } from "@/lib/ecommerce/storefront-data";
import { useCartStore, type CartItem } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { shortAddr } from "./StoreFront";

interface Props {
  open: boolean;
  onClose: () => void;
  tenant: StoreTenant;
  primaryColor: string;
  onOpenDeliveryModal: () => void;
  mobileOnly?: boolean;
  basePath?: string;
  products?: StoreProduct[];
  categories?: StoreCategory[];
  onOpenProduct?: (product: StoreProduct) => void;
}

export default function CartDrawer({ open, onClose, tenant, primaryColor, onOpenDeliveryModal, mobileOnly = true, basePath, products, categories, onOpenProduct }: Props) {
  const storeBase = basePath ?? `/ecommerce/${tenant.slug}`;
  const { items, deliveryType, deliveryAddress, deliverySelected, updateQty, removeItem, addItem, restaurantId } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());
  const deliveryFee = deliveryType === "delivery" ? deliveryAddress?.fee ?? 0 : 0;

  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [popularTopIds, setPopularTopIds] = useState<Set<string>>(new Set());
  const [popularPairs, setPopularPairs] = useState<Record<string, string[]>>({});

  const checkAvailability = useCallback(async () => {
    const ids = [...new Set(items.map((i) => i.product_id))];
    if (!restaurantId || ids.length === 0) { setUnavailableIds(new Set()); return; }
    setChecking(true);
    try {
      const res = await fetch(`/api/ecommerce/check-items?restaurantId=${restaurantId}&ids=${ids.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      setUnavailableIds(new Set(data.unavailable ?? []));
    } catch { /* noop */ } finally {
      setChecking(false);
    }
  }, [restaurantId, items]);

  const loadPopularity = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(`/api/ecommerce/popular-products?restaurantId=${restaurantId}`);
      if (!res.ok) return;
      const data = await res.json();
      setPopularTopIds(new Set(data.topIds ?? []));
      setPopularPairs(data.pairs ?? {});
    } catch { /* noop */ }
  }, [restaurantId]);

  useEffect(() => {
    if (open) { checkAvailability(); loadPopularity(); }
    else setUnavailableIds(new Set());
  }, [open, checkAvailability, loadPopularity]);

  if (!open) return null;

  const minPerType = deliveryType === "delivery" ? (deliveryAddress?.minOrder ?? tenant.minOrderDelivery) : tenant.minOrderPickup;
  const minReq = minPerType && minPerType > 0 ? minPerType : null;
  const belowMin = minReq != null && subtotal < minReq;
  const hasUnavailable = unavailableIds.size > 0;

  const removeUnavailable = () => {
    for (const item of items) {
      if (unavailableIds.has(item.product_id)) removeItem(item.product_id, item.options);
    }
    setUnavailableIds(new Set());
  };

  return (
    <div className={`fixed inset-0 z-50 ${mobileOnly ? "lg:hidden" : ""}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
          <h2 className="font-black text-lg text-gray-900">Tu pedido</h2>
          <button onClick={onClose} className="qc-glass-x w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de entrega */}
        <button onClick={onOpenDeliveryModal} className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 hover:bg-gray-50/80 transition text-left bg-gray-50/50">
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-gray-100">
            {deliverySelected && deliveryType === "delivery" ? <MapPin className="w-3.5 h-3.5 text-gray-500" /> : <Store className="w-3.5 h-3.5 text-gray-500" />}
          </div>
          <div className="flex-1 min-w-0">
            {!deliverySelected ? (
              <p className="text-sm font-semibold text-gray-500">¿Dónde quieres pedir?</p>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <p className="text-xs font-bold text-gray-700">Entrega a</p>
                <p className="text-xs text-gray-500 truncate">{shortAddr(deliveryAddress.address)}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1"><Store size={13} className="shrink-0" /> Retiro en tienda</p>
                {tenant.address && <p className="text-xs text-gray-400 truncate">{tenant.address}</p>}
              </>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
            <ShoppingCart className="mx-auto mb-3 text-gray-300" size={40} strokeWidth={1.5} />
            <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Banner de productos no disponibles */}
            {!checking && hasUnavailable && (
              <div className="mx-4 mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-700 leading-snug">
                    {unavailableIds.size === 1 ? "1 producto ya no está disponible" : `${unavailableIds.size} productos ya no están disponibles`}
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">Retíralos del carrito para poder continuar con tu pedido.</p>
                </div>
                <button
                  onClick={removeUnavailable}
                  className="text-xs font-bold text-red-600 hover:text-red-700 shrink-0 underline underline-offset-2"
                >
                  Quitar
                </button>
              </div>
            )}

            <div className="p-4 flex flex-col gap-3">
              {items.map((item) => {
                const isUnavailable = unavailableIds.has(item.product_id);
                return (
                  <div
                    key={`${item.product_id}-${item.options.map((o) => o.value_id).join(",")}`}
                    className={`flex gap-3 items-center ${isUnavailable ? "opacity-60" : ""}`}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className={`w-12 h-12 rounded-xl object-cover shrink-0 ${isUnavailable ? "grayscale" : ""}`} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><UtensilsCrossed size={20} className="text-gray-400" strokeWidth={1.5} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${isUnavailable ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</p>
                      {isUnavailable ? (
                        <p className="text-xs font-semibold text-red-500 mt-0.5">Ya no disponible</p>
                      ) : (
                        <p className="text-sm font-black mt-0.5" style={{ color: primaryColor }}>{clp(item.unit_price * item.quantity)}</p>
                      )}
                    </div>
                    {isUnavailable ? (
                      <button
                        onClick={() => { removeItem(item.product_id, item.options); setUnavailableIds((prev) => { const next = new Set(prev); next.delete(item.product_id); return next; }); }}
                        className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => updateQty(item.product_id, item.options, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-black text-gray-900">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, item.options, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cross-sell: sugerencias inteligentes */}
            {products && products.length > 0 && (() => {
              const suggestions = getSuggestions(items, products, popularTopIds, popularPairs);
              if (!suggestions.length) return null;
              return (
                <div className="bg-gray-50/80 px-4 py-3 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Agrega a tu pedido</p>
                  <div className="relative">
                    <div className="flex gap-2 overflow-x-auto pb-1 cart-xsell-scroll" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                      <style>{`.cart-xsell-scroll::-webkit-scrollbar{display:none}`}</style>
                      {suggestions.map((p) => {
                        const hasRequiredGroups = p.option_groups.some(g => g.min_select > 0);
                        const isPopular = popularTopIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (hasRequiredGroups && onOpenProduct) {
                                onClose();
                                setTimeout(() => onOpenProduct(p), 150);
                              } else {
                                addItem({
                                  product_id: p.id, name: p.name, unit_price: p.price, base_price: p.price,
                                  quantity: 1, image_url: p.image_url, toteat_code: p.toteat_code,
                                  is_happy_hour: p.is_happy_hour === true, promo_id: p.promo_id ?? null, options: [],
                                });
                              }
                            }}
                            className="flex items-center gap-2.5 shrink-0 bg-white rounded-xl border border-gray-100 px-2 py-2 hover:border-gray-200 hover:shadow-sm transition text-left"
                            style={{ maxWidth: 200 }}
                          >
                            <div className="relative shrink-0">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <UtensilsCrossed size={16} className="text-gray-300" strokeWidth={1.5} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">{p.name}</p>
                                {isPopular && <span className="shrink-0 text-[8px] font-extrabold uppercase px-1 py-px rounded bg-amber-100 text-amber-700">Top</span>}
                              </div>
                              <p className="text-[11px] font-black text-gray-500 mt-0.5">{clp(p.price)}</p>
                            </div>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${primaryColor}15` }}>
                              <Plus className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Fade derecho en mobile para indicar scroll */}
                    <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-gray-50/80 to-transparent pointer-events-none lg:hidden" />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Totales + CTA */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{clp(subtotal)}</span>
            </div>
            {deliveryType === "delivery" && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Delivery</span><span>{deliveryAddress ? clp(deliveryFee) : "—"}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span><span style={{ color: primaryColor }}>{clp(total)}</span>
            </div>
            {hasUnavailable ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center gap-1.5">
                <AlertTriangle size={13} className="shrink-0" /> Retira los productos no disponibles
              </div>
            ) : !tenant.openStatus.open ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs flex items-center justify-center gap-1.5">
                <Lock size={13} className="shrink-0" /> {tenant.openStatus.closedByClosure && tenant.openStatus.closure ? tenant.openStatus.closure.reason : "Cerrado por ahora"}
              </div>
            ) : !deliverySelected ? (
              <button
                onClick={onOpenDeliveryModal}
                className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90"
                style={{ background: primaryColor }}
              >
                {tenant.pickupEnabled && tenant.deliveryEnabled ? "Elige cómo recibir tu pedido" : tenant.deliveryEnabled ? "Ingresa tu dirección de entrega" : "Confirmar retiro"} →
              </button>
            ) : belowMin ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs text-center">
                Monto mínimo: {clp(minReq!)}
              </div>
            ) : (
              <button
                onClick={() => { window.location.href = `${storeBase}/checkout`; }}
                className="mt-1 w-full py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90"
                style={{ background: primaryColor }}
              >
                Continuar con mi pedido →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Detecta si un producto es un plato principal/combo/promo (vs complemento como entrada, bebida, postre).
// Heurística: si el precio es alto (>= 70% del precio más alto de la carta) o su nombre/categoría
// contiene keywords de combo/promo, es un "principal" y no debería sugerirse si ya hay uno en el carrito.
const MAIN_KEYWORDS = /promo|combo|combi|dúo|duo|trio|trío|familiar|deluxe|suprema|especial|mixto|parrilla|tabla|bandeja/i;
const COMPLEMENT_KEYWORDS = /entrada|acompañ|bebida|drink|jugo|agua|postre|helado|mochi|gyoza|edamame|roll individual|pieza|salsa/i;

function isMainDish(p: StoreProduct, maxPrice: number): boolean {
  if (COMPLEMENT_KEYWORDS.test(p.name)) return false;
  if (MAIN_KEYWORDS.test(p.name)) return true;
  return p.price >= maxPrice * 0.65;
}

/** Sugerencias inteligentes: complementos reales, no más platos principales.
 *  Usa co-ocurrencia (qué se compra junto), popularidad, y filtra inteligentemente. */
function getSuggestions(
  cartItems: CartItem[], products: StoreProduct[],
  topIds: Set<string>, pairs: Record<string, string[]>,
  maxResults = 5,
): StoreProduct[] {
  if (!cartItems.length || !products.length) return [];

  const cartIds = new Set(cartItems.map(i => i.product_id));
  const cartCatIds = new Set<string>();
  const productMap = new Map(products.map(p => [p.id, p]));

  for (const item of cartItems) {
    const product = productMap.get(item.product_id);
    if (product) cartCatIds.add(product.category_id);
  }

  // Precio máximo de la carta (para detectar platos principales)
  const maxPrice = Math.max(...products.filter(p => !p.is_sold_out && !p.hidden).map(p => p.price), 1);

  // ¿El carrito ya tiene un plato principal/combo?
  const cartHasMain = cartItems.some(item => {
    const p = productMap.get(item.product_id);
    return p ? isMainDish(p, maxPrice) : item.unit_price >= maxPrice * 0.65;
  });

  // Co-ocurrencia: productos que otros compraron junto
  const coScores = new Map<string, number>();
  for (const item of cartItems) {
    const pairIds = pairs[item.product_id];
    if (!pairIds) continue;
    for (let i = 0; i < pairIds.length; i++) {
      const id = pairIds[i];
      if (cartIds.has(id)) continue;
      const p = productMap.get(id);
      if (!p || p.is_sold_out || p.hidden) continue;
      coScores.set(id, (coScores.get(id) ?? 0) + (pairIds.length - i));
    }
  }

  // Candidatos: diferente categoría + no en carrito + disponible
  const fallbackCandidates = products.filter(p =>
    !cartIds.has(p.id) && !cartCatIds.has(p.category_id) && !p.is_sold_out && !p.hidden
  );

  const allCandidateIds = new Set([...coScores.keys(), ...fallbackCandidates.map(p => p.id)]);
  const scored: { product: StoreProduct; score: number }[] = [];

  for (const id of allCandidateIds) {
    const p = productMap.get(id);
    if (!p || cartIds.has(id) || p.is_sold_out || p.hidden) continue;

    // Si ya hay un plato principal en el carrito, no sugerir otro principal
    if (cartHasMain && isMainDish(p, maxPrice)) continue;

    let score = 0;
    // Co-ocurrencia (señal más fuerte)
    score += (coScores.get(id) ?? 0) * 15;
    // Popularidad real
    if (topIds.has(id)) score += 25;
    // Es complemento explícito (entrada, bebida, postre)
    if (COMPLEMENT_KEYWORDS.test(p.name)) score += 12;
    // Tiene imagen
    if (p.image_url) score += 8;
    // Sin modificadores obligatorios (1-click add)
    if (!p.option_groups.some(g => g.min_select > 0)) score += 6;
    // Precio bajo = buen complemento
    if (p.price < maxPrice * 0.35) score += 8;
    else if (p.price < maxPrice * 0.5) score += 4;
    // Categoría diferente a las del carrito
    if (!cartCatIds.has(p.category_id)) score += 5;
    // Con descuento activo
    if (p.original_price && p.original_price > p.price) score += 3;

    scored.push({ product: p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => s.product);
}
