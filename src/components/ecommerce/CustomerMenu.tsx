"use client";
import { useEffect, useState, useCallback } from "react";
import { X, ChevronRight, ArrowLeft, User, ClipboardList, Heart, MessageCircle, Share2, MapPin, LogOut, Camera, Globe, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { StoreTenant } from "@/lib/ecommerce/storefront-data";
import { useCartStore, type CartItemOption } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";

interface QrUser { id: string; name: string | null; email: string; savedAddresses?: { address: string; lat?: number | null; lng?: number | null }[] | null }
interface OrderItemStored { name?: string; dishName?: string; product_id?: string; unit_price?: number; unitTotal?: number; quantity: number; toteat_code?: string | null; options?: CartItemOption[] }
interface MyOrder { id: string; orderNumber: number | null; total: number; status: string; orderType: string; createdAt: string; paymentMethod: string; paymentStatus: string; items: OrderItemStored[] }

const STATUS_LABEL: Record<string, string> = { PENDING: "Nuevo", ACCEPTED: "Aceptado", PREPARING: "Preparando", IN_DELIVERY: "En reparto", READY: "Listo", DONE: "Entregado", CANCELLED: "Cancelado" };

type View = "root" | "profile" | "orders" | "favorites" | "contact" | "social";

export default function CustomerMenu({ tenant, primaryColor, onClose }: { tenant: StoreTenant; primaryColor: string; onClose: () => void }) {
  const [view, setView] = useState<View>("root");
  const [user, setUser] = useState<QrUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

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
  const go = (v: View) => { if (needsLogin(v)) { setLoginOpen(true); return; } setView(v); };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-50 w-full max-w-sm h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-14 bg-white border-b border-gray-100 shrink-0">
          {view !== "root" ? (
            <button onClick={() => setView("root")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"><ArrowLeft className="w-5 h-5" /></button>
          ) : <div className="w-9" />}
          <h2 className="flex-1 text-center font-black text-gray-900">
            {view === "root" ? "Menú" : view === "profile" ? "Mi perfil" : view === "orders" ? "Mis pedidos" : view === "favorites" ? "Mis favoritos" : view === "contact" ? "Contáctanos" : "Redes sociales"}
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {view === "root" && (
            <>
              {/* Usuario / login */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: primaryColor }}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  {loadingUser ? (
                    <p className="text-sm text-gray-400">Cargando…</p>
                  ) : user ? (
                    <>
                      <p className="text-sm font-black text-gray-900 truncate">{user.name || "Cliente"}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </>
                  ) : (
                    <button onClick={() => setLoginOpen(true)} className="text-sm font-black" style={{ color: primaryColor }}>Iniciar sesión →</button>
                  )}
                </div>
                {user && <button onClick={logout} title="Cerrar sesión" className="text-gray-400 hover:text-red-500 shrink-0"><LogOut className="w-4 h-4" /></button>}
              </div>

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
          {view === "orders" && user && <OrdersView tenant={tenant} primaryColor={primaryColor} onClose={onClose} />}
          {view === "favorites" && user && <FavoritesView tenant={tenant} primaryColor={primaryColor} />}
          {view === "contact" && <ContactView tenant={tenant} primaryColor={primaryColor} />}
          {view === "social" && <SocialView tenant={tenant} primaryColor={primaryColor} />}
        </div>
      </div>

      {loginOpen && <LoginModal primaryColor={primaryColor} onClose={() => setLoginOpen(false)} onLogged={() => { setLoginOpen(false); loadUser(); }} />}
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

// ── Login por código (OTP) ──────────────────────────────────────
function LoginModal({ primaryColor, onClose, onLogged }: { primaryColor: string; onClose: () => void; onLogged: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());

  async function send() {
    if (!emailOk || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), name: name.trim() || null }) });
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400"><X className="w-5 h-5" /></button>
        <h3 className="font-black text-lg text-gray-900 mb-1">{step === "email" ? "Iniciar sesión" : "Ingresa tu código"}</h3>
        <p className="text-xs text-gray-400 mb-4">{step === "email" ? "Con tu correo. Te enviamos un código para entrar." : `Enviado a ${email}`}</p>
        {step === "email" ? (
          <div className="flex flex-col gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="tu@email.com" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            <button onClick={send} disabled={!emailOk || busy} className="w-full py-3 rounded-xl text-white font-black text-sm disabled:opacity-40" style={{ background: primaryColor }}>{busy ? "Enviando…" : "Enviar código"}</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-gray-400" />
            <button onClick={verify} disabled={code.length !== 6 || busy} className="w-full py-3 rounded-xl text-white font-black text-sm disabled:opacity-40" style={{ background: primaryColor }}>{busy ? "Verificando…" : "Entrar"}</button>
            <button onClick={send} disabled={busy} className="text-xs text-gray-400 self-center">Reenviar código</button>
          </div>
        )}
        {msg && <p className={`text-xs mt-3 ${msg.includes("incorrecto") || msg.includes("No se pudo") || msg.includes("Error") ? "text-red-500" : "text-gray-500"}`}>{msg}</p>}
      </div>
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
function OrdersView({ tenant, primaryColor, onClose }: { tenant: StoreTenant; primaryColor: string; onClose: () => void }) {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    fetch(`/api/ecommerce/my-orders?restaurantId=${tenant.id}&limit=3`).then((r) => (r.ok ? r.json() : null)).then((d) => setOrders(d?.orders ?? [])).catch(() => setOrders([]));
  }, [tenant.id]);

  function reorder(o: MyOrder) {
    const items = Array.isArray(o.items) ? o.items : [];
    let added = 0;
    for (const it of items) {
      const options = (it.options ?? []) as CartItemOption[];
      const unit = it.unit_price ?? it.unitTotal ?? 0;
      const base = unit - options.reduce((s, op) => s + (op.price_delta ?? 0), 0);
      if (!it.product_id) continue;
      addItem({ product_id: it.product_id, name: it.name || it.dishName || "Producto", unit_price: unit, base_price: base, quantity: it.quantity || 1, image_url: null, toteat_code: it.toteat_code ?? null, options });
      added++;
    }
    if (added) { toast.success("Productos agregados al carrito"); onClose(); }
    else toast.error("No se pudieron re-agregar los productos");
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

// ── Contáctanos ─────────────────────────────────────────────────
function ContactView({ tenant, primaryColor }: { tenant: StoreTenant; primaryColor: string }) {
  const wa = (tenant.whatsapp || tenant.phone || "").replace(/\D/g, "");
  const email = tenant.contactEmail;
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
      {!wa && !email && <p className="text-sm text-gray-400 text-center py-8">El local aún no cargó sus datos de contacto.</p>}
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
