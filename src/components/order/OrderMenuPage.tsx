"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Search, X } from "lucide-react";
import { useCart } from "./OrderCartContext";
import OrderItemModal, { type DishForOrder } from "./OrderItemModal";
import OrderCart from "./OrderCart";
import OrderCheckout from "./OrderCheckout";
import type { SelectedOption } from "./OrderCartContext";

const F = "var(--font-display, 'Inter', sans-serif)";
const FB = "var(--font-body, 'Inter', sans-serif)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Category { id: string; name: string; }
interface Dish {
  id: string; name: string; description?: string | null;
  price: number; imageUrl?: string | null; categoryId: string;
  isActive: boolean; deletedAt?: Date | null;
  modifierTemplates: any[];
}
interface Restaurant {
  name: string; slug: string; logoUrl?: string | null;
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
      imageUrl: selectedDish.imageUrl || null,
      quantity,
      selectedOptions,
      unitTotal: selectedDish.price + priceAdj,
      notes,
    });
    setSelectedDish(null);
  };

  const CREAM = "#FAFAF8";
  const AMBER = "#F59E0B";

  return (
    <div style={{ minHeight: "100dvh", background: CREAM, fontFamily: FB }}>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: CREAM, borderBottom: "1px solid #ece9e3", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
          {restaurant.logoUrl && (
            <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "#111", margin: 0 }}>{restaurant.name}</p>
            {orderingConfig.waitTime && (
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#999", margin: 0 }}>⏱ {orderingConfig.waitTime}</p>
            )}
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={15} color="#aaa" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: search ? 140 : 36, height: 36, padding: search ? "0 28px 0 30px" : "0 0 0 30px",
                borderRadius: 999, border: "1.5px solid #ece9e3",
                fontFamily: FB, fontSize: "0.8rem", color: "#111",
                background: "#fff", outline: "none", transition: "width 0.2s",
                overflow: "hidden",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                <X size={13} color="#aaa" />
              </button>
            )}
          </div>
          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", background: count > 0 ? AMBER : "#f0ece6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
          >
            <ShoppingCart size={16} color={count > 0 ? "#fff" : "#888"} />
            {count > 0 && (
              <span style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, borderRadius: "50%", background: "#111", color: "#fff", fontFamily: F, fontWeight: 700, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Category pills */}
        {categories.length > 1 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, border: `1.5px solid ${!activeCategory ? AMBER : "#ddd"}`, cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: !activeCategory ? AMBER : "transparent", color: !activeCategory ? "#fff" : "#888", transition: "all 0.15s" }}
            >
              Todo
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, border: `1.5px solid ${activeCategory === cat.id ? AMBER : "#ddd"}`, cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: activeCategory === cat.id ? AMBER : "transparent", color: activeCategory === cat.id ? "#fff" : "#888", transition: "all 0.15s", whiteSpace: "nowrap" }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dishes */}
      <div style={{ padding: "6px 12px 120px" }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa" }}>
            <Search size={32} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>Sin resultados para "{search}"</p>
          </div>
        ) : (
          grouped.map(({ category, dishes }) => (
            <div key={category.id}>
              <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: "0.68rem", color: "#bbb", textTransform: "uppercase", letterSpacing: ".07em", padding: "18px 16px 6px", margin: 0 }}>
                {category.name}
              </h2>
              {dishes.map(dish => (
                <button
                  key={dish.id}
                  onClick={() => setSelectedDish(dish as DishForOrder)}
                  style={{
                    display: "flex", alignItems: "stretch", width: "100%",
                    margin: "0 0 10px", padding: 0, border: "none", cursor: "pointer",
                    background: "#fff", borderRadius: 16,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    overflow: "hidden", textAlign: "left",
                    minHeight: 110,
                  }}
                >
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0, padding: "14px 12px 14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "#111", margin: "0 0 4px", lineHeight: 1.3 }}>
                        {dish.name}
                      </p>
                      {dish.description && (
                        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#999", margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.45 }}>
                          {dish.description}
                        </p>
                      )}
                    </div>
                    <p style={{ fontFamily: F, fontWeight: 800, fontSize: "0.9rem", color: AMBER, margin: "8px 0 0" }}>
                      {formatCLP(dish.price)}
                    </p>
                  </div>
                  {/* Photo */}
                  <div style={{ width: 120, flexShrink: 0, position: "relative", background: "#f0ece6" }}>
                    {dish.imageUrl ? (
                      <img src={dish.imageUrl} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "2rem" }}>🍽️</span>
                      </div>
                    )}
                    {/* + badge */}
                    <div style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: AMBER, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(245,158,11,0.5)" }}>
                      <span style={{ color: "#fff", fontSize: "1.1rem", lineHeight: 1, fontWeight: 700, marginTop: -1 }}>+</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Sticky cart bar (when has items) */}
      {count > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))", background: CREAM, borderTop: "1px solid #ece9e3" }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "none", background: AMBER, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 520, margin: "0 auto", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.2)", fontFamily: F, fontWeight: 700, fontSize: "0.78rem", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
            </div>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem" }}>
              {formatCLP(items.reduce((s, i) => s + i.unitTotal * i.quantity, 0))}
            </span>
          </button>
        </div>
      )}

      {/* Modals */}
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
