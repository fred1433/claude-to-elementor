#!/usr/bin/env node
/**
 * Generates the sample page's images.
 *
 * They are drawn here, in code, rather than taken from anywhere. A public
 * repository that ships a converter has no business also shipping somebody
 * else's photographs, and a synthetic image makes the demonstration
 * reproducible offline into the bargain.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coded/assets');
fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Flat bands, no dithering: the images stay a few kilobytes each, which is
// what a repository should carry.
function gradient(file, w, h, from, to, { bars = 0, steps = 24 } = {}) {
  const png = new PNG({ width: w, height: h });
  const a = hex(from), b = hex(to);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = (x / w) * 0.6 + (y / h) * 0.4;
      const t = Math.round(raw * steps) / steps;
      let [r, g, bl] = mix(a, b, t);
      if (bars && ((x + y * 0.4) % (w / bars)) < w / (bars * 6)) { r = Math.min(255, r + 26); g = Math.min(255, g + 26); bl = Math.min(255, bl + 26); }
      const i = (w * y + x) << 2;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = bl; png.data[i + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png, { deflateLevel: 9 }));
  return file;
}

const made = [
  gradient('hero.png', 1600, 900, '#1B2430', '#4A5A6B', { bars: 7 }),
  gradient('workshop.png', 1200, 800, '#20303C', '#5E7285', { bars: 5 }),
  gradient('detail.png', 1200, 800, '#2A2118', '#6E5A44', { bars: 9 }),
  gradient('closing.png', 1600, 900, '#161C24', '#3B4A5A', { bars: 4 }),
  gradient('accreditations.png', 1600, 120, '#141A21', '#2C3743', { bars: 12 }),
  gradient('mark.png', 400, 280, '#1F6F4A', '#7FD1A6', {}),
];
console.log(`wrote ${made.length} synthetic images to ${path.relative(process.cwd(), OUT)}`);
