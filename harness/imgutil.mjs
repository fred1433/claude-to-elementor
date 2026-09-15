import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export function crop(png, top, height) {
  const t = Math.max(0, Math.min(png.height - 1, Math.round(top)));
  const h = Math.max(1, Math.min(png.height - t, Math.round(height)));
  const out = new PNG({ width: png.width, height: h });
  PNG.bitblt(png, out, 0, t, png.width, h, 0, 0);
  return out;
}

/** Plain box-filter resize. Good enough to compare two layouts at a glance. */
export function resize(png, w, h) {
  const out = new PNG({ width: w, height: h });
  const sx = png.width / w, sy = png.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < png.height; yy++) {
        for (let xx = x0; xx < x1 && xx < png.width; xx++) {
          const i = (png.width * yy + xx) << 2;
          r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
        }
      }
      const o = (w * y + x) << 2;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Visual similarity of two sections, normalised to one thumbnail size so that a
 * taller Elementor section is not punished for being taller. Reported next to
 * the checks, never counted in the score: two rendering engines never agree to
 * the pixel, and a number that cannot reach 100 tells a client nothing.
 */
export function similarity(a, b, W = 320) {
  const H = Math.max(40, Math.min(1400, Math.round(W * (a.height / a.width))));
  const ra = resize(a, W, H), rb = resize(b, W, H);
  const diff = new PNG({ width: W, height: H });
  const changed = pixelmatch(ra.data, rb.data, diff.data, W, H, { threshold: 0.2 });
  return { percent: Math.round((1 - changed / (W * H)) * 1000) / 10, diff };
}
