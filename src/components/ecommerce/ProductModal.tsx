"use client";
import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import type { StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore, type CartItemOption } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";

interface Props {
  product: StoreProduct;
  primaryColor: string;
  onClose: () => void;
}

export default function ProductModal({ product, primaryColor, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const addItem = useCartStore((s) => s.addItem);

  const groups = product.option_groups ?? [];

  // Bloquear scroll del body sin salto por la barra de scroll
  useEffect(() => {
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
    };
  }, []);

  function toggleOption(groupId: string, valueId: string, maxSelect: number) {
    setSelectedOptions((prev) => {
      const current = prev[groupId];
      if (maxSelect === 1) return { ...prev, [groupId]: valueId };
      const ids = current ? current.split(",").filter(Boolean) : [];
      if (ids.includes(valueId)) return { ...prev, [groupId]: ids.filter((id) => id !== valueId).join(",") };
      if (ids.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...ids, valueId].join(",") };
    });
  }

  function isSelected(groupId: string, valueId: string): boolean {
    return (selectedOptions[groupId] ?? "").split(",").includes(valueId);
  }

  const optionsDelta = groups.reduce((sum, g) => {
    const selected = (selectedOptions[g.id] ?? "").split(",").filter(Boolean);
    return sum + g.values.filter((v) => selected.includes(v.id)).reduce((s, v) => s + v.price_delta, 0);
  }, 0);
  const unitPrice = product.price + optionsDelta;

  function handleAdd() {
    for (const g of groups) {
      const count = (selectedOptions[g.id] ?? "").split(",").filter(Boolean).length;
      const needed = Math.max(g.is_required ? 1 : 0, g.min_select);
      if (count < needed) {
        toast.error(needed > 1 ? `Elige al menos ${needed} en ${g.name}` : `Debes seleccionar ${g.name}`);
        return;
      }
    }

    const options: CartItemOption[] = [];
    for (const g of groups) {
      const ids = (selectedOptions[g.id] ?? "").split(",").filter(Boolean);
      for (const id of ids) {
        const v = g.values.find((vv) => vv.id === id);
        if (v) options.push({ group_id: g.id, group_name: g.name, value_id: v.id, value: v.name, price_delta: v.price_delta, toteat_modifier_code: v.toteat_modifier_code });
      }
    }

    addItem({
      product_id: product.id,
      name: product.name,
      unit_price: unitPrice,
      base_price: product.price,
      quantity: qty,
      image_url: product.image_url,
      toteat_code: product.toteat_code,
      options,
    });
    window.dispatchEvent(new CustomEvent("cart:item-added"));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay — solo visible en desktop */}
      <div className="absolute inset-0 bg-black/50 hidden sm:block" onClick={onClose} />

      {/* Modal — pantalla completa en mobile, centrado en desktop */}
      <div className="relative bg-white w-full h-full sm:h-auto sm:rounded-3xl sm:max-w-md sm:max-h-[90vh] flex flex-col shadow-2xl">
        {/* Imagen */}
        {product.image_url ? (
          <div className="aspect-square sm:aspect-auto sm:h-52 sm:rounded-t-3xl overflow-hidden shrink-0">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-32 sm:rounded-t-3xl bg-gray-100 flex items-center justify-center text-5xl shrink-0">🍱</div>
        )}

        <button onClick={onClose} className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow">
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* Detalle + opciones */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 leading-tight">{product.name}</h2>
            {product.original_price ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-black" style={{ color: primaryColor }}>{clp(product.price)}</span>
                <span className="text-sm text-gray-400 line-through">{clp(product.original_price)}</span>
              </div>
            ) : (
              <p className="mt-1 text-lg font-black" style={{ color: primaryColor }}>{clp(product.price)}</p>
            )}
            {product.description && <p className="mt-2 text-sm text-gray-500 leading-relaxed whitespace-pre-line">{product.description}</p>}
          </div>

          {/* Grupos de opciones */}
          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-sm text-gray-800">{group.name}</span>
                {group.is_required && (
                  <span className="text-[10px] font-black bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">Obligatorio</span>
                )}
                {group.max_select > 1 && (
                  <span className="text-[10px] font-semibold text-gray-400">Hasta {group.max_select}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.values.map((v) => {
                  const sel = isSelected(group.id, v.id);
                  return (
                    <label key={v.id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 cursor-pointer transition ${sel ? "border-2" : "border-gray-200 hover:border-gray-300"}`} style={sel ? { borderColor: primaryColor, background: `${primaryColor}10` } : {}}>
                      <span className="text-sm font-medium text-gray-700">{v.name}</span>
                      <div className="flex items-center gap-2">
                        {v.price_delta !== 0 && (
                          <span className="text-xs text-gray-500">{v.price_delta > 0 ? "+" : ""}{clp(v.price_delta)}</span>
                        )}
                        <input
                          type={group.max_select === 1 ? "radio" : "checkbox"}
                          name={`group-${group.id}`}
                          checked={sel}
                          onChange={() => toggleOption(group.id, v.id, group.max_select)}
                          style={{ accentColor: primaryColor }}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — cantidad + agregar */}
        <div className="border-t border-gray-100 p-4 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-2">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 text-gray-600">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-black text-sm text-gray-900">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="p-2 text-gray-600">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button onClick={handleAdd} className="flex-1 py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90" style={{ background: primaryColor }}>
            Agregar · {clp(unitPrice * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
