import fs from 'node:fs';

/**
 * "Can a non-technical client edit this without breaking it?" turned into
 * assertions a machine can fail on. Runs against the exact template.json that
 * gets imported, so the claims on the report are produced, never asserted.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', copy: '\u00a9', reg: '\u00ae', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d' };
const decode = (s) => String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10));
  return ENTITIES[e] !== undefined ? ENTITIES[e] : m;
});

const EDITABLE_TEXT_KEYS = new Set(['title', 'editor', 'text', 'testimonial_content', 'testimonial_name', 'testimonial_job', 'caption', 'alt']);
const OPAQUE_WIDGETS = new Set(['html', 'shortcode', 'code', 'raw-html']);

function walk(list, fn, depth = 0, parent = null) {
  for (const e of list) { fn(e, depth, parent); walk(e.elements || [], fn, depth + 1, e); }
}

export function auditEditability(template, model) {
  const findings = [];
  const add = (name, ok, detail) => findings.push({ name, ok, detail });

  const widgets = [], containers = [];
  walk(template.content, (e) => (e.elType === 'widget' ? widgets : containers).push(e));

  // 1. Nothing hides behind a raw HTML or shortcode widget.
  const opaque = widgets.filter((w) => OPAQUE_WIDGETS.has(w.widgetType));
  add('No raw HTML or shortcode widget carries client content', opaque.length === 0,
    opaque.length ? `${opaque.length} found: ${[...new Set(opaque.map((w) => w.widgetType))].join(', ')}` : `${widgets.length} widgets, all native Elementor controls`);

  // 2. Every string the client might want to change sits in an editable field.
  const editable = new Set();
  for (const w of widgets) {
    for (const [k, v] of Object.entries(w.settings)) {
      if (EDITABLE_TEXT_KEYS.has(k) && typeof v === 'string') editable.add(decode(v.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().toLowerCase());
      if (k === 'icon_list' && Array.isArray(v)) for (const row of v) if (row.text) editable.add(decode(row.text).toLowerCase());
    }
  }
  const wantStrings = [];
  const grab = (n) => {
    for (const v of Object.values(n.slots || {})) for (const x of (Array.isArray(v) ? v : [v])) if (x && x.kind !== 'image' && x.text) wantStrings.push(x.text);
    for (const items of Object.values(n.lists || {})) items.forEach(grab);
  };
  model.sections.forEach(grab);
  const notEditable = wantStrings.filter((s) => {
    const t = decode(s).replace(/\s+/g, ' ').trim().toLowerCase();
    return ![...editable].some((e) => e.includes(t.slice(0, Math.min(t.length, 80))));
  });
  add('Every text on the page is a widget field the client can type into', notEditable.length === 0,
    notEditable.length ? `${notEditable.length} not reachable: ${notEditable.slice(0, 3).join(' | ')}` : `${wantStrings.length} strings, all in editable fields`);

  // 3. Images are media fields, so swapping a photo is a click in the library.
  const imgWidgets = widgets.filter((w) => w.widgetType === 'image');
  const badImg = imgWidgets.filter((w) => !w.settings.image || typeof w.settings.image.url !== 'string');
  add('Every photo is a media field, not a background hack', badImg.length === 0,
    `${imgWidgets.length} image widgets, ${containers.filter((c) => c.settings.background_image).length} section backgrounds`);

  // 4. Nobody has to open a font panel: the kit owns typography.
  const localType = [];
  walk(template.content, (e) => { for (const k of Object.keys(e.settings)) if (/^typography_font_size$|_typography_font_size$/.test(k)) localType.push(e.id); });
  add('No font size is set on any element: typography comes from the kit', localType.length === 0,
    localType.length ? `${localType.length} elements carry a local font size` : 'all sizes inherited from Site Settings');

  // 5. Colours resolve through the kit, so a rebrand is one screen.
  const hex = JSON.stringify(template).match(/#[0-9A-Fa-f]{3,8}/g) || [];
  const globals = JSON.stringify(template).match(/globals\/colors\?id=/g) || [];
  add('No colour is hard-coded: every one resolves through the kit', hex.length === 0,
    hex.length ? `${hex.length} literal colours: ${[...new Set(hex)].slice(0, 6).join(', ')}` : `${globals.length} colour references, all global`);

  // 6. Sections are named, so the navigator reads like a page, not like a tree.
  const unnamed = template.content.filter((c) => !c.settings._title || !c.settings._element_id);
  add('Every section is named and has a stable CSS id', unnamed.length === 0,
    unnamed.length ? `${unnamed.length} unnamed` : template.content.map((c) => c.settings._element_id).join(', '));

  // 7. Nothing fragile: no custom CSS, no inline style attribute smuggled in.
  const inlineStyle = [];
  walk(template.content, (e) => {
    if (e.settings.custom_css) inlineStyle.push(`${e.id}:custom_css`);
    if (typeof e.settings.editor === 'string' && /<(style|script)\b|style=/i.test(e.settings.editor)) inlineStyle.push(`${e.id}:editor`);
  });
  add('No custom CSS and no inline styles anywhere', inlineStyle.length === 0,
    inlineStyle.length ? inlineStyle.join(', ') : 'clean');

  return { findings, ok: findings.every((f) => f.ok) };
}

if (process.argv[1] && process.argv[1].endsWith('editability.mjs')) {
  const tpl = JSON.parse(fs.readFileSync(process.argv[2] || 'out/template.json', 'utf8'));
  const model = JSON.parse(fs.readFileSync(process.argv[3] || 'out/model.json', 'utf8'));
  const r = auditEditability(tpl, model);
  for (const f of r.findings) console.log(`${f.ok ? 'PASS' : 'FAIL'}  ${f.name}\n      ${f.detail}`);
  process.exit(r.ok ? 0 : 1);
}
