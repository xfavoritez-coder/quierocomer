import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Test Supabase storage upload with a tiny file
  let uploadTest = "not tested";
  try {
    const testBuffer = Buffer.from("test");
    const testName = `test/debug-${Date.now()}.txt`;
    const { error } = await supabase.storage.from("fotos").upload(testName, testBuffer, { contentType: "text/plain", upsert: true });
    if (error) {
      uploadTest = `FAILED: ${error.message}`;
    } else {
      uploadTest = "SUCCESS";
      // Cleanup
      await supabase.storage.from("fotos").remove([testName]);
    }
  } catch (e: any) {
    uploadTest = `ERROR: ${e.message}`;
  }

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    supabaseKeyPrefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "NOT SET").slice(0, 20) + "...",
    nodeEnv: process.env.NODE_ENV,
    uploadTest,
  });
}
