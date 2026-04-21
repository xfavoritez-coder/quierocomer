import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("panel_token");
  response.cookies.delete("panel_role");
  response.cookies.delete("panel_id");
  return response;
}
