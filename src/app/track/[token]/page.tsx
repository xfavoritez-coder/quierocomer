"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Line = { name: string; qty: number };
type Track = {
  ok: boolean; store?: string; storeLogo?: string | null; statusLabel?: string; status?: string; delivered?: boolean;
  isDelivery?: boolean; orderType?: string; orderReference?: string | null;
  customerName?: string; address?: string; destLat?: number | null; destLng?: number | null;
  items?: Line[]; total?: number; deliveryFee?: number; tip?: number; discount?: number; createdAt?: string | null;
  driverLat?: number | null; driverLng?: number | null; driverName?: string | null; lastPingAt?: string | null; courierTrackingUrl?: string | null;
};

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

const STEPS = ["preparing", "ready", "out_for_delivery", "delivered"];
const STEP_LABEL: Record<string, string> = { preparing: "Preparando", ready: "Listo", out_for_delivery: "En camino", delivered: "Entregado" };

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Track | null>(null);
  const [err, setErr] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ driver?: any; dest?: any }>({});
  const [leafletReady, setLeafletReady] = useState(false);

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

  // Polling del estado.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () => fetch(`/api/track/${token}`).then((r) => r.json()).then((j) => { if (alive) { if (j.ok) setD(j); else setErr(true); } }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);

  // Mapa.
  useEffect(() => {
    const L = (window as any).L;
    if (!leafletReady || !L || !d) return;
    const dLat = d.driverLat ?? d.destLat, dLng = d.driverLng ?? d.destLng;
    if (dLat == null || dLng == null) return;
    if (!mapRef.current) {
      mapRef.current = L.map("track-map", { zoomControl: true, attributionControl: false }).setView([dLat, dLng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (d.driverLat != null && d.driverLng != null) {
      const motoIcon = L.divIcon({
        html: `<div style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">🏍️</div>`,
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 30],
      });
      if (!markersRef.current.driver) markersRef.current.driver = L.marker([d.driverLat, d.driverLng], { icon: motoIcon }).addTo(map).bindPopup(d.driverName || "Repartidor");
      else markersRef.current.driver.setLatLng([d.driverLat, d.driverLng]);
    }
    if (d.destLat != null && d.destLng != null && !markersRef.current.dest) {
      markersRef.current.dest = L.circleMarker([d.destLat, d.destLng], { radius: 8, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.9 }).addTo(map).bindPopup("Destino");
    }
    const pts = [];
    if (d.driverLat != null && d.driverLng != null) pts.push([d.driverLat, d.driverLng]);
    if (d.destLat != null && d.destLng != null) pts.push([d.destLat, d.destLng]);
    if (pts.length === 2) map.fitBounds(pts, { padding: [50, 50] });
    else if (pts.length === 1) map.setView(pts[0], 15);
  }, [leafletReady, d]);

  if (err) return <Center><p style={{ fontFamily: "system-ui", color: "#666" }}>Pedido no encontrado.</p></Center>;
  if (!d) return <Center><p style={{ fontFamily: "system-ui", color: "#666" }}>Cargando…</p></Center>;

  const stepIdx = STEPS.indexOf(d.status || "");
  const hasMap = (d.driverLat != null && d.driverLng != null) || (d.destLat != null && d.destLng != null);

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f7", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {d.storeLogo ? <img src={d.storeLogo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} /> : null}
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#111" }}>{d.store}</div>
            <div style={{ fontSize: "0.82rem", color: "#666" }}>Seguimiento de tu pedido</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: d.delivered ? "#16a34a" : "#F4A623", marginBottom: 14 }}>
            {d.delivered ? "✅ " : "🛵 "}{d.statusLabel}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ height: 6, borderRadius: 3, background: i <= stepIdx ? "#F4A623" : "#e5e5ea" }} />
                <div style={{ fontSize: "0.64rem", color: i <= stepIdx ? "#111" : "#aaa", marginTop: 4, textAlign: "center", fontWeight: i === stepIdx ? 800 : 500 }}>{STEP_LABEL[s]}</div>
              </div>
            ))}
          </div>
          {d.driverName && !d.delivered ? <div style={{ marginTop: 14, fontSize: "0.86rem", color: "#333" }}>Repartidor: <strong>{d.driverName}</strong></div> : null}
          {d.address ? <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#666" }}>📍 {d.address}</div> : null}
        </div>

        {hasMap && (
          <div id="track-map" style={{ height: 340, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }} />
        )}
        {d.courierTrackingUrl ? (
          <a href={d.courierTrackingUrl} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", marginTop: 14, padding: 12, borderRadius: 12, background: "#111", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Ver seguimiento del courier →</a>
        ) : null}

        {/* Resumen del pedido */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#111" }}>Tu pedido{d.orderReference ? ` · #${d.orderReference}` : ""}</div>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#7a5300", background: "#F4A62322", borderRadius: 999, padding: "3px 10px" }}>
              {d.orderType === "delivery" ? "🛵 Delivery" : d.orderType === "dine-in" ? "🍽️ En local" : "🛍️ Retiro"}
            </span>
          </div>

          {d.items && d.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #eee" }}>
              {d.items.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.9rem", color: "#333" }}>
                  <span style={{ fontWeight: 800, color: "#111", minWidth: 24 }}>{it.qty}×</span>
                  <span>{it.name}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: "0.86rem", color: "#555" }}>
            {(d.deliveryFee ?? 0) > 0 && <Row label="Envío" value={clp(d.deliveryFee!)} />}
            {(d.discount ?? 0) > 0 && <Row label="Descuento" value={`- ${clp(d.discount!)}`} />}
            {(d.tip ?? 0) > 0 && <Row label="Propina" value={clp(d.tip!)} />}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 8, borderTop: "1px solid #eee", fontSize: "1.05rem", fontWeight: 800, color: "#111" }}>
              <span>Total</span><span>{clp(d.total ?? 0)}</span>
            </div>
          </div>

          {d.customerName ? <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#888" }}>A nombre de {d.customerName}</div> : null}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.72rem", color: "#aaa" }}>Pedido gestionado por {d.store}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span>{value}</span></div>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f5f5f7" }}>{children}</div>;
}
