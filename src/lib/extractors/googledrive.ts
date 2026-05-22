/**
 * Google Drive extractor — handles share links to PDFs hosted on Drive.
 *
 * Supported URL formats:
 *   https://drive.google.com/file/d/{FILE_ID}/view?usp=...
 *   https://drive.google.com/open?id={FILE_ID}
 *   https://drive.google.com/uc?id={FILE_ID}&export=download
 *
 * Strategy:
 *   1. Extract the file ID from the URL.
 *   2. Build a direct-download URL: https://drive.google.com/uc?export=download&id={FILE_ID}
 *   3. Download the file (following Google's virus-warning redirect if needed).
 *   4. Extract text from the PDF using pdf-parse.
 *   5. If text is insufficient, send the PDF as a base64 document to Claude.
 *   6. Structure the extracted text into ExtractedDish[] via Claude.
 */

import type { ExtractionResult } from "./types";

// ─── URL detection ────────────────────────────────────────────────────────────

/** Returns true if the URL points to a Google Drive file. */
export function isGoogleDriveUrl(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    if (!hostname.includes("drive.google.com")) return false;
    // /file/d/{id}/view  or  /open?id=  or  /uc?id=
    return (
      /^\/file\/d\/[^/]+/.test(pathname) ||
      pathname === "/open" && !!searchParams.get("id") ||
      pathname === "/uc" && !!searchParams.get("id")
    );
  } catch {
    return false;
  }
}

/** Extract the Google Drive file ID from any supported share URL. */
function extractFileId(url: string): string | null {
  try {
    const { pathname, searchParams } = new URL(url);
    // /file/d/{id}/...
    const match = pathname.match(/\/file\/d\/([^/]+)/);
    if (match) return match[1];
    // ?id=
    return searchParams.get("id");
  } catch {
    return null;
  }
}

/** Build the direct-download URL for a Drive file. */
function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Download a file from Google Drive, handling the "large file" virus-warning
 * confirmation page that Drive shows for files > 100 MB (or occasionally others).
 *
 * Returns the raw binary buffer and the detected content type.
 */
async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; contentType: string }> {
  const downloadUrl = buildDownloadUrl(fileId);
  console.log(`[GoogleDrive] Downloading file ${fileId} via ${downloadUrl}`);

  const res = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Google Drive download failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Google shows an HTML confirmation page for "large" files.
  // Detect it and follow the confirm link.
  if (contentType.includes("text/html")) {
    const html = await res.text();

    // Look for the confirm download link pattern
    const confirmMatch = html.match(/href="(\/uc\?[^"]*export=download[^"]*confirm=[^"]+)"/i)
      || html.match(/action="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i)
      || html.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i);

    if (confirmMatch) {
      const confirmHref = confirmMatch[1];
      const confirmUrl = confirmHref.startsWith("http")
        ? confirmHref
        : `https://drive.google.com${confirmHref}`;

      console.log("[GoogleDrive] Following confirmation redirect for large file");
      const confirmRes = await fetch(confirmUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!confirmRes.ok) {
        throw new Error(`Google Drive confirm download failed: HTTP ${confirmRes.status}`);
      }
      const buffer = Buffer.from(await confirmRes.arrayBuffer());
      const ct = confirmRes.headers.get("content-type") || "application/pdf";
      return { buffer, contentType: ct };
    }

    // Also handle drive.usercontent.google.com pattern (newer Drive URLs)
    const usercontent = html.match(/https:\/\/drive\.usercontent\.google\.com\/[^"'\s]+/);
    if (usercontent) {
      const ucRes = await fetch(usercontent[0], {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!ucRes.ok) {
        throw new Error(`Google Drive usercontent download failed: HTTP ${ucRes.status}`);
      }
      const buffer = Buffer.from(await ucRes.arrayBuffer());
      const ct = ucRes.headers.get("content-type") || "application/pdf";
      return { buffer, contentType: ct };
    }

    throw new Error(
      "Google Drive returned an HTML page but no download link could be found. " +
      "The file may be set to 'Restricted' access — ensure it is shared as 'Anyone with the link'."
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Extract menu data from a Google Drive PDF share link.
 * Automatically converts the preview URL to a direct download and processes the PDF.
 */
export async function extractGoogleDrive(cartaUrl: string): Promise<ExtractionResult> {
  const fileId = extractFileId(cartaUrl);
  if (!fileId) throw new Error(`Could not extract file ID from Google Drive URL: ${cartaUrl}`);

  const { buffer, contentType } = await downloadDriveFile(fileId);

  if (buffer.length < 100) {
    throw new Error("Downloaded file is too small — it may not be accessible. Ensure the file is shared as 'Anyone with the link'.");
  }

  console.log(`[GoogleDrive] Downloaded ${buffer.length} bytes (${contentType}) for file ${fileId}`);

  // Only handle PDFs for now (Drive share links for menus are almost always PDFs)
  const isPdf = contentType.includes("pdf") || buffer.slice(0, 5).toString() === "%PDF-";

  if (!isPdf) {
    throw new Error(
      `Google Drive file is not a PDF (content-type: ${contentType}). ` +
      "Only PDF menus are supported via Drive links."
    );
  }

  // Upload to Supabase temp storage so extractFromDocument can fetch it
  const { supabase } = await import("@/lib/supabase");
  const tempPath = `temp/gdrive-${fileId}-${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage.from("fotos").upload(tempPath, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Failed to upload PDF to temp storage: ${uploadErr.message}`);

  const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(tempPath);
  const publicUrl = urlData.publicUrl;
  console.log(`[GoogleDrive] Uploaded to temp storage: ${publicUrl}`);

  // Use the document extractor which handles text + vision fallback
  const { extractFromDocument } = await import("./document");
  const result = await extractFromDocument(publicUrl);

  // Cleanup temp file (fire-and-forget)
  supabase.storage.from("fotos").remove([tempPath]).catch(() => {});

  console.log(`[GoogleDrive] Extracted ${result.dishes.length} dishes from file ${fileId}`);
  return result;
}
