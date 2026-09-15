import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePage } from '../src/parse.mjs';
import { convert } from '../src/convert.mjs';
import { buildKit } from '../src/kit.mjs';
import { auditEditability } from '../harness/editability.mjs';

const html = fs.readFileSync(new URL('../demo/coded/index.html', import.meta.url), 'utf8');
const model = parsePage(html);
const template = convert(model, { mediaBase: 'https://example.test/uploads' });

const walk = (list, fn) => { for (const e of list) { fn(e); walk(e.elements || [], fn); } };
const all = []; walk(template.content, (e) => all.push(e));

/**
 * The grammar is tested on a fixture, not on the demo page. What the demo page
 * happens to contain is the source inventory's business, checked by the harness
 * against the client's live site; a unit test that also hard-coded it would
 * fail first and hide which guard actually caught a dropped section.
 */
const FIXTURE = `<!doctype html><html><head><title>Fixture</title></head><body>
  <section data-sec="hero" data-name="The Hero" data-bg="assets/bg.jpg">
    <p data-slot="eyebrow">Eyebrow</p>
    <h1 data-slot="heading">Headline</h1>
    <div data-slot="actions" class="wrapper-that-should-be-transparent">
      <a data-slot="cta" data-variant="primary" href="tel:123">Call</a>
      <a data-slot="cta" data-variant="secondary" href="/quote">Quote</a>
    </div>
  </section>
  <section data-sec="cards" data-name="Cards">
    <h2 data-slot="heading">Services</h2>
    <div data-list="items">
      <article data-item><h3 data-slot="title">One</h3><p data-slot="body">First</p></article>
      <article data-item><h3 data-slot="title">Two</h3><p data-slot="body">Second</p></article>
    </div>
  </section>
  <section data-sec="footer" data-name="Footer">
    <div data-list="columns">
      <div data-item>
        <h3 data-slot="title">Links</h3>
        <ul data-list="links">
          <li data-item><a data-slot="cta" href="/a">A</a></li>
          <li data-item><a data-slot="cta" href="/b">B</a></li>
        </ul>
      </div>
    </div>
    <p data-slot="legal">Legal</p>
  </section>
</body></html>`;

test('the grammar is read, the markup is not', () => {
  const m = parsePage(FIXTURE);
  assert.deepEqual(m.sections.map((s) => s.type), ['hero', 'cards', 'footer']);

  const hero = m.sections[0];
  assert.equal(hero.id, 'the-hero');            // data-name becomes the id and the Elementor name
  assert.equal(hero.bg, 'assets/bg.jpg');
  assert.equal(hero.slots.heading.text, 'Headline');
  // the wrapper carrying data-slot="actions" is transparent: two ctas, not one group
  assert.equal(hero.slots.cta.length, 2);
  assert.equal(hero.slots.cta[1].variant, 'secondary');
  assert.equal(hero.slots.cta[0].href, 'tel:123');

  assert.equal(m.sections[1].lists.items.length, 2);
  assert.equal(m.sections[1].lists.items[1].slots.title.text, 'Two');

  // lists nest: a footer column is an item that carries a list of its own
  assert.equal(m.sections[2].lists.columns[0].lists.links.length, 2);
  assert.equal(m.sections[2].lists.columns[0].lists.links[0].slots.cta.href, '/a');
});

test('every section type used by the demo page has a handler', () => {
  assert.doesNotThrow(() => convert(model, { mediaBase: 'https://example.test/uploads' }));
  assert.equal(template.content.length, model.sections.length);
});

test('restyling the page does not change the conversion', () => {
  const restyled = html.replace(/class="[^"]*"/g, 'class="totally-different"');
  assert.deepEqual(convert(parsePage(restyled), { mediaBase: 'https://example.test/uploads' }), template);
});

test('the same page converts to byte-identical JSON', () => {
  const again = convert(parsePage(html), { mediaBase: 'https://example.test/uploads' });
  assert.equal(JSON.stringify(again), JSON.stringify(template));
});

test('it is a valid Elementor library template envelope', () => {
  assert.equal(template.type, 'page');
  assert.equal(template.version, '0.4');
  assert.ok(Array.isArray(template.content) && template.content.length === 10);
  for (const e of all) {
    assert.match(e.id, /^[0-9a-f]{7}$/, `bad element id ${e.id}`);
    assert.ok(['container', 'widget'].includes(e.elType));
    if (e.elType === 'widget') assert.ok(typeof e.widgetType === 'string' && e.widgetType.length);
    assert.ok(e.settings && typeof e.settings === 'object');
    assert.ok(Array.isArray(e.elements));
  }
  assert.equal(new Set(all.map((e) => e.id)).size, all.length, 'element ids must be unique');
});

test('only free-tier Elementor widgets are emitted', () => {
  const FREE = new Set(['heading', 'text-editor', 'image', 'button', 'icon-list', 'testimonial', 'star-rating', 'divider', 'spacer', 'social-icons', 'google_maps', 'icon-box', 'image-box']);
  for (const e of all) if (e.elType === 'widget') assert.ok(FREE.has(e.widgetType), `${e.widgetType} is not a free-tier widget`);
});

test('an unknown section type fails the build instead of degrading silently', () => {
  const broken = html.replace('data-sec="cards"', 'data-sec="carousel-of-doom"');
  assert.throws(() => convert(parsePage(broken)), /No handler for section type "carousel-of-doom"/);
});

test('every editability rule holds', () => {
  const r = auditEditability(template, model);
  for (const f of r.findings) assert.ok(f.ok, `${f.name} -> ${f.detail}`);
});

test('the kit carries the design, the page carries none of it', () => {
  const kit = buildKit();
  // The client's own brand red, read off their live stylesheet.
  assert.equal(kit.system_colors.find((c) => c._id === 'secondary').color, '#ED1B24');
  // "Primary" is what Elementor gives a heading a client adds later, so it has
  // to be the headline pair, not the accent.
  assert.equal(kit.system_colors.find((c) => c._id === 'primary').color, '#FFFFFF');
  assert.equal(kit.custom_typography.find((t) => t._id === 'disphero').typography_font_size.size, 72);
  assert.equal((JSON.stringify(template).match(/#[0-9A-Fa-f]{3,8}/g) || []).length, 0);
  assert.ok((JSON.stringify(template).match(/globals\/colors\?id=/g) || []).length > 40);
});

test('every heading points at a kit preset instead of carrying its own look', () => {
  const headings = all.filter((e) => e.widgetType === 'heading');
  assert.ok(headings.length >= 38);
  for (const h of headings) {
    assert.ok(h.settings.__globals__, `heading ${h.settings.title} has no global reference`);
    assert.match(h.settings.__globals__.typography_typography || '', /^globals\/typography\?id=/);
    assert.match(h.settings.__globals__.title_color || '', /^globals\/colors\?id=/);
  }
});

test('the Elementor animation key differs between containers and widgets', () => {
  // A container that carried the widget key would render permanently hidden.
  for (const e of all) {
    if (e.elType === 'container') assert.ok(!e.settings._animation, `container ${e.id} uses the widget animation key`);
    if (e.elType === 'widget') assert.ok(!e.settings.animation, `widget ${e.id} uses the container animation key`);
  }
  assert.ok(all.some((e) => e.elType === 'container' && e.settings.animation === 'fadeInUp'));
  assert.ok(all.some((e) => e.elType === 'widget' && e.settings._animation === 'fadeInUp'));
});

test('media is addressed through the base url, so it resolves in the client library', () => {
  const t2 = convert(model, { mediaBase: 'https://client.example/wp-content/uploads' });
  const wanted = new Set();
  const grab = (n) => {
    for (const v of Object.values(n.slots || {})) for (const x of (Array.isArray(v) ? v : [v])) if (x && x.kind === 'image') wanted.add(x.src.split('/').pop());
    for (const items of Object.values(n.lists || {})) items.forEach(grab);
  };
  for (const sec of model.sections) { grab(sec); if (sec.bg) wanted.add(sec.bg.split('/').pop()); }
  const urls = new Set((JSON.stringify(t2).match(/https:\/\/client\.example[^"]+/g) || []).map((u) => u.split('/').pop()));
  assert.deepEqual([...urls].sort(), [...wanted].sort());
  assert.ok(wanted.size >= 6);
});
