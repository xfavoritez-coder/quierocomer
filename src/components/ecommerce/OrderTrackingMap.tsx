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
      const tiles = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      L.tileLayer(tiles, { maxZoom: 19 }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    const emojiIcon = (emoji: string) =>
      L.divIcon({ html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">${emoji}</div>`, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });

    const pts: [number, number][] = [];
    const upsert = (key: "driver" | "customer" | "store", pt: Pt, emoji: string) => {
      if (!pt || pt.lat == null || pt.lng == null) return;
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

  return <div ref={elRef} style={{ width: "100%", height: 260, borderRadius: 16, overflow: "hidden" }} />;
}
