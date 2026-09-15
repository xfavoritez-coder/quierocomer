"use client";
import { useEffect, useState, useCallback } from "react";
import { X, ChevronRight, ChevronDown, ArrowLeft, User, ClipboardList, Heart, MessageCircle, Share2, MapPin, LogOut, Camera, Globe, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { StoreTenant, StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore, type CartItemOption } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { useCloseAnimation } from "@/lib/ecommerce/useCloseAnimation";

interface QrUser { id: string; name: string | null; email: string; savedAddresses?: { address: string; lat?: number | null; lng?: number | null }[] | null }
interface OrderItemStored { name?: string; dishName?: string; product_id?: string; unit_price?: number; unitTotal?: number; quantity: number; toteat_code?: string | null; options?: CartItemOption[] }
interface MyOrder { id: string; orderNumber: number | null; total: number; status: string; orderType: string; createdAt: string; paymentMethod: string; paymentStatus: string; items: OrderItemStored[] }

const STATUS_LABEL: Record<string, string> = { PENDING: "Nuevo", ACCEPTED: "Aceptado", PREPARING: "Preparando", IN_DELIVERY: "En reparto", READY: "Listo", DONE: "Entregado", CANCELLED: "Cancelado" };

export type CustomerMenuView = "root" | "profile" | "orders" | "favorites" | "contact" | "social";
type View = CustomerMenuView;

export default function CustomerMenu({ tenant, primaryColor, onClose, side = "right", products = [], initialView = "root", variant = "drawer", initialLoginExpanded = false }: { tenant: StoreTenant; primaryColor: string; onClose: () => void; side?: "left" | "right"; products?: StoreProduct[]; initialView?: CustomerMenuView; variant?: "drawer" | "sheet"; initialLoginExpanded?: boolean }) {
  const [view, setView] = useState<View>(initialView);
  const sheet = variant === "sheet";
  const { closing, requestClose } = useCloseAnimation(onClose);
  const panelAnim = sheet
    ? (closing ? "qc-sheet-out" : "qc-sheet-in")
    : side === "left"
      ? (closing ? "qc-drawer-left-out" : "qc-drawer-left-in")
      : (closing ? "qc-drawer-right-out" : "qc-drawer-right-in");
  const [user, setUser] = useState<QrUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loginExpanded, setLoginExpanded] = useState(initialLoginExpanded);

  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  const loadUser = useCallback(() => {
    fetch("/api/qr/user/me").then((r) => (r.ok ? r.json() : null)).then((d) => setUser(d?.user ?? null)).catch(() => {}).finally(() => setLoadingUser(false));
  }, []);
  useEffect(() => { loadUser(); }, [loadUser]);

  async function logout() {
    await fetch("/api/qr/user/logout", { method: "POST" }).catch(() => {});
    setUser(null); setView("root"); toast.success("Sesión cerrada");
  }

  const needsLogin = (v: View) => (v === "profile" || v === "orders" || v === "favorites") && !user;
  const go = (v: View) => { if (needsLogin(v)) { setLoginExpanded(true); return; } setView(v); };

  return (
    <div className={`fixed inset-0 z-50 flex ${sheet ? "justify-center items-end sm:items-center" : side === "left" ? "justify-start" : "justify-end"}`}>
      <div className={`absolute inset-0 ${closing ? "qc-fade-out" : "qc-fade-in"}`} onClick={requestClose} style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }} />
      <div className={`${sheet
        ? "relative bg-gray-50 w-full max-w-md h-[75vh] sm:h-[80vh] sm:max-h-[640px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        : "relative bg-gray-50 w-[85%] max-w-sm h-full shadow-2xl flex flex-col"} ${panelAnim}`}>
        {sheet && <div className="pt-2.5 pb-1 flex justify-center shrink-0 bg-white"><span className="w-10 h-1.5 rounded-full bg-gray-300" /></div>}
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-14 bg-white border-b border-gray-100 shrink-0">
          {view !== "root" ? (
            <button onClick={() => setView("root")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"><ArrowLeft className="w-5 h-5" /></button>
          ) : <div className="w-9" />}
          <h2 className="flex-1 text-center font-black text-gray-900">
            {view === "root" ? "Menú" : view === "profile" ? "Mi perfil" : view === "orders" ? "Mis pedidos" : view === "favorites" ? "Mis favoritos" : view === "contact" ? "Contáctanos" : "Redes sociales"}
          </h2>
          <button onClick={requestClose} className="qc-glass-x w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 active:scale-90 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {view === "root" && (
            <>
              {/* Usuario / login */}
              {loadingUser ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: primaryColor }}><User className="w-5 h-5" /></div>
                  <p className="text-sm text-gray-400">Cargando…</p>
                </div>
              ) : user ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: primaryColor }}>
                    {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900 truncate">{user.name || "Cliente"}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button onClick={logout} title="Cerrar sesión" className="text-gray-400 hover:text-red-500 shrink-0"><LogOut className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
                  <button onClick={() => setLoginExpanded((v) => !v)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: primaryColor }}><User className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900">Iniciar sesión</p>
                      <p className="text-xs text-gray-400">Accede con tu correo</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${loginExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {/* Panel desplegable (grid 0fr → 1fr = expansión suave) */}
                  <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: loginExpanded ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <InlineLogin primaryColor={primaryColor} onLogged={() => { setLoginExpanded(false); loadUser(); }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                <MenuRow icon={<User className="w-5 h-5" />} label="Mi perfil" onClick={() => go("profile")} color={primaryColor} />
                <MenuRow icon={<ClipboardList className="w-5 h-5" />} label="Mis pedidos" onClick={() => go("orders")} color={primaryColor} />
                {tenant.favoritesEnabled && <MenuRow icon={<Heart className="w-5 h-5" />} label="Mis favoritos" onClick={() => go("favorites")} color={primaryColor} />}
                <MenuRow icon={<MessageCircle className="w-5 h-5" />} label="Contáctanos" onClick={() => setView("contact")} color={primaryColor} />
                <MenuRow icon={<Share2 className="w-5 h-5" />} label="Redes sociales" onClick={() => setView("social")} color={primaryColor} />
              </div>
            </>
          )}

          {view === "profile" && user && <ProfileView user={user} primaryColor={primaryColor} onUpdate={loadUser} />}
          {view === "orders" && user && <OrdersView tenant={tenant} primaryColor={primaryColor} onClose={requestClose} products={products} />}
          {view === "favorites" && user && <FavoritesView tenant={tenant} primaryColor={primaryColor} />}
          {view === "contact" && <ContactView tenant={tenant} primaryColor={primaryColor} />}
          {view === "social" && <SocialView tenant={tenant} primaryColor={primaryColor} />}
        </div>
      </div>
    </div>
  );
}

function MenuRow({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
      <span style={{ color }}>{icon}</span>
      <span className="flex-1 text-sm font-bold text-gray-800">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}

// ── Login por código (OTP), en línea ────────────────────────────
function InlineLogin({ primaryColor, onLogged }: { primaryColor: string; onLogged: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  // inputs a 16px para que iOS no haga zoom al enfocar
  const inputStyle = { fontSize: "16px" } as const;

  async function send() {
    if (!emailOk || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "No se pudo enviar"); setBusy(false); return; }
      setStep("code"); setMsg(d.devCode ? `Código (dev): ${d.devCode}` : "Te enviamos un código a tu correo.");
    } catch { setMsg("Error de conexión"); }
    setBusy(false);
  }
  async function verify() {
    if (code.trim().length !== 6 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/qr/user/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "Código incorrecto"); setBusy(false); return; }
      toast.success("¡Sesión iniciada!"); onLogged();
    } catch { setMsg("Error de conexión"); }
    setBusy(false);
  }

  return (
    <div className="px-4 pb-4 pt-1 border-t border-gray-100 flex flex-col gap-2.5">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && step === "email") send(); }}
        inputMode="email" type="email" style={inputStyle}
        placeholder="tu@email.com"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-gray-400"
      />
      {step === "email" ? (
        <button onClick={send} disabled={!emailOk || busy} className="w-full py-3 rounded-xl text-white font-black text-sm disabled:opacity-40" style={{ background: primaryColor }}>{busy ? "Enviando…" : "Enviar código"}</button>
      ) : (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
            inputMode="numeric" autoFocus style={inputStyle}
            placeholder="Código de 6 dígitos"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center tracking-[0.3em] outline-none focus:border-gray-400"
          />
          <button onClick={verify} disabled={code.length !== 6 || busy} className="w-full py-3 rounded-xl text-white font-black text-sm disabled:opacity-40" style={{ background: primaryColor }}>{busy ? "Verificando…" : "Entrar"}</button>
          <button onClick={send} disabled={busy} className="text-xs text-gray-400 self-center">Reenviar código</button>
        </>
      )}
      {msg && <p className={`text-xs ${msg.includes("incorrecto") || msg.includes("No se pudo") || msg.includes("Error") ? "text-red-500" : "text-gray-500"}`}>{msg}</p>}
    </div>
  );
}

// ── Mi perfil ───────────────────────────────────────────────────
function ProfileView({ user, primaryColor, onUpdate }: { user: QrUser; primaryColor: string; onUpdate: () => void }) {
  const [name, setName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);
  const addresses = Array.isArray(user.savedAddresses) ? user.savedAddresses : [];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/qr/user/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      if (!res.ok) { toast.error("No se pudo guardar"); setSaving(false); return; }
      toast.success("Perfil actualizado"); onUpdate();
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1"><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo</span>
          <input value={user.email} disabled className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-500" /></label>
        <button onClick={save} disabled={saving || name.trim() === (user.name || "")} className="self-start px-4 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-40" style={{ background: primaryColor }}>{saving ? "Guardando…" : "Guardar"}</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-black text-sm text-gray-900 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: primaryColor }} /> Mis direcciones</h3>
        {addresses.length === 0 ? (
          <p className="text-xs text-gray-400">Tus direcciones de entrega se guardan aquí al hacer un pedido.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {addresses.map((a, i) => (
              <p key={i} className="text-sm text-gray-700 py-2">{a.address}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mis pedidos ─────────────────────────────────────────────────
function OrdersView({ tenant, primaryColor, onClose, products }: { tenant: StoreTenant; primaryColor: string; onClose: () => void; products: StoreProduct[] }) {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    fetch(`/api/ecommerce/my-orders?restaurantId=${tenant.id}&limit=3`).then((r) => (r.ok ? r.json() : null)).then((d) => setOrders(d?.orders ?? [])).catch(() => setOrders([]));
  }, [tenant.id]);

  function reorder(o: MyOrder) {
    // "Volver a pedir" re-agrega usando SIEMPRE los precios ACTUALES de la carta
    // (no los del pedido viejo). Los productos que ya no existen o están agotados
    // se omiten (no se pueden repedir a precio actual).
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = Array.isArray(o.items) ? o.items : [];
    let added = 0, skipped = 0;
    for (const it of items) {
      const prod = it.product_id ? byId.get(it.product_id) : undefined;
      if (!prod || prod.is_sold_out) { skipped++; continue; }
      // Reconstruir las opciones con nombre/precio actuales del catálogo.
      const options: CartItemOption[] = [];
      for (const op of (it.options ?? []) as CartItemOption[]) {
        const group = prod.option_groups.find((g) => g.id === op.group_id);
        const val = group?.values.find((v) => v.id === op.value_id);
        if (group && val) options.push({ group_id: group.id, group_name: group.name, value_id: val.id, value: val.name, price_delta: val.price_delta, toteat_modifier_code: val.toteat_modifier_code });
      }
      const base = prod.price; // precio base actual
      const unit = base + options.reduce((s, op) => s + (op.price_delta ?? 0), 0);
      addItem({ product_id: prod.id, name: prod.name, unit_price: unit, base_price: base, quantity: it.quantity || 1, image_url: prod.image_url, toteat_code: prod.toteat_code, options });
      added++;
    }
    if (added) { toast.success(skipped ? `Productos agregados (${skipped} ya no disponibles)` : "Productos agregados al carrito"); onClose(); }
    else toast.error("Esos productos ya no están disponibles");
  }

  if (orders === null) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (orders.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Aún no tienes pedidos en este local.</p>;

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-gray-900 text-sm">#{o.orderNumber ?? o.id.slice(-5)}</span>
            <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: o.status === "CANCELLED" ? "#ef4444" : primaryColor }}>{STATUS_LABEL[o.status] || o.status}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{new Date(o.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {o.orderType === "DELIVERY" ? "Delivery" : "Retiro"}</p>
          <div className="mt-2 text-sm text-gray-600">
            {(Array.isArray(o.items) ? o.items : []).slice(0, 4).map((it, i) => <p key={i} className="truncate">{it.quantity}× {it.name || it.dishName}</p>)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="font-black text-gray-900">{clp(o.total)}</span>
            <button onClick={() => reorder(o)} className="inline-flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-xl text-white" style={{ background: primaryColor }}><RotateCcw className="w-4 h-4" /> Volver a pedir</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mis favoritos ───────────────────────────────────────────────
function FavoritesView({ tenant, primaryColor }: { tenant: StoreTenant; primaryColor: string }) {
  const [favs, setFavs] = useState<{ id: string; name: string; price: number; photos: string[]; restaurantId: string }[] | null>(null);

  useEffect(() => {
    fetch("/api/qr/favorites").then((r) => (r.ok ? r.json() : null)).then((d) => {
      const list = (d?.favorites ?? []).map((f: { dish: any }) => f.dish).filter((x: any) => x && x.restaurantId === tenant.id);
      setFavs(list);
    }).catch(() => setFavs([]));
  }, [tenant.id]);

  async function unfav(dishId: string) {
    await fetch(`/api/qr/favorites?dishId=${encodeURIComponent(dishId)}`, { method: "DELETE" }).catch(() => {});
    setFavs((f) => (f ? f.filter((d) => d.id !== dishId) : f));
  }

  if (favs === null) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (favs.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Aún no tienes favoritos. Toca el ♥ en un producto para guardarlo.</p>;

  return (
    <div className="flex flex-col gap-3">
      {favs.map((d) => (
        <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
          {d.photos?.[0] ? <img src={d.photos[0]} alt={d.name} className="w-14 h-14 rounded-xl object-cover shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{d.name}</p>
            <p className="text-sm font-black" style={{ color: primaryColor }}>{clp(d.price)}</p>
          </div>
          <button onClick={() => unfav(d.id)} title="Quitar de favoritos" className="shrink-0"><Heart className="w-5 h-5" fill={primaryColor} color={primaryColor} /></button>
        </div>
      ))}
    </div>
  );
}

// ── Contáctanos (incluye redes sociales) ────────────────────────
function ContactView({ tenant, primaryColor }: { tenant: StoreTenant; primaryColor: string }) {
  const wa = (tenant.whatsapp || tenant.phone || "").replace(/\D/g, "");
  const email = tenant.contactEmail;
  const ig = tenant.instagram?.trim();
  const igUrl = ig ? (ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`) : null;
  const web = tenant.website?.trim();
  const webUrl = web ? (web.startsWith("http") ? web : `https://${web}`) : null;
  const nothing = !wa && !email && !igUrl && !webUrl;
  return (
    <div className="flex flex-col gap-3">
      {wa ? (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <MessageCircle className="w-6 h-6 text-green-500 shrink-0" />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">WhatsApp</p><p className="text-xs text-gray-400">{tenant.whatsapp || tenant.phone}</p></div>
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <Mail className="w-6 h-6 shrink-0" style={{ color: primaryColor }} />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">Correo</p><p className="text-xs text-gray-400 truncate">{email}</p></div>
        </a>
      ) : null}
      {igUrl ? (
        <a href={igUrl} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <Camera className="w-6 h-6 text-pink-500 shrink-0" />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">Instagram</p><p className="text-xs text-gray-400 truncate">{ig}</p></div>
        </a>
      ) : null}
      {webUrl ? (
        <a href={webUrl} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <Globe className="w-6 h-6 shrink-0" style={{ color: primaryColor }} />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">Sitio web</p><p className="text-xs text-gray-400 truncate">{web}</p></div>
        </a>
      ) : null}
      {nothing && <p className="text-sm text-gray-400 text-center py-8">El local aún no cargó sus datos de contacto.</p>}
    </div>
  );
}

// ── Redes sociales ──────────────────────────────────────────────
function SocialView({ tenant, primaryColor }: { tenant: StoreTenant; primaryColor: string }) {
  const ig = tenant.instagram?.trim();
  const igUrl = ig ? (ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`) : null;
  const web = tenant.website?.trim();
  const webUrl = web ? (web.startsWith("http") ? web : `https://${web}`) : null;
  return (
    <div className="flex flex-col gap-3">
      {igUrl && (
        <a href={igUrl} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <Camera className="w-6 h-6 text-pink-500 shrink-0" />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">Instagram</p><p className="text-xs text-gray-400 truncate">{ig}</p></div>
        </a>
      )}
      {webUrl && (
        <a href={webUrl} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50">
          <Globe className="w-6 h-6 shrink-0" style={{ color: primaryColor }} />
          <div className="min-w-0"><p className="text-sm font-black text-gray-900">Sitio web</p><p className="text-xs text-gray-400 truncate">{web}</p></div>
        </a>
      )}
      {!igUrl && !webUrl && <p className="text-sm text-gray-400 text-center py-8">El local aún no cargó sus redes sociales.</p>}
    </div>
  );
}
