# Elementor Pro, honestly

The demonstration runs on **Elementor free**. WordPress Playground installs
plugins from the WordPress.org directory, and Pro is licensed, so it cannot be
installed there. Rather than simulate Pro widgets and call it a result, here is
what is free, what is Pro, and what the converter would emit instead.

## Free, and used in the demo

| Need | Widget / setting | In the demo |
|---|---|---|
| Layout | Flexbox containers, boxed/full, wrap, gap, per-breakpoint width | every section |
| Headings and body | Heading, Text Editor | 38 + 19 widgets |
| Buttons | Button, with the kit's button style | 14 |
| Photos | Image, Section background image with overlay | 4 + 2 |
| Reviews | Testimonial, Star Rating | 3 + 1 |
| Menus in the footer | Icon List with links | 2 |
| Design system | Kit: global colours, global typography, Theme Style per tag, container width | 78 kit settings |
| Entrance motion | `_animation` (fadeInUp) with per-element delay | 41 elements |

## Pro, mapped not faked

| Need in the ad | Free equivalent used here | What the converter would emit on Pro |
|---|---|---|
| Scroll-triggered reveals | entrance animations (`_animation`), which fire once on enter | `motion_fx` scroll effects: translate, opacity and blur tied to scroll position |
| Parallax | section background, fixed attachment | `background_motion_fx_*` on the container |
| Sticky sections | not attempted | `sticky: top` with `sticky_on` per breakpoint |
| Lead form to HighLevel | button to the existing contact page | Form widget with a Webhook action pointed at the HighLevel inbound URL, plus hidden fields for source and campaign |
| Sliders and galleries | Image widgets | Media Carousel / Gallery |
| Header and footer as reusable parts | the footer is a section of the page | Theme Builder header/footer, with the same grammar emitting `header` / `footer` document types |
| Popups | none | Popup document type with the same container tree |

Two things worth saying plainly. First, none of the above changes the converter's
architecture: a Pro target is a different widget name and a different settings
map inside the same handler, which is a day of work, not a rewrite. Second, the
free build is not a downgrade in the part that matters to a client: global
styles, named sections, native widgets and editable fields are all free-tier
features, and those are what decide whether a non-technical client can safely
edit the page.

## The one thing genuinely worth Pro here

Theme Builder. A header and footer built once as Pro templates, converted from
the same grammar, stop the footer from being duplicated into every page. Until
then, the footer converts as a reusable **saved section**, which gets most of the
way there on the free tier.

## Two Elementor details worth writing down

### The system colour slots are not labels

Elementor's own widget stylesheets read them. A Heading falls back to the
**Primary** colour, a Button falls back to **Accent**, and both rules outrank
the kit's per-tag Theme Style. Put the brand red in the wrong slot and every
call to action on the site comes out in whatever Accent happens to hold, while
Site Settings shows the right palette and the editor looks fine. Here it
rendered the client's Call button in black. Primary is the headline colour,
Accent is the brand red, and a heading or a button added next month is right
before anyone touches it.

The harness now compares the rendered colour of the filled call to action on
both sides, because text and links were all correct while the button was not.

### Containers and widgets name the entrance animation differently
A **widget** registers `_animation` and `_animation_delay`
(`includes/widgets/common-base.php`); a **container** registers `animation` and
`animation_delay` (`includes/elements/container.php`). Meanwhile
`Element_Base::add_render_attribute` adds the `elementor-invisible` class when
*either* key is set.

Put the widget key on a container and you get the worst of both: Elementor hides
the element server-side, and never hands the setting to the frontend script that
would reveal it. The section renders permanently blank on a real visit, while
looking correct in the editor.

Nothing in the export format hints at this. It was caught by the harness, which
measures what a browser actually shows rather than what the JSON contains, and
it is the single best argument for keeping the harness in the loop.
