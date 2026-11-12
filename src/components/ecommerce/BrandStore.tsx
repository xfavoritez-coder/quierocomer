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
import ModernStoreFront from "./ModernStoreFront";
import type { BrandData, BrandBranch, StorefrontData } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { useGoogleMaps } from "@/lib/ecommerce/useGoogleMaps";
import { computeDistanceFee } from "@/lib/ecommerce/delivery";
import { clp } from "@/lib/ecommerce/format";
import { formatPlaceAddress, placeAddressParts, type AddressParts } from "@/lib/ecommerce/address";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function BrandStore({ brand, representative, basePath, initialProductSlug, themeOverride }: { brand: BrandData; representative: StorefrontData; basePath?: string; initialProductSlug?: string; themeOverride?: string }) {
  const [data, setData] = useState<StorefrontData>(representative);
  const [branchSlug, setBranchSlug] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [resolving, setResolving] = useState(true); // true hasta que se resuelva la sucursal guardada

  const adoptRestaurant = useCartStore((s) => s.adoptRestaurant);
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress);
  const confirmPickup = useCartStore((s) => s.confirmPickup);

  const PERSIST_KEY = `qc-brand-branch:${brand.brandSlug}`;
  const COOKIE_KEY = `qc-bb:${brand.brandSlug}`;
  const saveBranch = useCallback((slug: string) => {
    try { localStorage.setItem(PERSIST_KEY, slug); } catch {}
    try { document.cookie = `${COOKIE_KEY}=${slug}; path=/; max-age=86400; SameSite=Lax`; } catch {}
  }, [PERSIST_KEY, COOKIE_KEY]);
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
        if (!bd) { setResolving(false); return; }
        adoptRestaurant(bd.tenant.id, bd.products);
        saveBranch(only.slug);
        setData(bd); setBranchSlug(only.slug);
        setResolving(false);
      })();
      return;
    }
    if (!saved) { setResolving(false); return; }
    const br = brand.branches.find((b) => b.slug === saved);
    if (!br) { try { localStorage.removeItem(PERSIST_KEY); } catch {} setResolving(false); return; }
    (async () => {
      const bd = br.slug === representative.tenant.slug ? representative : await fetchStorefront(br.slug);
      if (!bd) { setResolving(false); return; }
      adoptRestaurant(bd.tenant.id, bd.products); // carrito ya ligado → solo re-cotiza
      saveBranch(br.slug);
      setData(bd);
      setBranchSlug(br.slug);
      setResolving(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirmar una sucursal: carga su catálogo, re-liga el carrito y fija la entrega.
  const choose = useCallback(async (branch: BrandBranch, mode: "delivery" | "pickup", addr?: { address: string; details: string; lat: number | null; lng: number | null; fee: number; parts?: AddressParts | null }) => {
    setSwitching(true);
    try {
      const bd = branch.slug === data.tenant.slug ? data : await fetchStorefront(branch.slug);
      if (!bd) { toast.error("No pudimos cargar esa sucursal. Intenta de nuevo."); return; }
      adoptRestaurant(bd.tenant.id, bd.products);
      if (mode === "delivery" && addr) setDeliveryAddress({ ...addr, zoneName: null, minOrder: bd.tenant.minOrderDelivery || null });
      else if (mode === "pickup") confirmPickup();
      setData(bd);
      setBranchSlug(branch.slug);
      saveBranch(branch.slug);
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

  // Si la sucursal actual está cerrada, buscar una alternativa abierta para sugerirla
  const openBranchLabel = useMemo(() => {
    if (data.tenant.openStatus.open) return null;
    const alt = brand.branches.find((b) => b.slug !== branchSlug && b.open);
    return alt ? (alt.branchName || alt.name) : null;
  }, [data.tenant.openStatus.open, brand.branches, branchSlug]);

  const brandControls: BrandControls = {
    hasBranch: !!branchSlug,
    branchLabel,
    onRequireBranch: () => setPickerOpen(true),
    resolving,
    openBranchLabel,
  };

  return (
    <>
      {(themeOverride ?? data.tenant.theme) === "modern" ? (
        <ModernStoreFront
          key={data.tenant.id}
          tenant={data.tenant}
          categories={data.categories}
          products={data.products}
          brandControls={brandControls}
          basePath={basePath}
          siblings={brand.branches}
          initialProductSlug={resolving ? undefined : initialProductSlug}
        />
      ) : (
        <StoreFront
          key={data.tenant.id}
          tenant={data.tenant}
          categories={data.categories}
          products={data.products}
          brandControls={brandControls}
          basePath={basePath}
          initialProductSlug={resolving ? undefined : initialProductSlug}
        />
      )}
      {pickerOpen && (
        <BranchPicker
          brand={brand}
          currentSlug={branchSlug}
          switching={switching}
          fetchStorefront={fetchStorefront}
          onChoose={choose}
          onClose={() => setPickerOpen(false)}
          variant={(themeOverride ?? data.tenant.theme) === "modern" ? "modern" : "default"}
        />
      )}
    </>
  );
}

// ── Modal: elegir sucursal (delivery por dirección → más cercana · retiro) ──
function BranchPicker({ brand, currentSlug, switching, fetchStorefront, onChoose, onClose, variant = "default" }: {
  brand: BrandData;
  currentSlug: string | null;
  switching: boolean;
  fetchStorefront: (slug: string) => Promise<StorefrontData | null>;
  onChoose: (branch: BrandBranch, mode: "delivery" | "pickup", addr?: { address: string; details: string; lat: number | null; lng: number | null; fee: number; parts?: AddressParts | null }) => void;
  onClose: () => void;
  variant?: "default" | "modern";
}) {
  const modern = variant === "modern";
  const accent = brand.branches[0]?.primaryColor || "#F4A623";
  const hasDelivery = brand.branches.some((b) => b.deliveryEnabled);
  const hasPickup = brand.branches.some((b) => b.pickupEnabled);
  const currentType = useCartStore((s) => s.deliveryType);
  const currentSelected = useCartStore((s) => s.deliverySelected);
  const [tab, setTab] = useState<"delivery" | "pickup">(currentSelected && currentType === "pickup" && hasPickup ? "pickup" : hasDelivery ? "delivery" : "pickup");
  const gmapsReady = useGoogleMaps(tab === "delivery" ? brand.googleMapsKey : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; address: string; parts: AddressParts; hasNumber: boolean } | null>(null);
  const [details, setDetails] = useState("");

  // Evalúa TODAS las sucursales con delivery para la dirección escrita y determina
  // cuáles la CUBREN (su zona de reparto la incluye), con su costo. Así no se elige
  // la más cercana en línea recta, sino la que realmente puede repartir ahí.
  //  distance → se verifica el polígono localmente (computeDistanceFee).
  //  uber     → se cotiza en vivo (si cotiza, cubre).
  //  zones    → no se puede geo-verificar por lat/lng (depende de la comuna); se trata
  //             como candidata "por confirmar comuna" en la tienda.
  type BranchEval = { branch: BrandBranch; available: boolean; fee: number; mode: string; reason?: string; km: number };
  const [evals, setEvals] = useState<BranchEval[] | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    if (!dest) { setEvals(null); return; }
    let cancelled = false;
    (async () => {
      setEvalLoading(true); setEvals(null);
      const cands = brand.branches.filter((b) => b.deliveryEnabled);
      const results = await Promise.all(cands.map(async (branch): Promise<BranchEval> => {
        const km = branch.lat != null && branch.lng != null ? haversineKm(dest, { lat: branch.lat, lng: branch.lng }) : Number.POSITIVE_INFINITY;
        const bd = await fetchStorefront(branch.slug);
        if (!bd) return { branch, available: false, fee: 0, mode: "", reason: "No se pudo cargar", km };
        const mode = bd.tenant.deliveryConfig.mode;
        if (mode === "distance") {
          const r = computeDistanceFee(bd.tenant.deliveryConfig, dest);
          return { branch, available: r.available, fee: r.fee, mode, reason: r.reason, km };
        }
        if (mode === "uber") {
          try {
            const q = await fetch("/api/ecommerce/delivery/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: bd.tenant.id, address: dest.address, lat: dest.lat, lng: dest.lng }) });
            const j = await q.json().catch(() => ({}));
            return q.ok && j.ok ? { branch, available: true, fee: j.fee, mode, km } : { branch, available: false, fee: 0, mode, reason: j.error || "Sin cobertura", km };
          } catch { return { branch, available: false, fee: 0, mode, reason: "No se pudo cotizar", km }; }
        }
        // zones: candidata (se confirma la comuna en la tienda).
        return { branch, available: true, fee: 0, mode, km };
      }));
      if (!cancelled) { setEvals(results); setEvalLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [dest, brand.branches, fetchStorefront]);

  // Mejor sucursal: entre las que CUBREN la dirección, la de menor costo (desempata
  // por cercanía). Si ninguna cubre, no hay opción de delivery para esa dirección.
  const chosen = useMemo<BranchEval | null>(() => {
    if (!evals) return null;
    const ok = evals.filter((e) => e.available).sort((a, b) => a.fee - b.fee || a.km - b.km);
    return ok[0] ?? null;
  }, [evals]);
  const noCoverage = !!evals && evals.length > 0 && !chosen;

  useEffect(() => {
    if (tab !== "delivery" || !gmapsReady || !inputRef.current) return;
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const ac = new g.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: ["cl"] }, types: ["address"], fields: ["formatted_address", "address_components", "geometry"] });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) return;
      const cleanAddr = formatPlaceAddress(place, inputRef.current!.value);
      // ¿La dirección elegida trae numeración de calle? (componente street_number).
      const hasNumber = Array.isArray(place?.address_components) && place.address_components.some((c: { types?: string[] }) => c.types?.includes("street_number"));
      setDest({ lat: loc.lat(), lng: loc.lng(), address: cleanAddr, parts: placeAddressParts(place, inputRef.current!.value), hasNumber });
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
    if (!chosen || !dest || !chosen.available || !dest.hasNumber) return;
    // zones: sin costo aquí → el cliente elige comuna en la tienda (deliveryType se
    // queda sin seleccionar hasta ese paso). onChoose en modo delivery SIN dirección
    // adopta la sucursal pero no fija la entrega (el selector normal la pedirá).
    if (chosen.mode === "zones") { onChoose(chosen.branch, "delivery"); return; }
    onChoose(chosen.branch, "delivery", { address: dest.address, details: details.trim(), lat: dest.lat, lng: dest.lng, fee: chosen.fee, parts: dest.parts });
  }

  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "11px", borderRadius: modern ? 999 : 12, border: `1px solid ${on ? "transparent" : "#e5e7eb"}`, background: on ? accent : "#fff", color: on ? "#fff" : "#374151", fontWeight: modern ? 700 : 800, fontSize: "0.9rem", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 py-6" style={{ fontFamily: modern ? "'DM Sans',system-ui,-apple-system,Segoe UI,Roboto,Arial" : "system-ui,-apple-system,Segoe UI,Roboto,Arial" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: modern ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.5)" }} />
      <div className="relative w-full" style={{ maxWidth: 420, background: "#fff", borderRadius: modern ? 16 : 24, padding: modern ? 24 : 18, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: modern ? "flex-start" : "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: modern ? "1.1rem" : "1.15rem", fontWeight: modern ? 700 : 900, color: "#111", margin: 0 }}>¿Cómo quieres tu pedido?</h2>
            {modern && <p style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: 2 }}>Elige delivery o retiro en tienda</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, border: modern ? "1px solid #e5e7eb" : "none", background: modern ? "#fff" : "#f3f4f6", color: modern ? "#9ca3af" : "#374151", cursor: "pointer", flexShrink: 0 }}><X size={modern ? 16 : 18} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {hasDelivery && <button onClick={() => setTab("delivery")} style={tabBtn(tab === "delivery")}><Bike size={17} /> Delivery</button>}
          {hasPickup && <button onClick={() => setTab("pickup")} style={tabBtn(tab === "pickup")}><Store size={17} /> Retiro</button>}
        </div>

        {tab === "delivery" ? (
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Tu dirección</label>
            <input ref={inputRef} placeholder={gmapsReady ? "Escribe tu dirección…" : "Cargando mapa…"} style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "6px 2px 0" }}>Elige una opción de la lista: te asignamos la sucursal que reparte a tu dirección.</p>
            {dest && !dest.hasNumber && <p style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 700, margin: "8px 2px 0" }}>Falta la numeración: elige la dirección con su número de calle.</p>}
            {!brand.googleMapsKey && <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: "8px 2px 0" }}>La marca aún no configuró Google Maps.</p>}
            {dest && (
              <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Depto / casa / referencia (opcional)" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", boxSizing: "border-box", marginTop: 10 }} />
            )}
            {dest && evalLoading && <p style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "12px 2px 0" }}>Buscando sucursal que reparta a tu dirección…</p>}
            {dest && !evalLoading && noCoverage && (
              <p style={{ fontSize: "0.85rem", color: "#ef4444", margin: "12px 2px 0", fontWeight: 600 }}>Ninguna sucursal reparte a esta dirección. Prueba con <b>Retiro</b> o con otra dirección.</p>
            )}
            {chosen && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: `1px solid ${accent}55`, background: `${accent}10` }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Tu sucursal</p>
                <p style={{ fontSize: "1.05rem", fontWeight: 900, color: "#111", margin: "3px 0 1px" }}>{chosen.branch.branchName || chosen.branch.name}{!chosen.branch.open ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444", marginLeft: 8 }}>Cerrada ahora</span> : null}</p>
                {chosen.branch.address && <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 10px" }}>{chosen.branch.address}</p>}
                {chosen.mode !== "zones" && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", margin: "0 2px 10px" }}>
                    <span style={{ color: "#6b7280" }}>Costo de despacho</span>
                    <span style={{ fontWeight: 900, color: accent }}>{chosen.fee > 0 ? clp(chosen.fee) : "Gratis"}</span>
                  </div>
                )}
                <button onClick={confirmDelivery} disabled={evalLoading || switching || !dest?.hasNumber} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: dest?.hasNumber ? "pointer" : "not-allowed", opacity: evalLoading || switching || !dest?.hasNumber ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {switching ? <Loader2 size={16} className="animate-spin" /> : null}
                  Continuar con {chosen.branch.branchName || chosen.branch.name} →
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
                  {!b.open
                    ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: b.opensAt ? "#d97706" : "#ef4444" }}>{b.opensAt ? `Abre a las ${b.opensAt}` : "Cerrada ahora"}</span>
                    : <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16a34a" }}>Abierta</span>
                  }
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
