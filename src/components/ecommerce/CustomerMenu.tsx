"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronDown, ArrowLeft, User, ClipboardList, Heart, MessageCircle, MapPin, LogOut, Camera, Globe, Mail, RotateCcw, QrCode, Download } from "lucide-react";
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

export default function CustomerMenu({ tenant, primaryColor, onClose, side = "right", products = [], initialView = "root", variant = "drawer", initialLoginExpanded = false }: { tenant: StoreTenant; primaryColor: string; onClose: () => void; side?: "left" | "right"; products?: StoreProduct[]; initialView?: CustomerMenuView; variant?: "drawer" | "sheet" | "modern"; initialLoginExpanded?: boolean }) {
  const [view, setView] = useState<View>(initialView);
  // Enlaces de descarga de la app: solo en la WEB (dentro de la app no tiene sentido).
  const [showAppLinks, setShowAppLinks] = useState(false);
  useEffect(() => { try { if (!(window as any).Capacitor?.isNativePlatform?.()) setShowAppLinks(true); } catch { /* noop */ } }, []);
  const sheet = variant === "sheet" || variant === "modern";
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

  // ── Arrastrar hacia abajo para cerrar (el panel sigue al dedo) ────────
  // El arrastre vive en un wrapper, aparte de las animaciones CSS del panel, para
  // no re-dispararlas. Solo se arma si el contenido está arriba del todo
  // (scrollTop <= 0) y el gesto es claramente vertical hacia abajo.
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; active: boolean; moved: boolean }>({ startX: 0, startY: 0, active: false, moved: false });
  const [dragY, setDragY] = useState(0);
  const [snapTransition, setSnapTransition] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
    const t = e.touches[0];
    drag.current = { startX: t.clientX, startY: t.clientY, active: atTop, moved: false };
    setSnapTransition(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current.active) return;
    const t = e.touches[0];
    const dy = t.clientY - drag.current.startY;
    const dx = Math.abs(t.clientX - drag.current.startX);
    if (!drag.current.moved) {
      if (dy > 6 && dy > dx) drag.current.moved = true;       // arrastre vertical hacia abajo
      else if (dx > 8 || dy < -6) { drag.current.active = false; return; } // horizontal / hacia arriba → cancelar
      else return;
    }
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (!drag.current.active || !drag.current.moved) { drag.current.active = false; return; }
    drag.current.active = false;
    const h = panelRef.current?.offsetHeight ?? 600;
    setSnapTransition(true);
    if (dragY > Math.min(130, h * 0.22)) {
      setDragY(h);                              // desliza fuera y cierra
      window.setTimeout(onClose, 240);
    } else {
      setDragY(0);                              // no alcanzó el umbral: vuelve
      window.setTimeout(() => setSnapTransition(false), 240);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${sheet ? "justify-center items-end sm:items-center" : side === "left" ? "justify-start" : "justify-end"}`}>
      {/* Overlay oscuro SIN backdrop-blur: animar la opacidad de un overlay con
          blur(18px) saturaba la GPU y trababa la animación de cierre del drawer en
          escritorio. Un overlay sólido se desvanece de forma fluida. */}
      <div className={`absolute inset-0 ${closing ? "qc-fade-out" : "qc-fade-in"}`} onClick={requestClose} style={{ background: variant === "modern" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.5)" }} />
      <div
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={sheet
          ? "relative w-full max-w-md h-[75vh] sm:h-[80vh] sm:max-h-[640px]"
          : "relative w-[85%] max-w-sm h-full"}
        style={{ transform: dragY > 0 || snapTransition ? `translateY(${dragY}px)` : undefined, transition: snapTransition ? "transform .24s cubic-bezier(.4,0,.2,1)" : "none", willChange: "transform" }}>
      <div className={`${sheet
        ? `${variant === "modern" ? "bg-white" : "bg-gray-50"} w-full h-full ${variant === "modern" ? "rounded-t-2xl sm:rounded-2xl" : "rounded-t-3xl sm:rounded-3xl"} shadow-2xl flex flex-col overflow-hidden`
        : "bg-gray-50 w-full h-full shadow-2xl flex flex-col"} ${panelAnim}`}
        style={{ willChange: "transform" }}>
        {sheet && variant !== "modern" && <div className="pt-2.5 pb-1 flex justify-center shrink-0 bg-white"><span className="w-10 h-1.5 rounded-full bg-gray-300" /></div>}
        {/* Header */}
        <div className={`flex items-center gap-2 px-4 ${variant === "modern" ? "h-16 px-5" : "h-14"} bg-white border-b border-gray-100 shrink-0`}>
          {view !== "root" ? (
            <button onClick={() => setView("root")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"><ArrowLeft className="w-5 h-5" /></button>
          ) : <div className="w-9" />}
          <h2 className={`flex-1 text-center ${variant === "modern" ? "font-bold" : "font-black"} text-gray-900`}>
            {view === "root" ? (variant === "modern" ? "Mi cuenta" : "Menú") : view === "profile" ? "Mi perfil" : view === "orders" ? "Mis pedidos" : view === "favorites" ? "Mis favoritos" : view === "contact" ? "Contáctanos" : "Redes sociales"}
          </h2>
          <button onClick={requestClose} className={`w-9 h-9 flex items-center justify-center rounded-full transition active:scale-90 ${variant === "modern" ? "border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300" : "qc-glass-x text-gray-500 hover:bg-gray-50"}`}><X className={variant === "modern" ? "w-4 h-4" : "w-5 h-5"} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
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
                      <InlineLogin primaryColor={primaryColor} tenant={tenant} onLogged={() => { setLoginExpanded(false); loadUser(); }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                <MenuRow icon={<User className="w-5 h-5" />} label="Mi perfil" onClick={() => go("profile")} color={primaryColor} />
                <MenuRow icon={<ClipboardList className="w-5 h-5" />} label="Mis pedidos" onClick={() => go("orders")} color={primaryColor} />
                {tenant.favoritesEnabled && user && <MenuRow icon={<Heart className="w-5 h-5" />} label="Mis favoritos" onClick={() => go("favorites")} color={primaryColor} />}
              </div>

              {/* Redes sociales y contacto */}
              {(tenant.instagram || tenant.website || tenant.whatsapp || tenant.phone) && (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {tenant.instagram && (() => {
                    const ig = tenant.instagram.trim();
                    const igUrl = ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`;
                    const igHandle = ig.startsWith("http") ? ig.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/.*/, "") : (ig.startsWith("@") ? ig : `@${ig}`);
                    return (
                      <a href={igUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                        <span style={{ color: "#E1306C" }}>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        </span>
                        <span className="flex-1 text-sm font-bold text-gray-800">{igHandle}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </a>
                    );
                  })()}
                  {tenant.website && (
                    <a href={tenant.website.startsWith("http") ? tenant.website : `https://${tenant.website}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                      <span style={{ color: primaryColor }}><Globe className="w-5 h-5" /></span>
                      <span className="flex-1 text-sm font-bold text-gray-800">Sitio web</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </a>
                  )}
                  {tenant.whatsapp && (
                    <a href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                      <span style={{ color: "#25D366" }}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </span>
                      <span className="flex-1 text-sm font-bold text-gray-800">{tenant.whatsapp}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </a>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                {tenant.showTableMenu && (
                  <a href={`https://quierocomer.com/qr/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                    <span style={{ color: primaryColor }}><QrCode className="w-5 h-5" /></span>
                    <span className="flex-1 text-sm font-bold text-gray-800">Carta mesa</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </a>
                )}
                {showAppLinks && tenant.appAndroidUrl && (
                  <a href={tenant.appAndroidUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                    <span style={{ color: primaryColor }}><Download className="w-5 h-5" /></span>
                    <span className="flex-1 text-sm font-bold text-gray-800">Descargar app para Android</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </a>
                )}
                {showAppLinks && tenant.appIosUrl && (
                  <a href={tenant.appIosUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                    <span style={{ color: primaryColor }}><Download className="w-5 h-5" /></span>
                    <span className="flex-1 text-sm font-bold text-gray-800">Descargar app para iPhone</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </a>
                )}
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
function InlineLogin({ primaryColor, tenant, onLogged }: { primaryColor: string; tenant: StoreTenant; onLogged: () => void }) {
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
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), storeName: tenant.name, logoUrl: tenant.logoUrl ?? null, primaryColor }) });
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
    fetch(`/api/ecommerce/my-orders?restaurantId=${tenant.id}&limit=50`).then((r) => (r.ok ? r.json() : null)).then((d) => setOrders(d?.orders ?? [])).catch(() => setOrders([]));
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
        <div
          key={o.id}
          role="button"
          tabIndex={0}
          onClick={() => { window.location.href = `/pedido/${o.id}`; }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `/pedido/${o.id}`; } }}
          className="bg-white rounded-2xl border border-gray-100 p-4 text-left w-full cursor-pointer hover:border-gray-200 hover:shadow-sm transition active:scale-[0.99]"
        >
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
            <button onClick={(e) => { e.stopPropagation(); reorder(o); }} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white whitespace-nowrap" style={{ background: primaryColor }}><RotateCcw className="w-3.5 h-3.5" /> Volver a pedir</button>
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
  if (favs.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Aún no tienes favoritos. Toca el <Heart size={14} className="inline align-middle" /> en un producto para guardarlo.</p>;

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
