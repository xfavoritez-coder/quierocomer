import { NextResponse } from "next/server";

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("qr_user_id");
  return response;
}
