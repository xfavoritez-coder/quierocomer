// Tokens de push nativo por pedido. Se guardan en OnlineOrder.nativePush (Json).
// Soporta VARIOS dispositivos a la vez (p.ej. iPhone + Android del mismo cliente,
// o dispositivos de prueba) — antes era un solo objeto y un dispositivo pisaba al
// otro. Normaliza tanto el formato viejo ({platform, token}) como el array.

export interface NativeToken { platform: "ios" | "android"; token: string }

export function normalizeNativeTokens(v: unknown): NativeToken[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  const out: NativeToken[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const t = x as { platform?: string; token?: string } | null;
    const platform = t?.platform === "ios" ? "ios" : t?.platform === "android" ? "android" : null;
    if (!platform || typeof t?.token !== "string" || !t.token) continue;
    if (seen.has(t.token)) continue;
    seen.add(t.token);
    out.push({ platform, token: t.token });
  }
  return out;
}

// Agrega/actualiza un token en la lista (dedup por token, tope de dispositivos).
export function upsertNativeToken(current: unknown, next: NativeToken, max = 10): NativeToken[] {
  const list = normalizeNativeTokens(current).filter((t) => t.token !== next.token);
  list.push(next);
  return list.slice(-max);
}
