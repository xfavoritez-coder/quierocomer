"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Minus, MapPin, Store, ChevronRight } from "lucide-react";
import type { StoreTenant } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { shortAddr } from "./StoreFront";

interface Props {
  open: boolean;
  onClose: () => void;
  tenant: StoreTenant;
  primaryColor: string;
  onOpenDeliveryModal: () => void;
}

export default function CartDrawer({ open, onClose, tenant, primaryColor, onOpenDeliveryModal }: Props) {
  const router = useRouter();
  const { items, deliveryType, deliveryAddress, deliverySelected, updateQty } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());
  const deliveryFee = deliveryType === "delivery" ? deliveryAddress?.fee ?? 0 : 0;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const belowMin = tenant.minAmount != null && subtotal < tenant.minAmount;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
          <h2 className="font-black text-lg text-gray-900">Tu pedido</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de entrega */}
        <button onClick={onOpenDeliveryModal} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition text-left">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            {deliverySelected && deliveryType === "delivery" ? <MapPin className="w-4 h-4 text-gray-500" /> : <Store className="w-4 h-4 text-gray-500" />}
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
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {items.map((item) => (
              <div key={`${item.product_id}-${item.options.map((o) => o.value_id).join(",")}`} className="flex gap-3 items-center">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">🍱</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-snug">{item.name}</p>
                  <p className="text-sm font-black mt-0.5" style={{ color: primaryColor }}>{clp(item.unit_price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => updateQty(item.product_id, item.options, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-black text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.options, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
            {belowMin ? (
              <div className="mt-1 w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs text-center">
                Monto mínimo: {clp(tenant.minAmount!)}
              </div>
            ) : (
              <button
                onClick={() => router.push(`/ecommerce/${tenant.slug}/checkout`)}
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
