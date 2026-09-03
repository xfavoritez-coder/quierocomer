import { NextRequest, NextResponse } from "next/server";
import { getGoogleApiKey } from "@/lib/platformSettings";

/** Geocodificación inversa: coordenadas → dirección.
 *  GET /api/geo/reverse?lat=..&lng=..
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json(null);

  const GOOGLE_KEY = await getGoogleApiKey();

  if (GOOGLE_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&key=${GOOGLE_KEY}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]) {
        return NextResponse.json({ display_name: data.results[0].formatted_address });
      }
    } catch {
      /* cae a Nominatim */
    }
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`,
      { headers: { "User-Agent": "QuieroComer/1.0" } },
    );
    const data = await res.json();
    return NextResponse.json({ display_name: data?.display_name || null });
  } catch {
    return NextResponse.json(null);
  }
}
