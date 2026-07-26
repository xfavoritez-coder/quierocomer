import { readFileSync } from "fs";
import { join } from "path";

// Read at module level so Next.js bundles the content at build time
const html = readFileSync(join(process.cwd(), "vista-cordillera.html"), "utf-8");

export function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
