"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Store, Banknote, ArrowLeftRight, CreditCard, Wallet, Loader2, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import type { StoreTenant } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { storeFontVars, shortAddr } from "./StoreFront";
import StoreStyles from "./StoreStyles";
import AccompanimentsSection from "./AccompanimentsSection";
import { useFavicon } from "@/lib/ecommerce/useFavicon";

const PAY_META: Record<string, { label: string; hint: string; Icon: any; online?: boolean }> = {
  webpay: { label: "Webpay", hint: "Paga online con tarjeta", Icon: CreditCard, online: true },
  flow: { label: "Flow", hint: "Paga online (tarjetas, transferencia)", Icon: Wallet, online: true },
  mercadopago: { label: "MercadoPago", hint: "Paga online con MercadoPago", Icon: Wallet, online: true },
  efectivo: { label: "Efectivo", hint: "Pagas al recibir/retirar", Icon: Banknote },
  transferencia: { label: "Transferencia", hint: "Coordinas la transferencia", Icon: ArrowLeftRight },
  tarjeta: { label: "Tarjeta", hint: "Pagas con tarjeta al recibir", Icon: CreditCard },
};

export default function CheckoutForm({ tenant }: { tenant: StoreTenant }) {
  const primaryColor = tenant.primaryColor;
  useFavicon(tenant.logoUrl);
  const { items, deliveryType, deliveryAddress, deliverySelected, notes, setNotes, clearCart } = useCartStore();
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [accom, setAccom] = useState<{ pending: string[]; notesPart: string }>({ pending: [], notesPart: "" });
  const onAccomResolve = useCallback((r: { pending: string[]; notesPart: string }) => setAccom(r), []);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; label?: string | null } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const methods = tenant.paymentMethods.filter((m) => PAY_META[m]);
  useEffect(() => { if (!payment && methods.length) setPayment(methods[0]); }, [methods, payment]);

  const isDelivery = deliverySelected && deliveryType === "delivery";
  const deliveryFee = isDelivery ? deliveryAddress?.fee ?? 0 : 0;
  // Mínimo de compra por tipo de entrega (0 = sin mínimo). En delivery, la zona
  // puede imponer su propio mínimo (más específico).
  const minPerType = isDelivery ? (deliveryAddress?.minOrder ?? tenant.minOrderDelivery) : tenant.minOrderPickup;
  const minReq = minPerType && minPerType > 0 ? minPerType : null;
  const belowMin = minReq != null && subtotal < minReq;
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const discount = coupon?.discount ?? 0;
  const finalTotal = Math.max(0, total - discount);
  const isOpen = tenant.openStatus.open;
  const isValid = isOpen && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 8 && !!payment && !belowMin && (!isDelivery || !!deliveryAddress?.address) && (payment !== "flow" || emailOk);

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const res = await fetch("/api/ecommerce/coupons/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: tenant.slug, code, subtotal, orderType: isDelivery ? "DELIVERY" : "PICKUP", phone: phone.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.valid) {
        setCoupon({ code: data.coupon.code, discount: data.discount, label: data.coupon.label });
        setCouponMsg(null);
      } else {
        setCoupon(null);
        setCouponMsg(data.error || "Cupón no válido");
      }
    } catch { setCouponMsg("Error al validar el cupón"); }
    setCouponBusy(false);
  }

  async function placeOrder() {
    if (!isValid || sending) return;
    if (isDelivery && !deliveryAddress?.address) { toast.error("Falta la dirección de entrega"); return; }
    if (accom.pending.length > 0) { toast.error(`Indica tu preferencia para: ${accom.pending.join(", ")}`); return; }
    setSending(true);
    try {
      const res = await fetch("/api/ecommerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: tenant.slug,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim() || null,
          orderType: isDelivery ? "DELIVERY" : "PICKUP",
          deliveryAddress: isDelivery ? [deliveryAddress?.address, deliveryAddress?.details].filter(Boolean).join(" · ") : null,
          deliveryZone: isDelivery ? deliveryAddress?.zoneName : null,
          deliveryLat: isDelivery ? deliveryAddress?.lat : null,
          deliveryLng: isDelivery ? deliveryAddress?.lng : null,
          items,
          notes: [notes.trim(), accom.notesPart].filter(Boolean).join(" · ") || null,
          paymentMethod: payment,
          couponCode: coupon?.code || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { toast.error(data.error || "No se pudo crear el pedido"); setSending(false); return; }

      // Pago online (Webpay): redirigir al formulario de Transbank.
      if (data.url && data.token) {
        setRedirecting(true);
        clearCart();
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;
        const input = document.createElement("input");
        input.type = "hidden"; input.name = "token_ws"; input.value = data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // Pago online (Flow): redirigir a la URL de pago.
      if (data.redirectUrl) {
        setRedirecting(true);
        clearCart();
        window.location.href = data.redirectUrl;
        return;
      }

      // Pago offline: ir al seguimiento del pedido.
      setRedirecting(true);
      clearCart();
      window.location.href = `/pedido/${data.orderId}`;
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
      setSending(false);
    }
  }

  const showEmpty = mounted && items.length === 0 && !redirecting;
  const onlineSel = payment ? PAY_META[payment]?.online : false;

  return (
    <div className="qc-storefront min-h-screen bg-gray-50" style={storeFontVars}>
      <StoreStyles />
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href={`/ecommerce/${tenant.slug}`} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-black text-lg text-gray-900">Finalizar pedido</h1>
        </div>
      </header>

      {redirecting ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-transparent animate-spin" style={{ borderTopColor: primaryColor }} />
          <p className="text-sm font-semibold text-gray-600">Redirigiendo al pago…</p>
        </div>
      ) : showEmpty ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
          <Link href={`/ecommerce/${tenant.slug}`} className="inline-block mt-4 text-sm font-bold underline" style={{ color: primaryColor }}>Volver a la tienda</Link>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
          {/* Datos del cliente */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-sm text-gray-900 mb-3">Tus datos</h2>
            <div className="flex flex-col gap-3">
              <Field label="Nombre">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </Field>
              <Field label="Teléfono">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+56 9 1234 5678" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </Field>
              <Field label={payment === "flow" ? "Email (requerido para Flow)" : "Email (opcional)"}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="tu@email.com" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </Field>
            </div>
          </section>

          {/* Entrega */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-sm text-gray-900">Entrega</h2>
              <Link href={`/ecommerce/${tenant.slug}`} className="text-xs font-bold" style={{ color: primaryColor }}>Cambiar</Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                {isDelivery ? <MapPin className="w-4 h-4 text-gray-500" /> : <Store className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="min-w-0">
                {isDelivery && deliveryAddress ? (
                  <>
                    <p className="text-sm font-bold text-gray-800">🛵 Delivery</p>
                    <p className="text-xs text-gray-500 truncate">{shortAddr(deliveryAddress.address)}{deliveryAddress.details ? ` · ${deliveryAddress.details}` : ""}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-800">🏠 Retiro en tienda</p>
                    {tenant.address && <p className="text-xs text-gray-500 truncate">{tenant.address}</p>}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Pago */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-sm text-gray-900 mb-3">¿Cómo quieres pagar?</h2>
            <div className="flex flex-col gap-2">
              {methods.map((m) => {
                const meta = PAY_META[m];
                const sel = payment === m;
                return (
                  <label key={m} className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer transition ${sel ? "border-2" : "border-gray-200 hover:border-gray-300"}`} style={sel ? { borderColor: primaryColor, background: `${primaryColor}10` } : {}}>
                    <meta.Icon className="w-5 h-5 shrink-0" style={{ color: sel ? primaryColor : "#9ca3af" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{meta.label}</p>
                      <p className="text-xs text-gray-400">{meta.hint}</p>
                    </div>
                    <input type="radio" name="payment" checked={sel} onChange={() => setPayment(m)} style={{ accentColor: primaryColor }} />
                  </label>
                );
              })}
              {!methods.length && <p className="text-sm text-gray-400">Esta tienda aún no tiene métodos de pago configurados.</p>}
            </div>
          </section>

          {/* Acompañamientos */}
          <AccompanimentsSection config={tenant.accompaniments} items={items} subtotal={subtotal} primaryColor={primaryColor} onResolve={onAccomResolve} />

          {/* Notas */}
          {tenant.notesEnabled && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-black text-sm text-gray-900 mb-3">Notas (opcional)</h2>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej: sin cebolla, tocar el timbre…" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none" />
            </section>
          )}

          {/* Cupón */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-sm text-gray-900 mb-3">Cupón de descuento</h2>
            {coupon ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-3 border" style={{ borderColor: `${primaryColor}55`, background: `${primaryColor}10` }}>
                <span className="text-sm font-black" style={{ color: primaryColor }}>{coupon.code}</span>
                <span className="text-sm text-gray-500">{coupon.label || (discount > 0 ? `−${clp(discount)}` : "aplicado")}</span>
                <button onClick={() => { setCoupon(null); setCouponCode(""); setCouponMsg(null); }} className="ml-auto text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} placeholder="Código de cupón" className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono uppercase outline-none focus:border-gray-400" />
                <button onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()} className="px-4 rounded-xl text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-40" style={{ background: primaryColor }}>{couponBusy ? "…" : "Aplicar"}</button>
              </div>
            )}
            {couponMsg && <p className="text-xs text-red-500 mt-2">{couponMsg}</p>}
          </section>

          {/* Resumen */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-sm text-gray-900 mb-3">Resumen</h2>
            {mounted && (
              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <div key={`${it.product_id}-${it.options.map((o) => o.value_id).join(",")}`} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="text-gray-700">{it.quantity}× {it.name}</span>
                      {it.options.length > 0 && (
                        <span className="block text-xs text-gray-400 truncate">{it.options.map((o) => o.value).join(", ")}</span>
                      )}
                    </div>
                    <span className="font-semibold text-gray-700 shrink-0">{clp(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm text-gray-500 pt-2 mt-1 border-t border-gray-100"><span>Subtotal</span><span>{clp(subtotal)}</span></div>
                {isDelivery && <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{clp(deliveryFee)}</span></div>}
                {discount > 0 && <div className="flex justify-between text-sm" style={{ color: primaryColor }}><span>Descuento {coupon ? `(${coupon.code})` : ""}</span><span>−{clp(discount)}</span></div>}
                <div className="flex justify-between font-black text-base text-gray-900"><span>Total</span><span style={{ color: primaryColor }}>{clp(finalTotal)}</span></div>
              </div>
            )}
          </section>

          {!isOpen && (
            <div className="rounded-xl bg-gray-900 text-white text-center py-3 px-4 text-sm font-bold">
              🔒 Estamos cerrados ahora{tenant.openStatus.opensAt ? ` · Abrimos hoy a las ${tenant.openStatus.opensAt}` : tenant.openStatus.today?.open ? ` · Horario de hoy: ${tenant.openStatus.today.from} – ${tenant.openStatus.today.to}` : " · Hoy no atendemos"}
            </div>
          )}
          {belowMin && (
            <p className="text-center text-xs font-semibold text-red-500">Monto mínimo para pedir: {clp(minReq!)}</p>
          )}

          <button
            onClick={placeOrder}
            disabled={!isValid || sending}
            className="w-full py-4 rounded-2xl text-white font-black text-sm transition hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 sticky bottom-3 shadow-lg"
            style={{ background: primaryColor }}
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {sending ? "Procesando…" : onlineSel ? `Ir a pagar · ${clp(finalTotal)}` : `Confirmar pedido · ${clp(finalTotal)}`}
          </button>
          {onlineSel && <p className="text-center text-xs text-gray-400 -mt-1">Serás redirigido a {payment === "flow" ? "Flow" : "Webpay"} para pagar de forma segura.</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      {children}
    </label>
  );
}
