import fs from 'node:fs';
import path from 'node:path';

/**
 * The score.
 *
 * Fidelity is measured against the page MODEL, not by eyeballing two
 * screenshots. Every string, every href and every image file the coded page
 * declares becomes one check that the Elementor render has to satisfy, in the
 * right section. A missing section, a dropped sentence or a broken image each
 * fail a named check, and a failed check fails the run.
 *
 * Pixel similarity is measured too, per section, and reported next to the
 * checks. It is deliberately NOT part of the score: two different rendering
 * engines will never agree to the pixel, and a number that can never reach 100
 * tells a client nothing.
 */

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const strip = (s) => norm(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
/**
 * The same source image, compared across two renderers. WordPress appends a
 * `-WxH` suffix for each responsive size it generates, so the suffix is dropped
 * before comparing: `hero-1024x576.jpg` and `hero.jpg` are the same photo.
 * Only a trailing suffix is stripped, so a file genuinely named
 * `logos-1750x125-1.png` keeps its name.
 */
const fileOf = (u) => (u || '').split('?')[0].split('/').pop().replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');

function stringsOf(node) {
  const out = [];
  const push = (v) => {
    if (!v) return;
    if (v.kind === 'text' && v.text) out.push({ kind: 'text', value: v.text });
    if (v.kind === 'link') { if (v.text) out.push({ kind: 'text', value: v.text }); if (v.href) out.push({ kind: 'link', value: v.href }); }
    if (v.kind === 'image' && v.src) out.push({ kind: 'image', value: fileOf(v.src) });
  };
  for (const v of Object.values(node.slots || {})) (Array.isArray(v) ? v : [v]).forEach(push);
  for (const items of Object.values(node.lists || {})) for (const it of items) out.push(...stringsOf(it));
  return out;
}

export function score(model, rendered, { bgFiles = [] } = {}) {
  const bySection = new Map(rendered.map((s) => [s.id, s]));
  const order = rendered.map((s) => s.id);
  const sections = [];
  let pass = 0, total = 0;

  model.sections.forEach((sec, i) => {
    const checks = [];
    const add = (name, ok, detail) => { checks.push({ name, ok, detail }); total++; if (ok) pass++; };
    const r = bySection.get(sec.id);

    add('section present', !!r, r ? '' : `no element with id "${sec.id}" in the Elementor render`);
    add('section in order', order[i] === sec.id, order[i] === sec.id ? '' : `expected "${sec.id}" at position ${i + 1}, found "${order[i] || '(nothing)'}"`);

    if (r) {
      const text = strip(r.text);
      const hrefs = new Set(r.links.map((h) => norm(h)));
      const imgs = new Map(r.images.map((im) => [fileOf(im.name), im.ok]));
      const wanted = stringsOf(sec);
      if (sec.bg) wanted.push({ kind: 'image', value: fileOf(sec.bg) });

      const missText = [], missLink = [], missImg = [], brokeImg = [];
      for (const w of wanted) {
        if (w.kind === 'text') { if (!text.includes(strip(w.value))) missText.push(w.value.slice(0, 60)); }
        else if (w.kind === 'link') { if (!hrefs.has(norm(w.value))) missLink.push(w.value); }
        else { const f = fileOf(w.value); if (!imgs.has(f)) missImg.push(f); else if (!imgs.get(f)) brokeImg.push(f); }
      }
      const nText = wanted.filter((w) => w.kind === 'text').length;
      const nLink = wanted.filter((w) => w.kind === 'link').length;
      const nImg = wanted.filter((w) => w.kind === 'image').length;
      add(`text preserved (${nText})`, missText.length === 0, missText.length ? `missing: ${missText.join(' | ')}` : '');
      add(`links preserved (${nLink})`, missLink.length === 0, missLink.length ? `missing: ${missLink.join(' | ')}` : '');
      if (nImg) add(`images present and loaded (${nImg})`, missImg.length === 0 && brokeImg.length === 0,
        [missImg.length ? `missing: ${missImg.join(', ')}` : '', brokeImg.length ? `broken: ${brokeImg.join(', ')}` : ''].filter(Boolean).join(' / '));
    }

    sections.push({ id: sec.id, name: sec.name, type: sec.type, checks, ok: checks.every((c) => c.ok) });
  });

  const extra = order.filter((id) => !model.sections.some((s) => s.id === id));
  return { sections, pass, total, extra, percent: total ? Math.round((pass / total) * 1000) / 10 : 0 };
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
