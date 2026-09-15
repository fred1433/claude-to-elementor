import { parse as parseHtml } from 'node-html-parser';

/**
 * Reads a coded page that follows the section grammar (see grammar/SECTIONS.md)
 * and returns a plain page model. The parser knows THREE attributes and nothing
 * else about your design: data-sec, data-slot, data-list/data-item.
 * Classes, inline styles and markup structure are deliberately ignored, so the
 * same page can be restyled freely without touching the conversion.
 */

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

function valueOf(el) {
  const tag = el.tagName ? el.tagName.toUpperCase() : '';
  if (tag === 'IMG') {
    return {
      kind: 'image',
      src: el.getAttribute('src') || '',
      alt: el.getAttribute('alt') || '',
      width: el.getAttribute('width') || '',
      height: el.getAttribute('height') || '',
    };
  }
  if (tag === 'A') {
    return {
      kind: 'link',
      text: norm(el.text),
      href: el.getAttribute('href') || '',
      variant: el.getAttribute('data-variant') || 'primary',
    };
  }
  return { kind: 'text', text: norm(el.text), html: (el.innerHTML || '').trim() };
}

function nearestAncestorWith(el, attr, stopAt) {
  let p = el.parentNode;
  while (p && p !== stopAt) {
    if (p.getAttribute && p.getAttribute(attr) !== undefined && p.getAttribute(attr) !== null) return p;
    p = p.parentNode;
  }
  return null;
}

function addSlot(node, name, value) {
  if (node.slots[name] === undefined) node.slots[name] = value;
  else if (Array.isArray(node.slots[name])) node.slots[name].push(value);
  else node.slots[name] = [node.slots[name], value];
}

function collect(el, node) {
  for (const child of el.childNodes) {
    if (child.nodeType !== 1) continue;
    const listName = child.getAttribute('data-list');
    if (listName !== null && listName !== undefined) {
      const items = [];
      for (const it of child.querySelectorAll('[data-item]')) {
        if (nearestAncestorWith(it, 'data-list', null) !== child) continue;
        const n = { slots: {}, lists: {} };
        const own = it.getAttribute('data-slot');
        if (own !== null && own !== undefined && !it.querySelector('[data-slot]')) addSlot(n, own, valueOf(it));
        collect(it, n);
        items.push(n);
      }
      node.lists[listName] = items;
      continue;
    }
    const slotName = child.getAttribute('data-slot');
    if (slotName !== null && slotName !== undefined && !child.querySelector('[data-slot]') && !child.querySelector('[data-list]')) {
      addSlot(node, slotName, valueOf(child));
      continue;
    }
    collect(child, node);
  }
}

export function parsePage(html) {
  const root = parseHtml(html, { blockTextElements: { script: false, style: false } });
  const title = norm(root.querySelector('title')?.text) || 'Untitled';
  const description = root.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const sections = [];
  const seen = new Set();

  for (const el of root.querySelectorAll('[data-sec]')) {
    const type = el.getAttribute('data-sec');
    const name = el.getAttribute('data-name') || type;
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    while (seen.has(slug)) slug += '-2';
    seen.add(slug);
    const node = { type, name, id: slug, slots: {}, lists: {} };
    const bg = el.getAttribute('data-bg');
    if (bg) node.bg = bg;
    if (el.getAttribute('data-reverse') !== null && el.getAttribute('data-reverse') !== undefined) node.reverse = true;
    collect(el, node);
    sections.push(node);
  }
  return { title, description, sections };
}
