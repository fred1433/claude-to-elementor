/**
 * Pulls the same three things out of either page: which sections are there and
 * in what order, what text each one renders, and which links and images it
 * carries. Runs in the browser, so what it reports is what a visitor sees, not
 * what the markup claims.
 *
 * Two details that matter. Background images are read off the section element
 * itself as well as its descendants, because that is where a hero background
 * lives. Image names keep the `src` attribute rather than `currentSrc`:
 * WordPress adds a responsive srcset, so `currentSrc` is whichever resized
 * variant the browser picked, and comparing those would measure the viewport
 * rather than the conversion.
 */
export const EXTRACT = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const base = (u) => (u || '').split('?')[0].split('/').pop();
  const roots = Array.from(document.querySelectorAll('[data-sec]'));
  const list = roots.length
    ? roots.map((el) => ({ el, id: (el.getAttribute('data-name') || el.getAttribute('data-sec') || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }))
    : Array.from(document.querySelectorAll('.elementor > .e-con, .elementor > .elementor-element')).map((el) => ({ el, id: el.id || '' }));
  return list.map(({ el, id }) => {
    const r = el.getBoundingClientRect();
    const imgs = Array.from(el.querySelectorAll('img')).map((i) => ({
      name: base(i.getAttribute('src') || i.currentSrc || i.src),
      ok: i.naturalWidth > 0,
    }));
    for (const n of [el, ...el.querySelectorAll('*')]) {
      const bg = getComputedStyle(n).backgroundImage;
      const m = bg && bg.match(/url\\(["']?([^"')]+)["']?\\)/);
      if (m) imgs.push({ name: base(m[1]), ok: true, bg: true });
    }
    return {
      id,
      text: norm(el.innerText),
      links: Array.from(el.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
      images: imgs,
      box: { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) },
    };
  });
})()`;

/**
 * Both pages are given the same chance to finish before anything is measured:
 * every image decoded, every web font ready, and every Elementor entrance
 * animation played out. Elementor ships animated elements with
 * `visibility: hidden`, and a harness that measured before they revealed would
 * report content as missing when it is merely still arriving.
 */
export const SETTLE = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = (p, ms) => Promise.race([p, wait(ms)]);

  // One pass down the page, then each element that is still waiting is scrolled
  // into view on its own. Elementor lazy-loads section backgrounds and holds
  // animated elements at visibility:hidden until they enter the viewport, so a
  // harness that never brings them into view would report a correct page as
  // half empty. This is a visitor scrolling, not a workaround.
  const limit = Math.min(document.body.scrollHeight, 40000);
  for (let y = 0; y < limit; y += 400) { window.scrollTo(0, y); await wait(90); }
  for (let round = 0; round < 5; round++) {
    const pending = Array.from(document.querySelectorAll('.elementor-invisible'));
    if (!pending.length) break;
    for (const el of pending) { el.scrollIntoView({ block: 'center' }); await wait(130); }
    await wait(500);
  }
  window.scrollTo(0, document.body.scrollHeight);
  await wait(500);
  window.scrollTo(0, 0);
  await wait(500);

  await cap(Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); })))), 15000);
  if (document.fonts) await cap(document.fonts.ready, 10000);
  await wait(700);
  return {
    stillInvisible: document.querySelectorAll('.elementor-invisible').length,
    brokenImages: Array.from(document.images).filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
  };
})()`;
