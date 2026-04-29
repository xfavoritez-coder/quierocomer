import sharp from "sharp";

const size = 192;
const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="40" fill="#F4A623"/>
  <g transform="translate(${size/2}, ${size/2 - 5})" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-30 0 Q-30 -35 0 -35 Q30 -35 30 0 L35 14 L-35 14 Z"/>
    <rect x="-5" y="-50" width="10" height="15" rx="3" fill="white" stroke="none"/>
    <circle cx="0" cy="22" r="7" fill="white" stroke="none"/>
    <line x1="-42" y1="-4" x2="-36" y2="-4" stroke-width="4"/>
    <line x1="36" y1="-4" x2="42" y2="-4" stroke-width="4"/>
  </g>
  <text x="${size/2}" y="${size - 28}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="white" opacity="0.9">GARZÓN</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile("public/icon-garzon-192.png")
  .then(() => console.log("Icon generated: public/icon-garzon-192.png"))
  .catch(console.error);
