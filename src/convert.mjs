import { makeIdFactory } from './ids.mjs';
import { GLOBAL } from './kit.mjs';
import { container, heading, textEditor, image, button, iconList, testimonial, starRating, px, gap } from './widgets.mjs';

/**
 * Page model -> Elementor template JSON.
 *
 * One handler per section type of the grammar. Every handler is pure: same
 * model in, byte-identical JSON out. Nothing here calls a model, a service or
 * a network: the conversion is code, so it is reviewable, testable and it costs
 * nothing to run a hundred times.
 */

// Section padding mirrors the coded page exactly (py-32, and py-44 on the
// hero). Getting this wrong costs nothing in the checks and everything in the
// side by side: a 50px difference per section compounds down the page until
// the two renders no longer line up.
const SECTION_PAD = px(128, 24, 128, 24);
const SECTION_PAD_M = px(64, 20, 64, 20);
const HERO_PAD = px(176, 24, 176, 24);

const notes = [];
export function takeNotes() { const n = [...notes]; notes.length = 0; return n; }
const note = (section, what, why) => notes.push({ section, what, why });

function mediaUrl(src, base) {
  if (!base) return src;
  return `${base.replace(/\/$/, '')}/${src.replace(/^.*\//, '')}`;
}

function section(id, name, elementId, extra, children) {
  return container(id, {
    name, elementId, children,
    settings: {
      content_width: 'boxed',
      flex_direction: 'column',
      padding: SECTION_PAD,
      padding_mobile: SECTION_PAD_M,
      ...extra,
    },
  });
}

function bgSettings(url) {
  return {
    background_background: 'classic',
    background_image: { url, id: '', source: 'library' },
    background_position: 'center center',
    background_size: 'cover',
    background_overlay_background: 'classic',
    background_overlay_opacity: { unit: 'px', size: 0.8, sizes: [] },
    __globals__: { background_overlay_color: GLOBAL.surface },
  };
}

const solid = (globalKey) => ({ background_background: 'classic', __globals__: { background_color: globalKey } });

/**
 * Measure. A headline set across 1200 pixels is the difference between a page
 * that was designed and a page that was generated, so the converter carries a
 * width per slot and hands it to Elementor's own width control, which stays
 * editable in the Advanced tab. Full width again on mobile.
 */
const measure = (pct) => (pct ? {
  _element_width: 'initial',
  _element_custom_width: { unit: '%', size: pct, sizes: [] },
  _element_custom_width_mobile: { unit: '%', size: 100, sizes: [] },
} : {});

function stack(id, sec, ctx, { align, headingTag = 'h2', headWidth = 52, bodyWidth = 54, lede = false } = {}) {
  const { s } = ctx;
  const out = [];
  let d = 0;
  if (sec.slots.eyebrow) out.push(heading(s(`${sec.id}/eyebrow`), { text: sec.slots.eyebrow.text, tag: 'h6', align, animation: 'fadeInUp', delay: (d += 0) }));
  if (sec.slots.heading) out.push(heading(s(`${sec.id}/heading`), { text: sec.slots.heading.text, tag: headingTag, align, animation: 'fadeInUp', delay: (d += 100), extra: measure(headWidth) }));
  if (sec.slots.body) out.push(textEditor(s(`${sec.id}/body`), {
    html: sec.slots.body.html, align, animation: 'fadeInUp', delay: (d += 100),
    extra: { margin: px(24, 0, 0, 0), ...measure(bodyWidth), ...(lede ? { __globals__: { typography_typography: 'globals/typography?id=lede1900' } } : {}) },
  }));
  return out;
}

function actions(sec, ctx, align) {
  const { s } = ctx;
  const ctas = [].concat(sec.slots.cta || []);
  if (!ctas.length) return [];
  return [container(s(`${sec.id}/actions`), {
    name: 'Actions', elementId: `${sec.id}-actions`, isInner: true,
    settings: {
      content_width: 'full', flex_direction: 'row', flex_wrap: 'wrap',
      flex_justify_content: align === 'center' ? 'center' : 'flex-start',
      flex_gap: gap(16), padding: px(24, 0, 0, 0), width: { unit: '%', size: 100 },
    },
    children: ctas.map((c, i) => button(s(`${sec.id}/cta-${i}`), { text: c.text, href: c.href, variant: c.variant, animation: 'fadeInUp', delay: 300 })),
  })];
}

function grid(sec, ctx, cards, per) {
  const { s } = ctx;
  const width = per === 3 ? 31.5 : 48;
  return container(s(`${sec.id}/grid`), {
    name: 'Grid', elementId: `${sec.id}-grid`, isInner: true,
    settings: {
      content_width: 'full', flex_direction: 'row', flex_wrap: 'wrap',
      flex_gap: gap(24), padding: px(48, 0, 0, 0), width: { unit: '%', size: 100 },
    },
    children: cards.map((c, i) => container(s(`${sec.id}/card-${i}`), {
      name: `Card ${i + 1}`, elementId: `${sec.id}-card-${i + 1}`, isInner: true,
      settings: {
        content_width: 'full', flex_direction: 'column', flex_gap: gap(0),
        width: { unit: '%', size: width }, width_mobile: { unit: '%', size: 100 },
        padding: px(32, 28, 32, 28),
        background_background: 'classic',
        border_border: 'solid',
        border_width: { unit: 'px', top: '1', right: '1', bottom: '1', left: '1', isLinked: true },
        border_radius: { unit: 'px', top: '2', right: '2', bottom: '2', left: '2', isLinked: true },
        __globals__: { background_color: GLOBAL.card, border_color: GLOBAL.hairline },
        // Containers register the entrance animation as `animation`; widgets
        // register it as `_animation` (see includes/elements/container.php vs
        // includes/widgets/common-base.php). Using the widget key on a
        // container makes Elementor render it with `elementor-invisible` and
        // never expose the setting to the frontend script, so the card stays
        // hidden for good. The fidelity harness is what caught it.
        animation: 'fadeInUp', animation_delay: 80 * i,
      },
      children: c(s, i),
    })),
  });
}

const HANDLERS = {
  hero: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, { ...bgSettings(mediaUrl(sec.bg, ctx.mediaBase)), padding: HERO_PAD }, [
    ...stack(null, sec, ctx, { headingTag: 'h1', headWidth: 54, bodyWidth: 48, lede: true }),
    ...actions(sec, ctx),
  ]),

  trustbar: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, {
    ...solid(GLOBAL.card), padding: px(40, 24, 40, 24),
    border_border: 'solid', border_width: { unit: 'px', top: '1', right: '0', bottom: '1', left: '0', isLinked: false },
    __globals__: { background_color: GLOBAL.card, border_color: GLOBAL.hairline },
  }, [
    image(ctx.s(`${sec.id}/media`), { src: mediaUrl(sec.slots.media.src, ctx.mediaBase), alt: sec.slots.media.alt, width: 860 }),
  ]),

  split: (sec, ctx) => {
    const { s } = ctx;
    const text = container(s(`${sec.id}/col-text`), {
      name: 'Text column', elementId: `${sec.id}-text`, isInner: true,
      settings: { content_width: 'full', flex_direction: 'column', flex_gap: gap(0), width: { unit: '%', size: 48 }, width_mobile: { unit: '%', size: 100 } },
      children: [...stack(null, sec, ctx, { headWidth: 0, bodyWidth: 0 }), ...actions(sec, ctx)],
    });
    const media = container(s(`${sec.id}/col-media`), {
      name: 'Media column', elementId: `${sec.id}-media`, isInner: true,
      settings: { content_width: 'full', flex_direction: 'column', width: { unit: '%', size: 48 }, width_mobile: { unit: '%', size: 100 } },
      children: [image(s(`${sec.id}/media`), { src: mediaUrl(sec.slots.media.src, ctx.mediaBase), alt: sec.slots.media.alt, align: 'center', animation: 'fadeIn' })],
    });
    return section(s(sec.id), sec.name, sec.id, {
      ...solid(sec.reverse ? GLOBAL.surface : GLOBAL.surface),
      // nowrap on desktop: two 48% children plus a 64px gap exceed 100% and
      // would wrap to two stacked rows. They shrink to fit instead.
      flex_direction: sec.reverse ? 'row-reverse' : 'row',
      flex_wrap: 'nowrap', flex_align_items: 'center', flex_gap: gap(64),
      flex_direction_mobile: 'column', flex_wrap_mobile: 'wrap', flex_gap_mobile: gap(40),
    }, [text, media]);
  },

  cards: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, solid(GLOBAL.panel), [
    ...stack(null, sec, ctx, { headWidth: 48, bodyWidth: 54 }),
    grid(sec, ctx, sec.lists.items.map((it) => (s, i) => [
      heading(s(`${sec.id}/card-${i}/title`), { text: it.slots.title.text, tag: 'h3' }),
      textEditor(s(`${sec.id}/card-${i}/body`), { html: it.slots.body.html, extra: { margin: px(16, 0, 0, 0) } }),
      ...(it.slots.cta ? [container(s(`${sec.id}/card-${i}/act`), {
        name: 'Link', elementId: `${sec.id}-card-${i + 1}-link`, isInner: true,
        settings: { content_width: 'full', flex_direction: 'row', padding: px(24, 0, 0, 0), width: { unit: '%', size: 100 } },
        children: [button(s(`${sec.id}/card-${i}/cta`), { text: it.slots.cta.text, href: it.slots.cta.href, variant: 'link' })],
      })] : []),
    ]), 3),
  ]),

  numbered: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, solid(GLOBAL.surface), [
    ...stack(null, sec, ctx, { headWidth: 46, bodyWidth: 54 }),
    grid(sec, ctx, sec.lists.items.map((it) => (s, i) => [
      heading(s(`${sec.id}/card-${i}/index`), { text: it.slots.index.text, tag: 'div', role: 'stepnum' }),
      heading(s(`${sec.id}/card-${i}/title`), { text: it.slots.title.text, tag: 'h3', extra: { margin: px(20, 0, 0, 0) } }),
      heading(s(`${sec.id}/card-${i}/kicker`), { text: it.slots.kicker.text, tag: 'h5', extra: { margin: px(8, 0, 0, 0) } }),
      textEditor(s(`${sec.id}/card-${i}/body`), { html: it.slots.body.html, extra: { margin: px(16, 0, 0, 0) } }),
    ]), 3),
  ]),

  reviews: (sec, ctx) => {
    const { s } = ctx;
    const rating = sec.slots.rating ? [starRating(s(`${sec.id}/stars`), { rating: 5, title: sec.slots.rating.text })] : [];
    return section(s(sec.id), sec.name, sec.id, solid(GLOBAL.card), [
      heading(s(`${sec.id}/eyebrow`), { text: sec.slots.eyebrow.text, tag: 'h6', animation: 'fadeInUp' }),
      heading(s(`${sec.id}/heading`), { text: sec.slots.heading.text, tag: 'h2', animation: 'fadeInUp', delay: 100, extra: measure(50) }),
      ...rating,
      grid(sec, ctx, sec.lists.items.map((it) => (s2, i) => [
        testimonial(s2(`${sec.id}/card-${i}/t`), { content: it.slots.body.text, name: it.slots.author.text, job: it.slots.meta.text }),
      ]), 3),
    ]);
  },

  location: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, solid(GLOBAL.card), [
    ...stack(null, sec, ctx, { headWidth: 50, bodyWidth: 46 }),
    ...actions(sec, ctx),
  ]),

  cta: (sec, ctx) => section(ctx.s(sec.id), sec.name, sec.id, {
    ...bgSettings(mediaUrl(sec.bg, ctx.mediaBase)),
    background_overlay_opacity: { unit: 'px', size: 0.84, sizes: [] },
    flex_align_items: 'center',
  }, [
    heading(ctx.s(`${sec.id}/heading`), { text: sec.slots.heading.text, tag: 'h2', align: 'center', animation: 'fadeInUp', extra: measure(56) }),
    ...actions(sec, ctx, 'center'),
  ]),

  footer: (sec, ctx) => {
    const { s } = ctx;
    const cols = sec.lists.columns.map((col, i) => container(s(`${sec.id}/col-${i}`), {
      name: `Footer column ${i + 1}`, elementId: `${sec.id}-col-${i + 1}`, isInner: true,
      settings: { content_width: 'full', flex_direction: 'column', flex_gap: gap(0), width: { unit: '%', size: 30 }, width_mobile: { unit: '%', size: 100 } },
      children: [
        ...(col.slots.media ? [image(s(`${sec.id}/col-${i}/logo`), { src: mediaUrl(col.slots.media.src, ctx.mediaBase), alt: col.slots.media.alt, align: 'left', width: 150 })] : []),
        ...(col.slots.title ? [heading(s(`${sec.id}/col-${i}/title`), { text: col.slots.title.text, tag: 'h5' })] : []),
        ...(col.slots.body ? [textEditor(s(`${sec.id}/col-${i}/body`), { html: col.slots.body.html, extra: { margin: px(24, 0, 0, 0) } })] : []),
        ...(col.lists.links ? [iconList(s(`${sec.id}/col-${i}/links`), {
          links: col.lists.links.map((l) => l.slots.cta),
          idFor: (n) => s(`${sec.id}/col-${i}/link-${n}`),
        })] : []),
      ],
    }));
    return section(s(sec.id), sec.name, sec.id, {
      ...solid(GLOBAL.surface),
      padding: px(96, 24, 96, 24),
      border_border: 'solid',
      border_width: { unit: 'px', top: '1', right: '0', bottom: '0', left: '0', isLinked: false },
      __globals__: { background_color: GLOBAL.surface, border_color: GLOBAL.hairline },
    }, [
      container(s(`${sec.id}/cols`), {
        name: 'Footer columns', elementId: `${sec.id}-columns`, isInner: true,
        settings: { content_width: 'full', flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(48), width: { unit: '%', size: 100 } },
        children: cols,
      }),
      textEditor(s(`${sec.id}/legal`), { html: sec.slots.legal.html, extra: { margin: px(56, 0, 0, 0) } }),
    ]);
  },
};

export function convert(model, { mediaBase = '', title } = {}) {
  const s = makeIdFactory();
  const ctx = { s, mediaBase };
  notes.length = 0;
  const content = model.sections.map((sec) => {
    const h = HANDLERS[sec.type];
    if (!h) throw new Error(`No handler for section type "${sec.type}" (section "${sec.id}"). Add one to src/convert.mjs or fix the grammar.`);
    return h(sec, ctx);
  });
  return {
    version: '0.4',
    title: title || model.title,
    type: 'page',
    content,
    page_settings: {},
  };
}
