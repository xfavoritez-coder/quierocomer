"use client";
// ═══════════════════════════════════════════════════════════
//  Tienda de MARCA (multisucursal) — /ecommerce/marca/<brand>
//  Muestra el menú compartido directo (catálogo de una sucursal "representante")
//  en un único enlace. La sucursal se elige recién al querer agregar algo:
//  dirección → sucursal más cercana (delivery) o elegir sucursal (retiro).
//  Al elegir, carga el catálogo real de esa sucursal, re-liga el carrito
//  (adoptRestaurant) y sigue el flujo normal, SIN cambiar de URL. El checkout
//  sí navega a /ecommerce/<sucursal>/checkout (reutiliza el checkout existente).
// ═══════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bike, Store, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import StoreFront, { type BrandControls } from "./StoreFront";
import type { BrandData, BrandBranch, StorefrontData } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import { computeDistanceFee } from "@/lib/ecommerce/delivery";
import { clp } from "@/lib/ecommerce/format";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function BrandStore({ brand, representative }: { brand: BrandData; representative: StorefrontData }) {
  const [data, setData] = useState<StorefrontData>(representative);
  const [branchSlug, setBranchSlug] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const adoptRestaurant = useCartStore((s) => s.adoptRestaurant);
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress);
  const confirmPickup = useCartStore((s) => s.confirmPickup);

  const PERSIST_KEY = `qc-brand-branch:${brand.brandSlug}`;
  const cache = useRef<Map<string, StorefrontData>>(new Map());
  cache.current.set(representative.tenant.slug, representative);

  const fetchStorefront = useCallback(async (slug: string): Promise<StorefrontData | null> => {
    const hit = cache.current.get(slug);
    if (hit) return hit;
    try {
      const r = await fetch(`/api/ecommerce/storefront/${encodeURIComponent(slug)}`);
      if (!r.ok) return null;
      const d = (await r.json()) as StorefrontData;
      cache.current.set(slug, d);
      return d;
    } catch { return null; }
  }, []);

  // Al montar: limpiar un carrito que haya quedado de otro restaurante ajeno a esta
  // marca, y restaurar la sucursal elegida antes (si la hay) cargando su catálogo.
  useEffect(() => {
    const ids = new Set(brand.branches.map((b) => b.id));
    const rid = useCartStore.getState().restaurantId;
    if (rid && !ids.has(rid)) useCartStore.getState().clearCart();

    let saved: string | null = null;
    try { saved = localStorage.getItem(PERSIST_KEY); } catch {}

    // Marca de una sola sucursal: no tiene sentido pedir que elijan — se liga sola
    // y la tienda se comporta como una normal (el selector de entrega es el de esa
    // sucursal). No fijamos delivery/retiro: eso lo elige el cliente al pedir.
    if (!saved && brand.branches.length === 1) {
      const only = brand.branches[0];
      (async () => {
        const bd = only.slug === representative.tenant.slug ? representative : await fetchStorefront(only.slug);
        if (!bd) return;
        adoptRestaurant(bd.tenant.id, bd.products);
        setData(bd); setBranchSlug(only.slug);
      })();
      return;
    }
    if (!saved) return;
    const br = brand.branches.find((b) => b.slug === saved);
    if (!br) { try { localStorage.removeItem(PERSIST_KEY); } catch {} return; }
    (async () => {
      const bd = br.slug === representative.tenant.slug ? representative : await fetchStorefront(br.slug);
      if (!bd) return;
      adoptRestaurant(bd.tenant.id, bd.products); // carrito ya ligado → solo re-cotiza
      setData(bd);
      setBranchSlug(br.slug);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirmar una sucursal: carga su catálogo, re-liga el carrito y fija la entrega.
  const choose = useCallback(async (branch: BrandBranch, mode: "delivery" | "pickup", addr?: { address: string; details: string; lat: number | null; lng: number | null; fee: number }) => {
    setSwitching(true);
    try {
      const bd = branch.slug === data.tenant.slug ? data : await fetchStorefront(branch.slug);
      if (!bd) { toast.error("No pudimos cargar esa sucursal. Intenta de nuevo."); return; }
      adoptRestaurant(bd.tenant.id, bd.products);
      if (mode === "delivery" && addr) setDeliveryAddress({ ...addr, zoneName: null, minOrder: bd.tenant.minOrderDelivery || null });
      else if (mode === "pickup") confirmPickup();
      setData(bd);
      setBranchSlug(branch.slug);
      try { localStorage.setItem(PERSIST_KEY, branch.slug); } catch {}
      setPickerOpen(false);
      toast.success(`Pidiendo en ${branch.branchName || branch.name}`);
    } finally {
      setSwitching(false);
    }
  }, [data, fetchStorefront, adoptRestaurant, setDeliveryAddress, confirmPickup, PERSIST_KEY]);

  const branchLabel = useMemo(() => {
    const br = brand.branches.find((b) => b.slug === branchSlug);
    return br ? (br.branchName || br.name) : null;
  }, [branchSlug, brand.branches]);

  const brandControls: BrandControls = {
    hasBranch: !!branchSlug,
    branchLabel,
    onRequireBranch: () => setPickerOpen(true),
  };

  return (
    <>
      <StoreFront
        key={data.tenant.id}
        tenant={data.tenant}
        categories={data.categories}
        products={data.products}
        brandControls={brandControls}
      />
      {pickerOpen && (
        <BranchPicker
          brand={brand}
          currentSlug={branchSlug}
          switching={switching}
          fetchStorefront={fetchStorefront}
          onChoose={choose}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ── Modal: elegir sucursal (delivery por dirección → más cercana · retiro) ──
function BranchPicker({ brand, currentSlug, switching, fetchStorefront, onChoose, onClose }: {
  brand: BrandData;
  currentSlug: string | null;
  switching: boolean;
  fetchStorefront: (slug: string) => Promise<StorefrontData | null>;
  onChoose: (branch: BrandBranch, mode: "delivery" | "pickup", addr?: { address: string; details: string; lat: number | null; lng: number | null; fee: number }) => void;
  onClose: () => void;
}) {
  const accent = brand.branches[0]?.primaryColor || "#F4A623";
  const hasDelivery = brand.branches.some((b) => b.deliveryEnabled);
  const hasPickup = brand.branches.some((b) => b.pickupEnabled);
  const [tab, setTab] = useState<"delivery" | "pickup">(hasDelivery ? "delivery" : "pickup");
  const gmapsReady = useGoogleMaps(tab === "delivery" ? brand.googleMapsKey : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [details, setDetails] = useState("");

  // Sucursal de delivery más cercana al destino (por distancia geográfica).
  const nearest = useMemo<BrandBranch | null>(() => {
    if (!dest) return null;
    const cand = brand.branches.filter((b) => b.deliveryEnabled && b.lat != null && b.lng != null);
    if (!cand.length) return null;
    return cand.map((b) => ({ b, km: haversineKm(dest, { lat: b.lat!, lng: b.lng! }) })).sort((a, z) => a.km - z.km)[0].b;
  }, [dest, brand.branches]);

  // Costo de despacho de la sucursal más cercana (para mostrarlo antes de confirmar).
  // distance → se calcula localmente; uber → se cotiza en vivo; zones → se elige la
  // comuna después, en la tienda (no se resuelve aquí).
  const [fee, setFee] = useState<{ available: boolean; fee: number; mode: string; reason?: string } | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  useEffect(() => {
    if (!nearest || !dest) { setFee(null); return; }
    let cancelled = false;
    (async () => {
      setFeeLoading(true); setFee(null);
      const bd = await fetchStorefront(nearest.slug);
      if (cancelled) return;
      if (!bd) { setFee({ available: false, fee: 0, mode: "", reason: "No pudimos cargar la sucursal" }); setFeeLoading(false); return; }
      const mode = bd.tenant.deliveryConfig.mode;
      if (mode === "distance") {
        const r = computeDistanceFee(bd.tenant.deliveryConfig, dest);
        setFee({ available: r.available, fee: r.fee, mode, reason: r.reason });
      } else if (mode === "uber") {
        try {
          const q = await fetch("/api/ecommerce/delivery/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: bd.tenant.id, address: dest.address, lat: dest.lat, lng: dest.lng }) });
          const j = await q.json().catch(() => ({}));
          if (!cancelled) setFee(q.ok && j.ok ? { available: true, fee: j.fee, mode } : { available: false, fee: 0, mode, reason: j.error || "No se pudo cotizar el despacho" });
        } catch { if (!cancelled) setFee({ available: false, fee: 0, mode, reason: "No se pudo cotizar el despacho" }); }
      } else {
        // zones: la comuna/costo se eligen en la tienda al confirmar la dirección.
        setFee({ available: true, fee: 0, mode });
      }
      if (!cancelled) setFeeLoading(false);
    })();
    return () => { cancelled = true; };
  }, [nearest, dest, fetchStorefront]);

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function confirmDelivery() {
    if (!nearest || !dest || !fee?.available) return;
    // zones: sin costo aquí → el cliente elige comuna en la tienda (deliveryType se
    // queda sin seleccionar hasta ese paso). onChoose en modo delivery SIN dirección
    // adopta la sucursal pero no fija la entrega (el selector normal la pedirá).
    if (fee.mode === "zones") { onChoose(nearest, "delivery"); return; }
    onChoose(nearest, "delivery", { address: dest.address, details: details.trim(), lat: dest.lat, lng: dest.lng, fee: fee.fee });
  }

  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "11px", borderRadius: 12, border: `1px solid ${on ? "transparent" : "#e5e7eb"}`, background: on ? accent : "#fff", color: on ? "#fff" : "#374151", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 460, background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: "90vh", overflowY: "auto" }} className="sm:!rounded-3xl sm:mb-6">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#111", margin: 0 }}>¿Dónde quieres pedir?</h2>
            <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "2px 0 0" }}>Elige tu sucursal de {brand.brandName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "#f3f4f6", color: "#374151", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {hasDelivery && <button onClick={() => setTab("delivery")} style={tabBtn(tab === "delivery")}><Bike size={17} /> Delivery</button>}
          {hasPickup && <button onClick={() => setTab("pickup")} style={tabBtn(tab === "pickup")}><Store size={17} /> Retiro</button>}
        </div>

        {tab === "delivery" ? (
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Tu dirección</label>
            <input ref={inputRef} placeholder={gmapsReady ? "Escribe tu dirección…" : "Cargando mapa…"} style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "6px 2px 0" }}>Elige una opción de la lista: te asignamos la sucursal más cercana.</p>
            {!brand.googleMapsKey && <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: "8px 2px 0" }}>La marca aún no configuró Google Maps.</p>}
            {nearest && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: `1px solid ${accent}55`, background: `${accent}10` }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Tu sucursal</p>
                <p style={{ fontSize: "1.05rem", fontWeight: 900, color: "#111", margin: "3px 0 1px" }}>{nearest.branchName || nearest.name}{!nearest.open ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444", marginLeft: 8 }}>Cerrada ahora</span> : null}</p>
                {nearest.address && <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 10px" }}>{nearest.address}</p>}
                <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Depto / casa / referencia (opcional)" style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
                {feeLoading && <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0 0 8px" }}>Cotizando despacho…</p>}
                {fee && !fee.available && <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 8px" }}>{fee.reason || "Fuera de la zona de reparto"}</p>}
                {fee?.available && fee.mode !== "zones" && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", margin: "0 2px 10px" }}>
                    <span style={{ color: "#6b7280" }}>Costo de despacho</span>
                    <span style={{ fontWeight: 900, color: accent }}>{fee.fee > 0 ? clp(fee.fee) : "Gratis"}</span>
                  </div>
                )}
                <button onClick={confirmDelivery} disabled={!fee?.available || feeLoading || switching} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer", opacity: !fee?.available || feeLoading || switching ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {switching ? <Loader2 size={16} className="animate-spin" /> : null}
                  Continuar con {nearest.branchName || nearest.name} →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {brand.branches.filter((b) => b.pickupEnabled).map((b) => (
              <button key={b.id} onClick={() => onChoose(b, "pickup")} disabled={switching} style={{ textAlign: "left", background: b.slug === currentSlug ? `${accent}10` : "#fff", border: `1px solid ${b.slug === currentSlug ? `${accent}55` : "#eee"}`, borderRadius: 14, padding: 14, cursor: "pointer", opacity: switching ? 0.6 : 1 }}>
                <p style={{ fontSize: "1rem", fontWeight: 800, color: "#111", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <Store size={15} style={{ color: accent }} /> {b.branchName || b.name}
                  {!b.open ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444" }}>Cerrada ahora</span> : <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16a34a" }}>Abierta</span>}
                </p>
                {b.address && <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "2px 0 0 21px" }}>{b.address}</p>}
              </button>
            ))}
            {!hasPickup && <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Ninguna sucursal tiene retiro habilitado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
