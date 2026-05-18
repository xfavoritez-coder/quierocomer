/** SVG dish placeholder icon — consistent across all platforms (no emoji) */
export default function DishPlaceholderIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--carta-text, #999)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.2 }}
    >
      {/* Plate dome (cloche) */}
      <path d="M3 16h18" />
      <path d="M4 16a8 8 0 0 1 16 0" />
      {/* Handle */}
      <path d="M12 8V5" />
      <circle cx="12" cy="4.5" r="0.5" fill="var(--carta-text, #999)" stroke="none" />
      {/* Base plate */}
      <path d="M5 16v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" />
    </svg>
  );
}
