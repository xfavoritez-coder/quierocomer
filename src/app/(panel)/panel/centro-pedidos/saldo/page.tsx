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

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/delivery-wallet?restaurantId=${restaurantId}`);
      const d = await r.json();
      if (r.ok) { setBalance(d.balance ?? 0); setBank(d.bank || {}); setTxns(d.txns || []); }
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const copy = (val: string, key: string) => {
    try { navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  };

  const hasBank = bank.accountNumber || bank.bankName;
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

      {/* Datos bancarios para recargar */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Building2 size={18} color={ACCENT} />
          <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>¿Cómo recargar?</h2>
        </div>
        {hasBank ? (
          <>
            <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)", margin: "0 0 14px" }}>Transfiere a la siguiente cuenta y te acreditamos el saldo:</p>
            <div style={{ display: "grid", gap: 8 }}>
              <BankRow label="Banco" value={bank.bankName} />
              <BankRow label="Tipo de cuenta" value={bank.accountType} />
              <BankRow label="N° de cuenta" value={bank.accountNumber} onCopy={bank.accountNumber ? () => copy(bank.accountNumber!, "acc") : undefined} copied={copied === "acc"} />
              <BankRow label="RUT" value={bank.rut} onCopy={bank.rut ? () => copy(bank.rut!, "rut") : undefined} copied={copied === "rut"} />
              <BankRow label="Titular" value={bank.holder} />
              <BankRow label="Email" value={bank.email} onCopy={bank.email ? () => copy(bank.email!, "email") : undefined} copied={copied === "email"} />
            </div>
            {bank.instructions && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "14px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{bank.instructions}</p>}
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

function BankRow({ label, value, onCopy, copied }: { label: string; value?: string; onCopy?: () => void; copied?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--adm-hover)", borderRadius: 10 }}>
      <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", minWidth: 110 }}>{label}</span>
      <span style={{ flex: 1, fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: "var(--adm-text)", wordBreak: "break-all" }}>{value}</span>
      {onCopy && (
        <button onClick={onCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: copied ? GREEN : "var(--adm-text2)", cursor: "pointer", fontFamily: FB, fontSize: "0.74rem", fontWeight: 700 }}>
          {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
        </button>
      )}
    </div>
  );
}
