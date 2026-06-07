import sharp from "sharp";

/**
 * Centralized image optimization for all upload paths.
 * Converts to WebP at high quality and caps resolution to a sensible max
 * for mobile screens. Does NOT sacrifice visual quality — only trims
 * unnecessary resolution that no phone display can render anyway.
 *
 * A 1200px-wide photo in WebP quality 85 is visually identical to the
 * original on any mobile screen (max ~430 CSS-px × 3 DPR = 1290 hw-px).
 */
export async function optimizeImage(
  input: Buffer,
  opts: {
    /** Max width/height in px (default 1200) */
    maxDimension?: number;
    /** WebP quality 0-100 (default 85 — visually lossless) */
    quality?: number;
  } = {},
): Promise<Buffer> {
  const MAX_DIM = opts.maxDimension ?? 1200;
  const QUALITY = opts.quality ?? 85;

  let img = sharp(input).rotate(); // auto-rotate from EXIF
  const meta = await img.metadata();

  // Only resize if the image exceeds max dimension
  if ((meta.width && meta.width > MAX_DIM) || (meta.height && meta.height > MAX_DIM)) {
    img = img.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
  }

  return img.webp({ quality: QUALITY, effort: 4, smartSubsample: true }).toBuffer();
}
