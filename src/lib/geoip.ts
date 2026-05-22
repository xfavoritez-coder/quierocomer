/** Resolve IP → city using free ipapi.co API. Returns null on failure. */
export async function getCity(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${ip}/city/`, {
      signal: controller.signal,
      headers: { "User-Agent": "QuieroComer/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const city = (await res.text()).trim();
    return city && city !== "Undefined" ? city : null;
  } catch {
    return null;
  }
}
