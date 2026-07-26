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

  return (
    <div style={{ minHeight: "100dvh", background: "var(--carta-bg, #fff)", fontFamily: FB }}>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--carta-bg, #fff)", borderBottom: "1px solid var(--carta-border, #eee)", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
          {restaurant.logoUrl && (
            <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "var(--carta-text, #111)", margin: 0 }}>{restaurant.name}</p>
            {orderingConfig.waitTime && (
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--carta-text2, #777)", margin: 0 }}>⏱ {orderingConfig.waitTime}</p>
            )}
          </div>
          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", background: count > 0 ? "var(--carta-accent, #F4A623)" : "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
          >
            <ShoppingCart size={18} color={count > 0 ? "#fff" : "var(--carta-text2, #888)"} />
            {count > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#111", color: "#fff", fontFamily: F, fontWeight: 700, fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color="var(--carta-text2, #999)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar plato..."
            style={{
              width: "100%", padding: "9px 36px 9px 34px", borderRadius: 10, border: "1.5px solid var(--carta-border, #eee)",
              fontFamily: FB, fontSize: "0.83rem", color: "var(--carta-text, #111)",
              background: "var(--carta-surface, #f5f5f5)", outline: "none", boxSizing: "border-box",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", display: "flex" }}>
              <X size={14} color="var(--carta-text2, #999)" />
            </button>
          )}
        </div>

        {/* Category pills */}
        {categories.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: !activeCategory ? "var(--carta-accent, #F4A623)" : "var(--carta-surface, #f2f2f2)", color: !activeCategory ? "#fff" : "var(--carta-text2, #666)", transition: "all 0.15s" }}
            >
              Todo
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: activeCategory === cat.id ? "var(--carta-accent, #F4A623)" : "var(--carta-surface, #f2f2f2)", color: activeCategory === cat.id ? "#fff" : "var(--carta-text2, #666)", transition: "all 0.15s", whiteSpace: "nowrap" }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dishes */}
      <div style={{ padding: "8px 0 120px" }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--carta-text2, #999)" }}>
            <Search size={32} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>Sin resultados para "{search}"</p>
          </div>
        ) : (
          grouped.map(({ category, dishes }) => (
            <div key={category.id}>
              <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: "0.85rem", color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".05em", padding: "18px 16px 8px", margin: 0 }}>
                {category.name}
              </h2>
              {dishes.map(dish => (
                <button
                  key={dish.id}
                  onClick={() => setSelectedDish(dish as DishForOrder)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, width: "100%",
                    padding: "12px 16px", border: "none", cursor: "pointer",
                    background: "none", borderBottom: "1px solid var(--carta-border, #f0f0f0)",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontWeight: 600, fontSize: "0.9rem", color: "var(--carta-text, #111)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dish.name}
                    </p>
                    {dish.description && (
                      <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--carta-text2, #777)", margin: "0 0 6px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {dish.description}
                      </p>
                    )}
                    <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: "var(--carta-accent, #F4A623)", margin: 0 }}>
                      {formatCLP(dish.price)}
                    </p>
                  </div>
                  {dish.imageUrl ? (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={dish.imageUrl} alt={dish.name} style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "var(--carta-accent, #F4A623)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                        <span style={{ color: "#fff", fontSize: "1rem", lineHeight: 1, fontWeight: 700, marginTop: -1 }}>+</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "1.2rem" }}>🍽️</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Sticky cart bar (when has items) */}
      {count > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))", background: "var(--carta-bg, #fff)", borderTop: "1px solid var(--carta-border, #eee)" }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: "none", background: "var(--carta-accent, #F4A623)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 520, margin: "0 auto" }}
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
