"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, Store, Banknote, ArrowLeftRight, CreditCard, Wallet, Loader2, X, Minus, Plus, Trash2, ChevronRight, ShoppingCart, Motorbike, Lock, Check } from "lucide-react";
import { toast, Toaster } from "sonner";
import type { StoreTenant } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { computeDiscount } from "@/lib/ecommerce/coupons";
import { readPendingCoupon, clearPendingCoupon } from "@/lib/ecommerce/pendingCoupon";
import { isInApp } from "@/lib/ecommerce/isInApp";
import { clp } from "@/lib/ecommerce/format";
import { isValidPhoneCL, PHONE_CL_ERROR } from "@/lib/ecommerce/phoneCL";
import StoreLink from "./StoreLink";
import { trackCouponAttempt } from "@/lib/ecommerce/storeAnalytics";
import { getGuestId } from "@/lib/guestId";
import { trackCheckoutStart, trackCheckoutAbandon, trackOrderPlaced } from "@/lib/ecommerce/storeAnalytics";

// Cupón aplicado: guardamos sus parámetros para recalcular el descuento en vivo
// (misma fórmula que el servidor) según subtotal y costo de despacho.
type AppliedCoupon = {
  code: string; label?: string | null; type: "discount" | "product";
  discountType: "fixed" | "percent"; discountValue: number;
  maxDiscountAmount?: number | null; discountIncludesDelivery: boolean;
  freeProductId?: string | null;
};
import { storeFontVars, shortAddr, DeliveryModal } from "./StoreFront";
import StoreStyles from "./StoreStyles";
import ImpactSkin from "./ImpactSkin";
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

function fbTrack(event: string, params?: Record<string, unknown>, eventID?: string) {
  // El 4º arg {eventID} permite deduplicar con el evento server-side (CAPI) que usa el mismo id.
  try { (window as any).fbq?.("track", event, params, eventID ? { eventID } : undefined); } catch {}
}

// content_ids + num_items del carrito, alineados con el CAPI del servidor (dedup por eventID).
function cartContents(items: { product_id?: string; quantity?: number }[]) {
  return {
    content_ids: items.map((i) => String(i.product_id ?? "")).filter(Boolean),
    content_type: "product" as const,
    num_items: items.reduce((n, i) => n + (i.quantity || 1), 0),
  };
}

export default function CheckoutForm({ tenant, basePath }: { tenant: StoreTenant; basePath?: string }) {
  const storeHref = (basePath ?? `/ecommerce/${tenant.slug}`) || "/";
  const primaryColor = tenant.primaryColor;
  const impact = tenant.theme === "impact";
  useFavicon(tenant.faviconUrl || tenant.logoUrl);
  const { items, deliveryType, deliveryAddress, deliverySelected, notes, setNotes, clearCart, updateQty, removeItem, restaurantId: cartRestaurantId } = useCartStore();
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const subtotal = useCartStore((s) => s.subtotal());
  const total = useCartStore((s) => s.total());

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Verificación de email por código (OTP). Reutiliza /api/qr/user/send-otp + verify-otp.
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [payment, setPayment] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const searchParams = useSearchParams();
  const [accom, setAccom] = useState<{ pending: string[]; notesPart: string }>({ pending: [], notesPart: "" });
  const onAccomResolve = useCallback((r: { pending: string[]; notesPart: string }) => setAccom(r), []);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // ── Pedidos programados ──
  type SlotDay = { ymd: string; label: string; slots: { iso: string; label: string }[] };
  // Si el carrito tiene un producto de happy hour, se oculta en silencio la
  // opción de programar (evita pedir en la ventana del happy hour para mucho
  // más tarde). El cobro igual se recalcula en el servidor.
  const cartHasHappyHour = items.some((i) => i.is_happy_hour === true);
  const canSchedule = tenant.scheduledOrdersEnabled === true && !cartHasHappyHour;
  const [scheduleMode, setScheduleMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledIso, setScheduledIso] = useState<string | null>(null);
  const [scheduleDayYmd, setScheduleDayYmd] = useState<string | null>(null);
  const [slotDays, setSlotDays] = useState<SlotDay[]>([]);

  const orderPlacedRef = useRef(false);
  useEffect(() => {
    setMounted(true);
    if (items.length > 0) fbTrack("InitiateCheckout", { value: subtotal, currency: "CLP", ...cartContents(items) });
    trackCheckoutStart(tenant.id, items.length, subtotal);
    return () => {
      if (!orderPlacedRef.current) {
        const cartSnapshot = items.map((i) => ({ name: i.name, unit_price: i.unit_price, quantity: i.quantity }));
        trackCheckoutAbandon(tenant.id, cartSnapshot);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir los datos del cliente (nombre/teléfono/correo) en el navegador para
  // que al salir y volver a entrar al checkout queden rellenados y no haya que
  // reescribirlos. Se carga al montar y se guarda a medida que se escribe.
  const CUSTOMER_KEY = "qc-checkout-customer";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { name?: string; phone?: string; email?: string };
        if (d.name) setName(d.name);
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!name && !phone && !email) return; // no sobrescribir con todo vacío
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, email })); } catch {}
  }, [name, phone, email]);

  // Persistir cupón aplicado + comentario del pedido (por local), para que
  // sobrevivan al salir/entrar del checkout (pago fallido, cerrar la web, etc.).
  const EXTRA_KEY = `qc-checkout-extra:${tenant.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXTRA_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { couponCode?: string; coupon?: AppliedCoupon | null; notes?: string };
        if (d.couponCode) setCouponCode(d.couponCode);
        if (d.coupon && d.coupon.discountType) { setCoupon(d.coupon); restoredCouponRef.current = true; } // ignora formato viejo; revalidar
        if (d.notes) setNotes(d.notes);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const extrasFirstSave = useRef(true);
  useEffect(() => {
    if (extrasFirstSave.current) { extrasFirstSave.current = false; return; } // no pisar en el montaje
    try {
      if (!coupon && !couponCode.trim() && !notes.trim()) localStorage.removeItem(EXTRA_KEY);
      else localStorage.setItem(EXTRA_KEY, JSON.stringify({ couponCode, coupon, notes }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, couponCode, notes]);

  // Revalidar (una sola vez) un cupón restaurado desde localStorage: si ya no es
  // válido (expiró, superó usos, no aplica), quitarlo para no mostrar un descuento
  // que el servidor no aplicará; si sigue válido, refrescar sus parámetros.
  const restoredCouponRef = useRef(false);
  useEffect(() => {
    if (!restoredCouponRef.current || !coupon) return;
    restoredCouponRef.current = false;
    const code = coupon.code;
    (async () => {
      try {
        const res = await fetch("/api/ecommerce/coupons/validate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: cartRestaurantId || undefined, restaurantSlug: tenant.slug, code, subtotal, deliveryFee, orderType: isDelivery ? "DELIVERY" : "PICKUP", phone: phone.trim() || null, fromApp: isInApp() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data.valid) { setCoupon(null); setCouponCode(""); setCouponMsg("El cupón guardado ya no está disponible"); return; }
        const c = data.coupon;
        setCoupon({
          code: c.code, label: c.label, type: c.type, freeProductId: c.freeProductId,
          discountType: c.discountType, discountValue: c.discountValue,
          maxDiscountAmount: c.maxDiscountAmount, discountIncludesDelivery: c.discountIncludesDelivery === true,
        });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon]);

  // Reusar la sesión del cliente: si ya verificó su correo alguna vez (cookie
  // qr_user_id de un verify-otp previo), lo reconocemos al volver — prellenamos
  // nombre/email y damos el email por verificado, sin pedir el código otra vez.
  useEffect(() => {
    fetch("/api/qr/user/me").then((r) => (r.ok ? r.json() : null)).then((d) => {
      const u = d?.user as { name?: string | null; email?: string } | undefined;
      if (!u?.email) return;
      setEmail((prev) => prev || u.email!);
      setName((prev) => prev || u.name || "");
      setVerifiedEmail(u.email.toLowerCase());
    }).catch(() => {});
  }, []);

  // Resultado del pago online al volver a esta página.
  // - ?pago=exito → el pago se confirmó: vaciamos el carrito y vamos al seguimiento.
  // - ?pago=fallido / o quedó un pago pendiente marcado (el cliente volvió atrás sin
  //   pagar) → marcamos ese pago como fallido, avisamos y dejamos el carrito para
  //   reintentar.
  useEffect(() => {
    const PENDING_KEY = "qc-pay-pending";
    const pago = searchParams.get("pago");
    const orderParam = searchParams.get("order");
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(PENDING_KEY); } catch {}

    if (pago === "exito") {
      try { sessionStorage.removeItem(PENDING_KEY); } catch {}
      // Pedido completado: limpiar cupón/comentario/acompañamientos guardados.
      try { localStorage.removeItem(`qc-checkout-extra:${tenant.id}`); localStorage.removeItem(`qc-accom:${tenant.id}`); } catch {}
      fbTrack(
        "Purchase",
        { value: finalTotal, currency: "CLP", ...cartContents(items) },
        orderParam ? `order-${orderParam}` : undefined,
      );
      clearCart();
      if (orderParam) window.location.replace(`/pedido/${orderParam}`);
      return;
    }

    if (pago === "fallido" || pago === "cancelado" || pago === "error" || pending) {
      const failId = orderParam || pending;
      if (failId) {
        fetch("/api/ecommerce/payment/fail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: failId }) }).catch(() => {});
      }
      try { sessionStorage.removeItem(PENDING_KEY); } catch {}
      setPaymentFailed(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const methods = tenant.paymentMethods.filter((m) => PAY_META[m]);
  useEffect(() => { if (!payment && methods.length) setPayment(methods[0]); }, [methods, payment]);

  // Tipo de entrega efectivo respetando lo habilitado por la tienda: si solo hay
  // delivery, se fuerza delivery (y se exige dirección); si solo retiro, retiro.
  const onlyDelivery = tenant.deliveryEnabled && !tenant.pickupEnabled;
  const onlyPickup = tenant.pickupEnabled && !tenant.deliveryEnabled;
  const isDelivery = onlyDelivery ? true : onlyPickup ? false : (deliverySelected && deliveryType === "delivery");
  const missingAddress = isDelivery && !deliveryAddress?.address;
  const deliveryFee = isDelivery ? deliveryAddress?.fee ?? 0 : 0;
  // Mínimo de compra por tipo de entrega (0 = sin mínimo). En delivery, la zona
  // puede imponer su propio mínimo (más específico).
  const minPerType = isDelivery ? (deliveryAddress?.minOrder ?? tenant.minOrderDelivery) : tenant.minOrderPickup;
  const minReq = minPerType && minPerType > 0 ? minPerType : null;
  const belowMin = minReq != null && subtotal < minReq;
  const emailTrim = email.trim();
  const emailOk = /\S+@\S+\.\S+/.test(emailTrim);
  // Email obligatorio si paga con Flow o usa cupón.
  const emailNeeded = payment === "flow" || !!coupon;
  const emailVerifiedOk = emailOk && verifiedEmail !== "" && verifiedEmail === emailTrim.toLowerCase();
  // La verificación por código SOLO se exige cuando el email es obligatorio (Flow o
  // cupón). Para el resto de métodos el correo es opcional (para el comprobante) y no
  // requiere verificarse — así no molesta al recargar / volver del medio de pago.
  const emailReady = emailNeeded ? emailVerifiedOk : true;
  // Descuento en vivo: si el cupón NO incluye delivery, el fee de despacho no entra
  // en la base (se cobra completo y el descuento es solo sobre la comida).
  const discount = coupon ? computeDiscount(coupon, subtotal, deliveryFee) : 0;
  const finalTotal = Math.max(0, total - discount);
  const isOpen = tenant.openStatus.open;
  // Momento del pedido: "asap" requiere estar abierto; "scheduled" requiere una hora elegida.
  const timingOk = scheduleMode === "scheduled" ? !!scheduledIso : isOpen;
  // Teléfono: debe ser un celular chileno válido (9 dígitos empezando en 9, o +56 + ese celular).
  const phoneOk = isValidPhoneCL(phone);
  const isValid = timingOk && deliverySelected && name.trim().length >= 2 && phoneOk && !!payment && !belowMin && (!isDelivery || !!deliveryAddress?.address) && emailReady;

  // Traer las franjas disponibles para programar (según tipo de entrega).
  useEffect(() => {
    if (!canSchedule || !deliverySelected) { setSlotDays([]); return; }
    const type = isDelivery ? "DELIVERY" : "PICKUP";
    let cancelled = false;
    fetch(`/api/ecommerce/schedule-slots?slug=${encodeURIComponent(tenant.slug)}&type=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (cancelled) return; setSlotDays(d?.enabled ? (d.days || []) : []); })
      .catch(() => { if (!cancelled) setSlotDays([]); });
    return () => { cancelled = true; };
  }, [canSchedule, deliverySelected, isDelivery, tenant.slug]);

  // Si el local está cerrado y acepta programados, arrancamos en modo "programar".
  useEffect(() => {
    if (canSchedule && !isOpen) setScheduleMode("scheduled");
  }, [canSchedule, isOpen]);
  // Si deja de poder programar (p. ej. entró un producto de happy hour), vuelve a ASAP.
  useEffect(() => {
    if (!canSchedule) setScheduleMode("asap");
  }, [canSchedule]);

  // Al cambiar de día o de franjas, mantener una selección coherente.
  useEffect(() => {
    if (scheduleMode !== "scheduled") return;
    if (!slotDays.length) { setScheduleDayYmd(null); setScheduledIso(null); return; }
    const day = slotDays.find((d) => d.ymd === scheduleDayYmd) || slotDays[0];
    setScheduleDayYmd(day.ymd);
    if (!day.slots.some((s) => s.iso === scheduledIso)) setScheduledIso(null);
  }, [slotDays, scheduleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function onEmailChange(v: string) {
    setEmail(v);
    // Al cambiar el email se pierde la verificación previa.
    if (v.trim().toLowerCase() !== verifiedEmail) { setOtpSent(false); setOtpCode(""); setOtpMsg(null); }
  }
  async function sendOtp() {
    if (!emailOk || otpBusy) return;
    setOtpBusy(true); setOtpMsg(null);
    try {
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailTrim, name: name.trim() || null, storeName: tenant.name, logoUrl: tenant.logoUrl ?? null, primaryColor }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpMsg(d.error || "No se pudo enviar el código"); setOtpBusy(false); return; }
      setOtpSent(true); setOtpMsg(d.devCode ? `Código (dev): ${d.devCode}` : "Te enviamos un código a tu correo.");
    } catch { setOtpMsg("Error de conexión"); }
    setOtpBusy(false);
  }
  async function verifyOtp() {
    if (otpCode.trim().length !== 6 || otpBusy) return;
    setOtpBusy(true); setOtpMsg(null);
    try {
      const res = await fetch("/api/qr/user/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailTrim, code: otpCode.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpMsg(d.error || "Código incorrecto"); setOtpBusy(false); return; }
      setVerifiedEmail(emailTrim.toLowerCase()); setOtpSent(false); setOtpCode(""); setOtpMsg(null);
      toast.success("Email verificado");
    } catch { setOtpMsg("Error de conexión"); }
    setOtpBusy(false);
  }

  // Lleva al cliente al campo de correo (arriba) y, si ya escribió un email válido y
  // aún no envió el código, lo dispara — para que la verificación ocurra sin fricción
  // desde donde aplicó el cupón.
  function goVerifyEmail() {
    const el = document.getElementById("qc-email") as HTMLInputElement | null;
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus(), 300); }
    if (emailOk && !otpSent && !emailVerifiedOk) sendOtp();
  }

  // Cupón que vino por link (?coupon= del email de recuperación): aplicarlo solo,
  // una vez, cuando ya hay carrito. Si no es válido aquí (p. ej. otra sucursal),
  // se muestra el motivo en el campo del cupón.
  const pendingTried = useRef(false);
  useEffect(() => {
    if (pendingTried.current || coupon || subtotal <= 0) return;
    const pending = readPendingCoupon();
    if (!pending) return;
    pendingTried.current = true;
    setCouponCode(pending);
    setCouponOpen(true);
    void applyCoupon(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, coupon]);

  async function applyCoupon(codeOverride?: string) {
    const code = (codeOverride ?? couponCode).trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const res = await fetch("/api/ecommerce/coupons/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: cartRestaurantId || undefined, restaurantSlug: tenant.slug, code, subtotal, deliveryFee, orderType: isDelivery ? "DELIVERY" : "PICKUP", phone: phone.trim() || null, fromApp: isInApp() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.valid) {
        const c = data.coupon;
        setCoupon({
          code: c.code, label: c.label, type: c.type, freeProductId: c.freeProductId,
          discountType: c.discountType, discountValue: c.discountValue,
          maxDiscountAmount: c.maxDiscountAmount, discountIncludesDelivery: c.discountIncludesDelivery === true,
        });
        setCouponMsg(null);
        clearPendingCoupon();
        trackCouponAttempt(tenant.id, code, true);
      } else {
        setCoupon(null);
        setCouponMsg(data.error || "Cupón no válido");
        trackCouponAttempt(tenant.id, code, false, data.error);
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
          restaurantId: cartRestaurantId || undefined,
          restaurantSlug: tenant.slug,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim() || null,
          orderType: isDelivery ? "DELIVERY" : "PICKUP",
          deliveryAddress: isDelivery ? [deliveryAddress?.address, deliveryAddress?.details ? `Dpto/casa: ${deliveryAddress.details}` : null].filter(Boolean).join(" · ") : null,
          deliveryAddressParts: isDelivery ? (deliveryAddress?.parts ?? null) : null,
          deliveryZone: isDelivery ? deliveryAddress?.zoneName : null,
          deliveryLat: isDelivery ? deliveryAddress?.lat : null,
          deliveryLng: isDelivery ? deliveryAddress?.lng : null,
          items,
          notes: [notes.trim(), accom.notesPart].filter(Boolean).join(" · ") || null,
          paymentMethod: payment,
          couponCode: coupon?.code || null,
          scheduledFor: scheduleMode === "scheduled" && scheduledIso ? scheduledIso : null,
          fromApp: isInApp(),
          guestId: getGuestId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.couponInvalid) { setCoupon(null); setCouponCode(""); } // quitar cupón que el servidor rechazó
        toast.error(data.error || "No se pudo crear el pedido");
        setSending(false); return;
      }

      // Pedido creado — marcar para no disparar abandon al desmontar.
      orderPlacedRef.current = true;
      trackOrderPlaced(tenant.id, data.orderId, total);

      // Pago online: NO vaciamos el carrito todavía. Guardamos el pedido pendiente:
      // si el cliente vuelve sin pagar, marcamos el pago fallido y conserva su carrito.
      const markPending = () => { try { if (data.orderId) sessionStorage.setItem("qc-pay-pending", data.orderId); } catch {} };

      // Pago online (Webpay): redirigir al formulario de Transbank.
      if (data.url && data.token) {
        setRedirecting(true);
        markPending();
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

      // Pago online (Flow / MercadoPago): redirigir a la URL de pago.
      if (data.redirectUrl) {
        setRedirecting(true);
        markPending();
        window.location.href = data.redirectUrl;
        return;
      }

      // Pago offline: ir al seguimiento del pedido.
      setRedirecting(true);
      // Purchase del navegador (dedup con el CAPI del servidor vía eventID = order-<id>).
      fbTrack("Purchase", { value: finalTotal, currency: "CLP", ...cartContents(items) }, `order-${data.orderId}`);
      clearCart();
      window.location.href = `/pedido/${data.orderId}`;
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
      setSending(false);
    }
  }

  const finalizingSuccess = searchParams.get("pago") === "exito";
  const showEmpty = mounted && items.length === 0 && !redirecting && !finalizingSuccess && !paymentFailed;
  const onlineSel = payment ? PAY_META[payment]?.online : false;

  return (
    <div className={`qc-storefront min-h-screen ${impact ? "qc-impact" : "bg-gray-50"}`} style={impact ? { ...storeFontVars, background: "#0e0e0e" } : storeFontVars}>
      <StoreStyles />
      {impact && <ImpactSkin />}
      <Toaster position="top-center" richColors offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} />

      <header className="sticky top-0 z-40 bg-white shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <StoreLink href={storeHref} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition">
            <ArrowLeft className="w-5 h-5" />
          </StoreLink>
          <h1 className="font-black text-lg text-gray-900">Finalizar pedido</h1>
        </div>
      </header>

      {(redirecting || finalizingSuccess) ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-transparent animate-spin" style={{ borderTopColor: primaryColor }} />
          <p className="text-sm font-semibold text-gray-600">{finalizingSuccess ? "Confirmando tu pago…" : "Redirigiendo al pago…"}</p>
        </div>
      ) : showEmpty ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingCart className="mx-auto mb-3 text-gray-300" size={40} strokeWidth={1.5} />
          <p className="text-sm font-semibold text-gray-500">Tu carrito está vacío</p>
          <StoreLink href={storeHref} className="inline-block mt-4 text-sm font-bold underline" style={{ color: primaryColor }}>Volver a la tienda</StoreLink>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">
          {/* ── Columna izquierda: datos, entrega, pago, acompañamientos, cupón ── */}
          <div className="flex flex-col gap-4 min-w-0">
          {/* Aviso de pago fallido: el cliente volvió sin completar el pago. */}
          {paymentFailed && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <X size={18} />
              <div className="min-w-0">
                <p className="font-black text-sm text-red-700 m-0">Tu pago no se completó</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">Guardamos tu pedido acá. Revisa tus datos y vuelve a intentar el pago cuando quieras.</p>
              </div>
              <button onClick={() => setPaymentFailed(false)} className="ml-auto text-red-400 hover:text-red-600 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Falta dirección de entrega (tienda solo delivery / entró sin elegir) */}
          {missingAddress && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm text-amber-700 m-0">Falta tu dirección de entrega</p>
                <p className="text-xs text-amber-600 mt-1 leading-relaxed">Este local solo hace delivery. Vuelve a la tienda para ingresar tu dirección y continuar.</p>
                <StoreLink href={storeHref} className="inline-block mt-2 text-xs font-black underline" style={{ color: primaryColor }}>Volver a la tienda</StoreLink>
              </div>
            </div>
          )}

          {/* Datos del cliente + Entrega */}
          <Block title="Tus datos" action={deliverySelected ? <button type="button" onClick={() => setDeliveryModalOpen(true)} className="text-xs font-bold" style={{ color: primaryColor }}>Editar</button> : undefined}>
            <div className="flex flex-col gap-3">
              <Field label="Nombre">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </Field>
              <Field label="Teléfono *">
                <div className={`flex items-center rounded-xl border overflow-hidden ${phone.trim() && !phoneOk ? "border-red-400 bg-red-50" : "border-gray-200 focus-within:border-gray-400"}`}>
                  <span className="flex items-center gap-1.5 pl-3 pr-2 text-sm text-gray-500 select-none shrink-0" aria-hidden>
                    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0 rounded-sm" style={{boxShadow:'0 0 0 .5px rgba(0,0,0,.1)'}}><rect width="20" height="14" fill="#D52B1E"/><rect width="20" height="7" fill="#fff"/><rect width="7" height="7" fill="#002868"/><polygon points="3.5,1.8 4.1,3.6 2,2.5 5,2.5 2.9,3.6" fill="#fff"/></svg>+56
                  </span>
                  <input value={phone} onChange={(e) => { let v = e.target.value; if (v.startsWith("+56")) v = v.slice(3); else if (v.startsWith("56") && v.length > 9) v = v.slice(2); setPhone(v.trimStart()); }} inputMode="tel" placeholder="9 1234 5678"
                    className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none" />
                </div>
                {phone.trim() && !phoneOk ? (
                  <p className="mt-1 text-xs text-red-600">{PHONE_CL_ERROR}</p>
                ) : null}
              </Field>
              <Field label={emailNeeded ? "Email *" : "Email"}>
                <input id="qc-email" value={email} onChange={(e) => onEmailChange(e.target.value)} inputMode="email" placeholder="tu@email.com"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${emailNeeded && emailVerifiedOk ? "border-green-400 bg-green-50" : "border-gray-200 focus:border-gray-400"}`} />
                {emailNeeded && emailOk ? (
                  emailVerifiedOk ? (
                    <p className="text-xs text-green-600 font-semibold mt-1.5 inline-flex items-center gap-1"><Check size={13} className="shrink-0" /> Email verificado</p>
                  ) : otpSent ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos" className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm tracking-widest text-center outline-none focus:border-gray-400" />
                        <button type="button" onClick={verifyOtp} disabled={otpBusy || otpCode.length !== 6} className="px-4 rounded-xl text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-40" style={{ background: primaryColor }}>{otpBusy ? "…" : "Verificar"}</button>
                      </div>
                      <button type="button" onClick={sendOtp} disabled={otpBusy} className="text-xs text-gray-400 self-start hover:text-gray-600">Reenviar código</button>
                    </div>
                  ) : (
                    <button type="button" onClick={sendOtp} disabled={otpBusy} className="mt-2 text-sm font-bold px-3 py-2 rounded-xl border transition hover:opacity-90 disabled:opacity-50" style={{ borderColor: primaryColor, color: primaryColor }}>{otpBusy ? "Enviando…" : "Verificar mi correo"}</button>
                  )
                ) : null}
                {otpMsg && <p className={`text-xs mt-1.5 ${otpMsg.includes("incorrecto") || otpMsg.includes("No se pudo") || otpMsg.includes("Error") ? "text-red-500" : "text-gray-500"}`}>{otpMsg}</p>}
                {emailNeeded && !emailVerifiedOk && !otpMsg && <p className="text-xs text-gray-400 mt-1.5">Necesario para {payment === "flow" ? "pagar con Flow" : "usar el cupón"}. Verifícalo para continuar.</p>}
              </Field>
              {/* Entrega inline */}
              <div className="pt-1 border-t border-gray-100 mt-1">
                {deliverySelected ? (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      {isDelivery ? <Motorbike className="w-4 h-4 text-gray-500" /> : <Store className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isDelivery && deliveryAddress ? (
                        <>
                          <p className="text-sm font-bold text-gray-800">Entregar a</p>
                          <p className="text-xs text-gray-500 truncate">{shortAddr(deliveryAddress.address)}{deliveryAddress.details ? ` · ${deliveryAddress.details}` : ""}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-800">Retiro en tienda</p>
                          {tenant.address && <p className="text-xs text-gray-500 truncate">{tenant.address}</p>}
                        </>
                      )}
                    </div>
                    <button type="button" onClick={() => setDeliveryModalOpen(true)} className="text-xs font-bold shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition">Editar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeliveryModalOpen(true)} className="w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left mt-1" style={{ borderColor: primaryColor, background: `${primaryColor}0d` }}>
                    <span className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                      <span className="text-sm font-bold truncate" style={{ color: primaryColor }}>Elige cómo recibir tu pedido</span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  </button>
                )}
              </div>
            </div>
          </Block>

          {deliveryModalOpen && <DeliveryModal tenant={tenant} primaryColor={primaryColor} onClose={() => setDeliveryModalOpen(false)} />}

          {/* Programación del pedido */}
          {canSchedule && deliverySelected && (
            <Block title="¿Cuándo?">
              <div className="flex gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setScheduleMode("asap")}
                  disabled={!isOpen}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-40"
                  style={scheduleMode === "asap" ? { background: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#e5e7eb", color: "#374151" }}
                >
                  Lo antes posible
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("scheduled")}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition"
                  style={scheduleMode === "scheduled" ? { background: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#e5e7eb", color: "#374151" }}
                >
                  Programar
                </button>
              </div>
              {!isOpen && scheduleMode === "asap" && (
                <p className="text-xs text-gray-400 mt-1">El local está cerrado ahora. Programa tu pedido para más tarde.</p>
              )}
              {scheduleMode === "scheduled" && (
                slotDays.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-2">No hay horarios disponibles para programar en este momento.</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {slotDays.map((d) => (
                        <button
                          key={d.ymd}
                          type="button"
                          onClick={() => { setScheduleDayYmd(d.ymd); setScheduledIso(null); }}
                          className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold border transition capitalize"
                          style={scheduleDayYmd === d.ymd ? { background: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#e5e7eb", color: "#374151" }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {(slotDays.find((d) => d.ymd === scheduleDayYmd)?.slots || []).map((s) => (
                        <button
                          key={s.iso}
                          type="button"
                          onClick={() => setScheduledIso(s.iso)}
                          className="py-2 rounded-lg text-sm font-semibold border transition"
                          style={scheduledIso === s.iso ? { background: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#e5e7eb", color: "#374151" }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {scheduledIso ? "✓ Programación de pedido. Entregaremos tu pedido a esa hora." : "Elige la hora en que quieres recibir/retirar tu pedido."}
                    </p>
                  </div>
                )
              )}
            </Block>
          )}

          {/* Pago */}
          <Block title="¿Cómo quieres pagar?">
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
          </Block>

          {/* Acompañamientos */}
          <AccompanimentsSection config={tenant.accompaniments} items={items} subtotal={subtotal} primaryColor={primaryColor} onResolve={onAccomResolve} persistKey={`qc-accom:${tenant.id}`} />

          {/* Notas */}
          {tenant.notesEnabled && (
            <Block title="Notas (opcional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej: sin cebolla, tocar el timbre…" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none" />
            </Block>
          )}

          </div>

          {/* ── Columna derecha (sticky en escritorio): detalles de la compra + pagar ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          {/* Resumen */}
          <Block title="Detalles de tu compra">
            {mounted && (
              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <div key={`${it.product_id}-${it.options.map((o) => o.value_id).join(",")}`} className="flex gap-3 text-sm items-start">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><ShoppingCart size={18} className="text-gray-300" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-700 font-medium leading-snug">{it.name}</span>
                      {it.options.length > 0 && (
                        <span className="block text-xs text-gray-400 truncate">{it.options.map((o) => o.value).join(", ")}</span>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
                          <button type="button" onClick={() => updateQty(it.product_id, it.options, -1)} className="p-1.5 text-gray-600" aria-label="Quitar uno"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="w-5 text-center font-black text-xs text-gray-900">{it.quantity}</span>
                          <button type="button" onClick={() => updateQty(it.product_id, it.options, 1)} className="p-1.5 text-gray-600" aria-label="Agregar uno"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                        <button type="button" onClick={() => removeItem(it.product_id, it.options)} className="text-gray-400 hover:text-red-500 p-1" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <span className="font-semibold text-gray-700 shrink-0">{clp(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm text-gray-500 pt-2 mt-1 border-t border-gray-100"><span>Subtotal</span><span>{clp(subtotal)}</span></div>
                {isDelivery && <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{clp(deliveryFee)}</span></div>}
                {discount > 0 && <div className="flex justify-between text-sm" style={{ color: primaryColor }}><span>Descuento {coupon ? `(${coupon.code})` : ""}</span><span>−{clp(discount)}</span></div>}
                {/* Cupón inline debajo del detalle */}
                <div className="pt-2 mt-1 border-t border-gray-100">
                  {(() => {
                    const emailNotice = coupon && emailNeeded && !emailVerifiedOk ? (
                      <div className="rounded-xl px-3 py-2.5 border mt-2" style={{ borderColor: `${primaryColor}55`, background: `${primaryColor}12` }}>
                        <p className="text-xs font-bold text-gray-800">{otpSent ? "Ingresa el código que te enviamos para aplicar el cupón." : "Verifica tu correo para usar este cupón."}</p>
                        <button type="button" onClick={goVerifyEmail} className="mt-1 text-xs font-black underline" style={{ color: primaryColor }}>{otpSent ? "Ir al código →" : "Verificar ahora →"}</button>
                      </div>
                    ) : null;
                    if (coupon) return (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 border" style={{ borderColor: `${primaryColor}55`, background: `${primaryColor}08` }}>
                          <span className="text-xs font-black" style={{ color: primaryColor }}>{coupon.code}</span>
                          <span className="text-xs text-gray-500 flex-1">{coupon.label || (discount > 0 ? `−${clp(discount)}` : "aplicado")}</span>
                          <button onClick={() => { setCoupon(null); setCouponCode(""); setCouponMsg(null); setCouponOpen(false); }} className="text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        {emailNotice}
                      </div>
                    );
                    if (couponOpen) return (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input autoFocus value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} placeholder="Código de cupón" className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-mono uppercase outline-none focus:border-gray-400" />
                          <button onClick={() => applyCoupon()} disabled={couponBusy || !couponCode.trim()} className="px-3 rounded-lg text-white font-bold text-xs transition hover:opacity-90 disabled:opacity-40 shrink-0" style={{ background: primaryColor }}>{couponBusy ? "…" : "Aplicar"}</button>
                        </div>
                        {couponMsg && <p className="text-xs text-red-500">{couponMsg}</p>}
                      </div>
                    );
                    return (
                      <button type="button" onClick={() => setCouponOpen(true)} className="text-xs font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/><path d="M2 8h20v4H2z"/><path d="M12 20V8"/><path d="M12 8a2 2 0 1 0-4 0"/><path d="M12 8a2 2 0 1 1 4 0"/></svg>
                        ¿Tienes un cupón?
                      </button>
                    );
                  })()}
                </div>
                <div className="flex justify-between font-black text-base text-gray-900 pt-2 mt-1 border-t border-gray-100"><span>Total</span><span style={{ color: primaryColor }}>{clp(finalTotal)}</span></div>
              </div>
            )}
          </Block>

          {!isOpen && !canSchedule && (
            <div className="rounded-xl bg-gray-900 text-white py-3 px-4 text-sm font-bold flex items-center justify-center gap-1.5">
              <Lock size={14} className="shrink-0" />
              <span>{tenant.openStatus.closedByClosure && tenant.openStatus.closure
                ? `Cerrado · ${tenant.openStatus.closure.reason}`
                : `Estamos cerrados ahora${tenant.openStatus.opensAt ? ` · Abrimos hoy a las ${tenant.openStatus.opensAt}` : tenant.openStatus.today?.open ? ` · Horario de hoy: ${tenant.openStatus.today.from} – ${tenant.openStatus.today.to}` : " · Hoy no atendemos"}`}</span>
            </div>
          )}
          {!isOpen && canSchedule && scheduleMode !== "scheduled" && (
            <div className="rounded-xl bg-gray-900 text-white py-3 px-4 text-sm font-bold flex items-center justify-center gap-1.5">
              <Lock size={14} className="shrink-0" /> <span>Cerrado ahora · puedes <button type="button" onClick={() => setScheduleMode("scheduled")} className="underline">programar tu pedido</button></span>
            </div>
          )}
          {belowMin && (
            <p className="text-center text-xs font-semibold text-red-500">Monto mínimo para pedir: {clp(minReq!)}</p>
          )}

          <button
            onClick={placeOrder}
            disabled={!isValid || sending}
            className="w-full py-4 rounded-2xl text-white font-black text-sm transition hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 sticky bottom-3 lg:static shadow-lg"
            style={{ background: primaryColor }}
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {sending ? "Procesando…" : onlineSel ? `Ir a pagar · ${clp(finalTotal)}` : `Confirmar pedido · ${clp(finalTotal)}`}
          </button>
          {onlineSel && <p className="text-center text-xs text-gray-400 -mt-1">Serás redirigido a {payment === "flow" ? "Flow" : "Webpay"} para pagar de forma segura.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Bloque con el título FUERA de la tarjeta (estilo Niu): encabezado arriba + card.
function Block({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {(title || action) && (
        <div className="flex items-center justify-between px-1">
          {title ? <h2 className="font-black text-sm text-gray-900">{title}</h2> : <span />}
          {action}
        </div>
      )}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">{children}</section>
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
