import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import sharp from "sharp";

async function main() {
  // 1. Get image URLs from Jina
  console.log("Fetching Jina...");
  const jinaRes = await fetch("https://r.jina.ai/https://www.canva.com/design/DAF_JMggHwM/Oz7OnwB67ubLwnnAq2wA4g/view", {
    headers: { Accept: "text/plain", "X-No-Cache": "true" },
    signal: AbortSignal.timeout(15000),
  });
  const content = await jinaRes.text();
  const urls = [...content.matchAll(/!\[.*?\]\((https:\/\/media\.canva\.com\/[^\)]+)\)/g)]
    .map(m => m[1].replace(/height:\d+/, "height:1600").replace(/width:\d+/, "width:1200"));
  console.log("Found", urls.length, "images");

  // 2. Download first 2 images
  const images: { type: string; source: { type: string; media_type: string; data: string } }[] = [];
  for (const url of urls.slice(0, 2)) {
    console.log("Downloading:", url.slice(0, 80));
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.log("  FAILED:", res.status); continue; }
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log("  Raw size:", (buffer.length / 1024).toFixed(0), "KB");

    let finalBuffer: Buffer;
    try {
      finalBuffer = await sharp(buffer).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      console.log("  Resized:", (finalBuffer.length / 1024).toFixed(0), "KB");
    } catch (e) {
      console.log("  Sharp failed:", (e as Error).message);
      finalBuffer = buffer;
    }

    images.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: finalBuffer.toString("base64") } });
  }

  console.log("\nSending", images.length, "images to Claude...");
  const totalB64 = images.reduce((s, i) => s + i.source.data.length, 0);
  console.log("Total base64 size:", (totalB64 / 1024 / 1024).toFixed(2), "MB");

  // 3. Send to Claude
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: [...images, { type: "text", text: "List any menu items visible in these images. JSON only." }] }],
    }),
  });

  console.log("Claude status:", res.status);
  const data = await res.json();
  if (res.ok) {
    console.log("Response:", data.content?.[0]?.text?.slice(0, 200));
  } else {
    console.log("Error:", JSON.stringify(data));
  }
}
main();
