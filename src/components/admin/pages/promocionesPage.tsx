"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const GOLD = "#F4A623";

const DAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];
const DAY_LABELS_FULL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function parseCLP(v: string): number | null {
  if (!v) return null;
  const clean = v.replace(/\./g, "").replace(/,/g, "");
  const n = parseInt(clean, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function isPromoActiveToday(p: Promo): boolean {
  if (p.status !== "ACTIVE") return false;
  const now = new Date();
  if (p.validFrom && new Date(p.validFrom) > now) return false;
  if (p.validUntil && new Date(p.validUntil) < now) return false;
  if (p.daysOfWeek && p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(now.getDay())) return false;
  return true;
}

interface Promo {
  id: string;
  name: string;
  status: string;
  dishId?: string | null;
  promoName?: string | null;
  promoPrice?: number | null;
  originalPrice?: number | null;
  daysOfWeek?: number[];
  validFrom?: string | null;
  validUntil?: string | null;
  dishes?: { id: string; name: string; price: number; photos: string[] }[];
  // legacy fields — present but ignored
  dishIds?: string[];
  linkedDishId?: string | null;
  hideOriginalWhenActive?: boolean;
  promoType?: string;
  imageUrl?: string | null;
  position?: number;
}

type FilterTab = "all" | "active" | "paused";

const EMPTY_FORM = {
  name: "",
  dishId: "",
  promoName: "",
  promoPrice: "",
  originalPrice: "",
  daysOfWeek: [] as number[],
  validFrom: "",
  validUntil: "",
};

type PromoForm = typeof EMPTY_FORM;

function DayChips({
  days,
  today,
  onChange,
  readonly,
}: {
  days: number[];
  today?: number;
  onChange?: (d: number[]) => void;
  readonly?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {DAY_LABELS.map((label, i) => {
        const active = days.includes(i);
        const isToday = today === i;
        if (readonly) {
          return (
            <span
              key={i}
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                fontWeight: 600,
                background: active
                  ? isToday
                    ? "#4ade80"
                    : "var(--adm-hover)"
                  : "transparent",
                color: active
                  ? isToday
                    ? "#000"
                    : "var(--adm-text)"
                  : "var(--adm-text2)",
                border: "1px solid",
                borderColor: active ? (isToday ? "#4ade80" : "var(--adm-border)") : "var(--adm-border)",
                opacity: active ? 1 : 0.4,
              }}
            >
              {label}
            </span>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (!onChange) return;
              onChange(active ? days.filter((d) => d !== i) : [...days, i]);
            }}
            style={{
              fontSize: 12,
              padding: "4px 9px",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: active ? GOLD : "var(--adm-border)",
              background: active ? `${GOLD}22` : "var(--adm-hover)",
              color: active ? GOLD : "var(--adm-text2)",
            }}
          >
            {DAY_LABELS_FULL[i]}
          </button>
        );
      })}
    </div>
  );
}

function DishSearchPicker({
  dishes,
  selectedId,
  onSelect,
}: {
  dishes: { id: string; name: string; price: number; photos: string[] }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const selected = dishes.find((d) => d.id === selectedId);
  const filtered = q
    ? dishes.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
    : dishes.slice(0, 20);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {selected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: "var(--adm-hover)",
            border: `1px solid ${GOLD}`,
          }}
        >
          {selected.photos?.[0] && (
            <img
              src={selected.photos[0]}
              alt=""
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
            />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{selected.name}</span>
          <button
            type="button"
            onClick={() => onSelect("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--adm-text2)",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {!selected && (
        <>
          <input
            type="text"
            placeholder="Buscar plato..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
              color: "var(--adm-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
            }}
          >
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onSelect(d.id); setQ(""); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--adm-text)",
                }}
              >
                {d.photos?.[0] && (
                  <img
                    src={d.photos[0]}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
                  />
                )}
                <span style={{ fontSize: 13 }}>{d.name}</span>
                <span style={{ fontSize: 11, color: "var(--adm-text2)", marginLeft: "auto" }}>
                  ${d.price?.toLocaleString("es-CL")}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--adm-text2)" }}>
                Sin resultados
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PromoForm({
  form,
  setForm,
  dishes,
  onSave,
  onCancel,
  onDelete,
  saving,
  isNew,
}: {
  form: PromoForm;
  setForm: (f: PromoForm) => void;
  dishes: { id: string; name: string; price: number; photos: string[] }[];
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const selectedDish = dishes.find((d) => d.id === form.dishId);

  return (
    <div
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderTop: "1px solid var(--adm-border)",
        marginTop: 8,
      }}
    >
      {/* Nombre interno */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Nombre para identificarla en el panel
        </span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ej: Martes de Suprema"
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--adm-border)",
            background: "var(--adm-card)",
            color: "var(--adm-text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </label>

      {/* Plato */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Plato al que aplica
        </span>
        <DishSearchPicker
          dishes={dishes}
          selectedId={form.dishId}
          onSelect={(id) => setForm({ ...form, dishId: id })}
        />
      </label>

      {/* Nombre que ve el cliente */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Nombre que ve el cliente (dejar vacío para usar el nombre del plato)
        </span>
        <input
          type="text"
          value={form.promoName}
          onChange={(e) => setForm({ ...form, promoName: e.target.value })}
          placeholder={selectedDish?.name ?? "Nombre del plato"}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--adm-border)",
            background: "var(--adm-card)",
            color: "var(--adm-text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </label>

      {/* Precios */}
      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Precio de oferta
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={form.promoPrice}
            onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
            placeholder="19900"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
              color: "var(--adm-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </label>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Precio normal (aparece tachado)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={form.originalPrice}
            onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
            placeholder="25900"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
              color: "var(--adm-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </label>
      </div>

      {/* Días */}
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Días de la semana (vacío = todos los días)
        </span>
        <DayChips
          days={form.daysOfWeek}
          onChange={(d) => setForm({ ...form, daysOfWeek: d })}
        />
      </label>

      {/* Rango de fechas */}
      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Desde
          </span>
          <input
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
              color: "var(--adm-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </label>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--adm-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Hasta
          </span>
          <input
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--adm-border)",
              background: "var(--adm-card)",
              color: "var(--adm-text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </label>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "none",
            background: GOLD,
            color: "#000",
            fontWeight: 700,
            fontSize: 13,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontFamily: F,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--adm-border)",
            background: "none",
            color: "var(--adm-text2)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              marginLeft: "auto",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ef4444",
              background: "none",
              color: "#ef4444",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPromociones() {
  const { t } = usePanelLang();
  const pathname = usePathname();
  const isPanel = pathname.startsWith("/panel");

  const { restaurants, loading: sessionLoading, selectedRestaurantId, isSuper } = useAdminSession();
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  // Expanded card for inline editing
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PromoForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // Create new
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<PromoForm>(EMPTY_FORM);
  const [createSaving, setCreateSaving] = useState(false);

  const [localDishes, setLocalDishes] = useState<{ id: string; name: string; price: number; photos: string[] }[]>([]);

  const today = new Date().getDay();

  // Auto-set selectedLocal from session
  useEffect(() => {
    if (selectedRestaurantId && !selectedLocal) setSelectedLocal(selectedRestaurantId);
  }, [selectedRestaurantId, selectedLocal]);

  // Load dishes when local changes
  useEffect(() => {
    if (!selectedLocal) { setLocalDishes([]); return; }
    fetch(`/api/admin/dishes?restaurantId=${selectedLocal}`)
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : d?.dishes;
        if (Array.isArray(arr)) setLocalDishes(arr);
      })
      .catch(() => {});
  }, [selectedLocal]);

  // Load promos when local changes
  useEffect(() => {
    if (!selectedLocal) { setPromos([]); return; }
    setLoading(true);
    fetch(`/api/admin/promotions?restaurantId=${selectedLocal}`)
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : d?.promotions;
        if (Array.isArray(arr)) setPromos(arr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocal]);

  function promoToForm(p: Promo): PromoForm {
    return {
      name: p.name ?? "",
      dishId: p.dishId ?? "",
      promoName: p.promoName ?? "",
      promoPrice: p.promoPrice != null ? String(p.promoPrice) : "",
      originalPrice: p.originalPrice != null ? String(p.originalPrice) : "",
      daysOfWeek: p.daysOfWeek ?? [],
      validFrom: p.validFrom ? p.validFrom.slice(0, 10) : "",
      validUntil: p.validUntil ? p.validUntil.slice(0, 10) : "",
    };
  }

  function openEdit(p: Promo) {
    setExpandedId(p.id);
    setEditForm(promoToForm(p));
  }

  function closeEdit() {
    setExpandedId(null);
    setEditForm(EMPTY_FORM);
  }

  async function saveEdit(promo: Promo) {
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: promo.id,
        name: editForm.name,
        dishId: editForm.dishId || null,
        promoName: editForm.promoName || null,
        promoPrice: parseCLP(editForm.promoPrice),
        originalPrice: parseCLP(editForm.originalPrice) || null,
        daysOfWeek: editForm.daysOfWeek,
        validFrom: editForm.validFrom || null,
        validUntil: editForm.validUntil || null,
      };
      const res = await fetch("/api/admin/promotions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.promotion ?? data;
        setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, ...updated } : p)));
        closeEdit();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleStatus(promo: Promo) {
    const newStatus = promo.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const res = await fetch("/api/admin/promotions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: promo.id, status: newStatus }),
    });
    if (res.ok) {
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, status: newStatus } : p))
      );
    }
  }

  async function deletePromo(promo: Promo) {
    if (!confirm(`¿Eliminar la oferta "${promo.name}"?`)) return;
    const res = await fetch("/api/admin/promotions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: promo.id, status: "DELETED" }),
    });
    if (res.ok) {
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      closeEdit();
    }
  }

  async function saveCreate() {
    if (!selectedLocal) return;
    setCreateSaving(true);
    try {
      const body = {
        restaurantId: selectedLocal,
        name: createForm.name,
        dishId: createForm.dishId || undefined,
        promoName: createForm.promoName || undefined,
        promoPrice: parseCLP(createForm.promoPrice),
        originalPrice: parseCLP(createForm.originalPrice) || undefined,
        daysOfWeek: createForm.daysOfWeek,
        validFrom: createForm.validFrom || undefined,
        validUntil: createForm.validUntil || undefined,
      };
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.promotion ?? data;
        setPromos((prev) => [created, ...prev]);
        setCreating(false);
        setCreateForm(EMPTY_FORM);
      }
    } finally {
      setCreateSaving(false);
    }
  }

  const filtered = promos.filter((p) => {
    if (filter === "active") return p.status === "ACTIVE";
    if (filter === "paused") return p.status === "PAUSED";
    return p.status !== "DELETED";
  });

  if (sessionLoading) return <SkeletonLoading />;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 780, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: F, fontWeight: 800, fontSize: 22, margin: 0 }}>Ofertas</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Selector de local — solo super admin */}
          {!isPanel && restaurants && restaurants.length > 0 && (
            <select
              value={selectedLocal}
              onChange={(e) => setSelectedLocal(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid var(--adm-border)",
                background: "var(--adm-card)",
                color: "var(--adm-text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <option value="">Seleccionar local…</option>
              {restaurants.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => { setCreating(true); setCreateForm(EMPTY_FORM); setExpandedId(null); }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: GOLD,
              color: "#000",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: F,
            }}
          >
            + Nueva oferta
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["all", "active", "paused"] as FilterTab[]).map((tab) => {
          const labels: Record<FilterTab, string> = { all: "Todas", active: "Activas", paused: "Pausadas" };
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid var(--adm-border)",
                background: filter === tab ? GOLD : "var(--adm-hover)",
                color: filter === tab ? "#000" : "var(--adm-text2)",
                fontWeight: filter === tab ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Formulario de creación */}
      {creating && (
        <div
          style={{
            borderRadius: 12,
            border: `2px solid ${GOLD}`,
            background: "var(--adm-card)",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 15, fontFamily: F }}>
            Nueva oferta
          </div>
          <PromoForm
            form={createForm}
            setForm={setCreateForm}
            dishes={localDishes}
            onSave={saveCreate}
            onCancel={() => { setCreating(false); setCreateForm(EMPTY_FORM); }}
            saving={createSaving}
            isNew
          />
        </div>
      )}

      {/* Loading */}
      {loading && <SkeletonLoading />}

      {/* Sin local seleccionado */}
      {!loading && !selectedLocal && (
        <div style={{ textAlign: "center", color: "var(--adm-text2)", padding: "40px 0", fontSize: 14 }}>
          Selecciona un local para ver las ofertas
        </div>
      )}

      {/* Sin resultados */}
      {!loading && selectedLocal && filtered.length === 0 && !creating && (
        <div style={{ textAlign: "center", color: "var(--adm-text2)", padding: "40px 0", fontSize: 14 }}>
          No hay ofertas{filter !== "all" ? " en esta categoría" : ""}
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((promo) => {
          const dish = promo.dishes?.[0] ?? localDishes.find((d) => d.id === promo.dishId);
          const photoUrl = dish?.photos?.[0] ?? null;
          const isToday = isPromoActiveToday(promo);
          const isExpanded = expandedId === promo.id;

          return (
            <div
              key={promo.id}
              style={{
                borderRadius: 12,
                border: isExpanded ? `2px solid ${GOLD}` : "1px solid var(--adm-border)",
                background: "var(--adm-card)",
                overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              {/* Card header — clickeable */}
              <div
                onClick={() => isExpanded ? closeEdit() : openEdit(promo)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                {/* Foto o emoji */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "var(--adm-hover)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    "🏷️"
                  )}
                </div>

                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, fontFamily: F }}>{promo.name}</span>
                    {/* Badge estado */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 20,
                        background: promo.status === "ACTIVE" ? "rgba(74,222,128,0.15)" : "var(--adm-hover)",
                        color: promo.status === "ACTIVE" ? "#4ade80" : "var(--adm-text2)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {promo.status === "ACTIVE" ? "ACTIVA" : "PAUSADA"}
                    </span>
                    {/* Badge HOY */}
                    {isToday && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 20,
                          background: "#4ade80",
                          color: "#000",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Plato */}
                  {dish && (
                    <div style={{ fontSize: 12, color: "var(--adm-text2)", marginBottom: 2 }}>
                      🍽 {dish.name}
                    </div>
                  )}

                  {/* promoName si difiere del plato */}
                  {promo.promoName && promo.promoName !== dish?.name && (
                    <div style={{ fontSize: 12, color: "var(--adm-text2)", marginBottom: 2 }}>
                      → se muestra como: <em>{promo.promoName}</em>
                    </div>
                  )}

                  {/* Precios */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {promo.promoPrice != null && (
                      <span style={{ fontWeight: 700, fontSize: 15, color: GOLD }}>
                        ${promo.promoPrice.toLocaleString("es-CL")}
                      </span>
                    )}
                    {promo.originalPrice != null && (
                      <span style={{ fontSize: 13, color: "var(--adm-text2)", textDecoration: "line-through" }}>
                        ${promo.originalPrice.toLocaleString("es-CL")}
                      </span>
                    )}
                  </div>

                  {/* Días */}
                  {promo.daysOfWeek && promo.daysOfWeek.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <DayChips days={promo.daysOfWeek} today={today} readonly />
                    </div>
                  )}

                  {/* Rango de fechas */}
                  {(promo.validFrom || promo.validUntil) && (
                    <div style={{ fontSize: 11, color: "var(--adm-text2)", marginTop: 4 }}>
                      {promo.validFrom && `Desde ${promo.validFrom.slice(0, 10)}`}
                      {promo.validFrom && promo.validUntil && " · "}
                      {promo.validUntil && `Hasta ${promo.validUntil.slice(0, 10)}`}
                    </div>
                  )}
                </div>

                {/* Botón Pausar/Activar */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleStatus(promo); }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--adm-border)",
                    background: "var(--adm-hover)",
                    color: "var(--adm-text2)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {promo.status === "ACTIVE" ? "Pausar" : "Activar"}
                </button>
              </div>

              {/* Editor inline expandido */}
              {isExpanded && (
                <PromoForm
                  form={editForm}
                  setForm={setEditForm}
                  dishes={localDishes}
                  onSave={() => saveEdit(promo)}
                  onCancel={closeEdit}
                  onDelete={() => deletePromo(promo)}
                  saving={editSaving}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
