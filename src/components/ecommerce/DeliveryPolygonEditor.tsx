"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Trash2, Ban } from "lucide-react";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import type { DeliveryConfig, LatLng } from "@/lib/ecommerce/delivery";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const SANTIAGO = { lat: -33.45, lng: -70.66 };

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  config: DeliveryConfig;
  gmapsKey: string | null;
  restaurantAddress?: string | null;
  onChange: (patch: Partial<DeliveryConfig>) => void;
}

type DrawTarget = "included" | "excluded" | null;

export default function DeliveryPolygonEditor({ config, gmapsKey, restaurantAddress, onChange }: Props) {
  const ready = useGoogleMaps(gmapsKey);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const originMarker = useRef<any>(null);
  const includedPoly = useRef<any>(null);
  const excludedPoly = useRef<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState<DrawTarget>(null);
  const drawingRef = useRef<DrawTarget>(null);
  drawingRef.current = drawing;

  // Refs a los valores actuales (para usarlos dentro de listeners del mapa).
  const cfgRef = useRef(config);
  cfgRef.current = config;

  // ── Inicializar el mapa una vez ──
  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;
    const center = config.origin ?? SANTIAGO;
    const map = new g.maps.Map(mapDiv.current, { center, zoom: 13, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
    mapRef.current = map;

    // Marcador de origen (arrastrable)
    if (config.origin) placeOrigin(config.origin);

    // Autocomplete de búsqueda del origen
    if (searchRef.current && g.maps.places?.Autocomplete) {
      const ac = new g.maps.places.Autocomplete(searchRef.current, { componentRestrictions: { country: ["cl"] }, fields: ["formatted_address", "geometry"] });
      ac.addListener("place_changed", () => {
        const loc = ac.getPlace()?.geometry?.location;
        if (!loc) return;
        const o = { lat: loc.lat(), lng: loc.lng() };
        map.panTo(o); map.setZoom(15);
        placeOrigin(o);
        onChange({ origin: o, originAddress: ac.getPlace().formatted_address || null });
      });
      searchRef.current.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    } else if (!config.origin && restaurantAddress) {
      // Geocodificar la dirección del restaurante como origen inicial
      new g.maps.Geocoder().geocode({ address: restaurantAddress }, (res: any, status: string) => {
        if (status === "OK" && res[0]) {
          const loc = res[0].geometry.location;
          const o = { lat: loc.lat(), lng: loc.lng() };
          map.panTo(o); placeOrigin(o); onChange({ origin: o, originAddress: restaurantAddress });
        }
      });
    }

    // Click en el mapa: si estamos dibujando, agrega vértice al polígono activo.
    map.addListener("click", (e: any) => {
      const target = drawingRef.current;
      if (!target) return;
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (target === "included") {
        onChange({ polygonIncluded: [...cfgRef.current.polygonIncluded, pt] });
      } else {
        // Agrega el punto al último anillo de la zona excluida.
        const rings = cfgRef.current.polygonExcluded.map((r) => r.slice());
        if (!rings.length) rings.push([]);
        rings[rings.length - 1].push(pt);
        onChange({ polygonExcluded: rings });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function placeOrigin(o: LatLng) {
    const g = (window as any).google;
    if (originMarker.current) originMarker.current.setMap(null);
    originMarker.current = new g.maps.Marker({ position: o, map: mapRef.current, draggable: true, title: "Local (origen)" });
    originMarker.current.addListener("dragend", (e: any) => onChange({ origin: { lat: e.latLng.lat(), lng: e.latLng.lng() } }));
  }

  // ── Redibujar polígonos cuando cambian ──
  useEffect(() => {
    if (!mapRef.current) return;
    const g = (window as any).google;
    if (includedPoly.current) includedPoly.current.setMap(null);
    if (config.polygonIncluded.length >= 2) {
      includedPoly.current = new g.maps.Polygon({ paths: config.polygonIncluded, map: mapRef.current, strokeColor: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.12, strokeWeight: 2 });
    }
    if (excludedPoly.current) excludedPoly.current.setMap(null);
    const excludedRings = config.polygonExcluded.filter((r) => r.length >= 2);
    if (excludedRings.length) {
      excludedPoly.current = new g.maps.Polygon({ paths: excludedRings, map: mapRef.current, strokeColor: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.12, strokeWeight: 2 });
    }
  }, [config.polygonIncluded, config.polygonExcluded]);

  if (!gmapsKey) {
    return <div style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)" }}>Falta la API Key de Google Maps. Pídela al equipo de QuieroComer para configurar el mapa.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Origen */}
      <div>
        <label style={lbl}>Ubicación del local (origen)</label>
        <input ref={searchRef} defaultValue={config.originAddress ?? ""} placeholder={ready ? "Busca la dirección del local…" : "Cargando mapa…"} style={inp} />
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 2px 0" }}>Arrastra el marcador para ajustar el punto exacto.</p>
      </div>

      {/* Mapa */}
      <div ref={mapDiv} style={{ width: "100%", height: 340, borderRadius: 14, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)" }} />

      {/* Controles de dibujo */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setDrawing(drawing === "included" ? null : "included")} style={btn(drawing === "included", "#22c55e")}>
          <Pencil size={14} /> {drawing === "included" ? "Terminar zona de reparto" : "Dibujar zona de reparto"}
        </button>
        <button onClick={() => onChange({ polygonIncluded: [] })} style={btnGhost}>
          <Trash2 size={14} /> Limpiar zona
        </button>
        <button onClick={() => { const next = drawing === "excluded" ? null : "excluded"; setDrawing(next); if (next === "excluded") onChange({ polygonExcluded: [...config.polygonExcluded, []] }); }} style={btn(drawing === "excluded", "#ef4444")}>
          <Ban size={14} /> {drawing === "excluded" ? "Terminar zona excluida" : "Agregar zona excluida"}
        </button>
        {config.polygonExcluded.length > 0 && (
          <button onClick={() => onChange({ polygonExcluded: [] })} style={btnGhost}><Trash2 size={14} /> Limpiar excluida</button>
        )}
      </div>
      {drawing && (
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: ACCENT, margin: 0 }}>
          Haz clic en el mapa para marcar los vértices de la {drawing === "included" ? "zona de reparto" : "zona excluida"}. ({drawing === "included" ? config.polygonIncluded.length : (config.polygonExcluded[config.polygonExcluded.length - 1]?.length ?? 0)} puntos)
        </p>
      )}

      {/* Tarifas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <div>
          <label style={lbl}>Tarifa base</label>
          <input value={config.basePrice || ""} onChange={(e) => onChange({ basePrice: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
        </div>
        <div>
          <label style={lbl}>Costo por km</label>
          <input value={config.pricePerKm || ""} onChange={(e) => onChange({ pricePerKm: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
        </div>
        <div>
          <label style={lbl}>Redondeo</label>
          <input value={config.roundingMult || ""} onChange={(e) => onChange({ roundingMult: Number(e.target.value.replace(/\D/g, "")) || 100 })} inputMode="numeric" placeholder="100" style={inp} />
        </div>
      </div>
      <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <MapPin size={13} /> El costo = tarifa base + (km × costo por km), redondeado. Solo dentro de la zona de reparto.
      </p>
    </div>
  );
}

const lbl: React.CSSProperties = { fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 9, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer" };
function btn(active: boolean, color: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", background: active ? color : "var(--adm-hover)", border: `1px solid ${active ? color : "var(--adm-card-border)"}`, borderRadius: 9, color: active ? "#fff" : "var(--adm-text)", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" };
}
