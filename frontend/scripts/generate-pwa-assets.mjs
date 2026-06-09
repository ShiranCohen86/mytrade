/**
 * One-time PWA asset generator.
 * Renders PNG icons, the Apple touch icon, and the iOS launch (splash) image set
 * from the existing SVG sources, and emits the <link> tags for index.html.
 *
 * Run:  node scripts/generate-pwa-assets.mjs
 */
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
const BG = '#0d1117'; // brand tile / splash background (matches icon)

const iconSvg = await readFile(resolve(PUBLIC, 'icon.svg'));
const maskableSvg = await readFile(resolve(PUBLIC, 'icon-maskable.svg'));

await mkdir(PUBLIC, { recursive: true });

// ---- App icons ----------------------------------------------------------
async function png(svg, size, out, flatten = false) {
  let img = sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' });
  if (flatten) img = img.flatten({ background: BG });
  await img.png().toFile(resolve(PUBLIC, out));
  console.log('icon  ', out);
}

await png(iconSvg, 192, 'pwa-192x192.png');
await png(iconSvg, 512, 'pwa-512x512.png');
await png(maskableSvg, 192, 'maskable-192x192.png');
await png(maskableSvg, 512, 'maskable-512x512.png');
await png(iconSvg, 180, 'apple-touch-icon.png', true); // iOS: opaque, iOS applies its own mask
await png(iconSvg, 64, 'pwa-64x64.png');

// ---- iOS launch (splash) images -----------------------------------------
// [cssWidth, cssHeight, dpr] — portrait. PNG = css*dpr.
const DEVICES = [
  [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3],
  [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3],
  [440, 956, 3],
  // iPads
  [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2],
  [834, 1194, 2], [1024, 1366, 2],
];

const links = [];
for (const [cw, ch, dpr] of DEVICES) {
  const w = cw * dpr;
  const h = ch * dpr;
  const iconSize = Math.round(Math.min(w, h) * 0.26);
  const icon = await sharp(iconSvg, { density: 384 }).resize(iconSize, iconSize).png().toBuffer();
  const out = `apple-splash-${w}x${h}.png`;
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(resolve(PUBLIC, out));
  links.push(
    `    <link rel="apple-touch-startup-image" media="screen and (device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="/${out}" />`
  );
  console.log('splash', out);
}

await writeFile(resolve(__dirname, 'apple-splash-links.txt'), links.join('\n') + '\n');
console.log(`\nWrote ${DEVICES.length} splash links to scripts/apple-splash-links.txt`);
