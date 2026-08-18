/**
 * Generate a visual barcode pattern as an SVG data URL or SVG markup
 */
export function generateBarcodeSvg(value: string, width = 240, height = 70): string {
  // Simple deterministic Code 128 pseudo-pattern generator for crisp rendering
  const hash = Array.from(value).reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  const bars: { x: number; w: number }[] = [];
  
  let currentX = 10;
  const usableWidth = width - 20;
  const barCount = 35;
  const step = usableWidth / barCount;

  // Start guard
  bars.push({ x: currentX, w: 2 });
  currentX += 4;

  for (let i = 0; i < barCount; i++) {
    const charCode = value.charCodeAt(i % value.length) || 65;
    const pseudoBit = ((hash * (i + 3) + charCode) % 7);
    const barWidth = (pseudoBit === 0 || pseudoBit === 3) ? 3 : (pseudoBit === 1) ? 2 : 1;
    const gap = (pseudoBit % 2 === 0) ? 2 : 1.5;

    bars.push({ x: currentX, w: barWidth });
    currentX += barWidth + gap;
    if (currentX > width - 15) break;
  }

  // End guard
  bars.push({ x: width - 14, w: 2 });
  bars.push({ x: width - 10, w: 1.5 });

  const rects = bars
    .map((b) => `<rect x="${b.x.toFixed(1)}" y="6" width="${b.w.toFixed(1)}" height="${height - 24}" fill="#0f172a" />`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="w-full h-auto">
    <rect width="100%" height="100%" fill="#ffffff" rx="4" />
    ${rects}
    <text x="${width / 2}" y="${height - 6}" font-family="monospace, ui-monospace, sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="#334155" letter-spacing="2">${value}</text>
  </svg>`;
}
