import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }
    // Return password as token since adminAuth validates against ADMIN_PASSWORD
    return NextResponse.json({ ok: true, token: password });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
