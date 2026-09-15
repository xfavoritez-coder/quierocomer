"use client";
// ═══════════════════════════════════════════════════════════
//  Zustand store del carrito del Ecommerce — persiste en localStorage.
//  Portado del cart-store de Servio (diseño 1.0), adaptado a quierocomer.
// ═══════════════════════════════════════════════════════════
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DeliveryType = "pickup" | "delivery";

export interface CartItemOption {
  group_id: string;
  group_name: string;
  value_id: string;
  value: string;
  price_delta: number;
  toteat_modifier_code?: string | null;
}

export interface CartItem {
  product_id: string;
  name: string;
  unit_price: number; // precio base + deltas de opciones
  base_price: number;
  quantity: number;
  image_url: string | null;
  toteat_code?: string | null;
  options: CartItemOption[];
}

export interface DeliveryAddress {
  address: string;
  details: string;
  lat: number | null;
  lng: number | null;
  fee: number;
  zoneName?: string | null;
  minOrder?: number | null;
}

interface CartState {
  restaurantId: string;
  items: CartItem[];
  deliveryType: DeliveryType;
  deliverySelected: boolean; // true solo cuando el usuario eligió explícitamente
  notes: string;
  deliveryAddress: DeliveryAddress | null;

  setRestaurantId: (id: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, options: CartItemOption[]) => void;
  updateQty: (productId: string, options: CartItemOption[], delta: number) => void;
  clearCart: () => void;
  setDeliveryType: (t: DeliveryType) => void;
  setNotes: (n: string) => void;
  setDeliveryAddress: (info: DeliveryAddress) => void;
  clearDeliveryAddress: () => void;
  confirmPickup: () => void;

  itemCount: () => number;
  subtotal: () => number;
  total: () => number;
}

function optionsKey(options: CartItemOption[]): string {
  return options.map((o) => `${o.value_id}`).sort().join(",");
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: "",
      items: [],
      deliveryType: "pickup",
      deliverySelected: false,
      notes: "",
      deliveryAddress: null,

      setRestaurantId: (id) => {
        // Si cambia de restaurante, vaciar el carrito (evita mezclar tiendas).
        if (get().restaurantId && get().restaurantId !== id) {
          set({ restaurantId: id, items: [], deliveryAddress: null, deliverySelected: false });
        } else {
          set({ restaurantId: id });
        }
      },

      addItem: (newItem) => {
        const items = get().items;
        const key = optionsKey(newItem.options);
        const idx = items.findIndex((i) => i.product_id === newItem.product_id && optionsKey(i.options) === key);
        if (idx >= 0) {
          const updated = [...items];
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + newItem.quantity };
          set({ items: updated });
        } else {
          set({ items: [...items, newItem] });
        }
      },

      removeItem: (productId, options) => {
        const key = optionsKey(options);
        set({ items: get().items.filter((i) => !(i.product_id === productId && optionsKey(i.options) === key)) });
      },

      updateQty: (productId, options, delta) => {
        const key = optionsKey(options);
        const updated = get().items
          .map((i) => (i.product_id === productId && optionsKey(i.options) === key ? { ...i, quantity: i.quantity + delta } : i))
          .filter((i) => i.quantity > 0);
        set({ items: updated });
      },

      clearCart: () => set({ items: [], notes: "", deliveryAddress: null, deliverySelected: false }),

      setDeliveryType: (t) => {
        if (t === "pickup") set({ deliveryType: t, deliveryAddress: null });
        else set({ deliveryType: t });
      },
      setNotes: (n) => set({ notes: n }),
      setDeliveryAddress: (info) => set({ deliveryAddress: info, deliveryType: "delivery", deliverySelected: true }),
      clearDeliveryAddress: () => set({ deliveryAddress: null }),
      confirmPickup: () => set({ deliveryType: "pickup", deliveryAddress: null, deliverySelected: true }),

      itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      total: () => {
        const s = get();
        const fee = s.deliveryType === "delivery" ? s.deliveryAddress?.fee ?? 0 : 0;
        return s.items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0) + fee;
      },
    }),
    {
      name: "qc-ecommerce-cart",
      partialize: (s) => ({
        items: s.items,
        deliveryType: s.deliveryType,
        deliverySelected: s.deliverySelected,
        restaurantId: s.restaurantId,
        deliveryAddress: s.deliveryAddress,
      }),
    },
  ),
);
