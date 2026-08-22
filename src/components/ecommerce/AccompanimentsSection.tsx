"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { buildUnifiedList, groupPools, accomMaxFor, type AccompConfig, type CartLine } from "@/lib/ecommerce/accompaniments";

interface Props {
  config: AccompConfig;
  items: CartLine[];
  subtotal: number;
  primaryColor: string;
  onResolve: (r: { pending: string[]; notesPart: string }) => void;
}

export default function AccompanimentsSection({ config, items, subtotal, primaryColor, onResolve }: Props) {
  const unifiedList = useMemo(() => buildUnifiedList(config, items, subtotal), [config, items, subtotal]);
  const pools = useMemo(() => groupPools(config, items), [config, items]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});

  const resolveRef = useRef(onResolve);
  resolveRef.current = onResolve;

  // Reiniciar al cambiar el carrito (item agregado/quitado).
  const itemsKey = items.map((i) => `${i.product_id}:${i.quantity}`).join("|");
  useEffect(() => { setQty({}); setDeclined({}); }, [itemsKey]);

  // Reportar al padre (pendientes + nota) cuando cambia la selección.
  useEffect(() => {
    const pending = unifiedList.filter((e) => (qty[e.name] ?? 0) === 0 && !declined[e.name]).map((e) => e.name);
    const parts: string[] = [];
    unifiedList.forEach((e) => {
      const q = qty[e.name] ?? 0;
      if (q > 0) parts.push(`${e.name} x${q}`);
      else if (declined[e.name]) parts.push(`Sin ${e.name}`);
    });
    resolveRef.current({ pending, notesPart: parts.join(", ") });
  }, [unifiedList, qty, declined]);

  if (!unifiedList.length) return null;

  const dec = (name: string) => setQty((p) => ({ ...p, [name]: Math.max(0, (p[name] ?? 0) - 1) }));
  const inc = (name: string, max: number) => setQty((p) => ({ ...p, [name]: Math.min(max, (p[name] ?? 0) + 1) }));

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-black text-sm text-gray-900 mb-1">Acompañamientos</h2>
      <p className="text-xs text-gray-400 mb-3">Elige tus acompañamientos o marca &quot;No quiero&quot;.</p>
      <div className="flex flex-col gap-2">
        {unifiedList.map((entry) => {
          const isDeclined = !!declined[entry.name];
          const max = accomMaxFor(entry, config, subtotal, pools, qty);
          const q = qty[entry.name] ?? 0;
          const atMax = q >= max;
          return (
            <div key={entry.name} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${isDeclined ? "border-gray-100 bg-gray-50" : "border-gray-200"}`}>
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${isDeclined ? "text-gray-400 line-through" : "text-gray-700"}`}>{entry.name}</span>
                {!isDeclined && <span className="ml-2 text-xs text-gray-400">máx. {max}</span>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => dec(entry.name)} disabled={q === 0 || isDeclined} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition disabled:opacity-30">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className={`w-5 text-center text-sm font-black ${isDeclined ? "text-gray-300" : "text-gray-800"}`}>{q}</span>
                <button onClick={() => inc(entry.name, max)} disabled={atMax || isDeclined} className="w-7 h-7 rounded-lg flex items-center justify-center transition text-white disabled:opacity-30" style={{ background: isDeclined ? "#d1d5db" : primaryColor }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => {
                  if (isDeclined) setDeclined((p) => ({ ...p, [entry.name]: false }));
                  else { setDeclined((p) => ({ ...p, [entry.name]: true })); setQty((p) => ({ ...p, [entry.name]: 0 })); }
                }}
                className={`ml-3 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition shrink-0 ${isDeclined ? "bg-gray-200 border-gray-200 text-gray-600" : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"}`}
              >
                {isDeclined ? "✓ No quiero" : "No quiero"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
