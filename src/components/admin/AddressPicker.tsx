"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

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
  const [q, setQ] = useState(address);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(address), [address]);

  const onType = (val: string) => {
    setQ(val);
    onChange(val, lat, lng);
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(val)}&all=1`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  // Arrastrar el pin → actualizar coords y (por geocodificación inversa) la dirección
  const handleDrag = async (la: number, ln: number) => {
    onChange(q, la, ln);
    try {
      const res = await fetch(`/api/geo/reverse?lat=${la}&lng=${ln}`);
      const d = await res.json();
      if (d?.display_name) {
        setQ(d.display_name);
        onChange(d.display_name, la, ln);
      }
    } catch {
      /* mantiene las coords aunque falle el texto */
    }
  };

  const select = async (s: Suggestion) => {
    setOpen(false);
    const userText = q; // conservar lo que escribió el usuario (puede incluir número)
    try {
      let la: number | null = null;
      let ln: number | null = null;
      if (s.lat && s.lat !== "0") {
        la = Number(s.lat);
        ln = Number(s.lon);
      } else {
        const res = await fetch(`/api/geo/place?place_id=${encodeURIComponent(String(s.place_id))}`);
        const d = await res.json();
        if (d) {
          la = Number(d.lat);
          ln = Number(d.lon);
        }
      }
      // Mantener el texto que escribió el usuario; solo actualizar las coords
      onChange(userText, la, ln);
    } catch {
      /* noop */
    }
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          value={q}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Escribe tu dirección…"
          style={inputStyle}
          autoComplete="off"
        />
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

      {loading && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>Buscando…</p>}

      {lat != null && lng != null ? (
        <>
          <div style={{ position: "relative", zIndex: 0, height: 200, marginTop: 10, borderRadius: 10, overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
            <MapView lat={lat} lng={lng} onDragEnd={handleDrag} />
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
            📍 Arrastra el pin para ajustar la ubicación exacta. Estas coordenadas se usan para las notificaciones por cercanía.
          </p>
        </>
      ) : (
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>
          Busca y selecciona tu dirección para fijar la ubicación en el mapa.
        </p>
      )}
    </div>
  );
}
