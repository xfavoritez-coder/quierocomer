"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Store } from "lucide-react";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import type { BrandData, BrandBranch } from "@/lib/ecommerce/storefront-data";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function BrandChooser({ brand }: { brand: BrandData }) {
  const accent = brand.branches[0]?.primaryColor || "#F4A623";
  const hasDelivery = brand.branches.some((b) => b.deliveryEnabled);
  const hasPickup = brand.branches.some((b) => b.pickupEnabled);
  const [tab, setTab] = useState<"delivery" | "pickup">(hasDelivery ? "delivery" : "pickup");
  const gmapsReady = useGoogleMaps(tab === "delivery" ? brand.googleMapsKey : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; address: string } | null>(null);

  const go = (slug: string) => { window.location.href = `/ecommerce/${slug}`; };

  // Sucursal más cercana que hace delivery (por distancia geográfica al destino).
  const nearest = useMemo<BrandBranch | null>(() => {
    if (!dest) return null;
    const candidates = brand.branches.filter((b) => b.deliveryEnabled && b.lat != null && b.lng != null);
    if (!candidates.length) return null;
    return candidates.map((b) => ({ b, km: haversineKm(dest, { lat: b.lat!, lng: b.lng! }) })).sort((a, z) => a.km - z.km)[0].b;
  }, [dest, brand.branches]);

  useEffect(() => {
    if (tab !== "delivery" || !gmapsReady || !inputRef.current) return;
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const ac = new g.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: ["cl"] }, types: ["address"], fields: ["formatted_address", "geometry"] });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) return;
      setDest({ lat: loc.lat(), lng: loc.lng(), address: place.formatted_address || inputRef.current!.value });
    });
    inputRef.current.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    return () => { g.maps.event?.removeListener?.(listener); };
  }, [tab, gmapsReady]);

  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${on ? "transparent" : "#e5e7eb"}`, background: on ? accent : "#fff", color: on ? "#fff" : "#374151", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f8f8", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.brandName} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px" }} /> : null}
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#111", margin: 0 }}>{brand.brandName}</h1>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "4px 0 0" }}>¿Dónde quieres pedir?</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {hasDelivery && <button onClick={() => setTab("delivery")} style={tabBtn(tab === "delivery")}><Bike size={17} /> Delivery</button>}
          {hasPickup && <button onClick={() => setTab("pickup")} style={tabBtn(tab === "pickup")}><Store size={17} /> Retiro</button>}
        </div>

        {tab === "delivery" ? (
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Tu dirección</label>
            <input ref={inputRef} placeholder={gmapsReady ? "Escribe tu dirección…" : "Cargando mapa…"} style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "6px 2px 0" }}>Elige una opción de la lista: te asignamos la sucursal más cercana.</p>
            {!brand.googleMapsKey && <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: "8px 2px 0" }}>La marca aún no configuró Google Maps.</p>}
            {nearest && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: `1px solid ${accent}55`, background: `${accent}10` }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Tu sucursal</p>
                <p style={{ fontSize: "1.05rem", fontWeight: 900, color: "#111", margin: "3px 0 1px" }}>{nearest.branchName || nearest.name}{!nearest.open ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444", marginLeft: 8 }}>Cerrada ahora</span> : null}</p>
                {nearest.address && <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 10px" }}>{nearest.address}</p>}
                <button onClick={() => go(nearest.slug)} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>Continuar con {nearest.branchName || nearest.name} →</button>
                <p style={{ fontSize: "0.7rem", color: "#9ca3af", margin: "8px 2px 0" }}>En la tienda confirmarás tu dirección y verás el costo de despacho.</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {brand.branches.filter((b) => b.pickupEnabled).map((b) => (
              <button key={b.id} onClick={() => go(b.slug)} style={{ textAlign: "left", background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 14, cursor: "pointer" }}>
                <p style={{ fontSize: "1rem", fontWeight: 800, color: "#111", margin: 0 }}>{b.branchName || b.name}{!b.open ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444", marginLeft: 8 }}>Cerrada ahora</span> : <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16a34a", marginLeft: 8 }}>Abierta</span>}</p>
                {b.address && <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "2px 0 0" }}>{b.address}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
