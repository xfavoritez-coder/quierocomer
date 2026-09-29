"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, RefreshCw, Bike, Phone, MapPin, ExternalLink, Crosshair, Navigation } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { supabase } from "@/lib/supabase";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e", BLUE = "#3b82f6", RED = "#ef4444", GRAY = "#9ca3af", PURPLE = "#7c3aed";

interface Delivery {
  id: string; orderReference: string | null; customerName: string; customerPhone: string; addressLine: string;
  totalAmount: number; opsStage: string; isDelivery: boolean; createdAt: string | null;
  destLat: number | null; destLng: number | null;
  driverName: string | null; driverLat: number | null; driverLng: number | null;
  lastPingAt: string | null; dispatchedAt: string | null; trackingUrl: string | null;
  courierName: string | null; courierStatus: string | null; courierTrackingUrl: string | null;
}

interface Local { name: string; address: string | null; lat: number; lng: number }

const STAGE_HOME: Record<string, { color: string; label: string }> = {
  preparing: { color: "#f59e0b", label: "En preparación" },
  ready: { color: "#22c55e", label: "Listo" },
  out_for_delivery: { color: "#3b82f6", label: "En reparto" },
};

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

function agoLabel(iso: string | null): { text: string; stale: boolean; none: boolean } {
  if (!iso) return { text: "sin señal", stale: true, none: true };
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const stale = secs > 90;
  if (secs < 60) return { text: `hace ${secs}s`, stale, none: false };
  const m = Math.round(secs / 60);
  if (m < 60) return { text: `hace ${m} min`, stale, none: false };
  return { text: `hace ${Math.round(m / 60)} h`, stale, none: false };
}

// Marcador de repartidor: pin redondo con inicial.
function driverIconHtml(name: string | null, color: string) {
  const initial = (name || "R").trim().charAt(0).toUpperCase();
  return `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;border:2px solid #fff"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-family:sans-serif;font-size:14px">${initial}</span></div>`;
}

// Punto de la casa del cliente: círculo pequeño de color según etapa,
// con el número del pedido (como en deliveryhandroll).
function homeIconHtml(color: string, num: number) {
  return `<div style="width:22px;height:22px;border-radius:50%;background:${color};box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;border:2px solid #fff;color:#fff;font-weight:800;font-family:sans-serif;font-size:11px;line-height:1">${num}</div>`;
}

// Marcador del local (restaurante): edificio.
function localIconHtml() {
  return `<div style="width:30px;height:30px;border-radius:8px;background:#111827;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:16px;line-height:1">🏢</div>`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function ageMin(iso: string | null): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// Etiqueta-pill tipo deliveryhandroll: número + nombre + dirección + meta.
function homePillHtml(num: number, color: string, name: string, address: string, age: string, stageLabel: string) {
  const n = escapeHtml(name || "Cliente");
  const a = escapeHtml(address || "");
  const metaParts = [age, stageLabel].filter(Boolean).map(escapeHtml);
  return `<div class="qc-pill">
    <span class="qc-pill-num" style="background:${color}">${num}</span>
    <div class="qc-pill-body">
      <div class="qc-pill-name">${n}</div>
      ${a ? `<div class="qc-pill-addr">${a}</div>` : ""}
      ${metaParts.length ? `<div class="qc-pill-meta"><span class="qc-pill-dot" style="background:${color}"></span>${metaParts.join(" · ")}</div>` : ""}
    </div>
  </div>`;
}

function localPillHtml(name: string) {
  return `<div class="qc-pill qc-pill-local"><span class="qc-pill-num" style="background:#111827">🏢</span><div class="qc-pill-body"><div class="qc-pill-name">${escapeHtml(name || "Local")}</div><div class="qc-pill-addr">Local</div></div></div>`;
}

export default function SeguimientoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<Delivery[]>([]);
  const [local, setLocal] = useState<Local | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [, force] = useState(0); // re-render para refrescar los "hace Xs"

  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, { driver?: any; dest?: any }>>({});
  const localMarkerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const prevIdsRef = useRef<string>("");
  const refetchTimer = useRef<any>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/tracking?restaurantId=${restaurantId}`);
      const d = await r.json();
      if (r.ok && d.orders) setOrders(d.orders);
      if (r.ok && "local" in d) setLocal(d.local);
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Re-render cada 10s para actualizar los "hace Xs".
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 10000); return () => clearInterval(t); }, []);

  // Carga Leaflet (CDN) una vez.
  useEffect(() => {
    if ((window as any).L) { setLeafletReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => setLeafletReady(true);
    document.body.appendChild(js);
  }, []);

  // Realtime: pings de ubicación actualizan PosOrder. Movemos el marcador sin
  // refetch; si cambia la membresía (nuevo/entregado), refrescamos la lista.
  useEffect(() => {
    if (!restaurantId) return;
    const scheduleRefetch = () => { clearTimeout(refetchTimer.current); refetchTimer.current = setTimeout(() => fetchOrders(true), 800); };
    const channel = supabase
      .channel(`tracking-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "PosOrder", filter: `restaurantId=eq.${restaurantId}` }, (payload: any) => {
        if (payload.eventType === "UPDATE") {
          const row = payload.new;
          if (row.opsStage !== "out_for_delivery" || row.posStatus === "canceled") { scheduleRefetch(); return; }
          setOrders((prev) => {
            if (!prev.some((o) => o.id === row.id)) { scheduleRefetch(); return prev; }
            return prev.map((o) => (o.id === row.id ? { ...o, driverLat: row.lastLat ?? o.driverLat, driverLng: row.lastLng ?? o.driverLng, lastPingAt: row.trackingLastPingAt ?? o.lastPingAt } : o));
          });
        } else { scheduleRefetch(); }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const onVis = () => { if (document.visibilityState === "visible") fetchOrders(true); };
    document.addEventListener("visibilitychange", onVis);
    const backup = setInterval(() => fetchOrders(true), 20000);
    return () => { supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVis); clearInterval(backup); clearTimeout(refetchTimer.current); };
  }, [restaurantId, fetchOrders]);

  // Dibuja/actualiza marcadores.
  useEffect(() => {
    const L = (window as any).L;
    if (!leafletReady || !L) return;
    if (!mapRef.current) {
      mapRef.current = L.map("track-map", { zoomControl: true, attributionControl: false }).setView([-33.45, -70.66], 12);
      // Mapa en escala de grises (Esri Light Gray), sin API key.
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, maxNativeZoom: 16 }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    const seen = new Set<string>();
    const pts: [number, number][] = [];

    // Marcador del local (restaurante): edificio + pill con el nombre.
    if (local) {
      pts.push([local.lat, local.lng]);
      const localTip = localPillHtml(local.name);
      if (!localMarkerRef.current) {
        const icon = L.divIcon({ html: localIconHtml(), className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
        localMarkerRef.current = L.marker([local.lat, local.lng], { icon, zIndexOffset: 1000 }).addTo(map)
          .bindTooltip(localTip, { direction: "right", offset: [14, 0], permanent: true, opacity: 1, className: "qc-pill-tip" });
      } else { localMarkerRef.current.setLatLng([local.lat, local.lng]); localMarkerRef.current.setTooltipContent(localTip); }
    }

    let num = 0;
    for (const o of orders) {
      seen.add(o.id);
      const m = markersRef.current[o.id] || (markersRef.current[o.id] = {});
      const color = o.courierName ? PURPLE : BLUE;
      if (o.driverLat != null && o.driverLng != null) {
        pts.push([o.driverLat, o.driverLng]);
        const icon = L.divIcon({ html: driverIconHtml(o.driverName, color), className: "", iconSize: [34, 34], iconAnchor: [17, 34] });
        if (!m.driver) m.driver = L.marker([o.driverLat, o.driverLng], { icon }).addTo(map).bindTooltip(o.driverName || "Repartidor", { direction: "top", offset: [0, -34] });
        else { m.driver.setLatLng([o.driverLat, o.driverLng]); m.driver.setIcon(icon); }
      }
      // La casa del cliente solo para pedidos delivery con coordenadas.
      if (o.isDelivery && o.destLat != null && o.destLng != null) {
        num++;
        pts.push([o.destLat, o.destLng]);
        const stageColor = STAGE_HOME[o.opsStage]?.color || RED;
        const stageLabel = STAGE_HOME[o.opsStage]?.label || "";
        const tip = homePillHtml(num, stageColor, o.customerName || "Cliente", o.addressLine || "", ageMin(o.createdAt), stageLabel);
        const homeIcon = L.divIcon({ html: homeIconHtml(stageColor, num), className: "", iconSize: [22, 22], iconAnchor: [11, 11] });
        if (!m.dest) {
          m.dest = L.marker([o.destLat, o.destLng], { icon: homeIcon }).addTo(map)
            .bindTooltip(tip, { direction: "right", offset: [12, 0], permanent: true, opacity: 1, className: "qc-pill-tip" });
        } else { m.dest.setLatLng([o.destLat, o.destLng]); m.dest.setIcon(homeIcon); m.dest.setTooltipContent(tip); }
      }
    }
    // Limpia marcadores de pedidos que ya no están.
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) { const m = markersRef.current[id]; if (m.driver) map.removeLayer(m.driver); if (m.dest) map.removeLayer(m.dest); delete markersRef.current[id]; }
    }
    // Ajusta el encuadre solo cuando cambia el conjunto de pedidos (no en cada ping).
    const ids = (local ? "L," : "") + orders.map((o) => o.id).sort().join(",");
    if (ids !== prevIdsRef.current && pts.length) { map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 }); prevIdsRef.current = ids; }
  }, [orders, local, leafletReady]);

  const focusOrder = (o: Delivery) => {
    const map = mapRef.current;
    const lat = o.driverLat ?? o.destLat, lng = o.driverLng ?? o.destLng;
    if (map && lat != null && lng != null) map.setView([lat, lng], 16, { animate: true });
  };
  const fitAll = () => {
    const map = mapRef.current;
    const pts: [number, number][] = [];
    if (local) pts.push([local.lat, local.lng]);
    for (const o of orders) { if (o.driverLat != null && o.driverLng != null) pts.push([o.driverLat, o.driverLng]); if (o.isDelivery && o.destLat != null && o.destLng != null) pts.push([o.destLat, o.destLng]); }
    if (map && pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
  };

  const enReparto = orders.filter((o) => o.opsStage === "out_for_delivery");

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 4px 60px" }}>
      <style>{`
        .leaflet-tooltip.qc-pill-tip { background: transparent; border: none; box-shadow: none; padding: 0; white-space: nowrap; }
        .leaflet-tooltip.qc-pill-tip::before { display: none; }
        .qc-pill { display: inline-flex; align-items: stretch; gap: 0; background: #fff; border-radius: 9px; box-shadow: 0 2px 8px rgba(0,0,0,.18); overflow: hidden; font-family: sans-serif; max-width: 230px; }
        .qc-pill-num { flex-shrink: 0; width: 22px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 12px; }
        .qc-pill-body { padding: 4px 8px 4px 7px; min-width: 0; }
        .qc-pill-name { font-weight: 800; font-size: 11.5px; color: #111827; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .qc-pill-addr { font-size: 10.5px; color: #6b7280; line-height: 1.25; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
        .qc-pill-meta { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #374151; margin-top: 2px; }
        .qc-pill-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .qc-pill-local .qc-pill-addr { color: #9ca3af; }
      `}</style>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Navigation size={20} color={ACCENT} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Seguimiento en vivo</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>El local 🏪, la casa 🏠 de cada pedido activo y los repartidores en tiempo real.</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, background: live ? "rgba(34,197,94,0.12)" : "var(--adm-hover)", color: live ? GREEN : "var(--adm-text3)" }}>
          <Radio size={13} /> {live ? "En vivo" : "Conectando…"}
        </span>
        <button onClick={() => fetchOrders()} title="Refrescar" style={{ width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><RefreshCw size={16} /></button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Lista de repartos */}
        <div style={{ width: 340, flexShrink: 0, minWidth: 280, flex: "1 1 300px", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
            <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)" }}>🛵 En reparto</span>
            <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", background: "var(--adm-hover)", borderRadius: 999, padding: "2px 8px" }}>{enReparto.length}</span>
            <button onClick={fitAll} title="Ver todo en el mapa" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}><Crosshair size={13} /> Ver todo</button>
          </div>

          {loading ? (
            <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 24, textAlign: "center" }}>Cargando…</p>
          ) : enReparto.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
              <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Sin repartos activos</p>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 4px" }}>Cuando un repartidor tome un pedido, aparecerá aquí con su ubicación en vivo.</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Mientras tanto, en el mapa ves el local 🏪 y la casa 🏠 de cada pedido activo.</p>
            </div>
          ) : (
            enReparto.map((o) => {
              const ago = agoLabel(o.lastPingAt);
              const dotColor = o.courierName ? PURPLE : ago.none ? GRAY : ago.stale ? RED : GREEN;
              return (
                <div key={o.id} onClick={() => focusOrder(o)} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 13, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: o.courierName ? PURPLE : BLUE, background: `${o.courierName ? PURPLE : BLUE}14`, borderRadius: 7, padding: "3px 8px" }}>
                      <Bike size={12} /> {o.driverName || o.courierName || "Repartidor"}
                    </span>
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: dotColor }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} /> {o.courierName ? (o.courierStatus || "courier") : ago.text}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName || (o.orderReference ? `#${o.orderReference}` : "Pedido")}</span>
                    <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: ACCENT, flexShrink: 0 }}>{clp(o.totalAmount)}</span>
                  </div>
                  {o.addressLine && <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 4, fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)" }}><MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} /> {o.addressLine}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                    {o.customerPhone && <a href={`tel:${o.customerPhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, textDecoration: "none" }}><Phone size={12} /> Llamar cliente</a>}
                    {(o.trackingUrl || o.courierTrackingUrl) && <a href={(o.courierTrackingUrl || o.trackingUrl)!} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: BLUE, fontFamily: F, fontSize: "0.74rem", fontWeight: 700, textDecoration: "none" }}><ExternalLink size={12} /> Seguir</a>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mapa */}
        <div style={{ flex: "2 1 420px", minWidth: 300, position: "sticky", top: 8 }}>
          <div id="track-map" style={{ height: "72vh", minHeight: 380, borderRadius: 16, overflow: "hidden", border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)" }} />
        </div>
      </div>
    </div>
  );
}
