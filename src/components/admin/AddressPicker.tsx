"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

const MapView = dynamic(() => import("@/app/a/components/LocationMapView"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text3)", fontSize: 13 }}>
      Cargando mapa…
    </div>
  ),
});

interface Suggestion {
  place_id: string | number;
  display_name: string;
  lat?: string;
  lon?: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 8,
  color: "var(--adm-text)",
  fontFamily: FB,
  fontSize: "0.88rem",
  outline: "none",
};

export default function AddressPicker({
  address,
  lat,
  lng,
  onChange,
}: {
  address: string;
  lat: number | null;
  lng: number | null;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
}) {
  // Campo de texto libre — el usuario escribe lo que quiere guardar
  const [addressText, setAddressText] = useState(address);
  // Campo de búsqueda para coordenadas (separado del texto)
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setAddressText(address); }, [address]);

  const onAddressChange = (val: string) => {
    setAddressText(val);
    onChange(val, lat, lng);
  };

  const onSearchType = (val: string) => {
    setSearchQ(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 3) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(val)}&all=1`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  const select = async (s: Suggestion) => {
    setOpen(false);
    try {
      let la: number | null = null;
      let ln: number | null = null;
      if (s.lat && s.lat !== "0") {
        la = Number(s.lat);
        ln = Number(s.lon);
      } else {
        const res = await fetch(`/api/geo/place?place_id=${encodeURIComponent(String(s.place_id))}`);
        const d = await res.json();
        if (d) { la = Number(d.lat); ln = Number(d.lon); }
      }
      // Solo actualiza coords; el texto de la dirección se mantiene como el usuario lo escribió
      onChange(addressText, la, ln);
      setSearchQ("");
      setResults([]);
    } catch { /* noop */ }
  };

  const handleDrag = async (la: number, ln: number) => {
    onChange(addressText, la, ln);
    try {
      const res = await fetch(`/api/geo/reverse?lat=${la}&lng=${ln}`);
      const d = await res.json();
      if (d?.display_name) {
        setAddressText(d.display_name);
        onChange(d.display_name, la, ln);
      }
    } catch { /* mantiene coords */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Campo de texto libre */}
      <div>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px" }}>
          Texto de la dirección — escribe exactamente como quieres que aparezca
        </p>
        <input
          value={addressText}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Ej: Avenida Providencia 2550, Providencia"
          style={inputStyle}
          autoComplete="off"
        />
      </div>

      {/* Buscador para ubicar en el mapa (separado del texto) */}
      <div>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px" }}>
          Buscar en el mapa para fijar coordenadas <span style={{ opacity: 0.6 }}>(escribe la calle, sin número)</span>
        </p>
        <div style={{ position: "relative" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color="var(--adm-text3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={searchQ}
              onChange={(e) => onSearchType(e.target.value)}
              onFocus={() => results.length && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Ej: Avenida Providencia, Providencia"
              style={{ ...inputStyle, paddingLeft: 32 }}
              autoComplete="off"
            />
          </div>
          {open && results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1500, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
              {results.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(s)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem" }}
                >
                  <MapPin size={14} color="var(--adm-text3)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {loadingSearch && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>Buscando…</p>}
      </div>

      {/* Mapa */}
      {lat != null && lng != null ? (
        <>
          <div style={{ position: "relative", zIndex: 0, height: 200, borderRadius: 10, overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
            <MapView lat={lat} lng={lng} onDragEnd={handleDrag} />
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
            📍 Arrastra el pin para ajustar la ubicación exacta.
          </p>
        </>
      ) : (
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
          Busca la calle arriba para fijar el pin en el mapa.
        </p>
      )}
    </div>
  );
}
