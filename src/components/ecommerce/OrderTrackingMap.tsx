"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Pt = { lat: number; lng: number } | null | undefined;

// Mapa de seguimiento del pedido: repartidor (en vivo) + cliente + tienda.
// Se carga solo en cliente (dynamic ssr:false). Actualiza los marcadores en su lugar.
export default function OrderTrackingMap({ driver, customer, store, dark }: { driver: Pt; customer: Pt; store: Pt; dark?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<{ driver?: L.Marker; customer?: L.Marker; store?: L.Marker }>({});

  useEffect(() => {
    if (!elRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView([-33.45, -70.66], 12);
      // OpenStreetMap: sin API key. En modo oscuro invertimos SOLO las tiles
      // (clase qc-tile-dark), no los marcadores emoji.
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: dark ? "qc-tile-dark" : "",
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    const emojiIcon = (emoji: string) =>
      L.divIcon({ html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">${emoji}</div>`, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });

    // Coordenada válida: números finitos y NO el (0,0) del golfo de Guinea
    // (DH a veces devuelve 0/0/null cuando aún no hay ubicación real).
    const validPt = (pt: Pt): pt is { lat: number; lng: number } =>
      !!pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng) && (Math.abs(pt.lat) > 0.01 || Math.abs(pt.lng) > 0.01);

    const pts: [number, number][] = [];
    const upsert = (key: "driver" | "customer" | "store", pt: Pt, emoji: string) => {
      if (!validPt(pt)) return;
      const pos: [number, number] = [pt.lat, pt.lng];
      pts.push(pos);
      const existing = markers.current[key];
      if (existing) existing.setLatLng(pos);
      else markers.current[key] = L.marker(pos, { icon: emojiIcon(emoji) }).addTo(map);
    };
    upsert("store", store, "🏪");
    upsert("customer", customer, "🏠");
    upsert("driver", driver, "🛵");

    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], 15);
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [driver?.lat, driver?.lng, customer?.lat, customer?.lng, store?.lat, store?.lng, dark]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; markers.current = {}; }, []);

  return (
    <>
      <style>{`.qc-tile-dark{filter:invert(1) hue-rotate(180deg) brightness(.95) contrast(.9);}`}</style>
      <div ref={elRef} style={{ width: "100%", height: 260, borderRadius: 16, overflow: "hidden" }} />
    </>
  );
}
