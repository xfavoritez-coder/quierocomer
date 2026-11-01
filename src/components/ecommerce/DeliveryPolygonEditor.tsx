"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
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
  // Polígonos EDITABLES ya cerrados: el de reparto (uno) y las zonas excluidas (varias).
  // Son la fuente de verdad en el mapa; al arrastrar un vértice se re-escribe el config.
  const includedPolyRef = useRef<any>(null);
  const excludedPolysRef = useRef<any[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState<DrawTarget>(null);
  const [ptCount, setPtCount] = useState(0);

  // onChange siempre actual, para usarlo dentro de listeners del mapa (bound una vez).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Estado del dibujo en curso: una polilínea que conecta los vértices en vivo +
  // un marcador por punto. Al cerrar (doble clic) se convierte en polígono.
  const drawRef = useRef<{ active: boolean; isExcluded: boolean; points: any[]; markers: any[]; line: any }>({ active: false, isExcluded: false, points: [], markers: [], line: null });

  // ── Inicializar el mapa una vez ──
  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;
    const center = config.origin ?? SANTIAGO;
    // clickableIcons:false → un clic sobre un ícono de lugar (POI) también cuenta como
    // clic en el mapa (agrega vértice) en vez de abrir el info-window de Google; sin
    // esto, dibujar sobre zonas con muchos POIs "comía" clics y no marcaba puntos.
    const map = new g.maps.Map(mapDiv.current, { center, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
    mapRef.current = map;

    // Marcador de origen (arrastrable)
    if (config.origin) placeOrigin(config.origin);

    // Encuadrar UNA sola vez a la cobertura existente al cargar (si la hay). Antes
    // esto vivía en un efecto reactivo y se re-disparaba al agregar el 2º punto,
    // moviendo el mapa bajo los clics del usuario mientras dibujaba.
    const initPts: LatLng[] = [...config.polygonIncluded, ...config.polygonExcluded.flat()];
    if (config.origin) initPts.push(config.origin);
    if (initPts.length >= 2) {
      const b = new g.maps.LatLngBounds();
      initPts.forEach((p) => b.extend(p));
      map.fitBounds(b);
    }

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

    // Dibujo manual (el DrawingManager de Google fue removido en v3.65):
    // clic = agrega un vértice; doble clic (o clic en el 1er punto) = cierra la figura.
    map.addListener("click", (e: any) => { if (drawRef.current.active) addDrawPoint(e.latLng); });
    map.addListener("dblclick", (e: any) => { if (drawRef.current.active) finishDrawing(); });

    // Cargar las zonas ya guardadas como polígonos EDITABLES (vértices arrastrables).
    if (config.polygonIncluded.length >= 3) createIncluded(config.polygonIncluded);
    config.polygonExcluded.forEach((ring) => { if (ring.length >= 3) createExcluded(ring); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Dibujo manual: línea por línea, cierre por 1er-punto o doble clic ────────
  function startDrawing(isExcluded: boolean) {
    const g = (window as any).google;
    if (!mapRef.current) return;
    cancelDrawing(); // descarta cualquier dibujo en curso
    setPolysEditable(false); // no editar polígonos existentes mientras dibujo uno nuevo
    const line = new g.maps.Polyline({ map: mapRef.current, path: [], strokeColor: isExcluded ? "#ef4444" : "#22c55e", strokeWeight: 2, clickable: false });
    drawRef.current = { active: true, isExcluded, points: [], markers: [], line };
    mapRef.current.setOptions({ draggableCursor: "crosshair", disableDoubleClickZoom: true });
    setDrawing(isExcluded ? "excluded" : "included");
    setPtCount(0);
  }

  function addDrawPoint(latLng: any) {
    const g = (window as any).google;
    const d = drawRef.current;
    const isFirst = d.points.length === 0;
    const color = d.isExcluded ? "#ef4444" : "#16a34a";
    d.points.push(latLng);
    // El PRIMER vértice es más grande y clickeable: tocarlo cierra la figura (además
    // del doble clic). Los demás son puntitos blancos no clickeables.
    const mk = new g.maps.Marker({
      position: latLng, map: mapRef.current, clickable: isFirst,
      cursor: isFirst ? "pointer" : undefined,
      title: isFirst ? "Toca aquí para cerrar la zona" : undefined,
      icon: { path: g.maps.SymbolPath.CIRCLE, scale: isFirst ? 6 : 4, fillColor: isFirst ? color : "#fff", fillOpacity: 1, strokeColor: color, strokeWeight: 2 },
    });
    if (isFirst) mk.addListener("click", () => { if (drawRef.current.active) finishDrawing(); });
    d.markers.push(mk);
    d.line.setPath(d.points);
    setPtCount(d.points.length);
  }

  function finishDrawing() {
    const d = drawRef.current;
    if (!d.active) return;
    if (d.points.length < 3) { toast.error("Marca al menos 3 puntos para cerrar la zona"); return; }
    const paths = d.points.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
    const isExcluded = d.isExcluded;
    cancelDrawing();
    if (isExcluded) { createExcluded(paths); onChangeRef.current({ polygonExcluded: excludedPolysRef.current.map(polygonToCoords) }); }
    else { createIncluded(paths); onChangeRef.current({ polygonIncluded: paths }); }
  }

  function cancelDrawing() {
    const d = drawRef.current;
    d.markers.forEach((m: any) => m.setMap(null));
    if (d.line) d.line.setMap(null);
    drawRef.current = { active: false, isExcluded: false, points: [], markers: [], line: null };
    mapRef.current?.setOptions?.({ draggableCursor: null, disableDoubleClickZoom: false });
    setPolysEditable(true); // vuelven a ser editables al salir del modo dibujo
    setDrawing(null);
    setPtCount(0);
  }

  // ── Polígonos cerrados y EDITABLES (vértices arrastrables + puntos medios) ───
  function polygonToCoords(poly: any): LatLng[] {
    const path = poly.getPath();
    const out: LatLng[] = [];
    for (let i = 0; i < path.getLength(); i++) { const p = path.getAt(i); out.push({ lat: p.lat(), lng: p.lng() }); }
    return out;
  }
  function setPolysEditable(on: boolean) {
    includedPolyRef.current?.setOptions?.({ editable: on });
    excludedPolysRef.current.forEach((p) => p.setOptions?.({ editable: on }));
  }
  function createIncluded(paths: LatLng[]) {
    const g = (window as any).google;
    if (includedPolyRef.current) includedPolyRef.current.setMap(null);
    const poly = new g.maps.Polygon({ paths, map: mapRef.current, editable: true, strokeColor: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.12, strokeWeight: 2 });
    const push = () => onChangeRef.current({ polygonIncluded: polygonToCoords(poly) });
    const path = poly.getPath();
    path.addListener("set_at", push);    // vértice movido
    path.addListener("insert_at", push); // vértice agregado (punto medio)
    path.addListener("remove_at", push); // vértice eliminado (clic derecho)
    includedPolyRef.current = poly;
  }
  function createExcluded(paths: LatLng[]) {
    const g = (window as any).google;
    const poly = new g.maps.Polygon({ paths, map: mapRef.current, editable: true, strokeColor: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.12, strokeWeight: 2 });
    excludedPolysRef.current.push(poly);
    const push = () => onChangeRef.current({ polygonExcluded: excludedPolysRef.current.map(polygonToCoords) });
    const path = poly.getPath();
    path.addListener("set_at", push);
    path.addListener("insert_at", push);
    path.addListener("remove_at", push);
  }

  // Escape cancela el dibujo en curso.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && drawRef.current.active) cancelDrawing(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function placeOrigin(o: LatLng) {
    const g = (window as any).google;
    if (originMarker.current) originMarker.current.setMap(null);
    originMarker.current = new g.maps.Marker({ position: o, map: mapRef.current, draggable: true, title: "Local (origen)" });
    originMarker.current.addListener("dragend", (e: any) => onChange({ origin: { lat: e.latLng.lat(), lng: e.latLng.lng() } }));
  }


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
        <button onClick={() => (drawing === "included" ? cancelDrawing() : startDrawing(false))} style={btn(drawing === "included", "#22c55e")}>
          <Pencil size={14} /> {drawing === "included" ? "Cancelar dibujo" : "Dibujar zona de reparto"}
        </button>
        <button onClick={() => { cancelDrawing(); includedPolyRef.current?.setMap(null); includedPolyRef.current = null; onChange({ polygonIncluded: [] }); }} style={btnGhost}>
          <Trash2 size={14} /> Limpiar zona
        </button>
        <button onClick={() => (drawing === "excluded" ? cancelDrawing() : startDrawing(true))} style={btn(drawing === "excluded", "#ef4444")}>
          <Ban size={14} /> {drawing === "excluded" ? "Cancelar dibujo" : "Agregar zona excluida"}
        </button>
        {config.polygonExcluded.length > 0 && (
          <button onClick={() => { cancelDrawing(); excludedPolysRef.current.forEach((p) => p.setMap(null)); excludedPolysRef.current = []; onChange({ polygonExcluded: [] }); }} style={btnGhost}><Trash2 size={14} /> Limpiar excluida</button>
        )}
      </div>
      {drawing ? (
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: ACCENT, margin: 0 }}>
          Haz clic en el mapa para marcar cada esquina de la {drawing === "included" ? "zona de reparto" : "zona excluida"}. Para <b>cerrar</b>: haz clic en el <b>primer punto</b> (el grande) o <b>doble clic</b> · mínimo 3 puntos · <b>Esc</b> cancela. ({ptCount} {ptCount === 1 ? "punto" : "puntos"})
        </p>
      ) : (config.polygonIncluded.length >= 3 || config.polygonExcluded.length > 0) ? (
        <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0 }}>
          Arrastra los vértices para ajustar la zona. Arrastra un punto medio (más claro) para agregar un vértice · clic derecho en un vértice para quitarlo.
        </p>
      ) : null}

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
