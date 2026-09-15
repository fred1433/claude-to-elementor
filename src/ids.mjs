import { createHash } from 'node:crypto';

/**
 * Elementor element ids are 7 hex characters. We derive them from a stable
 * structural path ("hero/heading", "cards/item-3/cta") instead of randomising,
 * so that converting the same page twice produces byte-identical JSON. That is
 * what makes the output reviewable in a pull request: a diff means the page
 * changed, never that the generator ran again.
 */
export function makeIdFactory() {
  const used = new Set();
  return function id(path) {
    let base = createHash('sha1').update(path).digest('hex').slice(0, 7);
    let n = 0;
    while (used.has(base)) base = createHash('sha1').update(`${path}#${++n}`).digest('hex').slice(0, 7);
    used.add(base);
    return base;
  };
}
