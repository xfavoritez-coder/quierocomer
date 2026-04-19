import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    supabaseKeyPrefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "NOT SET").slice(0, 20) + "...",
    nodeEnv: process.env.NODE_ENV,
  });
}
