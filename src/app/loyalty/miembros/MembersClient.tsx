"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import LoyaltyNav from "../LoyaltyNav";

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stamps: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  enrolledAt: string;
  lastStampAt: string | null;
}

export default function MembersClient() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurant, loading, error } = usePanelSession();

  const [members, setMembers] = useState<Member[]>([]);
  const [stampsRequired, setStampsRequired] = useState(10);
  const [rewardText, setRewardText] = useState("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // Cargar config del programa (para saber stampsRequired / recompensa)
  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.program) {
          setStampsRequired(d.program.stampsRequired);
          setRewardText(d.program.rewardText);
        }
      })
      .catch(() => {});
  }, [selectedRestaurantId]);

  const loadMembers = useCallback(
    (q: string) => {
      if (!selectedRestaurantId) return;
      setLoadingList(true);
      fetch(`/api/loyalty/members?restaurantId=${selectedRestaurantId}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setMembers(d.members || []))
        .catch(() => showToast("Error al cargar miembros"))
        .finally(() => setLoadingList(false));
    },
    [selectedRestaurantId, showToast],
  );

  // Carga inicial + búsqueda con debounce
  useEffect(() => {
    if (!selectedRestaurantId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadMembers(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedRestaurantId, loadMembers]);

  const patchMember = (m: Member) => setMembers((prev) => prev.map((x) => (x.id === m.id ? m : x)));

  const addStamp = async (member: Member, delta: 1 | -1) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      patchMember(d.member);
      if (d.rewardCompleted) showToast(`🎉 ¡${member.name || "El cliente"} completó la tarjeta! Recompensa ganada.`);
    } catch (e: any) {
      showToast(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

  const redeem = async (member: Member) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}/redeem`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      patchMember(d.member);
      showToast(`✓ Recompensa canjeada para ${member.name || "el cliente"}`);
    } catch (e: any) {
      showToast(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

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
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label="Tarjeta">
              🎟️
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Loyalty</h1>
          </div>
          <p className="mt-2 text-neutral-400">Gestiona tus miembros y sus sellos.</p>
        </header>

        <LoyaltyNav />

        {restaurants.length > 1 && (
          <div className="mb-6">
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

        {/* Buscador + agregar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-neutral-950 hover:bg-amber-400"
          >
            + Agregar miembro
          </button>
        </div>

        {showAdd && (
          <AddMemberForm
            restaurantId={selectedRestaurantId!}
            onCreated={(m) => {
              setMembers((prev) => [m, ...prev]);
              setShowAdd(false);
              showToast("Miembro agregado");
            }}
            onError={showToast}
          />
        )}

        {/* Lista */}
        {loadingList ? (
          <p className="text-neutral-500">Cargando miembros…</p>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 py-16 text-center">
            <p className="text-neutral-400">
              {query ? "Sin resultados para tu búsqueda." : "Aún no tienes miembros. Agrega el primero."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => {
              const available = m.rewardsEarned - m.rewardsRedeemed;
              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.name || "Sin nombre"}</p>
                    <p className="text-sm text-neutral-500 truncate">
                      {[m.email, m.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StampBar current={m.stamps} required={stampsRequired} />
                      <span className="text-xs text-neutral-400">
                        {m.stamps}/{stampsRequired}
                      </span>
                      {available > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          {available} recompensa{available > 1 ? "s" : ""} lista{available > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => addStamp(m, -1)}
                      className="h-9 w-9 rounded-lg border border-neutral-700 text-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
                      title="Quitar sello"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => addStamp(m, 1)}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-40"
                      title="Agregar sello"
                    >
                      +1 sello
                    </button>
                    {available > 0 && (
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => redeem(m)}
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
                      >
                        Canjear
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-800 px-5 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function StampBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, (current / required) * 100) : 0;
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function AddMemberForm({
  restaurantId,
  onCreated,
  onError,
}: {
  restaurantId: string;
  onCreated: (m: Member) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/loyalty/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name, email, phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      onCreated(d.member);
    } catch (e: any) {
      onError(e.message || "Error al agregar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono"
          className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar miembro"}
        </button>
      </div>
    </div>
  );
}
