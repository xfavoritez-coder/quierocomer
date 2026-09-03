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
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="font-black text-sm text-gray-900 mb-1.5">Acompañamientos</h2>
      <div className="flex flex-col divide-y divide-gray-100">
        {unifiedList.map((entry) => {
          const isDeclined = !!declined[entry.name];
          const max = accomMaxFor(entry, config, subtotal, pools, qty);
          const q = qty[entry.name] ?? 0;
          const atMax = q >= max;
          return (
            <div key={entry.name} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-tight truncate ${isDeclined ? "text-gray-400 line-through" : "text-gray-800"}`}>{entry.name}</p>
                <p className="text-[11px] text-gray-400 leading-tight">{isDeclined ? "No quiero" : `Máx ${max}`}</p>
              </div>
              <button
                onClick={() => {
                  if (isDeclined) setDeclined((p) => ({ ...p, [entry.name]: false }));
                  else { setDeclined((p) => ({ ...p, [entry.name]: true })); setQty((p) => ({ ...p, [entry.name]: 0 })); }
                }}
                className={`text-[11px] font-bold shrink-0 px-2 py-1 rounded-md transition ${isDeclined ? "text-gray-600 bg-gray-100" : "text-gray-400 hover:text-gray-600"}`}
              >
                {isDeclined ? "Elegir" : "No quiero"}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => dec(entry.name)} disabled={q === 0 || isDeclined} className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition disabled:opacity-30">
                  <Minus className="w-3 h-3" />
                </button>
                <span className={`w-4 text-center text-sm font-black ${isDeclined ? "text-gray-300" : "text-gray-800"}`}>{q}</span>
                <button onClick={() => inc(entry.name, max)} disabled={atMax || isDeclined} className="w-6 h-6 rounded-md flex items-center justify-center transition text-white disabled:opacity-30" style={{ background: isDeclined ? "#d1d5db" : primaryColor }}>
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
