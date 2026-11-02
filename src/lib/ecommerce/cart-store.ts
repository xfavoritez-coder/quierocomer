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
  is_happy_hour?: boolean; // el precio del ítem viene de un happy hour activo
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
  parts?: import("@/lib/ecommerce/address").AddressParts | null; // partes separadas (calle, comuna, ciudad, región, país)
}

interface CartState {
  restaurantId: string;
  items: CartItem[];
  deliveryType: DeliveryType;
  deliverySelected: boolean; // true solo cuando el usuario eligió explícitamente
  notes: string;
  deliveryAddress: DeliveryAddress | null;

  setRestaurantId: (id: string) => void;
  adoptRestaurant: (id: string, products: AdoptProduct[]) => void;
  repriceItems: (products: RepriceProduct[]) => void;
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

// Forma mínima del producto de la carta que necesita el re-cotizado del carrito.
export interface RepriceProduct {
  id: string;
  price: number; // precio actual ya con la oferta vigente aplicada
  is_sold_out?: boolean;
  is_happy_hour?: boolean;
  option_groups: { id: string; values: { id: string; price_delta: number }[] }[];
}

// Forma del producto del catálogo de una sucursal, usada para "adoptar" el carrito
// en otra sucursal de la misma marca (ver adoptRestaurant). El emparejamiento es por
// NOMBRE (no por id) porque cada sucursal tiene sus propios registros de producto.
export interface AdoptProduct {
  id: string;
  name: string;
  price: number; // precio vigente (con oferta/happy hour ya aplicada)
  toteat_code: string | null;
  image_url: string | null;
  is_sold_out?: boolean;
  is_happy_hour?: boolean;
  option_groups: { id: string; name: string; values: { id: string; name: string; price_delta: number; toteat_modifier_code?: string | null; is_sold_out?: boolean }[] }[];
}

// Normaliza un nombre para emparejar entre sucursales (sin mayúsculas ni espacios extra).
function normName(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
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

      // Liga el carrito a una sucursal de la MISMA marca, re-mapeando los ítems por
      // NOMBRE al catálogo de esa sucursal (cada sucursal tiene ids de producto
      // propios, aunque el menú se vea igual). A diferencia de setRestaurantId, NO
      // vacía el carrito al cambiar de sucursal: conserva los ítems que existen en
      // la nueva (por nombre), re-mapeando también sus opciones y actualizando precio
      // y código Toteat. Los ítems/opciones sin equivalente se descartan. Tampoco
      // toca la selección de entrega (delivery/retiro), que la fija el selector de marca.
      adoptRestaurant: (id, products) => {
        const cur = get();
        // Misma sucursal → basta re-cotizar por id (más seguro que por nombre).
        if (cur.restaurantId === id) {
          get().repriceItems(products.map((p) => ({ id: p.id, price: p.price, is_sold_out: p.is_sold_out, is_happy_hour: p.is_happy_hour, option_groups: p.option_groups.map((g) => ({ id: g.id, values: g.values.map((v) => ({ id: v.id, price_delta: v.price_delta })) })) })));
          if (cur.restaurantId !== id) set({ restaurantId: id });
          return;
        }
        const byName = new Map(products.map((p) => [normName(p.name), p]));
        const next: CartItem[] = [];
        for (const it of cur.items) {
          const p = byName.get(normName(it.name));
          if (!p || p.is_sold_out) continue; // no existe en la nueva sucursal → se descarta
          const opts: CartItemOption[] = [];
          for (const o of it.options) {
            const g = p.option_groups.find((gr) => normName(gr.name) === normName(o.group_name));
            const v = g?.values.find((vv) => normName(vv.name) === normName(o.value));
            if (g && v && !v.is_sold_out) opts.push({ group_id: g.id, group_name: g.name, value_id: v.id, value: v.name, price_delta: v.price_delta, toteat_modifier_code: v.toteat_modifier_code ?? null });
          }
          const base = p.price;
          const unit = base + opts.reduce((s, o) => s + (o.price_delta ?? 0), 0);
          next.push({ ...it, product_id: p.id, toteat_code: p.toteat_code ?? null, base_price: base, unit_price: unit, is_happy_hour: p.is_happy_hour === true, image_url: p.image_url ?? it.image_url, options: opts });
        }
        set({ restaurantId: id, items: next });
      },

      // Re-cotiza los ítems guardados contra el catálogo actual: actualiza el
      // precio (base + deltas de opciones vigentes) y quita lo que ya no existe o
      // está agotado. Evita que un carrito viejo (de una oferta pasada) muestre o
      // intente pagar un precio desactualizado.
      repriceItems: (products) => {
        const byId = new Map(products.map((p) => [p.id, p]));
        const prev = get().items;
        const next: CartItem[] = [];
        for (const it of prev) {
          const p = byId.get(it.product_id);
          if (!p || p.is_sold_out) continue; // ya no disponible → se quita
          const opts = it.options
            .map((o) => {
              const g = p.option_groups.find((gr) => gr.id === o.group_id);
              const v = g?.values.find((vv) => vv.id === o.value_id);
              return v ? { ...o, price_delta: v.price_delta } : null;
            })
            .filter((o): o is CartItemOption => o !== null);
          const base = p.price;
          const unit = base + opts.reduce((s, o) => s + (o.price_delta ?? 0), 0);
          next.push({ ...it, base_price: base, unit_price: unit, is_happy_hour: p.is_happy_hour === true, options: opts });
        }
        const changed = prev.length !== next.length || next.some((n, i) => prev[i]?.unit_price !== n.unit_price || prev[i]?.product_id !== n.product_id || prev[i]?.is_happy_hour !== n.is_happy_hour);
        if (changed) set({ items: next });
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
