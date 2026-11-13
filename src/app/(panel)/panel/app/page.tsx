"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, Bell, Users, ShoppingBag, Sparkles, Send, Target, Trophy, Download } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const BRAND = "#6366f1";
const clp = (n: number) => "$" + (Math.round(n) || 0).toLocaleString("es-CL");
const toName = (s: string) => (s || "").trim().replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) || "—";
const STATUS_ES: Record<string, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", PREPARING: "Preparando", READY: "Listo", OUT_FOR_DELIVERY: "En camino", DELIVERED: "Entregado", DONE: "Completado", COMPLETED: "Completado" };
const statusLabel = (s: string) => STATUS_ES[s] || s;
function statusColor(s: string): { bg: string; fg: string } {
  if (["DONE", "COMPLETED", "DELIVERED"].includes(s)) return { bg: "rgba(22,163,74,0.14)", fg: "#16a34a" };
  if (["PENDING", "PREPARING", "CONFIRMED"].includes(s)) return { bg: "rgba(245,158,11,0.16)", fg: "#b45309" };
  return { bg: "var(--adm-hover)", fg: "var(--adm-text2)" };
}

interface Stats {
  days: number;
  devices: { total: number; ios: number; android: number; optedIn: number; new: number; active: number };
  orders: { app: number; appRevenue: number; appAov: number; web: number; webRevenue: number; webAov: number; total: number; appSharePct: number; series: { date: string; app: number; web: number }[] };
  conversion: { buyers: number; devices: number; pct: number };
  topProducts: { name: string; qty: number; revenue: number }[];
  appOrdersList: { id: string; customer: string; phone: string; total: number; status: string; orderType: string; createdAt: string }[];
  exclusiveProducts: number;
  notifications: { title: string; sent: number; total: number; createdAt: string }[];
}

export default function AppResumenPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId || "";
  const [days, setDays] = useState(30);
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  // Enlaces de descarga de la app (se guardan en la config de la tienda).
  const [android, setAndroid] = useState("");
  const [ios, setIos] = useState("");
  const [linksSaving, setLinksSaving] = useState(false);
  const [linksMsg, setLinksMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/app/links?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setAndroid(d.appAndroidUrl || ""); setIos(d.appIosUrl || ""); } })
      .catch(() => {});
  }, [restaurantId]);

  async function saveLinks() {
    setLinksSaving(true); setLinksMsg(null);
    try {
      const r = await fetch(`/api/panel/app/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, appAndroidUrl: android.trim(), appIosUrl: ios.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setLinksMsg(d.error || "No se pudo guardar"); return; }
      setAndroid(d.appAndroidUrl || ""); setIos(d.appIosUrl || "");
      setLinksMsg("✓ Enlaces guardados");
    } catch { setLinksMsg("Error de conexión"); }
    finally { setLinksSaving(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/app/stats?restaurantId=${restaurantId}&days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setS(d))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
  }, [restaurantId, days]);

  const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 16 };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Smartphone size={20} color={BRAND} /></div>
          <div>
            <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>APP · Resumen</h1>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Métricas de tu aplicación móvil.</p>
          </div>
        </div>
        <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={{ padding: "7px 13px", border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, background: days === d ? BRAND : "transparent", color: days === d ? "#fff" : "var(--adm-text2)" }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Enlaces de descarga de la app (se usan en el menú del ecommerce) */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Download size={17} color={BRAND} />
          <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>Enlaces de descarga de la app</span>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>Pega aquí los enlaces de tu app. Aparecerán en el menú del ecommerce como “Descargar app para Android / iPhone”.</p>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 }}>Google Play (Android)</label>
            <input value={android} onChange={(e) => setAndroid(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem" }} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 }}>App Store (iPhone)</label>
            <input value={ios} onChange={(e) => setIos(e.target.value)} placeholder="https://apps.apple.com/cl/app/..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveLinks} disabled={linksSaving} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: linksSaving ? "default" : "pointer", opacity: linksSaving ? 0.6 : 1 }}>{linksSaving ? "Guardando…" : "Guardar enlaces"}</button>
            {linksMsg && <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: linksMsg.startsWith("✓") ? "#16a34a" : "#ef4444" }}>{linksMsg}</span>}
          </div>
        </div>
      </div>

      {loading && !s ? (
        <div style={{ ...card, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB }}>Cargando métricas…</div>
      ) : !s ? (
        <div style={{ ...card, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB }}>No se pudieron cargar las métricas.</div>
      ) : (
        <>
          {/* Dispositivos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Tile icon={<Smartphone size={16} />} label="Dispositivos" value={s.devices.total} sub={`${s.devices.ios} iOS · ${s.devices.android} Android`} />
            <Tile icon={<Bell size={16} />} label="Suscritos (opt-in)" value={s.devices.optedIn} sub="pueden recibir push" />
            <Tile icon={<Users size={16} />} label={`Nuevos (${days}d)`} value={s.devices.new} sub="dispositivos nuevos" />
            <Tile icon={<Users size={16} />} label={`Activos (${days}d)`} value={s.devices.active} sub="abrieron la app" />
          </div>

          {/* Pedidos app vs web */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Tile icon={<ShoppingBag size={16} />} label={`Pedidos app (${days}d)`} value={s.orders.app} sub={`${s.orders.appSharePct}% del total`} accent />
            <Tile icon={<ShoppingBag size={16} />} label="Ingresos app" value={clp(s.orders.appRevenue)} sub="ventas desde la app" accent />
            <Tile icon={<ShoppingBag size={16} />} label="Ticket prom. app" value={clp(s.orders.appAov)} sub={`web: ${clp(s.orders.webAov)}`} />
            <Tile icon={<Target size={16} />} label="Conversión" value={`${s.conversion.pct}%`} sub={`${s.conversion.buyers} compradores · ${s.conversion.devices} disp.`} />
            <Tile icon={<Sparkles size={16} />} label="Productos exclusivos" value={s.exclusiveProducts} sub="solo-app o precio app" />
          </div>

          {/* Gráfico app vs web por día */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>Pedidos por día</span>
              <span style={{ display: "inline-flex", gap: 14, fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)" }}>
                <Legend color={BRAND} label="App" /><Legend color="#cbd5e1" label="Web" />
              </span>
            </div>
            <OrdersChart series={s.orders.series} />
          </div>

          {/* Top productos pedidos desde la app */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Trophy size={17} color={BRAND} />
              <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>Top productos pedidos desde la app</span>
            </div>
            {s.topProducts.length === 0 ? (
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Aún no hay pedidos desde la app en este período.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {(() => { const maxQty = Math.max(1, ...s.topProducts.map((p) => p.qty)); return s.topProducts.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: i === 0 ? BRAND : "var(--adm-hover)", color: i === 0 ? "#fff" : "var(--adm-text2)", fontFamily: F, fontSize: "0.74rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 600, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text2)", flexShrink: 0 }}>{p.qty} u · {clp(p.revenue)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "var(--adm-hover)", overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((p.qty / maxQty) * 100)}%`, height: "100%", background: BRAND, borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>
                )); })()}
              </div>
            )}
          </div>

          {/* Pedidos hechos desde la app */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>Pedidos desde la app</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)" }}>{s.appOrdersList.length}{s.appOrdersList.length >= 50 ? "+" : ""} en {days}d</span>
            </div>
            {s.appOrdersList.length === 0 ? (
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Aún no hay pedidos desde la app en este período.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {s.appOrdersList.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, background: "var(--adm-hover)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toName(o.customer)}</div>
                      <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                        {new Date(o.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {o.orderType === "DELIVERY" ? "Delivery" : "Retiro"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 800, color: "var(--adm-text)" }}>{clp(o.total)}</span>
                      <span style={{ fontFamily: F, fontSize: "0.64rem", fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: statusColor(o.status).bg, color: statusColor(o.status).fg }}>{statusLabel(o.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notificaciones recientes */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>Últimas notificaciones</span>
              <Link href="/panel/app/notificaciones" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "7px 12px", borderRadius: 9, background: BRAND, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 700 }}><Send size={14} /> Enviar</Link>
            </div>
            {s.notifications.length === 0 ? (
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Aún no has enviado notificaciones.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {s.notifications.map((n, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, background: "var(--adm-hover)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                      <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{new Date(n.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text2)", flexShrink: 0 }}>{n.sent}/{n.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "rgba(99,102,241,0.07)" : "var(--adm-card)", border: `1px solid ${accent ? "rgba(99,102,241,0.3)" : "var(--adm-card-border)"}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: accent ? BRAND : "var(--adm-text3)", marginBottom: 6 }}>{icon}<span style={{ fontFamily: FB, fontSize: "0.74rem", fontWeight: 600 }}>{label}</span></div>
      <div style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, color: "var(--adm-text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />{label}</span>;
}

function OrdersChart({ series }: { series: { date: string; app: number; web: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.app + d.web));
  const n = series.length;
  const gap = n > 45 ? 1 : 2;
  const dm = (ymd: string) => { const [, m, d] = ymd.split("-"); return `${Number(d)}/${Number(m)}`; };
  // ~5 fechas repartidas (primera, cuartos, última) para no amontonar.
  const idxs = n <= 1 ? [0] : Array.from(new Set([0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1].map((i) => Math.min(n - 1, Math.max(0, i)))));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap, height: 120 }}>
        {series.map((d, i) => {
          const appH = (d.app / max) * 100;
          const webH = (d.web / max) * 100;
          return (
            <div key={i} title={`${dm(d.date)}: app ${d.app} · web ${d.web}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 2 }}>
              <div style={{ height: `${webH}%`, background: "#cbd5e1", borderRadius: "3px 3px 0 0" }} />
              <div style={{ height: `${appH}%`, background: BRAND, borderRadius: webH > 0 ? 0 : "3px 3px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {idxs.map((i) => (
          <span key={i} style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{dm(series[i].date)}</span>
        ))}
      </div>
    </div>
  );
}
