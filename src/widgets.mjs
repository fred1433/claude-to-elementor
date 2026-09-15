/** Factories for the Elementor elements we emit. Free-tier widgets only. */
import { ROLE } from './kit.mjs';

export const px = (t, r, b, l) => ({ unit: 'px', top: String(t), right: String(r), bottom: String(b), left: String(l), isLinked: false });
export const gap = (n) => ({ unit: 'px', size: n, column: String(n), row: String(n), isLinked: true });

export function container(id, { name, elementId, settings = {}, children = [], isInner = false }) {
  const s = { ...settings };
  if (elementId) s._element_id = elementId;
  if (name) { s._title = name; s._css_classes = `cte-${elementId || ''}`.replace(/-$/, ''); }
  return { id, elType: 'container', settings: s, elements: children, isInner };
}

function widget(id, widgetType, settings) {
  return { id, elType: 'widget', settings, elements: [], widgetType };
}

/** Heading. Carries no size and no colour: the kit's Theme Style owns both. */
export function heading(id, { text, tag = 'h2', role, align, animation, delay, globals, extra = {} }) {
  const s = { title: text, header_size: tag, ...extra };
  if (align) s.align = align;
  if (animation) { s._animation = animation; if (delay) s._animation_delay = delay; }
  const g = globals || (role ? ROLE[role] : ROLE[tag]);
  if (g) s.__globals__ = g;
  return widget(id, 'heading', s);
}

export function textEditor(id, { html, align, animation, delay, extra = {} }) {
  const s = { editor: `<p>${html}</p>`, ...extra };
  if (align) s.align = align;
  if (animation) { s._animation = animation; if (delay) s._animation_delay = delay; }
  return widget(id, 'text-editor', s);
}

export function image(id, { src, alt, align = 'center', width, animation, extra = {} }) {
  const s = { image: { url: src, id: '', alt, source: 'library' }, image_size: 'full', align, ...extra };
  if (width) s.width = { unit: 'px', size: width, sizes: [] };
  if (animation) s._animation = animation;
  return widget(id, 'image', s);
}

export function button(id, { text, href, variant = 'primary', align, animation, delay }) {
  const external = /^https?:/i.test(href) && !href.includes('cleancutautoshield.com');
  const s = {
    text,
    link: { url: href, is_external: external ? 'on' : '', nofollow: '', custom_attributes: '' },
    size: 'md',
    button_type: '',
  };
  if (align) s.align = align;
  if (variant === 'secondary') {
    // Outline variant. Transparent is not a colour choice; the visible line
    // comes from the kit's Hairline global, like every other colour here.
    s.background_color = 'rgba(0,0,0,0)';
    s.border_border = 'solid';
    s.border_width = { unit: 'px', top: '1', right: '1', bottom: '1', left: '1', isLinked: true };
    s.__globals__ = { button_border_color: 'globals/colors?id=hairlin' };
  }
  if (variant === 'link') {
    s.background_color = 'rgba(0,0,0,0)';
    s.text_padding = px(0, 0, 0, 0);
    s.__globals__ = { button_text_color: 'globals/colors?id=accent' };
  }
  if (animation) { s._animation = animation; if (delay) s._animation_delay = delay; }
  return widget(id, 'button', s);
}

export function iconList(id, { links, idFor }) {
  return widget(id, 'icon-list', {
    icon_list: links.map((l, i) => ({
      _id: idFor(i),
      text: l.text,
      selected_icon: { value: '', library: '' },
      link: { url: l.href, is_external: '', nofollow: '', custom_attributes: '' },
    })),
    space_between: { unit: 'px', size: 12, sizes: [] },
    icon_typography_typography: '',
    __globals__: { icon_color: 'globals/colors?id=text', text_color: 'globals/colors?id=text' },
  });
}

export function testimonial(id, { content, name, job, animation, delay }) {
  const s = {
    testimonial_content: content,
    testimonial_name: name,
    testimonial_job: job,
    testimonial_image: { url: '', id: '' },
    testimonial_image_position: 'aside',
    testimonial_alignment: 'left',
    __globals__: {
      content_content_color: 'globals/colors?id=primary',
      content_content_typography_typography: 'globals/typography?id=text',
      name_text_color: 'globals/colors?id=primary',
      name_typography_typography: 'globals/typography?id=person17',
      job_text_color: 'globals/colors?id=text',
      job_typography_typography: 'globals/typography?id=kicker12',
    },
  };
  if (animation) { s._animation = animation; if (delay) s._animation_delay = delay; }
  return widget(id, 'testimonial', s);
}

export function starRating(id, { rating = 5, title }) {
  return widget(id, 'star-rating', {
    rating: String(rating),
    rating_scale: '5',
    star_style: 'star_fontawesome',
    title,
    unmarked_star_style: 'outline',
    __globals__: { stars_color: 'globals/colors?id=accent', title_color: 'globals/colors?id=text', title_typography_typography: 'globals/typography?id=text' },
  });
}
