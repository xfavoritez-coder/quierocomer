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
  totalAmount: number; opsStage: string;
  destLat: number | null; destLng: number | null;
  driverName: string | null; driverLat: number | null; driverLng: number | null;
  lastPingAt: string | null; dispatchedAt: string | null; trackingUrl: string | null;
  courierName: string | null; courierStatus: string | null; courierTrackingUrl: string | null;
}

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

export default function SeguimientoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [, force] = useState(0); // re-render para refrescar los "hace Xs"

  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, { driver?: any; dest?: any }>>({});
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
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    const seen = new Set<string>();
    const pts: [number, number][] = [];

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
      if (o.destLat != null && o.destLng != null) {
        pts.push([o.destLat, o.destLng]);
        if (!m.dest) m.dest = L.circleMarker([o.destLat, o.destLng], { radius: 7, color: RED, fillColor: RED, fillOpacity: 0.9, weight: 2 }).addTo(map).bindTooltip(o.customerName || "Destino", { direction: "top" });
        else m.dest.setLatLng([o.destLat, o.destLng]);
      }
    }
    // Limpia marcadores de pedidos que ya no están.
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) { const m = markersRef.current[id]; if (m.driver) map.removeLayer(m.driver); if (m.dest) map.removeLayer(m.dest); delete markersRef.current[id]; }
    }
    // Ajusta el encuadre solo cuando cambia el conjunto de pedidos (no en cada ping).
    const ids = orders.map((o) => o.id).sort().join(",");
    if (ids !== prevIdsRef.current && pts.length) { map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 }); prevIdsRef.current = ids; }
  }, [orders, leafletReady]);

  const focusOrder = (o: Delivery) => {
    const map = mapRef.current;
    const lat = o.driverLat ?? o.destLat, lng = o.driverLng ?? o.destLng;
    if (map && lat != null && lng != null) map.setView([lat, lng], 16, { animate: true });
  };
  const fitAll = () => {
    const map = mapRef.current;
    const pts: [number, number][] = [];
    for (const o of orders) { if (o.driverLat != null && o.driverLng != null) pts.push([o.driverLat, o.driverLng]); if (o.destLat != null && o.destLng != null) pts.push([o.destLat, o.destLng]); }
    if (map && pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Navigation size={20} color={ACCENT} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Seguimiento en vivo</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Repartos en curso y la ubicación de cada repartidor en tiempo real.</p>
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
            <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", background: "var(--adm-hover)", borderRadius: 999, padding: "2px 8px" }}>{orders.length}</span>
            <button onClick={fitAll} title="Ver todos en el mapa" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}><Crosshair size={13} /> Ver todos</button>
          </div>

          {loading ? (
            <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 24, textAlign: "center" }}>Cargando…</p>
          ) : orders.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
              <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Sin repartos activos</p>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Cuando un repartidor tome un pedido, aparecerá aquí con su ubicación en vivo.</p>
            </div>
          ) : (
            orders.map((o) => {
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
