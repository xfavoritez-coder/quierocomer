import { prisma } from "@/lib/prisma";

/**
 * Ajustes globales de plataforma (key-value). Solo el superadmin los edita.
 * Ej: la API key de Google usada por /api/geo/* ("Dirección" del panel).
 */
export async function getPlatformSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setPlatformSetting(key: string, value: string | null): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value || null },
    update: { value: value || null },
  });
}

/** API key de Google (Places/Geocoding). DB primero, fallback al env legacy. */
export async function getGoogleApiKey(): Promise<string> {
  return (await getPlatformSetting("google_api_key")) || process.env.GOOGLE_PLACES_API_KEY || "";
}
