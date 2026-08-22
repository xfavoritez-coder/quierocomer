"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { storeFontVars } from "@/components/ecommerce/StoreFront";
import StoreStyles from "@/components/ecommerce/StoreStyles";

export default function EcommerceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="qc-storefront min-h-screen bg-gray-50" style={storeFontVars}>
      <StoreStyles />
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href={`/ecommerce/${slug}`} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-black text-lg text-gray-900">Finalizar pedido</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {mounted && items.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-sm text-gray-900 mb-3">Resumen</h2>
            <div className="flex flex-col gap-2">
              {items.map((it) => (
                <div key={`${it.product_id}-${it.options.map((o) => o.value_id).join(",")}`} className="flex justify-between text-sm text-gray-600">
                  <span>{it.quantity}× {it.name}</span>
                  <span className="font-semibold">{clp(it.unit_price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-base text-gray-900 pt-3 mt-3 border-t border-gray-100">
              <span>Total</span><span>{clp(total)}</span>
            </div>
            <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              🚧 El pago (Webpay / Flow) y el envío al POS se conectan en el siguiente paso.
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
            <Link href={`/ecommerce/${slug}`} className="inline-block mt-4 text-sm font-bold text-gray-900 underline">Volver a la tienda</Link>
          </div>
        )}
      </div>
    </div>
  );
}
