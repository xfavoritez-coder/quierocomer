"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Plus, Minus, X, ShoppingCart, User, MapPin, CreditCard,
  Package, Bike, Trash2, Gift, MessageSquare, Tag, PencilLine, CheckCircle2, Loader2, UtensilsCrossed, ExternalLink,
} from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import StoreStyles from "@/components/ecommerce/StoreStyles";
import AccompanimentsSection from "@/components/ecommerce/AccompanimentsSection";
import type { StorefrontData, StoreProduct, StoreOptionGroup } from "@/lib/ecommerce/storefront-data";
import type { AccompConfig } from "@/lib/ecommerce/accompaniments";

const F = "var(--font-display)";
const FB = "var(--font-body)";

const fmt = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");
const uid = () => Math.random().toString(36).slice(2);

const PAY_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
];

interface CartOption { group_id: string; group_name: string; value_id: string; value: string; price_delta: number; toteat_modifier_code: string | null }
interface CartItem {
  key: string; product_id: string; name: string; base_price: number; unit_price: number;
  quantity: number; toteat_code: string | null; options: CartOption[];
  comment: string; courtesy: boolean; courtesyReason: string;
}

// ── Palette (POS claro, estilo Servio) ──
const C = {
  bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0", border2: "#f1f5f9",
  text: "#0f172a", text2: "#64748b", text3: "#94a3b8", green: "#16a34a", red: "#ef4444", amber: "#f59e0b",
};

export default function TomarPedidosPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [posAvailable, setPosAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo cargar el catálogo")))),
      fetch(`/api/panel/ecommerce/status?restaurantId=${restaurantId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([menu, status]) => { setData(menu); setPosAvailable(!!status?.integrations?.pos); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  // Colapsa el sidebar del panel desde el primer render (antes de cargar), para
  // que no se vea aparecer y desaparecer. Se restaura al desmontar la página.
  return (
    <>
      <CollapseSidebar />
      {loading ? <Center><Loader2 size={22} className="animate-spin" /> Cargando catálogo…</Center>
        : err || !data ? <Center>{err || "No disponible"}</Center>
        : <POS data={data} restaurantId={restaurantId!} posAvailable={posAvailable} />}
    </>
  );
}

// Oculta el sidebar del panel (desktop) mientras el tomador está montado.
function CollapseSidebar() {
  return <style>{`@media (min-width:768px){.owl-sidebar{display:none!important}.owl-main{margin-left:0!important}}`}</style>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 300, fontFamily: FB, color: "var(--adm-text2)" }}>{children}</div>;
}

function POS({ data, restaurantId, posAvailable }: { data: StorefrontData; restaurantId: string; posAvailable: boolean }) {
  const { tenant, categories, products } = data;
  const accent = tenant.primaryColor || "#F4A623";
  const deliveryMode = tenant.deliveryConfig?.mode ?? "zones";
  const zones = tenant.deliveryZones ?? [];

  const [isWide, setIsWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsWide(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [mobileTab, setMobileTab] = useState<"menu" | "cart">("cart");

  // Menú
  const [search, setSearch] = useState("");
  const [modalProduct, setModalProduct] = useState<StoreProduct | null>(null);

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [courtesyKey, setCourtesyKey] = useState<string | null>(null);

  // Formulario
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "DELIVERY">(tenant.pickupEnabled === false && tenant.deliveryEnabled ? "DELIVERY" : "PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Nombre del cliente en la pestaña del navegador (útil con varias ventanas abiertas).
  useEffect(() => {
    const prev = document.title;
    document.title = customerName.trim() ? `${customerName.trim()} — Tomar pedidos` : `Tomar pedidos · ${tenant.name}`;
    return () => { document.title = prev; };
  }, [customerName, tenant.name]);
  const [address, setAddress] = useState("");
  const [apt, setApt] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [geo, setGeo] = useState<{ status: "idle" | "loading" | "ok" | "error"; msg: string; lat?: number; lng?: number }>({ status: "idle", msg: "" });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [accomNote, setAccomNote] = useState("");
  const [sendToPos, setSendToPos] = useState(true);

  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = (m: string) => { clearTimeout(toastTimer.current); setToast(m); toastTimer.current = setTimeout(() => setToast(null), 1800); };

  // Totales
  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.courtesy ? 0 : i.unit_price * i.quantity), 0), [cart]);
  const discount = useMemo(() => {
    const v = parseFloat(discountInput) || 0;
    if (v <= 0) return 0;
    return discountType === "percent" ? Math.round((subtotal * v) / 100) : Math.round(v);
  }, [discountInput, discountType, subtotal]);
  const fee = deliveryType === "DELIVERY" ? deliveryFee : 0;
  const total = Math.max(0, subtotal + fee - discount);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartLines = useMemo(() => cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })), [cart]);

  // Delivery: zona → fee
  const selectZone = (name: string) => {
    setZoneName(name);
    const z = zones.find((z) => z.name === name);
    setDeliveryFee(z ? z.fee : 0);
  };
  const selectedZone = zones.find((z) => z.name === zoneName);

  // Delivery: distancia → geocodificar (debounced)
  const geoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (deliveryType !== "DELIVERY" || deliveryMode !== "distance") return;
    clearTimeout(geoTimer.current);
    if (address.trim().length < 6) { setGeo({ status: "idle", msg: "" }); setDeliveryFee(0); return; }
    setGeo({ status: "loading", msg: "Calculando envío…" });
    geoTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/panel/ecommerce/delivery-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, address: address.trim() }) });
        const q = await res.json();
        if (q.available) { setDeliveryFee(q.fee); setGeo({ status: "ok", msg: `🛵 ${fmt(q.fee)} · ${q.formatted}`, lat: q.lat, lng: q.lng }); }
        else { setDeliveryFee(0); setGeo({ status: "error", msg: `⚠️ ${q.reason || "Zona no disponible"}` }); }
      } catch { setDeliveryFee(0); setGeo({ status: "error", msg: "⚠️ Error al calcular" }); }
    }, 700);
  }, [address, deliveryType, deliveryMode, restaurantId]);

  // Acciones de carrito
  const addToCart = useCallback((base: Omit<CartItem, "key" | "quantity" | "comment" | "courtesy" | "courtesyReason">, qty: number) => {
    const optKey = JSON.stringify(base.options.map((o) => o.value_id).sort());
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product_id === base.product_id && JSON.stringify(c.options.map((o) => o.value_id).sort()) === optKey && !c.courtesy);
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + qty } : c));
      return [...prev, { ...base, key: uid(), quantity: qty, comment: "", courtesy: false, courtesyReason: "" }];
    });
    if (search) setSearch("");
    showToast(`✓ ${base.name}`);
  }, [search]);

  const onProductClick = (p: StoreProduct) => {
    if (p.is_sold_out) { showToast("Agotado"); return; }
    if ((p.option_groups?.length ?? 0) > 0) setModalProduct(p);
    else addToCart({ product_id: p.id, name: p.name, base_price: p.price, unit_price: p.price, toteat_code: p.toteat_code, options: [] }, 1);
    if (!isWide) setMobileTab("cart");
  };
  const changeQty = (key: string, d: number) => setCart((prev) => prev.flatMap((c) => (c.key !== key ? [c] : c.quantity + d <= 0 ? [] : [{ ...c, quantity: c.quantity + d }])));
  const removeItem = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));
  const setComment = (key: string, comment: string) => setCart((prev) => prev.map((c) => (c.key === key ? { ...c, comment } : c)));
  const applyCourtesy = (key: string, reason: string) => { setCart((prev) => prev.map((c) => (c.key === key ? { ...c, courtesy: true, courtesyReason: reason } : c))); setCourtesyKey(null); };
  const removeCourtesy = (key: string) => setCart((prev) => prev.map((c) => (c.key === key ? { ...c, courtesy: false, courtesyReason: "" } : c)));

  const addressFull = [address.trim(), apt.trim()].filter(Boolean).join(", ");

  // Validación
  const invalid = useMemo(() => {
    if (!cart.length) return "Agrega productos";
    if (!customerName.trim()) return "Falta el nombre del cliente";
    if (deliveryType === "DELIVERY") {
      if (deliveryMode === "zones") { if (!selectedZone) return "Selecciona la zona de reparto"; if (selectedZone.minOrder && subtotal < selectedZone.minOrder) return `Mínimo en ${selectedZone.name}: ${fmt(selectedZone.minOrder)}`; }
      else if (geo.status !== "ok") return "Ingresa una dirección válida";
    }
    if (!paymentMethod) return "Selecciona el medio de pago";
    return null;
  }, [cart, customerName, deliveryType, deliveryMode, selectedZone, subtotal, geo.status, paymentMethod]);

  async function submit() {
    setSending(true);
    try {
      const res = await fetch("/api/panel/ecommerce/manual-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          orderType: deliveryType,
          deliveryAddress: deliveryType === "DELIVERY" ? addressFull : null,
          deliveryLat: geo.lat ?? null, deliveryLng: geo.lng ?? null,
          paymentMethod, notes: [accomNote, notes.trim()].filter(Boolean).join(" | ") || null,
          discount, deliveryFee: fee, sendToPos: posAvailable && sendToPos,
          items: cart.map((i) => ({
            product_id: i.product_id, name: i.name, unit_price: i.courtesy ? 0 : i.unit_price, quantity: i.quantity,
            toteat_code: i.toteat_code, comment: i.comment, courtesy: i.courtesy, courtesyReason: i.courtesyReason, options: i.options,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo registrar");
      setSuccess(d.orderNumber);
    } catch (e) { showToast(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setSending(false); setShowConfirm(false); }
  }

  function reset() {
    setCart([]); setCustomerName(""); setCustomerPhone(""); setAddress(""); setApt(""); setZoneName(""); setDeliveryFee(0);
    setGeo({ status: "idle", msg: "" }); setPaymentMethod(""); setNotes(""); setDiscountInput(""); setDiscountType("percent");
    setDeliveryType("PICKUP"); setAccomNote(""); setSuccess(null); setOpenNoteKey(null); setMobileTab("menu");
  }

  // ── Sub-vistas ──
  const filtered = search.trim() ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())) : null;

  const menuPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg }}>
      <div style={{ padding: 14, flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} color={C.text3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…"
            style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, fontFamily: FB, fontSize: "0.86rem", color: C.text, outline: "none" }} />
        </div>
        {!filtered && categories.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {categories.map((cat) => (
              <a key={cat.id} href={`#cat-${cat.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                style={{ padding: "5px 11px", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, borderRadius: 999, background: C.card, border: `1px solid ${C.border}`, color: C.text2, cursor: "pointer", textDecoration: "none" }}>{cat.name}</a>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 20px", scrollBehavior: "smooth" }}>
        {filtered ? (
          filtered.length === 0 ? <p style={{ textAlign: "center", color: C.text3, fontFamily: FB, padding: 30 }}>Sin resultados</p>
            : <ProductGrid products={filtered} accent={accent} showDesc={tenant.posShowDescriptions} onClick={onProductClick} />
        ) : (
          categories.map((cat) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            if (!catProducts.length) return null;
            return (
              <div key={cat.id} id={`cat-${cat.id}`} style={{ marginBottom: 22, scrollMarginTop: 8 }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: "0.86rem", fontWeight: 800, color: C.text, margin: "6px 0 10px" }}>
                  <span style={{ width: 5, height: 18, borderRadius: 999, background: accent }} />{cat.name}
                </h2>
                <ProductGrid products={catProducts} accent={accent} showDesc={tenant.posShowDescriptions} onClick={onProductClick} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const cartPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.card, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Tipo de entrega */}
        {tenant.deliveryEnabled && tenant.pickupEnabled && (
          <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: `1px solid ${C.border2}` }}>
            <TypeBtn active={deliveryType === "PICKUP"} onClick={() => setDeliveryType("PICKUP")} icon={<Package size={15} />} label="Retiro" activeBg={C.text} />
            <TypeBtn active={deliveryType === "DELIVERY"} onClick={() => setDeliveryType("DELIVERY")} icon={<Bike size={15} />} label="Delivery" activeBg={accent} />
          </div>
        )}

        {/* Cliente */}
        <Section icon={<User size={13} />} title="Cliente">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre *" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Teléfono" type="tel" style={{ ...inp, flex: 1, minWidth: 0 }} />
          </div>
        </Section>

        {/* Dirección / zona */}
        {deliveryType === "DELIVERY" && (
          <Section icon={<MapPin size={13} />} title="Entrega">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 123, Comuna *" style={inp} />
              <input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Dpto / Piso (opcional)" style={inp} />
              {deliveryMode === "zones" ? (
                <>
                  <select value={zoneName} onChange={(e) => selectZone(e.target.value)} style={{ ...inp, appearance: "auto" }}>
                    <option value="">Selecciona la zona…</option>
                    {zones.map((z) => <option key={z.name} value={z.name}>{z.name} — {fmt(z.fee)}{z.minOrder ? ` (mín. ${fmt(z.minOrder)})` : ""}</option>)}
                  </select>
                  {selectedZone && <p style={{ fontFamily: FB, fontSize: "0.74rem", color: selectedZone.minOrder && subtotal < selectedZone.minOrder ? C.red : C.green, margin: 0 }}>{selectedZone.minOrder && subtotal < selectedZone.minOrder ? `⚠️ Mínimo ${fmt(selectedZone.minOrder)}` : `🛵 Envío ${fmt(selectedZone.fee)}`}</p>}
                  {zones.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.74rem", color: C.text3, margin: 0 }}>No hay zonas configuradas.</p>}
                </>
              ) : (
                geo.msg && <p style={{ fontFamily: FB, fontSize: "0.74rem", color: geo.status === "ok" ? C.green : geo.status === "error" ? C.red : C.text3, margin: 0 }}>{geo.status === "loading" ? "⏳ " : ""}{geo.msg}</p>
              )}
            </div>
          </Section>
        )}

        {/* Pedido */}
        <Section icon={<ShoppingCart size={13} />} title="Pedido" badge={cartCount || undefined} accent={accent}>
          {cart.length === 0 ? <p style={{ fontFamily: FB, fontSize: "0.84rem", color: C.text3, textAlign: "center", padding: 12 }}>Agrega productos del menú</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cart.map((item) => {
                const noteOpen = openNoteKey === item.key;
                return (
                  <div key={item.key} style={{ borderRadius: 12, border: `1px solid ${item.courtesy ? "#fde68a" : C.border2}`, background: item.courtesy ? "#fffbeb" : C.bg }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: FB, fontSize: "0.84rem", fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.3 }}>{item.name}</p>
                        {item.options.length > 0 && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: C.text3, margin: "2px 0 0" }}>{item.options.map((o) => o.value).join(", ")}</p>}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          {item.courtesy
                            ? <><span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: C.amber }}>Cortesía</span><span style={{ fontFamily: FB, fontSize: "0.72rem", color: C.text3, textDecoration: "line-through" }}>{fmt(item.unit_price * item.quantity)}</span></>
                            : <span style={{ fontFamily: FB, fontSize: "0.74rem", fontWeight: 700, color: C.text2 }}>{fmt(item.unit_price * item.quantity)}</span>}
                          {item.courtesyReason && <span style={{ fontFamily: FB, fontSize: "0.7rem", color: C.amber }}>· {item.courtesyReason}</span>}
                        </div>
                        {item.comment && !noteOpen && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: C.text3, fontStyle: "italic", margin: "3px 0 0" }}>&quot;{item.comment}&quot;</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <RoundBtn onClick={() => changeQty(item.key, -1)}><Minus size={12} /></RoundBtn>
                        <span style={{ width: 18, textAlign: "center", fontFamily: F, fontSize: "0.78rem", fontWeight: 700 }}>{item.quantity}</span>
                        <RoundBtn onClick={() => changeQty(item.key, 1)}><Plus size={12} /></RoundBtn>
                        <RoundBtn onClick={() => setOpenNoteKey(noteOpen ? null : item.key)} active={!!item.comment} accent={accent}><MessageSquare size={12} /></RoundBtn>
                        <RoundBtn onClick={() => (item.courtesy ? removeCourtesy(item.key) : setCourtesyKey(item.key))} active={item.courtesy} accent={C.amber}><Gift size={12} /></RoundBtn>
                        <RoundBtn onClick={() => removeItem(item.key)} danger><Trash2 size={12} /></RoundBtn>
                      </div>
                    </div>
                    {noteOpen && (
                      <div style={{ padding: "0 10px 10px" }}>
                        <input autoFocus value={item.comment} onChange={(e) => setComment(item.key, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setOpenNoteKey(null); }} placeholder="Nota para cocina…" maxLength={120} style={{ ...inp, fontSize: "0.78rem", padding: "6px 10px" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Acompañamientos (reutiliza el del checkout) */}
        {cart.length > 0 && (
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border2}` }}>
            <AccompanimentsSection config={tenant.accompaniments as AccompConfig} items={cartLines} subtotal={subtotal} primaryColor={accent} onResolve={(r) => setAccomNote(r.notesPart)} />
          </div>
        )}

        {/* Descuento */}
        <Section icon={<Tag size={13} />} title="Descuento">
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setDiscountType("percent")} style={{ padding: "0 12px", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, border: "none", cursor: "pointer", background: discountType === "percent" ? C.text : C.card, color: discountType === "percent" ? "#fff" : C.text2 }}>%</button>
              <button onClick={() => setDiscountType("amount")} style={{ padding: "0 12px", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, border: "none", cursor: "pointer", background: discountType === "amount" ? C.text : C.card, color: discountType === "amount" ? "#fff" : C.text2 }}>$</button>
            </div>
            <input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" style={{ ...inp, flex: 1 }} />
            {discount > 0 && <span style={{ alignSelf: "center", fontFamily: FB, fontSize: "0.76rem", fontWeight: 700, color: C.green, flexShrink: 0 }}>−{fmt(discount)}</span>}
          </div>
        </Section>

        {/* Medio de pago */}
        <Section icon={<CreditCard size={13} />} title="Medio de pago">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PAY_METHODS.map((p) => (
              <button key={p.id} onClick={() => setPaymentMethod(p.id === paymentMethod ? "" : p.id)}
                style={{ padding: "7px 12px", borderRadius: 10, fontFamily: F, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${paymentMethod === p.id ? C.text : C.border}`, background: paymentMethod === p.id ? C.text : C.card, color: paymentMethod === p.id ? "#fff" : C.text2 }}>{p.label}</button>
            ))}
          </div>
        </Section>

        {/* Notas */}
        {tenant.notesEnabled && (
          <Section icon={<PencilLine size={13} />} title="Notas generales" last>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones adicionales…" style={{ ...inp, resize: "none" }} />
          </Section>
        )}
      </div>

      {/* Barra inferior */}
      <div style={{ borderTop: `1px solid ${C.border2}`, background: C.card, padding: 14, display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        <div style={{ fontFamily: FB, fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 2 }}>
          <Row label="Subtotal" value={fmt(subtotal)} color={C.text2} />
          {discount > 0 && <Row label="Descuento" value={`−${fmt(discount)}`} color={C.green} />}
          {fee > 0 && <Row label="Delivery" value={fmt(fee)} color={C.text2} />}
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontWeight: 800, color: C.text, fontSize: "1rem", paddingTop: 5, borderTop: `1px solid ${C.border2}` }}><span>Total</span><span>{fmt(total)}</span></div>
        </div>
        {posAvailable && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <Toggle on={sendToPos} onClick={() => setSendToPos((v) => !v)} accent={accent} />
            <span style={{ fontFamily: FB, fontSize: "0.76rem", color: C.text2 }}>Enviar al POS (Toteat)</span>
          </label>
        )}
        <button onClick={() => { if (!invalid) setShowConfirm(true); }} disabled={!!invalid} title={invalid || undefined}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", fontFamily: F, fontSize: "0.9rem", fontWeight: 800, cursor: invalid ? "not-allowed" : "pointer", background: invalid ? C.border : accent, color: invalid ? C.text3 : "#1a1a1a" }}>
          {invalid || `Tomar pedido — ${fmt(total)}`}
        </button>
      </div>
    </div>
  );

  return (
    <div className="qc-storefront" style={{ fontFamily: FB }}>
      <StoreStyles />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none" }}>
          <ArrowLeft size={15} /> Ecommerce
        </Link>
        <button onClick={() => window.open("/panel/ecommerce/tomar-pedidos", "_blank", "noopener")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text2, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
          <ExternalLink size={14} /> Nueva ventana
        </button>
      </div>

      {isWide ? (
        <div style={{ display: "flex", gap: 14, height: "calc(100vh - 150px)", minHeight: 520 }}>
          <div style={{ width: 380, flexShrink: 0, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>{cartPanel}</div>
          <div style={{ flex: 1, minWidth: 0, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>{menuPanel}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 128px)", minHeight: 420 }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: "16px 16px 0 0", border: `1px solid ${C.border}`, borderBottom: "none", overflow: "hidden" }}>
            {mobileTab === "menu" ? menuPanel : cartPanel}
          </div>
          {/* Barra de tabs fija abajo */}
          <div style={{ display: "flex", gap: 8, padding: 8, background: C.card, borderRadius: "0 0 16px 16px", border: `1px solid ${C.border}`, flexShrink: 0 }}>
            <TabBtn active={mobileTab === "cart"} onClick={() => setMobileTab("cart")} icon={<ShoppingCart size={16} />} label={`Pedido${cartCount ? ` (${cartCount})` : ""}`} accent={accent} />
            <TabBtn active={mobileTab === "menu"} onClick={() => setMobileTab("menu")} icon={<UtensilsCrossed size={16} />} label="Menú" accent={accent} />
          </div>
        </div>
      )}

      {modalProduct && <ModifiersModal product={modalProduct} accent={accent} onClose={() => setModalProduct(null)} onAdd={(base, qty) => { addToCart(base, qty); setModalProduct(null); if (!isWide) setMobileTab("cart"); }} />}
      {courtesyKey && <CourtesyModal onClose={() => setCourtesyKey(null)} onConfirm={(r) => applyCourtesy(courtesyKey, r)} />}
      {showConfirm && (
        <ConfirmModal
          cart={cart} customerName={customerName} customerPhone={customerPhone} deliveryType={deliveryType}
          addressFull={addressFull} paymentMethod={paymentMethod} notes={[accomNote, notes].filter(Boolean).join(" | ")}
          subtotal={subtotal} discount={discount} fee={fee} total={total} sending={sending} accent={accent}
          onClose={() => setShowConfirm(false)} onConfirm={submit}
        />
      )}
      {success != null && (
        <Overlay>
          <div style={{ background: C.card, borderRadius: 18, padding: 30, maxWidth: 340, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={30} color={C.green} /></div>
            <div>
              <h2 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: C.text, margin: 0 }}>¡Pedido tomado!</h2>
              <p style={{ fontFamily: FB, fontSize: "0.86rem", color: C.text2, margin: "4px 0 0" }}>Pedido #{success} registrado. Aparece en Pedidos.</p>
            </div>
            <button onClick={reset} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: C.text, color: "#fff", fontFamily: F, fontWeight: 700, cursor: "pointer" }}>Nuevo pedido</button>
            <Link href="/panel/ecommerce/pedidos" style={{ fontFamily: FB, fontSize: "0.8rem", color: C.text2, textDecoration: "none" }}>Ver pedidos →</Link>
          </div>
        </Overlay>
      )}
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: C.text, color: "#fff", padding: "10px 18px", borderRadius: 999, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>{toast}</div>}
    </div>
  );
}

// ── Componentes auxiliares ──
const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, fontFamily: FB, fontSize: "0.84rem", color: C.text, outline: "none", boxSizing: "border-box" };

function ProductGrid({ products, accent, showDesc, onClick }: { products: StoreProduct[]; accent: string; showDesc?: boolean; onClick: (p: StoreProduct) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
      {products.map((p) => {
        const hasMods = (p.option_groups?.length ?? 0) > 0;
        return (
          <button key={p.id} onClick={() => onClick(p)} disabled={p.is_sold_out}
            style={{ textAlign: "left", background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 12, display: "flex", flexDirection: "column", gap: 5, cursor: p.is_sold_out ? "not-allowed" : "pointer", opacity: p.is_sold_out ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{p.name}</span>
              {hasMods && <span style={{ fontFamily: FB, fontSize: "0.58rem", fontWeight: 700, color: accent, background: `${accent}1f`, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>opciones</span>}
            </div>
            {showDesc && p.description && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: C.text2, lineHeight: 1.35, margin: 0 }}>{p.description}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
              {p.is_sold_out ? <span style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: C.red }}>Agotado</span>
                : p.original_price ? <><span style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 800, color: "#fff", background: accent, padding: "1px 7px", borderRadius: 999 }}>{fmt(p.price)}</span><span style={{ fontFamily: FB, fontSize: "0.72rem", color: C.text3, textDecoration: "line-through" }}>{fmt(p.original_price)}</span></>
                : <span style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 800, color: C.text }}>{fmt(p.price)}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Section({ icon, title, badge, accent, last, children }: { icon: React.ReactNode; title: string; badge?: number; accent?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: last ? "none" : `1px solid ${C.border2}` }}>
      <p style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>
        {icon} {title}
        {badge ? <span style={{ background: accent, color: "#fff", fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{badge}</span> : null}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", color }}><span>{label}</span><span>{value}</span></div>;
}

function TypeBtn({ active, onClick, icon, label, activeBg }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; activeBg: string }) {
  return <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", border: `1px solid ${active ? activeBg : C.border}`, background: active ? activeBg : C.card, color: active ? "#fff" : C.text2 }}>{icon}{label}</button>;
}

function TabBtn({ active, onClick, icon, label, accent }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; accent: string }) {
  return <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 12, fontFamily: F, fontSize: "0.84rem", fontWeight: 700, cursor: "pointer", border: `1px solid ${active ? accent : C.border}`, background: active ? accent : C.card, color: active ? "#1a1a1a" : C.text2 }}>{icon}{label}</button>;
}

function RoundBtn({ children, onClick, active, danger, accent }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean; accent?: string }) {
  const color = danger ? C.red : active ? (accent || C.text) : C.text2;
  const bg = danger ? "transparent" : active ? `${accent || C.text}1f` : "transparent";
  return <button onClick={onClick} style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${C.border}`, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{children}</button>;
}

function Toggle({ on, onClick, accent }: { on: boolean; onClick: () => void; accent: string }) {
  return <button onClick={onClick} style={{ width: 34, height: 19, borderRadius: 999, border: "none", background: on ? accent : C.border, position: "relative", cursor: "pointer", flexShrink: 0 }}><span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} /></button>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>{children}</div>;
}

function ModifiersModal({ product, accent, onAdd, onClose }: { product: StoreProduct; accent: string; onAdd: (base: Omit<CartItem, "key" | "quantity" | "comment" | "courtesy" | "courtesyReason">, qty: number) => void; onClose: () => void }) {
  const groups = product.option_groups ?? [];
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);

  const toggle = (g: StoreOptionGroup, valueId: string) => {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      if (cur.includes(valueId)) return { ...prev, [g.id]: cur.filter((v) => v !== valueId) };
      if (g.max_select === 1) return { ...prev, [g.id]: [valueId] };
      if (cur.length < g.max_select) return { ...prev, [g.id]: [...cur, valueId] };
      return prev;
    });
  };

  const optionsFlat: CartOption[] = groups.flatMap((g) => (selected[g.id] ?? []).map((vid) => {
    const val = (g.values ?? []).find((v) => v.id === vid)!;
    return { group_id: g.id, group_name: g.name, value_id: vid, value: val.name, price_delta: val.price_delta, toteat_modifier_code: val.toteat_modifier_code };
  }));
  const unitPrice = product.price + optionsFlat.reduce((s, o) => s + o.price_delta, 0);
  const canAdd = groups.every((g) => !g.is_required || (selected[g.id]?.length ?? 0) >= Math.max(1, g.min_select));

  return (
    <Overlay>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 18, borderBottom: `1px solid ${C.border2}` }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: C.text, margin: 0 }}>{product.name}</h2>
            {product.description && <p style={{ fontFamily: FB, fontSize: "0.76rem", color: C.text3, margin: "2px 0 0" }}>{product.description}</p>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.text3 }}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: C.text }}>{g.name}</span>
                {g.is_required && <span style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: C.red, background: "#fee2e2", padding: "1px 6px", borderRadius: 5 }}>Requerido</span>}
                {g.max_select > 1 && <span style={{ fontFamily: FB, fontSize: "0.7rem", color: C.text3 }}>Máx {g.max_select}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(g.values ?? []).map((v) => {
                  const checked = (selected[g.id] ?? []).includes(v.id);
                  return (
                    <button key={v.id} onClick={() => toggle(g, v.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 9, borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${checked ? accent : C.border2}`, background: checked ? `${accent}12` : C.bg }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${checked ? accent : C.border}`, background: checked ? accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{checked && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}</span>
                      <span style={{ flex: 1, fontFamily: FB, fontSize: "0.84rem", color: C.text }}>{v.name}</span>
                      {v.price_delta !== 0 && <span style={{ fontFamily: FB, fontSize: "0.74rem", fontWeight: 600, color: C.text2 }}>{v.price_delta > 0 ? "+" : ""}{fmt(v.price_delta)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, borderTop: `1px solid ${C.border2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RoundBtn onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={13} /></RoundBtn>
            <span style={{ width: 22, textAlign: "center", fontFamily: F, fontWeight: 700, color: C.text }}>{qty}</span>
            <RoundBtn onClick={() => setQty((q) => q + 1)}><Plus size={13} /></RoundBtn>
          </div>
          <button onClick={() => onAdd({ product_id: product.id, name: product.name, base_price: product.price, unit_price: unitPrice, toteat_code: product.toteat_code, options: optionsFlat }, qty)} disabled={!canAdd}
            style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: canAdd ? "pointer" : "not-allowed", background: canAdd ? accent : C.border, color: canAdd ? "#1a1a1a" : C.text3 }}>Agregar — {fmt(unitPrice * qty)}</button>
        </div>
      </div>
    </Overlay>
  );
}

function CourtesyModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 60); }, []);
  return (
    <Overlay>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottom: `1px solid ${C.border2}` }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: "1rem", fontWeight: 800, color: C.text, margin: 0 }}><Gift size={18} color={C.amber} /> Cortesía</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.text3 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <input ref={ref} value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onConfirm(reason); }} placeholder="Motivo (cumpleaños, error…)" maxLength={100} style={inp} />
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 18px 18px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: C.text2, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => onConfirm(reason)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: C.amber, color: "#fff", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>Confirmar</button>
        </div>
      </div>
    </Overlay>
  );
}

function ConfirmModal({ cart, customerName, customerPhone, deliveryType, addressFull, paymentMethod, notes, subtotal, discount, fee, total, sending, accent, onClose, onConfirm }: {
  cart: CartItem[]; customerName: string; customerPhone: string; deliveryType: "PICKUP" | "DELIVERY"; addressFull: string;
  paymentMethod: string; notes: string; subtotal: number; discount: number; fee: number; total: number; sending: boolean; accent: string; onClose: () => void; onConfirm: () => void;
}) {
  const payLabel = PAY_METHODS.find((p) => p.id === paymentMethod)?.label ?? paymentMethod;
  return (
    <Overlay>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: "100%", maxWidth: 380, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottom: `1px solid ${C.border2}` }}>
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: C.text, margin: 0 }}>Confirmar pedido</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.text3 }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 10, fontFamily: FB, fontSize: "0.84rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: C.text }}>{deliveryType === "DELIVERY" ? <><Bike size={15} color={accent} /> Delivery</> : <><Package size={15} /> Retiro en local</>}</div>
          <div><span style={{ fontWeight: 700, color: C.text }}>{customerName}</span>{customerPhone && <span style={{ color: C.text2 }}> · {customerPhone}</span>}</div>
          {deliveryType === "DELIVERY" && addressFull && <p style={{ color: C.text2, fontSize: "0.78rem", margin: 0 }}>{addressFull}</p>}
          <div style={{ alignSelf: "flex-start", background: C.text, color: "#fff", fontFamily: F, fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>POR PAGAR: {payLabel}</div>
          {notes && <p style={{ color: C.text3, fontSize: "0.78rem", fontStyle: "italic", margin: 0 }}>&quot;{notes}&quot;</p>}
          <ul style={{ listStyle: "none", margin: 0, padding: "10px 0 0", borderTop: `1px solid ${C.border2}`, display: "flex", flexDirection: "column", gap: 6 }}>
            {cart.map((it) => (
              <li key={it.key} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: C.text3, flexShrink: 0 }}>{it.quantity}×</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: C.text }}>{it.name}</span>
                  {it.options.length > 0 && <span style={{ color: C.text3, fontSize: "0.74rem" }}> ({it.options.map((o) => o.value).join(", ")})</span>}
                  {it.courtesy && <span style={{ color: C.amber, fontWeight: 700, fontSize: "0.74rem" }}> · Cortesía</span>}
                </div>
                <span style={{ flexShrink: 0, fontSize: "0.78rem", fontWeight: 600, color: it.courtesy ? C.text3 : C.text2, textDecoration: it.courtesy ? "line-through" : "none" }}>{fmt(it.courtesy ? 0 : it.unit_price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div style={{ borderTop: `1px solid ${C.border2}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {discount > 0 && <Row label="Descuento" value={`−${fmt(discount)}`} color={C.green} />}
            {fee > 0 && <Row label="Delivery" value={fmt(fee)} color={C.text2} />}
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontWeight: 800, color: C.text, fontSize: "1rem" }}><span>Total</span><span>{fmt(total)}</span></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, padding: 18, borderTop: `1px solid ${C.border2}` }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, fontFamily: F, fontSize: "0.84rem", fontWeight: 600, color: C.text2, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={sending} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: accent, color: "#1a1a1a", fontFamily: F, fontSize: "0.84rem", fontWeight: 800, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{sending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}{sending ? "Registrando…" : "Confirmar"}</button>
        </div>
      </div>
    </Overlay>
  );
}
