"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Search, X } from "lucide-react";
import { useCart } from "./OrderCartContext";
import OrderItemModal, { type DishForOrder } from "./OrderItemModal";
import OrderCart from "./OrderCart";
import OrderCheckout from "./OrderCheckout";
import type { SelectedOption } from "./OrderCartContext";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Category { id: string; name: string; }
interface Dish {
  id: string; name: string; description?: string | null;
  price: number; discountPrice?: number | null; photos?: string[]; categoryId: string;
  isActive: boolean; deletedAt?: Date | null;
  modifierTemplates: any[];
}
interface Restaurant {
  name: string; slug: string; logoUrl?: string | null; bannerUrl?: string | null;
  categories: Category[]; dishes: Dish[];
}

interface OrderingConfig {
  phone: string;
  delivery: "PICKUP" | "DELIVERY" | "BOTH";
  minAmount: number | null;
  waitTime: string | null;
  note: string | null;
  address: string | null;
  paymentMethods?: string[];
  theme?: string;
  accentColor?: string | null;
  orderingBannerUrl?: string | null;
}

interface Props {
  restaurant: Restaurant;
  orderingConfig: OrderingConfig;
}

export default function OrderMenuPage({ restaurant, orderingConfig }: Props) {
  const { items, count, addItem } = useCart();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<DishForOrder | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const isDark = orderingConfig.theme === "dark";
  const accent = orderingConfig.accentColor || (isDark ? "#fe0001" : "#F59E0B");

  const themeVars: React.CSSProperties = isDark ? {
    "--carta-bg": "#0e0e0e",
    "--carta-surface": "#1a1a1a",
    "--carta-text": "#f0f0f0",
    "--carta-text2": "#aaa",
    "--carta-text3": "#555",
    "--carta-border": "#262626",
    "--carta-accent": accent,
    "--carta-card-bg": "#1a1a1a",
    "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.4)",
    "--carta-photo-bg": "#222",
  } as React.CSSProperties : {
    "--carta-bg": "#FAFAF8",
    "--carta-surface": "#fff",
    "--carta-text": "#111",
    "--carta-text2": "#666",
    "--carta-text3": "#999",
    "--carta-border": "#ece9e3",
    "--carta-accent": accent,
    "--carta-card-bg": "#fff",
    "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.07)",
    "--carta-photo-bg": "#f0ece6",
  } as React.CSSProperties;

  // Build category list from active dishes
  const activeDishes = restaurant.dishes.filter(d => d.isActive && !d.deletedAt);
  const activeCatIds = new Set(activeDishes.map(d => d.categoryId));
  const categories = restaurant.categories.filter(c => activeCatIds.has(c.id));

  // Filter by search and active category
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeDishes.filter(d => {
      if (activeCategory && d.categoryId !== activeCategory) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeDishes, search, activeCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const d of filtered) {
      const arr = map.get(d.categoryId) || [];
      arr.push(d);
      map.set(d.categoryId, arr);
    }
    return categories.filter(c => map.has(c.id)).map(c => ({ category: c, dishes: map.get(c.id)! }));
  }, [filtered, categories]);

  const handleAddItem = ({ selectedOptions, quantity, notes }: { selectedOptions: SelectedOption[]; quantity: number; notes: string }) => {
    if (!selectedDish) return;
    const priceAdj = selectedOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    const effectivePrice = selectedDish.discountPrice != null && selectedDish.discountPrice < selectedDish.price
      ? selectedDish.discountPrice : selectedDish.price;
    addItem({
      dishId: selectedDish.id,
      dishName: selectedDish.name,
      dishPrice: effectivePrice,
      imageUrl: selectedDish.photos?.[0] || null,
      quantity,
      selectedOptions,
      unitTotal: effectivePrice + priceAdj,
      notes,
    });
    setSelectedDish(null);
  };

  const firstDishPhoto = activeDishes.find(d => d.photos?.[0])?.photos?.[0] || null;
  const heroImg = orderingConfig.orderingBannerUrl || restaurant.bannerUrl || firstDishPhoto;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--carta-bg)", fontFamily: FB, ...themeVars }}>

      <style>{`
        .order-search-input::placeholder { color: var(--carta-text3); }
        .order-search-input { color: var(--carta-text); background: var(--carta-surface); border-color: var(--carta-border); }
      `}</style>

      {/* HERO BANNER */}
      {heroImg && (
        <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden", flexShrink: 0 }}>
          <img src={heroImg} alt={restaurant.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }} />
            )}
            <p style={{ fontFamily: F, fontWeight: 800, fontSize: "1.3rem", color: "#fff", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.45)", textAlign: "center", padding: "0 20px" }}>
              {restaurant.name}
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", margin: 0 }}>
              ⏱ {orderingConfig.waitTime || "30-45 min"}
            </p>
          </div>
        </div>
      )}

      {/* HEADER sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--carta-bg)", borderBottom: "1px solid var(--carta-border)", padding: "0 16px" }}>

        {/* Fila 1: logo + nombre + carrito */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
          {restaurant.logoUrl && (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--carta-border)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
            />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "var(--carta-text)", margin: 0 }}>
              {restaurant.name}
            </p>
            {!heroImg && (
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--carta-text3)", margin: 0 }}>
                ⏱ {orderingConfig.waitTime || "30-45 min"}
              </p>
            )}
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none",
              cursor: "pointer", background: count > 0 ? "var(--carta-accent)" : "var(--carta-photo-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.2s",
            }}
          >
            <ShoppingCart size={17} color={count > 0 ? "#fff" : "#888"} />
            {count > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                width: 17, height: 17, borderRadius: "50%",
                background: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)", color: "#fff",
                fontFamily: F, fontWeight: 700, fontSize: "0.6rem",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Fila 2: pills de categorías */}
        {categories.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                border: `1.5px solid ${!activeCategory ? "var(--carta-accent)" : "var(--carta-border)"}`,
                background: !activeCategory ? "var(--carta-accent)" : "transparent",
                color: !activeCategory ? "#fff" : "var(--carta-text3)",
                fontFamily: F, fontSize: "0.76rem", fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              Todo
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                  border: `1.5px solid ${activeCategory === cat.id ? "var(--carta-accent)" : "var(--carta-border)"}`,
                  background: activeCategory === cat.id ? "var(--carta-accent)" : "transparent",
                  color: activeCategory === cat.id ? "#fff" : "var(--carta-text3)",
                  fontFamily: F, fontSize: "0.76rem", fontWeight: 600,
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LISTA DE PLATOS */}
      <div style={{ padding: "8px 0 120px" }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--carta-text3)" }}>
            <Search size={32} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>Sin resultados para "{search}"</p>
          </div>
        ) : (
          grouped.map(({ category, dishes }) => (
            <div key={category.id}>
              {/* Título de categoría */}
              <p style={{
                fontFamily: F, fontWeight: 800, fontSize: "0.82rem", color: "var(--carta-text2)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "20px 14px 8px", margin: 0,
              }}>
                {category.name}
              </p>

              {/* Platos */}
              {dishes.map(dish => (
                <button
                  key={dish.id}
                  onClick={() => setSelectedDish(dish as unknown as DishForOrder)}
                  style={{
                    margin: "0 12px 10px",
                    background: "var(--carta-card-bg)",
                    borderRadius: 16,
                    boxShadow: "var(--carta-card-shadow)",
                    display: "flex",
                    alignItems: "stretch",
                    overflow: "hidden",
                    minHeight: 108,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "calc(100% - 24px)",
                    padding: 0,
                  }}
                >
                  {/* Izquierda: texto */}
                  <div style={{
                    flex: 1, padding: "14px 10px 14px 14px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{
                        fontFamily: F, fontWeight: 700, fontSize: "1.1rem",
                        color: "var(--carta-text)", lineHeight: 1.3, margin: "0 0 4px",
                      }}>
                        {dish.name}
                      </p>
                      {dish.description && (
                        <p style={{
                          fontFamily: FB, fontSize: "0.95rem", color: "var(--carta-text2)", margin: 0,
                          display: "-webkit-box", WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5,
                        }}>
                          {dish.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
                      <p style={{ fontFamily: F, fontWeight: 800, fontSize: "0.92rem", color: "var(--carta-accent)", margin: 0 }}>
                        {formatCLP(dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price)}
                      </p>
                      {dish.discountPrice != null && dish.discountPrice < dish.price && (
                        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--carta-text3)", margin: 0, textDecoration: "line-through" }}>
                          {formatCLP(dish.price)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Derecha: foto */}
                  <div style={{ width: 120, flexShrink: 0, position: "relative", background: "var(--carta-photo-bg)" }}>
                    {dish.photos?.[0] ? (
                      <img
                        src={dish.photos[0]}
                        alt={dish.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "2rem" }}>🍽️</span>
                      </div>
                    )}
                    {/* Botón + */}
                    <div style={{
                      position: "absolute", bottom: 8, right: 8,
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--carta-accent)", color: "#fff",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      fontSize: 18, fontWeight: 700,
                    }}>
                      +
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* STICKY CART BAR */}
      {count > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
          padding: "10px 16px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          background: "var(--carta-bg)", borderTop: "1px solid var(--carta-border)",
        }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: "100%", padding: "13px 18px", borderRadius: 14, border: "none",
              background: "var(--carta-accent)", color: "#fff", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              maxWidth: 520, margin: "0 auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              fontFamily: F,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%",
                background: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                fontFamily: F, fontWeight: 700, fontSize: "0.78rem", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {count}
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {formatCLP(items.reduce((s, i) => s + i.unitTotal * i.quantity, 0))}
            </span>
          </button>
        </div>
      )}

      {/* Modales */}
      {selectedDish && (
        <OrderItemModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onAdd={handleAddItem}
        />
      )}
      {cartOpen && !checkoutOpen && (
        <OrderCart
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        />
      )}
      {checkoutOpen && (
        <OrderCheckout
          restaurantName={restaurant.name}
          restaurantSlug={restaurant.slug}
          orderingConfig={orderingConfig}
          onBack={() => { setCheckoutOpen(false); setCartOpen(true); }}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  );
}
