// Renderiza el PDF térmico de SharkPOS a un raster 1-bit (para ESC/POS GS v 0).
// Corre SOLO en el navegador (usa canvas + pdf.js). Así imprimimos la boleta
// EXACTA que genera SharkPOS, sin reconstruirla nosotros.
"use client";

export async function pdfBase64ToRaster(
  pdfBase64: string,
  targetWidth = 576,
): Promise<{ width: number; height: number; data: number[] } | null> {
  if (typeof document === "undefined") return null;
  try {
    const pdfjs = await import("pdfjs-dist");
    // Worker vendoreado en /public (versión fija), para no depender del bundler.
    (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      "/pdf.worker.min.mjs";

    const bin = atob(pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const vp = page.getViewport({ scale });
    const w = Math.round(vp.width);
    const h = Math.round(vp.height);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as unknown as Parameters<typeof page.render>[0]).promise;

    const px = ctx.getImageData(0, 0, w, h).data;
    const bytesPerRow = Math.ceil(w / 8);
    const data: number[] = new Array(bytesPerRow * h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        if (px[i + 3] > 128 && lum < 128) data[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
    return { width: w, height: h, data };
  } catch (e) {
    console.error("[pdfRaster]", e);
    return null;
  }
}
