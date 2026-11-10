"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Minus, MapPin, Store, ChevronRight, Motorbike, ShoppingCart, UtensilsCrossed, Lock, AlertTriangle, Trash2 } from "lucide-react";
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
  mobileOnly?: boolean;
  basePath?: string;
}

export default function CartDrawer({ open, onClose, tenant, primaryColor, onOpenDeliveryModal, mobileOnly = true, basePath }: Props) {
  const storeBase = basePath ?? `/ecommerce/${tenant.slug}`;
  const router = useRouter();
  const { items, deliveryType, deliveryAddress, deliverySelected, updateQty, removeItem, restaurantId } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());
  const deliveryFee = deliveryType === "delivery" ? deliveryAddress?.fee ?? 0 : 0;

  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

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

  useEffect(() => {
    if (open) checkAvailability();
    else setUnavailableIds(new Set());
  }, [open, checkAvailability]);

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
        <button onClick={onOpenDeliveryModal} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition text-left">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            {deliverySelected && deliveryType === "delivery" ? <MapPin className="w-4 h-4 text-gray-500" /> : <Store className="w-4 h-4 text-gray-500" />}
          </div>
          <div className="flex-1 min-w-0">
            {!deliverySelected ? (
              <p className="text-sm font-semibold text-gray-500">¿Dónde quieres pedir?</p>
            ) : deliveryType === "delivery" && deliveryAddress ? (
              <>
                <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1"><Motorbike size={13} className="shrink-0" /> Delivery</p>
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
                onClick={() => router.push(`${storeBase}/checkout`)}
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
