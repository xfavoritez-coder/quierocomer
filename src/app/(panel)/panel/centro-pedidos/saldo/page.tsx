"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { ArrowLeft, Wallet, Building2, Copy, Check } from "lucide-react";
import Link from "next/link";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e", RED = "#ef4444";

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

interface Bank { bankName?: string; accountType?: string; accountNumber?: string; rut?: string; holder?: string; email?: string; instructions?: string }
interface Txn { id: string; amount: number; type: string; description: string | null; balanceAfter: number; createdAt: string }

const TXN_LABEL: Record<string, string> = { topup: "Recarga", charge: "Despacho", refund: "Reembolso", adjust: "Ajuste" };

export default function SaldoDeliveryPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [balance, setBalance] = useState<number | null>(null);
  const [bank, setBank] = useState<Bank>({});
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(false);
  const [savingShow, setSavingShow] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/delivery-wallet?restaurantId=${restaurantId}`);
      const d = await r.json();
      if (r.ok) { setBalance(d.balance ?? 0); setBank(d.bank || {}); setTxns(d.txns || []); setShowBalance(d.showBalance === true); }
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId]);

  const toggleShow = async () => {
    if (!restaurantId) return;
    const next = !showBalance;
    setShowBalance(next); setSavingShow(true);
    try {
      const r = await fetch("/api/panel/ecommerce/delivery-wallet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, showBalance: next }) });
      if (!r.ok) setShowBalance(!next);
    } catch { setShowBalance(!next); }
    setSavingShow(false);
  };

  useEffect(() => { load(); }, [load]);

  const copy = (val: string, key: string) => {
    try { navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  };

  const copyAll = () => {
    const lines = [
      bank.bankName && `Banco: ${bank.bankName}`,
      bank.accountType && `Tipo de cuenta: ${bank.accountType}`,
      bank.accountNumber && `N° de cuenta: ${bank.accountNumber}`,
      bank.rut && `RUT: ${bank.rut}`,
      bank.holder && `Titular: ${bank.holder}`,
      bank.email && `Email: ${bank.email}`,
    ].filter(Boolean);
    copy(lines.join("\n"), "all");
  };

  const hasBank = bank.accountNumber || bank.bankName;
  const rows = [
    ["Banco", bank.bankName], ["Tipo de cuenta", bank.accountType], ["N° de cuenta", bank.accountNumber],
    ["RUT", bank.rut], ["Titular", bank.holder], ["Email", bank.email],
  ].filter(([, v]) => v) as [string, string][];
  const low = balance != null && balance <= 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px 40px" }}>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", textDecoration: "none", marginBottom: 10 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, color: "var(--adm-text)", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 10 }}>
        <Wallet size={24} color={ACCENT} /> Saldo para delivery
      </h1>
      <p style={{ fontFamily: FB, fontSize: "0.9rem", color: "var(--adm-text2)", margin: "0 0 18px" }}>
        Saldo prepago con el que solicitas repartidores externos (Uber / PedidosYa). Cada despacho descuenta su costo. Si te quedas sin saldo, no podrás solicitar repartidores.
      </p>

      {/* Saldo actual */}
      <div style={{ background: low ? "#fef2f2" : "linear-gradient(135deg, #F4A62318, #F4A62305)", border: `1px solid ${low ? "#fecaca" : "#F4A62340"}`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
        <div style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", fontWeight: 700, marginBottom: 4 }}>Saldo disponible</div>
        <div style={{ fontFamily: F, fontSize: "2.6rem", fontWeight: 900, color: low ? RED : "var(--adm-text)", lineHeight: 1.05 }}>
          {loading ? "…" : clp(balance || 0)}
        </div>
        {low && <div style={{ fontFamily: FB, fontSize: "0.85rem", color: RED, fontWeight: 700, marginTop: 6 }}>Sin saldo. Transfiere para recargar y seguir solicitando repartidores.</div>}
      </div>

      {/* Toggle: mostrar saldo en Centro de pedidos */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)" }}>Mostrar saldo en Centro de pedidos</div>
          <div style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", marginTop: 2 }}>Muestra tu saldo disponible arriba en la pantalla de Centro de pedidos.</div>
        </div>
        <button onClick={toggleShow} disabled={savingShow} aria-pressed={showBalance}
          style={{ position: "relative", width: 46, height: 26, borderRadius: 999, border: "none", background: showBalance ? GREEN : "var(--adm-card-border)", cursor: savingShow ? "wait" : "pointer", flexShrink: 0, transition: "background .15s" }}>
          <span style={{ position: "absolute", top: 3, left: showBalance ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .15s" }} />
        </button>
      </div>

      {/* Datos bancarios para recargar */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Building2 size={17} color={ACCENT} />
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>¿Cómo recargar?</h2>
          {hasBank && (
            <button onClick={copyAll} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: copied === "all" ? GREEN : ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}>
              {copied === "all" ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar datos</>}
            </button>
          )}
        </div>
        {hasBank ? (
          <>
            <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 10px" }}>Transfiere a esta cuenta y te acreditamos el saldo:</p>
            <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 10, overflow: "hidden" }}>
              {rows.map(([label, value], i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: i % 2 ? "transparent" : "var(--adm-hover)" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", minWidth: 100, flexShrink: 0 }}>{label}</span>
                  <span style={{ flex: 1, fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
            {bank.instructions && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "10px 0 0", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{bank.instructions}</p>}
          </>
        ) : (
          <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text3)", margin: 0 }}>Los datos de transferencia aún no están configurados. Contáctanos para recargar tu saldo.</p>
        )}
      </div>

      {/* Movimientos */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 14px" }}>Movimientos</h2>
        {loading ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>Cargando…</p>
        ) : txns.length === 0 ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>Aún no hay movimientos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {txns.map((t) => {
              const pos = t.amount >= 0;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)" }}>{TXN_LABEL[t.type] || t.type}</div>
                    <div style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description || "—"} · {new Date(t.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: pos ? GREEN : RED }}>{pos ? "+" : "−"}{clp(Math.abs(t.amount))}</div>
                    <div style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>Saldo {clp(t.balanceAfter)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

