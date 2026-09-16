"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Save, Palette, CreditCard, StickyNote, ConciergeBell, Truck, UtensilsCrossed, ChevronRight, Store, Package, Bike, Bell, Heart, Globe, BarChart3, Mail, Printer, Image as ImageIcon, Upload, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseStoreConfig, type EcommerceStoreConfig } from "@/lib/ecommerce/store-config";
import HorarioEditor from "@/components/ecommerce/HorarioEditor";
import { buildPrintAgentInstaller } from "@/lib/ecommerce/printAgentScript";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

const PAY_LABELS: Record<string, { label: string; hint: string }> = {
  webpay: { label: "Webpay", hint: "Pago online con tarjeta" },
  flow: { label: "Flow", hint: "Pago online (tarjetas, transferencia)" },
  mercadopago: { label: "MercadoPago", hint: "Pago online con MercadoPago" },
  efectivo: { label: "Efectivo", hint: "Paga al recibir/retirar" },
  transferencia: { label: "Transferencia", hint: "Coordina la transferencia" },
  tarjeta: { label: "Tarjeta", hint: "Con tarjeta al recibir" },
};

export default function EcommerceConfiguracionPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<EcommerceStoreConfig>(() => parseStoreConfig(null));
  const [allMethods, setAllMethods] = useState<string[]>(["webpay", "efectivo", "transferencia", "tarjeta"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"tienda" | "pagos" | "checkout" | "pos" | "mas">("tienda");
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "denied" | "inactive" | "active">("unknown");
  const [uploadingFav, setUploadingFav] = useState(false);

  // Estado inicial de las notificaciones push (suscripción del dispositivo).
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) { setPushState("unsupported"); return; }
    navigator.serviceWorker.getRegistration("/sw-orders.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "active" : "inactive"))
      .catch(() => setPushState("inactive"));
  }, []);

  async function subscribePush() {
    if (!restaurantId) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw-orders.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushState("denied"); return; }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      await fetch("/api/panel/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, subscription: sub.toJSON() }) });
      setPushState("active");
      toast.success("Notificaciones activadas");
    } catch { setPushState("inactive"); toast.error("No se pudieron activar las notificaciones"); }
  }
  async function unsubscribePush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-orders.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/panel/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setPushState("inactive");
      toast.success("Notificaciones desactivadas");
    } catch { setPushState("inactive"); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCfg(d.config); if (d.allMethods) setAllMethods(d.allMethods); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const patch = (p: Partial<EcommerceStoreConfig>) => setCfg((c) => ({ ...c, ...p }));

  // Genera (o regenera) el token del agente de impresión y lo persiste de inmediato.
  async function generatePrintToken() {
    if (!restaurantId) return;
    const rnd = (globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
    const next = { ...cfg, printToken: rnd, printTokenAt: new Date().toISOString() };
    setCfg(next);
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: next }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo generar"); return; }
      setCfg(data.config);
      toast.success("Token generado");
    } catch { toast.error("Error de conexión"); }
  }

  // Descarga el agente PowerShell con el token y la URL ya embebidos.
  function downloadAgent() {
    if (!cfg.printToken) return;
    const base = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";
    const script = buildPrintAgentInstaller(cfg.printToken, base);
    const blob = new Blob([script], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instalar-agente-quierocomer.bat";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Solicita una impresión de prueba: el agente la imprime en su próximo sondeo (~5s).
  async function testPrint() {
    if (!restaurantId || !cfg.printToken) return;
    const next = { ...cfg, printTestAt: new Date().toISOString() };
    setCfg(next);
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: next }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo solicitar"); return; }
      setCfg(data.config);
      toast.success("Prueba enviada — sale en unos segundos si el agente está corriendo");
    } catch { toast.error("Error de conexión"); }
  }

  async function uploadFavicon(file: File) {
    setUploadingFav(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "favicons");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) { toast.error(d.error || "No se pudo subir el favicon"); setUploadingFav(false); return; }
      patch({ faviconUrl: d.url });
      toast.success("Favicon subido — recuerda Guardar");
    } catch { toast.error("Error de conexión"); }
    setUploadingFav(false);
  }
  const togglePay = (m: string) => setCfg((c) => ({ ...c, paymentMethods: c.paymentMethods.includes(m) ? c.paymentMethods.filter((x) => x !== m) : [...c.paymentMethods, m] }));

  async function save() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: cfg }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setCfg(data.config);
      toast.success("Configuración guardada");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Configuración de la tienda</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Colores de marca, métodos de pago y opciones del checkout.</p>
        </div>
      </div>

      {/* Tabs */}
      {!loading && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 18, marginBottom: 4 }}>
          <TabChip active={tab === "tienda"} onClick={() => setTab("tienda")} icon={Store} label="Tienda" />
          <TabChip active={tab === "pagos"} onClick={() => setTab("pagos")} icon={CreditCard} label="Pagos" />
          <TabChip active={tab === "checkout"} onClick={() => setTab("checkout")} icon={StickyNote} label="Checkout" />
          <TabChip active={tab === "pos"} onClick={() => setTab("pos")} icon={ConciergeBell} label="Tomar pedidos" />
          <TabChip active={tab === "mas"} onClick={() => setTab("mas")} icon={Settings} label="Más ajustes" />
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {/* Tipos de entrega */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Store} title="Tipos de entrega" sub="Elige qué formas de recibir el pedido aceptas en tu tienda online." />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Package size={18} color={ACCENT} />
                  <div>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Retiro en local</p>
                    <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>El cliente pasa a retirar el pedido.</p>
                  </div>
                </div>
                <Toggle on={cfg.pickupEnabled} onClick={() => patch({ pickupEnabled: !cfg.pickupEnabled })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Bike size={18} color={ACCENT} />
                  <div>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Delivery</p>
                    <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>Envío a domicilio según tus zonas.</p>
                  </div>
                </div>
                <Toggle on={cfg.deliveryEnabled} onClick={() => patch({ deliveryEnabled: !cfg.deliveryEnabled })} />
              </div>
              {!cfg.pickupEnabled && !cfg.deliveryEnabled && <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "#ef4444", margin: 0 }}>Debes aceptar al menos retiro o delivery.</p>}
            </div>

            {(cfg.pickupEnabled || cfg.deliveryEnabled) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Mínimo de compra</p>
                {cfg.pickupEnabled && <MinField label="Retiro" value={cfg.minOrderPickup} onChange={(n) => patch({ minOrderPickup: n })} />}
                {cfg.deliveryEnabled && <MinField label="Delivery" value={cfg.minOrderDelivery} onChange={(n) => patch({ minOrderDelivery: n })} />}
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>Deja en 0 para no exigir mínimo. En delivery, la zona puede tener su propio mínimo (se aplica el mayor).</p>
              </div>
            )}
          </section>
          )}

          {/* Dominio propio */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Globe} title="Dominio propio" sub="Conecta tu propio dominio para que tu tienda se vea en él con URLs limpias (ej: haruna.cl/checkout)." />
            <div style={{ marginTop: 12 }}>
              <input
                value={cfg.customDomain ?? ""}
                onChange={(e) => patch({ customDomain: e.target.value.trim() || null })}
                placeholder="haruna.cl"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.86rem", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>
                Escribe solo el dominio, sin “https://” ni “www” (ej: <b>haruna.cl</b>). Además debes: (1) agregar el dominio a este proyecto en Vercel y (2) en tu proveedor DNS apuntarlo a Vercel — registro <b>A</b> <code>@</code> → <code>76.76.21.21</code> y <b>CNAME</b> <code>www</code> → <code>cname.vercel-dns.com</code>. Déjalo vacío para usar el dominio de quierocomer.
              </p>
            </div>
          </section>
          )}

          {/* Google Tag Manager */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={BarChart3} title="Google Tag Manager" sub="Mide el tráfico de tu tienda online. Pega el ID de tu contenedor (formato GTM-XXXXXX)." />
            <div style={{ marginTop: 12 }}>
              <input
                value={cfg.gtmId ?? ""}
                onChange={(e) => patch({ gtmId: e.target.value.trim() ? e.target.value.trim().toUpperCase() : null })}
                placeholder="GTM-XXXXXX"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.86rem", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>
                Lo encuentras en tu cuenta de Google Tag Manager (Espacio de trabajo → arriba, junto al nombre del contenedor). El script se carga solo en tu tienda y checkout. Déjalo vacío para desactivarlo.
              </p>
            </div>
          </section>
          )}

          {/* Colores de marca */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Palette} title="Colores de marca" sub="Se aplican en tu tienda online (botones, precios, header y categorías)." />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <ColorField label="Color principal" value={cfg.primaryColor} onChange={(v) => patch({ primaryColor: v })} />
              <ColorField label="Color del header (fondo del logo)" value={cfg.headerBgColor} onChange={(v) => patch({ headerBgColor: v })} />
              <ColorField label="Color de las categorías" value={cfg.categoryColor} onChange={(v) => patch({ categoryColor: v })} />
            </div>
            {/* Preview */}
            <div style={{ marginTop: 14, borderRadius: 12, overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
              <div style={{ background: cfg.headerBgColor, padding: "10px 14px", fontFamily: F, fontWeight: 900, color: "#111" }}>Tu Local</div>
              <div style={{ padding: "12px 14px", background: "#f7f7f8" }}>
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: cfg.categoryColor, margin: "0 0 6px" }}>Aperitivos</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 10, padding: "8px 10px", border: "1px solid #eee" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "#111", fontWeight: 700 }}>Gyozas</span>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", fontWeight: 900, color: cfg.primaryColor }}>$5.900</span>
                </div>
                <button style={{ marginTop: 8, width: "100%", padding: "8px", borderRadius: 10, border: "none", background: cfg.primaryColor, color: "#fff", fontFamily: F, fontWeight: 800, fontSize: "0.8rem" }}>Continuar con mi pedido →</button>
              </div>
            </div>
          </section>
          )}

          {/* Tema de la tienda */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Palette} title="Tema de la tienda" sub="El diseño con el que se ve tu tienda online." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <ThemeOption
                active={(cfg.theme ?? "base") === "base"}
                onClick={() => patch({ theme: "base" })}
                title="Base"
                desc="Claro y limpio."
                swatch={<div style={{ display: "flex", height: "100%" }}><div style={{ flex: 1, background: "#f7f7f8" }} /><div style={{ width: 26, background: cfg.primaryColor }} /></div>}
                accent={cfg.primaryColor}
              />
              <ThemeOption
                active={cfg.theme === "impact"}
                onClick={() => patch({ theme: "impact" })}
                title="Impact"
                desc="Oscuro, con fotos y acento de marca."
                swatch={<div style={{ display: "flex", height: "100%", background: "#111" }}><div style={{ flex: 1 }} /><div style={{ width: 26, background: cfg.primaryColor }} /></div>}
                accent={cfg.primaryColor}
              />
            </div>
          </section>
          )}

          {/* Notificaciones de pedidos (dentro de Tienda) */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Bell} title="Notificaciones de pedidos" sub="Recibe un aviso en este dispositivo cuando llegue un pedido nuevo." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: pushState === "denied" ? "#ef4444" : "var(--adm-text2)" }}>
                {pushState === "active" ? "🔔 Activas en este dispositivo" : pushState === "denied" ? "🔕 Bloqueadas en el navegador" : pushState === "unsupported" ? "No compatible en este navegador" : "Desactivadas"}
              </span>
              {pushState !== "unsupported" && (
                <button
                  onClick={pushState === "active" ? unsubscribePush : subscribePush}
                  disabled={pushState === "denied"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1px solid ${pushState === "active" ? "#22c55e" : "var(--adm-card-border)"}`, background: pushState === "active" ? "rgba(34,197,94,0.12)" : ACCENT, color: pushState === "active" ? "#22c55e" : "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, cursor: pushState === "denied" ? "not-allowed" : "pointer", opacity: pushState === "denied" ? 0.5 : 1, flexShrink: 0 }}
                >
                  <Bell size={15} /> {pushState === "active" ? "Desactivar" : "Activar notificaciones"}
                </button>
              )}
            </div>
            {pushState === "denied" && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>Habilita las notificaciones para este sitio en la configuración del navegador y vuelve a intentar.</p>}
          </section>
          )}

          {/* Aviso de pedidos por correo (dentro de Tienda) */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Mail} title="Aviso de pedidos por correo" sub="Te enviamos un correo con los datos de cada pedido nuevo (cliente, monto, medio de pago, entrega)." />
            <div style={{ marginTop: 12 }}>
              <input
                value={cfg.orderNotifyEmail ?? ""}
                onChange={(e) => patch({ orderNotifyEmail: e.target.value.trim() || null })}
                placeholder="pedidos@tulocal.cl"
                inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>Déjalo vacío para no recibir correos. Es independiente de las notificaciones push de arriba.</p>
            </div>
          </section>
          )}

          {/* Favicon */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={ImageIcon} title="Favicon" sub="El ícono que se ve en la pestaña del navegador, en tu tienda y en la web de seguimiento del pedido. Si no subes uno, se usa tu logo. Ideal: imagen cuadrada (PNG)." />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {cfg.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cfg.faviconUrl} alt="Favicon" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <ImageIcon size={22} color="var(--adm-text3)" />
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: uploadingFav ? "wait" : "pointer" }}>
                  <Upload size={15} /> {uploadingFav ? "Subiendo…" : cfg.faviconUrl ? "Cambiar" : "Subir favicon"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} disabled={uploadingFav}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFavicon(f); e.currentTarget.value = ""; }} />
                </label>
                {cfg.faviconUrl && (
                  <button onClick={() => patch({ faviconUrl: null })} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    <XIcon size={15} /> Quitar
                  </button>
                )}
              </div>
            </div>
          </section>
          )}

          {/* Impresión de comandas */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Printer} title="Impresión de comandas" sub="Imprime un ticket con cada pedido en tu impresora térmica. La automática requiere abrir Chrome con la opción de kiosco en el equipo del local." />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 }}>Modo de impresión</span>
                <select
                  value={cfg.printMode}
                  onChange={(e) => patch({ printMode: e.target.value as "off" | "manual" | "auto" })}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box" }}
                >
                  <option value="off">Desactivada</option>
                  <option value="manual">Manual (botón en cada pedido)</option>
                  <option value="auto">Automática (imprime al llegar el pedido)</option>
                </select>
              </label>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 }}>Ancho del papel</span>
                <select
                  value={cfg.printPaperWidth}
                  onChange={(e) => patch({ printPaperWidth: Number(e.target.value) === 58 ? 58 : 80 })}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box" }}
                >
                  <option value={80}>80 mm (estándar)</option>
                  <option value={58}>58 mm (chica)</option>
                </select>
              </label>
              {cfg.printMode === "auto" && (
                <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Impresión automática — 2 opciones</p>
                  <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
                    <strong>A) Sin instalar nada:</strong> abre esta misma pantalla de <strong>Pedidos</strong> en el equipo del local con Chrome en modo kiosco (<code>--kiosk-printing</code>) y déjala abierta.
                  </p>
                  <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
                    <strong>B) Agente local (sin navegador, ESC/POS, corte automático):</strong> genera el token, descarga el agente y déjalo corriendo en la PC Windows con la impresora.
                  </p>

                  {cfg.printToken ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "8px 10px" }}>
                        <code style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: "0.72rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.printToken}</code>
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(cfg.printToken || "").then(() => toast.success("Token copiado")).catch(() => {}); }} style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Copiar</button>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={downloadAgent} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                          <Printer size={15} /> Descargar instalador (Windows)
                        </button>
                        <button type="button" onClick={testPrint} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>Imprimir de prueba</button>
                        <button type="button" onClick={generatePrintToken} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>Regenerar token</button>
                      </div>
                      <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.55 }}>
                        Guarda <code>instalar-agente-quierocomer.bat</code> en la PC Windows y <strong>haz doble clic</strong> (si aparece un aviso de Windows: <em>Más información → Ejecutar de todas formas</em>). El instalador crea el agente, lo deja corriendo <strong>junto al reloj</strong> (en la bandeja, junto a la hora) y hace que <strong>arranque solo con Windows</strong> — ya no queda ninguna ventana negra abierta. Cuando termine puedes cerrar la ventana del instalador. Para probar la impresora: clic derecho en el ícono de la bandeja → <em>Imprimir prueba local</em>. Para quitarlo o pausarlo: clic derecho → <em>Salir</em>. Regenera el token si crees que se filtró (invalida el anterior).
                      </p>
                    </>
                  ) : (
                    <button type="button" onClick={generatePrintToken} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                      Generar token del agente
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
          )}

          {/* Horario (dentro de Tienda) */}
          {tab === "tienda" && (
          <section style={card}>
            <HorarioEditor restaurantId={restaurantId} showHeader />
          </section>
          )}

          {/* Menú del cliente */}
          {tab === "tienda" && (
          <section style={card}>
            <SectionTitle icon={Heart} title="Menú del cliente" sub="Opciones que ve el cliente en el menú de la tienda." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Favoritos</p>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>Permite al cliente marcar productos con ♥ y verlos en “Mis favoritos”.</p>
              </div>
              <Toggle on={cfg.favoritesEnabled} onClick={() => patch({ favoritesEnabled: !cfg.favoritesEnabled })} />
            </div>
          </section>
          )}

          {/* Métodos de pago */}
          {tab === "pagos" && (
          <section style={card}>
            <SectionTitle icon={CreditCard} title="Métodos de pago" sub="Elige qué medios de pago ve el cliente en el checkout." />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {allMethods.map((m) => {
                const meta = PAY_LABELS[m] || { label: m, hint: "" };
                const on = cfg.paymentMethods.includes(m);
                return (
                  <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{meta.label}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>{meta.hint}</p>
                    </div>
                    <Toggle on={on} onClick={() => togglePay(m)} />
                  </div>
                );
              })}
              {cfg.paymentMethods.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "#ef4444", margin: 0 }}>Debes dejar al menos un método de pago activo.</p>}
            </div>
          </section>
          )}

          {/* Notas */}
          {tab === "checkout" && (
          <section style={card}>
            <SectionTitle icon={StickyNote} title="Notas del cliente" sub="Campo opcional en el checkout para instrucciones (ej: sin cebolla)." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Recibir notas del cliente</span>
              <Toggle on={cfg.notesEnabled} onClick={() => patch({ notesEnabled: !cfg.notesEnabled })} />
            </div>
          </section>
          )}

          {/* Tomar pedidos */}
          {tab === "pos" && (
          <section style={card}>
            <SectionTitle icon={ConciergeBell} title="Tomar pedidos" sub="Ajustes de la pantalla de mostrador (Tomar pedidos)." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Mostrar descripción de los productos</span>
              <Toggle on={cfg.posShowDescriptions} onClick={() => patch({ posShowDescriptions: !cfg.posShowDescriptions })} />
            </div>
          </section>
          )}

          {/* Más ajustes de la tienda (páginas propias) */}
          {tab === "mas" && (
          <section style={card}>
            <SectionTitle icon={Settings} title="Más ajustes de la tienda" sub="Zonas de delivery y acompañamientos." />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <NavRow href="/panel/ecommerce/delivery" icon={Truck} title="Delivery" desc="Zonas de reparto y despacho" />
              <NavRow href="/panel/ecommerce/acompanamientos" icon={UtensilsCrossed} title="Acompañamientos" desc="Palitos, salsas y extras del checkout" />
            </div>
          </section>
          )}

          {tab !== "mas" && (
          <button onClick={save} disabled={saving || cfg.paymentMethods.length === 0 || (!cfg.pickupEnabled && !cfg.deliveryEnabled)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 20px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving || cfg.paymentMethods.length === 0 || (!cfg.pickupEnabled && !cfg.deliveryEnabled) ? 0.5 : 1 }}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar configuración"}
          </button>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={18} color={ACCENT} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{title}</h2>
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0", lineHeight: 1.4 }}>{sub}</p>
      </div>
    </div>
  );
}

function MinField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text2)", width: 74, flexShrink: 0 }}>{label}</span>
      <div style={{ position: "relative", flex: 1 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)" }}>$</span>
        <input type="number" min={0} step={100} value={value || ""} placeholder="0"
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          style={{ width: "100%", padding: "8px 10px 8px 20px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function TabChip({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, border: `1px solid ${active ? ACCENT : "var(--adm-card-border)"}`, background: active ? `${ACCENT}1a` : "transparent", color: active ? ACCENT : "var(--adm-text2)" }}>
      <Icon size={15} /> {label}
    </button>
  );
}

function NavRow({ href, icon: Icon, title, desc }: { href: string; icon: any; title: string; desc: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", textDecoration: "none" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--adm-card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={ACCENT} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>{title}</div>
        <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{desc}</div>
      </div>
      <ChevronRight size={18} color="var(--adm-text3)" />
    </Link>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 42, height: 38, borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", cursor: "pointer", padding: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <label style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>{label}</label>
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.82rem", outline: "none" }} />
      </div>
    </div>
  );
}

function ThemeOption({ active, onClick, title, desc, swatch, accent }: { active: boolean; onClick: () => void; title: string; desc: string; swatch: React.ReactNode; accent: string }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, background: "var(--adm-card)", border: `2px solid ${active ? accent : "var(--adm-card-border)"}` }}>
      <div style={{ height: 64 }}>{swatch}</div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: "var(--adm-text)" }}>{title}</span>
          {active && <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#fff", background: accent, borderRadius: 999, padding: "1px 7px" }}>Activo</span>}
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{desc}</p>
      </div>
    </button>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: on ? "#22c55e" : "var(--adm-toggle-off, #ccc)", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
