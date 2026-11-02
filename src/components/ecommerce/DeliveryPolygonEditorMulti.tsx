"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Trash2, Ban, Save, Maximize2, Minimize2, X } from "lucide-react";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import type { DeliveryConfig, LatLng } from "@/lib/ecommerce/delivery";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const SANTIAGO = { lat: -33.45, lng: -70.66 };

// Paleta de colores por sucursal (hasta 8)
const BRANCH_COLORS = ["#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#06b6d4", "#84cc16"];

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BranchDelivery {
  id: string;
  name: string;          // nombre de la marca
  branchName?: string | null;  // nombre de la sucursal (si existe)
  config: DeliveryConfig;
  address?: string | null;     // dirección registrada del local
}

interface Props {
  branches: BranchDelivery[];
  activeBranchId: string;       // sucursal que el panel tiene seleccionada
  gmapsKey: string | null;
  onChangeConfig: (patch: Partial<DeliveryConfig>) => void;  // solo para la sucursal activa
  onSave: () => void;
  saving: boolean;
}

type DrawTarget = "included" | "excluded" | null;

export default function DeliveryPolygonEditorMulti({
  branches, activeBranchId, gmapsKey, onChangeConfig, onSave, saving,
}: Props) {
  const ready = useGoogleMaps(gmapsKey);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [drawing, setDrawing] = useState<DrawTarget>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Al entrar/salir de fullscreen, redimensiona el mapa para que encaje bien
  useEffect(() => {
    if (!mapRef.current) return;
    const g = (window as any).google;
    setTimeout(() => g?.maps?.event?.trigger(mapRef.current, "resize"), 50);
  }, [fullscreen]);
  const drawingRef = useRef<DrawTarget>(null);
  drawingRef.current = drawing;

  // Refs a polígonos y marcadores por sucursal
  const polyRefs = useRef<Record<string, { included: any; excluded: any; marker: any }>>({});

  // Ref a branches/activeBranchId para usar dentro de listeners del mapa
  const branchesRef = useRef(branches);
  branchesRef.current = branches;
  const activeIdRef = useRef(activeBranchId);
  activeIdRef.current = activeBranchId;

  const colorOf = (id: string) =>
    BRANCH_COLORS[branches.findIndex((b) => b.id === id) % BRANCH_COLORS.length];

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const activeConfig = activeBranch?.config;

  // ── Inicializar mapa una vez ──
  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;

    const map = new g.maps.Map(mapDiv.current, {
      center: SANTIAGO, zoom: 11,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    });
    mapRef.current = map;
    setMapReady(true);

    // Click: agrega vértice solo en la sucursal activa
    map.addListener("click", (e: any) => {
      const target = drawingRef.current;
      if (!target) return;
      const branchId = activeIdRef.current;
      const branch = branchesRef.current.find((b) => b.id === branchId);
      if (!branch) return;
      const pt: LatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (target === "included") {
        onChangeConfig({ polygonIncluded: [...branch.config.polygonIncluded, pt] });
      } else {
        const rings = branch.config.polygonExcluded.map((r) => r.slice());
        if (!rings.length) rings.push([]);
        rings[rings.length - 1].push(pt);
        onChangeConfig({ polygonExcluded: rings });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Redibujar todos los polígonos cuando cambian ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const g = (window as any).google;

    branches.forEach((branch, idx) => {
      const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
      const isActive = branch.id === activeBranchId;
      const prev = polyRefs.current[branch.id] || {};

      // Polígono incluido
      if (prev.included) prev.included.setMap(null);
      let incPoly: any = null;
      if (branch.config.polygonIncluded.length >= 2) {
        incPoly = new g.maps.Polygon({
          paths: branch.config.polygonIncluded,
          map: mapRef.current,
          strokeColor: color,
          fillColor: color,
          fillOpacity: isActive ? 0.18 : 0.08,
          strokeWeight: isActive ? 2.5 : 1.5,
          strokeOpacity: isActive ? 1 : 0.55,
          zIndex: isActive ? 2 : 1,
          editable: isActive,   // muestra los vértices arrastrables en la sucursal activa
          draggable: false,
        });
        // Sincroniza los cambios de vértices al estado React
        if (isActive) {
          const path = incPoly.getPath();
          const syncPath = () => {
            const pts: LatLng[] = [];
            path.forEach((ll: any) => pts.push({ lat: ll.lat(), lng: ll.lng() }));
            onChangeConfig({ polygonIncluded: pts });
          };
          path.addListener("set_at", syncPath);
          path.addListener("insert_at", syncPath);
          path.addListener("remove_at", syncPath);
        }
      }

      // Polígonos excluidos
      if (prev.excluded) prev.excluded.setMap(null);
      let excPoly: any = null;
      const excRings = branch.config.polygonExcluded.filter((r) => r.length >= 2);
      if (excRings.length) {
        excPoly = new g.maps.Polygon({
          paths: excRings,
          map: mapRef.current,
          strokeColor: color,
          fillColor: color,
          fillOpacity: 0.05,
          strokeWeight: 1.5,
          strokeOpacity: isActive ? 0.8 : 0.4,
          zIndex: isActive ? 2 : 1,
          editable: isActive,
          draggable: false,
        });
        if (isActive) {
          const outerPath = excPoly.getPaths();
          const syncExc = () => {
            const rings: LatLng[][] = [];
            outerPath.forEach((ring: any) => {
              const pts: LatLng[] = [];
              ring.forEach((ll: any) => pts.push({ lat: ll.lat(), lng: ll.lng() }));
              rings.push(pts);
            });
            onChangeConfig({ polygonExcluded: rings });
          };
          outerPath.forEach((ring: any) => {
            ring.addListener("set_at", syncExc);
            ring.addListener("insert_at", syncExc);
            ring.addListener("remove_at", syncExc);
          });
        }
      }

      // Marcador de origen
      if (prev.marker) prev.marker.setMap(null);
      let marker: any = null;
      if (branch.config.origin) {
        marker = new g.maps.Marker({
          position: branch.config.origin,
          map: mapRef.current,
          title: branch.branchName || branch.name,
          draggable: isActive,
          zIndex: isActive ? 3 : 2,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: isActive ? 9 : 6,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        if (isActive) {
          marker.addListener("dragend", (e: any) => {
            onChangeConfig({ origin: { lat: e.latLng.lat(), lng: e.latLng.lng() } });
          });
        }
      }

      polyRefs.current[branch.id] = { included: incPoly, excluded: excPoly, marker };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, branches, activeBranchId]);

  // ── Encuadrar vista a todos los polígonos al cargar ──
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!mapReady || !mapRef.current || fittedRef.current) return;
    const g = (window as any).google;
    const pts: LatLng[] = [];
    branches.forEach((b) => {
      pts.push(...b.config.polygonIncluded);
      b.config.polygonExcluded.forEach((r) => pts.push(...r));
      if (b.config.origin) pts.push(b.config.origin);
    });
    if (pts.length < 2) return;
    const bounds = new g.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds);
    fittedRef.current = true;
  }, [mapReady, branches]);

  // Autocomplete de dirección para la sucursal activa
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!mapReady || !searchRef.current) return;
    const g = (window as any).google;
    if (!g.maps.places?.Autocomplete) return;
    const ac = new g.maps.places.Autocomplete(searchRef.current, {
      componentRestrictions: { country: ["cl"] },
      fields: ["formatted_address", "geometry"],
    });
    ac.addListener("place_changed", () => {
      const loc = ac.getPlace()?.geometry?.location;
      if (!loc) return;
      const o: LatLng = { lat: loc.lat(), lng: loc.lng() };
      mapRef.current?.panTo(o);
      mapRef.current?.setZoom(14);
      onChangeConfig({ origin: o, originAddress: ac.getPlace().formatted_address || null });
    });
    searchRef.current.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeBranchId]);

  if (!gmapsKey) {
    return (
      <div style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)" }}>
        Falta la API Key de Google Maps.
      </div>
    );
  }

  const inner = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: fullscreen ? "100%" : undefined }}>

      {/* Leyenda de sucursales + botón fullscreen */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
          {branches.map((b, idx) => {
            const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
            const isActive = b.id === activeBranchId;
            return (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: color, flexShrink: 0, border: isActive ? `2px solid var(--adm-text)` : "2px solid transparent", boxSizing: "border-box" }} />
                <span style={{ fontFamily: isActive ? F : FB, fontWeight: isActive ? 700 : 400, fontSize: "0.78rem", color: isActive ? "var(--adm-text)" : "var(--adm-text3)" }}>
                  {b.branchName || b.name}
                  {isActive && <span style={{ marginLeft: 5, fontSize: "0.68rem", color: ACCENT }}>(editando)</span>}
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: fullscreen ? ACCENT : "var(--adm-hover)", color: fullscreen ? "#1a1a1a" : "var(--adm-text2)", fontFamily: F, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {fullscreen ? <><Minimize2 size={13} /> Salir</> : <><Maximize2 size={13} /> Pantalla completa</>}
        </button>
      </div>

      {/* Mapa */}
      <div ref={mapDiv} style={{ width: "100%", height: fullscreen ? "calc(100vh - 340px)" : 400, minHeight: 280, borderRadius: 14, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", flexShrink: 0 }} />

      {/* Panel de edición — solo sucursal activa */}
      {activeBranch && activeConfig && (
        <div style={{ padding: 16, background: "var(--adm-card)", border: `1.5px solid ${colorOf(activeBranchId)}55`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: colorOf(activeBranchId), margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: colorOf(activeBranchId), display: "inline-block", flexShrink: 0 }} />
            {activeBranch.branchName || activeBranch.name}
            <span style={{ fontFamily: FB, fontWeight: 400, fontSize: "0.75rem", color: "var(--adm-text3)", marginLeft: 2 }}>— zona de reparto</span>
          </p>

          {/* Dirección origen */}
          <div>
            <label style={lbl}>Ubicación del local (origen)</label>
            <input
              key={activeBranchId}
              ref={searchRef}
              defaultValue={activeConfig.originAddress ?? activeBranch.address ?? ""}
              placeholder={ready ? "Busca la dirección del local…" : "Cargando mapa…"}
              style={inp}
            />
            <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>
              Arrastra el marcador en el mapa para ajustar el punto exacto.
            </p>
          </div>

          {/* Controles de dibujo */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setDrawing(drawing === "included" ? null : "included")} style={btn(drawing === "included", colorOf(activeBranchId))}>
              <Pencil size={14} /> {drawing === "included" ? "Terminar zona" : "Dibujar zona de reparto"}
            </button>
            <button onClick={() => { onChangeConfig({ polygonIncluded: [] }); }} style={btnGhost}>
              <Trash2 size={14} /> Limpiar zona
            </button>
            <button
              onClick={() => {
                const next = drawing === "excluded" ? null : "excluded";
                setDrawing(next);
                if (next === "excluded") onChangeConfig({ polygonExcluded: [...activeConfig.polygonExcluded, []] });
              }}
              style={btn(drawing === "excluded", "#ef4444")}
            >
              <Ban size={14} /> {drawing === "excluded" ? "Terminar excluida" : "Agregar zona excluida"}
            </button>
            {activeConfig.polygonExcluded.length > 0 && (
              <button onClick={() => onChangeConfig({ polygonExcluded: [] })} style={btnGhost}>
                <Trash2 size={14} /> Limpiar excluida
              </button>
            )}
          </div>

          {drawing && (
            <p style={{ fontFamily: FB, fontSize: "0.76rem", color: ACCENT, margin: 0 }}>
              Haz clic en el mapa para marcar vértices de la {drawing === "included" ? "zona de reparto" : "zona excluida"}. ({drawing === "included" ? activeConfig.polygonIncluded.length : (activeConfig.polygonExcluded[activeConfig.polygonExcluded.length - 1]?.length ?? 0)} puntos)
            </p>
          )}

          {/* Tarifas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <div>
              <label style={lbl}>Tarifa base</label>
              <input value={activeConfig.basePrice || ""} onChange={(e) => onChangeConfig({ basePrice: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
            </div>
            <div>
              <label style={lbl}>Costo por km</label>
              <input value={activeConfig.pricePerKm || ""} onChange={(e) => onChangeConfig({ pricePerKm: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
            </div>
            <div>
              <label style={lbl}>Redondeo</label>
              <input value={activeConfig.roundingMult || ""} onChange={(e) => onChangeConfig({ roundingMult: Number(e.target.value.replace(/\D/g, "")) || 100 })} inputMode="numeric" placeholder="100" style={inp} />
            </div>
          </div>

          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} style={{ flexShrink: 0 }} /> Costo = tarifa base + (km × costo/km), redondeado. Solo aplica dentro de la zona de reparto.
          </p>

          {/* Botón guardar — solo esta sucursal */}
          <div>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: colorOf(activeBranchId), color: "#fff",
                fontFamily: F, fontSize: "0.82rem", fontWeight: 800,
                cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              <Save size={15} /> {saving ? "Guardando…" : `Guardar ${activeBranch.branchName || activeBranch.name}`}
            </button>
            <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
              Guarda solo la zona de <strong>{activeBranch.branchName || activeBranch.name}</strong>. Las otras sucursales no se modifican.
            </p>
          </div>
        </div>
      )}

      {/* Nota sobre las otras sucursales */}
      {branches.length > 1 && (
        <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
          Las zonas de las otras sucursales ({branches.filter(b => b.id !== activeBranchId).map(b => b.branchName || b.name).join(", ")}) se muestran en el mapa como referencia. Para editarlas, selecciona esa sucursal en el menú superior del panel.
        </p>
      )}
    </div>
  );

  return fullscreen ? (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--adm-bg, #f5f5f5)",
      display: "flex", flexDirection: "column",
      padding: "12px 16px 16px",
      overflowY: "auto",
    }}>
      {/* Botón X para cerrar fullscreen */}
      <button
        onClick={() => setFullscreen(false)}
        style={{ position: "absolute", top: 12, right: 16, zIndex: 1, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
      >
        <X size={14} /> Cerrar
      </button>
      {inner}
    </div>
  ) : inner;
}

const lbl: React.CSSProperties = {
  fontFamily: FB, fontSize: "0.66rem", fontWeight: 700,
  color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4,
  display: "block", marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", boxSizing: "border-box",
  background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))",
  borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none",
};
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px",
  background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)",
  borderRadius: 9, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer",
};
function btn(active: boolean, color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px",
    background: active ? color : "var(--adm-hover)",
    border: `1px solid ${active ? color : "var(--adm-card-border)"}`,
    borderRadius: 9, color: active ? "#fff" : "var(--adm-text)",
    fontFamily: F, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer",
  };
}
