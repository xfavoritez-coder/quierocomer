"use client";

import { useState, useEffect, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import LoyaltyNav from "./LoyaltyNav";

interface LoyaltyProgram {
  id: string;
  restaurantId: string;
  name: string;
  active: boolean;
  stampsRequired: number;
  rewardText: string;
  cardColorHex: string;
  logoUrl: string | null;
  description: string | null;
}

const DEFAULTS = {
  name: "Tarjeta de fidelidad",
  active: false,
  stampsRequired: 10,
  rewardText: "Un producto gratis",
  cardColorHex: "#111111",
  description: "",
};

export default function LoyaltyClient() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurant, loading, error } = usePanelSession();

  const [form, setForm] = useState({ ...DEFAULTS });
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const restaurant = restaurants.find((r) => r.id === selectedRestaurantId);

  // Cargar el programa del restaurante seleccionado
  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingProgram(true);
    setSaved(false);
    setSaveError("");
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((data) => {
        const p: LoyaltyProgram | null = data.program;
        setForm(
          p
            ? {
                name: p.name,
                active: p.active,
                stampsRequired: p.stampsRequired,
                rewardText: p.rewardText,
                cardColorHex: p.cardColorHex,
                description: p.description || "",
              }
            : { ...DEFAULTS },
        );
      })
      .catch(() => setSaveError("No se pudo cargar la configuración."))
      .finally(() => setLoadingProgram(false));
  }, [selectedRestaurantId]);

  const update = useCallback((patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!selectedRestaurantId) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, ...form }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      setSaved(true);
    } catch (e: any) {
      setSaveError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── Estados de carga / error de sesión ──
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Cargando…</p>
      </div>
    );
  }

  if (error || restaurants.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-300">No pudimos verificar tu sesión de restaurante.</p>
        <a href="/panel/login" className="mt-4 text-amber-400 underline">
          Iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-5 py-10 sm:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label="Tarjeta">
              🎟️
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Loyalty</h1>
          </div>
          <p className="mt-2 text-neutral-400 max-w-2xl">
            Configura la tarjeta de sellos que tus clientes guardarán en Apple Wallet y Google Wallet.
            Junta sellos, gana recompensas.
          </p>
        </header>

        <LoyaltyNav />

        {/* Selector de restaurante (solo si hay varios) */}
        {restaurants.length > 1 && (
          <div className="mb-8">
            <label className="block text-sm text-neutral-400 mb-1">Restaurante</label>
            <select
              value={selectedRestaurantId || ""}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loadingProgram ? (
          <p className="text-neutral-500">Cargando configuración…</p>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            {/* ── Formulario ── */}
            <div className="space-y-6">
              {/* Activar */}
              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                <div>
                  <p className="font-medium">Programa activo</p>
                  <p className="text-sm text-neutral-500">
                    Cuando esté activo, tus clientes podrán inscribirse y recibir su tarjeta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => update({ active: !form.active })}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    form.active ? "bg-emerald-500" : "bg-neutral-700"
                  }`}
                  aria-pressed={form.active}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                      form.active ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Nombre del programa</label>
                <input
                  type="text"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => update({ name: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Sellos requeridos */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Sellos para ganar la recompensa
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.stampsRequired}
                  onChange={(e) => update({ stampsRequired: Number(e.target.value) })}
                  className="w-32 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-neutral-500">Entre 1 y 50 sellos.</p>
              </div>

              {/* Recompensa */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Recompensa</label>
                <input
                  type="text"
                  value={form.rewardText}
                  maxLength={120}
                  onChange={(e) => update({ rewardText: e.target.value })}
                  placeholder="Ej: Un producto gratis"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Descripción <span className="text-neutral-600">(opcional)</span>
                </label>
                <textarea
                  value={form.description}
                  maxLength={200}
                  rows={2}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Ej: Válido de lunes a viernes."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Color de la tarjeta */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Color de la tarjeta</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.cardColorHex}
                    onChange={(e) => update({ cardColorHex: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded border border-neutral-700 bg-neutral-900"
                  />
                  <span className="text-neutral-400 text-sm font-mono">{form.cardColorHex}</span>
                </div>
              </div>

              {/* Guardar */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                {saved && <span className="text-emerald-400 text-sm">✓ Guardado</span>}
                {saveError && <span className="text-red-400 text-sm">{saveError}</span>}
              </div>
            </div>

            {/* ── Vista previa de la tarjeta ── */}
            <div className="lg:sticky lg:top-10 h-fit">
              <p className="mb-3 text-sm text-neutral-500">Vista previa</p>
              <CardPreview
                color={form.cardColorHex}
                restaurantName={restaurant?.name || "Tu restaurante"}
                stampsRequired={form.stampsRequired}
                rewardText={form.rewardText}
                description={form.description}
              />
              <p className="mt-3 text-xs text-neutral-600">
                Así se verá aproximadamente en el teléfono del cliente. Ejemplo con 3 sellos.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CardPreview({
  color,
  restaurantName,
  stampsRequired,
  rewardText,
  description,
}: {
  color: string;
  restaurantName: string;
  stampsRequired: number;
  rewardText: string;
  description: string;
}) {
  const demoStamps = Math.min(3, stampsRequired);
  const textColor = isLight(color) ? "#111111" : "#ffffff";
  const subColor = isLight(color) ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)";

  return (
    <div
      className="rounded-2xl p-5 shadow-xl"
      style={{ backgroundColor: color, color: textColor }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide">{restaurantName}</span>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: subColor }}>
          Fidelidad
        </span>
      </div>

      <div className="mt-6 mb-2 text-xs" style={{ color: subColor }}>
        SELLOS
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: Math.max(stampsRequired, 1) }).map((_, i) => {
          const filled = i < demoStamps;
          return (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-full text-sm"
              style={{
                border: `1.5px solid ${textColor}`,
                backgroundColor: filled ? textColor : "transparent",
                color: filled ? color : textColor,
                opacity: filled ? 1 : 0.5,
              }}
            >
              {filled ? "★" : ""}
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t pt-3" style={{ borderColor: subColor }}>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: subColor }}>
          Recompensa
        </div>
        <div className="text-sm font-medium">{rewardText || "—"}</div>
        {description && (
          <div className="mt-1 text-xs" style={{ color: subColor }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

// Determina si un color hex es claro (para elegir texto oscuro/claro encima).
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Luminancia percibida
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}
