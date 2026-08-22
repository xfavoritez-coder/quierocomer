"use client";
import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import type { StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";

interface Props {
  product: StoreProduct;
  primaryColor: string;
  onClose: () => void;
}

export default function ProductModal({ product, primaryColor, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

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

  const unitPrice = product.price;

  function handleAdd() {
    addItem({
      product_id: product.id,
      name: product.name,
      unit_price: unitPrice,
      base_price: product.price,
      quantity: qty,
      image_url: product.image_url,
      toteat_code: product.toteat_code,
      options: [],
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

        {/* Detalle */}
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-xl font-black text-gray-900 leading-tight">{product.name}</h2>
          {product.original_price ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-black" style={{ color: primaryColor }}>{clp(product.price)}</span>
              <span className="text-sm text-gray-400 line-through">{clp(product.original_price)}</span>
            </div>
          ) : (
            <p className="mt-1 text-lg font-black" style={{ color: primaryColor }}>{clp(product.price)}</p>
          )}
          {product.description && (
            <p className="mt-3 text-sm text-gray-500 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}
        </div>

        {/* Footer — cantidad + agregar */}
        <div className="border-t border-gray-100 p-4 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-2 py-1.5">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-black text-gray-900">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 py-3 rounded-xl text-white font-black text-sm transition hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            <span>Agregar</span>
            <span>·</span>
            <span>{clp(unitPrice * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
