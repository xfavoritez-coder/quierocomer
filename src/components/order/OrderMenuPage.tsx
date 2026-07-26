"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Search, X } from "lucide-react";
import { useCart } from "./OrderCartContext";
import { useOrderLang } from "./OrderLangContext";
import OrderItemModal, { type DishForOrder } from "./OrderItemModal";
import OrderCart from "./OrderCart";
import OrderCheckout from "./OrderCheckout";
import type { SelectedOption } from "./OrderCartContext";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";
const AMBER = "#F59E0B";
const CREAM = "#FAFAF8";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Category { id: string; name: string; }
interface Dish {
  id: string; name: string; description?: string | null;
  price: number; photos?: string[]; categoryId: string;
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
}

interface Props {
  restaurant: Restaurant;
  orderingConfig: OrderingConfig;
}

export default function OrderMenuPage({ restaurant, orderingConfig }: Props) {
  const { items, count, addItem } = useCart();
  const { lang, setLang, s } = useOrderLang();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<DishForOrder | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
    addItem({
      dishId: selectedDish.id,
      dishName: selectedDish.name,
      dishPrice: selectedDish.price,
      imageUrl: selectedDish.photos?.[0] || null,
      quantity,
      selectedOptions,
      unitTotal: selectedDish.price + priceAdj,
      notes,
    });
    setSelectedDish(null);
  };

  // Pick best hero image: banner, or first dish with photo
  const heroImg = restaurant.bannerUrl ||
    activeDishes.find(d => d.photos?.[0])?.photos?.[0] || null;

  return (
    <div style={{ minHeight: "100dvh", background: CREAM, fontFamily: FB }}>

      {/* HERO BANNER */}
      {heroImg && (
        <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden", flexShrink: 0 }}>
          <img
            src={heroImg}
            alt={restaurant.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
              />
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
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #ece9e3", padding: "0 16px" }}>

        {/* Fila 1: logo + nombre + lang toggle + carrito */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
          {restaurant.logoUrl && (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
            />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "#111", margin: 0 }}>
              {restaurant.name}
            </p>
            {!heroImg && (
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#aaa", margin: 0 }}>
                ⏱ {orderingConfig.waitTime || "30-45 min"}
              </p>
            )}
          </div>

          {/* Lang toggle */}
          <div style={{ display: "flex", background: "#f0ece6", borderRadius: 999, padding: 3, gap: 2, flexShrink: 0 }}>
            {(["es", "en"] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: "4px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                  background: lang === l ? "#fff" : "transparent",
                  color: lang === l ? "#111" : "#999",
                  fontFamily: F, fontSize: "0.68rem", fontWeight: 700,
                  boxShadow: lang === l ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none",
              cursor: "pointer", background: count > 0 ? AMBER : "#f0ece6",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.2s",
            }}
          >
            <ShoppingCart size={17} color={count > 0 ? "#fff" : "#888"} />
            {count > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                width: 17, height: 17, borderRadius: "50%",
                background: "#111", color: "#fff",
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
                border: `1.5px solid ${!activeCategory ? AMBER : "#e5e7eb"}`,
                background: !activeCategory ? AMBER : "transparent",
                color: !activeCategory ? "#fff" : "#999",
                fontFamily: F, fontSize: "0.76rem", fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {s.all}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                  border: `1.5px solid ${activeCategory === cat.id ? AMBER : "#e5e7eb"}`,
                  background: activeCategory === cat.id ? AMBER : "transparent",
                  color: activeCategory === cat.id ? "#fff" : "#999",
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
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>
            <Search size={32} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>{s.noResults(search)}</p>
          </div>
        ) : (
          grouped.map(({ category, dishes }) => (
            <div key={category.id}>
              {/* Título de categoría */}
              <p style={{
                fontFamily: F, fontWeight: 800, fontSize: "0.82rem", color: "#7a736a",
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
                    background: "#fff",
                    borderRadius: 16,
                    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
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
                        fontFamily: F, fontWeight: 700, fontSize: "0.88rem",
                        color: "#111", lineHeight: 1.3, margin: "0 0 4px",
                      }}>
                        {dish.name}
                      </p>
                      {dish.description && (
                        <p style={{
                          fontFamily: FB, fontSize: "0.72rem", color: "#999", margin: 0,
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.45,
                        }}>
                          {dish.description}
                        </p>
                      )}
                    </div>
                    <p style={{
                      fontFamily: F, fontWeight: 800, fontSize: "0.92rem",
                      color: AMBER, margin: "8px 0 0",
                    }}>
                      {formatCLP(dish.price)}
                    </p>
                  </div>

                  {/* Derecha: foto */}
                  <div style={{ width: 120, flexShrink: 0, position: "relative", background: "#f0ece6" }}>
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
                      background: AMBER, color: "#fff",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(245,158,11,0.45)",
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
          background: "#fff", borderTop: "1px solid #ece9e3",
        }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: "100%", padding: "13px 18px", borderRadius: 14, border: "none",
              background: AMBER, color: "#fff", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              maxWidth: 520, margin: "0 auto",
              boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
              fontFamily: F,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "rgba(0,0,0,0.2)",
                fontFamily: F, fontWeight: 700, fontSize: "0.78rem", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {count}
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{s.viewCart}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {formatCLP(items.reduce((acc, i) => acc + i.unitTotal * i.quantity, 0))}
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
