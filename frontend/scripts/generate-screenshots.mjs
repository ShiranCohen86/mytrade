/**
 * One-time generator for manifest `screenshots` (rich install dialog).
 * Produces branded promo images — no fabricated UI, just brand + value props.
 * Run:  node scripts/generate-screenshots.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

const chart = `
  <polyline points="80,560 200,420 320,470 440,300 560,360 680,210 800,250"
    stroke="#4F7EF7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
  <circle cx="800" cy="250" r="11" fill="#4F7EF7"/>`;

function promo(w, h, { titleY, tagY, pillY, chartTransform, chartShow }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="32%" r="85%">
        <stop offset="0%" stop-color="#141433"/>
        <stop offset="60%" stop-color="#0b0b1f"/>
        <stop offset="100%" stop-color="#070712"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="${w / 2 - 56}" y="${titleY - 150}" width="112" height="112" rx="26" fill="#0d1117"/>
    <g transform="translate(${w / 2 - 56} ${titleY - 150}) scale(0.218)">
      <polyline points="48,352 128,240 208,288 304,144 432,208" stroke="#4F7EF7" stroke-width="35" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="432" cy="208" r="32" fill="#4F7EF7"/>
    </g>
    <text x="50%" y="${titleY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="800" fill="#ffffff">MyTrade</text>
    <text x="50%" y="${tagY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="500" fill="#9aa0b4">Stock Intelligence — risk, earnings &amp; alerts</text>
    <g font-family="Inter, Arial, sans-serif" font-size="20" font-weight="600" fill="#c7cbe0">
      <rect x="${w / 2 - 300}" y="${pillY}" width="190" height="48" rx="24" fill="#1b1b3a"/>
      <text x="${w / 2 - 205}" y="${pillY + 31}" text-anchor="middle">Risk Scores</text>
      <rect x="${w / 2 - 95}" y="${pillY}" width="190" height="48" rx="24" fill="#1b1b3a"/>
      <text x="${w / 2}" y="${pillY + 31}" text-anchor="middle">Price Alerts</text>
      <rect x="${w / 2 + 110}" y="${pillY}" width="190" height="48" rx="24" fill="#1b1b3a"/>
      <text x="${w / 2 + 205}" y="${pillY + 31}" text-anchor="middle">Earnings AI</text>
    </g>
    ${chartShow ? `<g transform="${chartTransform}">${chart}</g>` : ''}
  </svg>`);
}

// Wide (desktop) 1280x800
await sharp(promo(1280, 800, {
  titleY: 360, tagY: 410, pillY: 470,
  chartShow: true, chartTransform: 'translate(240 120) scale(0.95)',
})).png().toFile(resolve(PUBLIC, 'screenshot-wide.png'));
console.log('screenshot-wide.png');

// Narrow (mobile) 1080x1920
await sharp(promo(1080, 1920, {
  titleY: 760, tagY: 815, pillY: 900,
  chartShow: true, chartTransform: 'translate(140 380) scale(1.05)',
})).png().toFile(resolve(PUBLIC, 'screenshot-narrow.png'));
console.log('screenshot-narrow.png');
