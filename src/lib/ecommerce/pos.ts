// ═══════════════════════════════════════════════════════════
//  Despacho de pedidos del Ecommerce al POS del restaurante.
//  POS integration removed — always skips.
// ═══════════════════════════════════════════════════════════

export async function dispatchOrderToPos(_orderId: string): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  return { ok: true, message: "POS no configurado", skipped: true };
}
