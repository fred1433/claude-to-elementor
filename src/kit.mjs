/**
 * The Elementor Kit: the single place where this build's design lives.
 *
 * Two mechanisms, both native, both editable from Site Settings:
 *  - Theme Style (h1..h6, body, buttons): sets the look per HTML tag site-wide.
 *    Because of it, not one heading widget on the page carries a font size or a
 *    colour of its own. Change the kit, every page changes.
 *  - Global colours and global typography presets: referenced by widgets through
 *    Elementor's own `__globals__` mechanism when a tag-level rule is not enough.
 *
 * Colours and fonts below are read off the client's live site, not invented.
 */

export const GLOBAL = {
  headline: 'globals/colors?id=primary',
  brand: 'globals/colors?id=secondary',
  body: 'globals/colors?id=text',
  surface: 'globals/colors?id=accent',
  card: 'globals/colors?id=cardblk',
  panel: 'globals/colors?id=panelbk',
  hairline: 'globals/colors?id=hairlin',
  muted: 'globals/colors?id=mutedgy',
};

/**
 * Which global colour and which global typography preset each heading role
 * uses. This exists because Elementor's Heading widget does NOT inherit the
 * kit's per-tag Theme Style: its own stylesheet pins colour and size to the
 * global "Primary" pair, at a higher specificity than `.elementor-kit-N h3`.
 * Assigning a global pair per role is Elementor's intended answer, and it keeps
 * the promise that matters: the page holds no value of its own, only pointers
 * into the kit.
 */
export const ROLE = {
  h1: { title_color: 'globals/colors?id=primary', typography_typography: 'globals/typography?id=disphero' },
  h2: { title_color: 'globals/colors?id=primary', typography_typography: 'globals/typography?id=primary' },
  h3: { title_color: 'globals/colors?id=primary', typography_typography: 'globals/typography?id=secondary' },
  h4: { title_color: 'globals/colors?id=primary', typography_typography: 'globals/typography?id=person17' },
  h5: { title_color: 'globals/colors?id=mutedgy', typography_typography: 'globals/typography?id=kicker12' },
  h6: { title_color: 'globals/colors?id=secondary', typography_typography: 'globals/typography?id=accent' },
  stepnum: { title_color: 'globals/colors?id=secondary', typography_typography: 'globals/typography?id=stepnum' },
};

const type = (family, size, weight, lh, ls, transform) => ({
  typography_typography: 'custom',
  typography_font_family: family,
  typography_font_size: { unit: 'px', size, sizes: [] },
  typography_font_weight: weight,
  ...(lh ? { typography_line_height: { unit: 'em', size: lh, sizes: [] } } : {}),
  ...(ls ? { typography_letter_spacing: { unit: 'px', size: ls, sizes: [] } } : {}),
  ...(transform ? { typography_text_transform: transform } : {}),
});

const themeTag = (prefix, color, t, mobileSize) => {
  const out = {};
  for (const [k, v] of Object.entries(t)) out[`${prefix}_${k}`] = v;
  if (mobileSize) out[`${prefix}_typography_font_size_mobile`] = { unit: 'px', size: mobileSize, sizes: [] };
  out[`${prefix}_color`] = color;
  return out;
};

export function buildKit() {
  return {
    // --- palette, read off the client's live stylesheet -------------------
    // "Primary" is the pair Elementor hands to a heading a client drops in
    // later, so it is the headline style, not the brand accent.
    system_colors: [
      { _id: 'primary',   title: 'Headline White', color: '#FFFFFF' },
      { _id: 'secondary', title: 'Brand Red',      color: '#ED1B24' },
      { _id: 'text',      title: 'Body Grey',      color: '#A6A6A6' },
      { _id: 'accent',    title: 'Section Black',  color: '#0A0A0A' },
    ],
    custom_colors: [
      { _id: 'cardblk', title: 'Card Black', color: '#1A1A1A' },
      { _id: 'panelbk', title: 'Panel Black', color: '#141414' },
      { _id: 'hairlin', title: 'Hairline', color: 'rgba(255,255,255,0.10)' },
      { _id: 'mutedgy', title: 'Muted Grey', color: '#6E6E6E' },
    ],
    system_typography: [
      { _id: 'primary',   title: 'Section heading', ...type('Rajdhani', 48, '600', 1.1, -1) },
      { _id: 'secondary', title: 'Card heading',    ...type('Rajdhani', 22, '600', 1.25, 0) },
      { _id: 'text',      title: 'Body',            ...type('Open Sans', 16, '400', 1.75, 0) },
      { _id: 'accent',    title: 'Eyebrow',         ...type('Rajdhani', 13, '600', 1.4, 3, 'uppercase') },
    ],
    custom_typography: [
      { _id: 'disphero', title: 'Hero headline', ...type('Rajdhani', 72, '600', 1.02, -2) },
      { _id: 'lede1900', title: 'Lede',          ...type('Open Sans', 19, '400', 1.65, 0) },
      { _id: 'person17', title: 'Name',          ...type('Rajdhani', 17, '600', 1.3, 0) },
      { _id: 'kicker12', title: 'Kicker',        ...type('Rajdhani', 12, '600', 1.4, 2, 'uppercase') },
      { _id: 'stepnum',  title: 'Step number',   ...type('Rajdhani', 40, '700', 1, 0) },
    ],

    // --- theme style: the look, per HTML tag, for the whole site ----------
    ...themeTag('h1', '#FFFFFF', type('Rajdhani', 72, '600', 1.02, -2), 40),
    ...themeTag('h2', '#FFFFFF', type('Rajdhani', 48, '600', 1.1, -1), 32),
    ...themeTag('h3', '#FFFFFF', type('Rajdhani', 22, '600', 1.25, 0), 20),
    ...themeTag('h4', '#FFFFFF', type('Rajdhani', 17, '600', 1.3, 0), 17),
    ...themeTag('h5', '#6E6E6E', type('Rajdhani', 12, '600', 1.4, 2, 'uppercase'), 12),
    ...themeTag('h6', '#ED1B24', type('Rajdhani', 13, '600', 1.4, 3, 'uppercase'), 13),
    body_color: '#A6A6A6',
    ...Object.fromEntries(Object.entries(type('Open Sans', 16, '400', 1.75, 0)).map(([k, v]) => [`body_${k}`, v])),
    link_normal_color: '#ED1B24',
    link_hover_color: '#FFFFFF',

    // --- buttons ---------------------------------------------------------
    button_typography_typography: 'custom',
    button_typography_font_family: 'Rajdhani',
    button_typography_font_size: { unit: 'px', size: 15, sizes: [] },
    button_typography_font_weight: '600',
    button_typography_letter_spacing: { unit: 'px', size: 1, sizes: [] },
    button_typography_text_transform: 'uppercase',
    button_text_color: '#FFFFFF',
    button_background_color: '#ED1B24',
    button_border_radius: { unit: 'px', top: '2', right: '2', bottom: '2', left: '2', isLinked: true },
    button_padding: { unit: 'px', top: '16', right: '30', bottom: '16', left: '30', isLinked: false },
    button_hover_text_color: '#FFFFFF',
    button_background_hover_color: '#C7151C',

    // --- layout ----------------------------------------------------------
    container_width: { unit: 'px', size: 1200, sizes: [] },
    space_between_widgets: { unit: 'px', size: 0, sizes: [] },
    page_title_selector: 'h1.entry-title',
    viewport_mobile: 767,
    viewport_tablet: 1024,
    default_generic_fonts: 'Sans-serif',
  };
}
