# The section grammar

A coded page converts to Elementor without anyone rebuilding it by hand when it
says what its parts *are*. That is all this grammar is: three data attributes
that name the parts of a page, plus a fixed vocabulary of section types.

Nothing else is read. Classes, inline styles, wrappers, the CSS framework, the
order of divs: the converter ignores all of it. Restyle the page as much as you
like and the conversion does not change.

## The three attributes

| Attribute | On | Means |
|---|---|---|
| `data-sec="<type>"` | a `<section>` | this is one section, of this type |
| `data-slot="<name>"` | anything inside | this element is the section's `<name>` |
| `data-list="<name>"` + `data-item` | a wrapper and its children | a repeating group |

Two extras on a section: `data-name="Studio intro"` becomes the section's name in
the Elementor navigator and its CSS id; `data-bg="path.jpg"` becomes the section
background.

A `data-slot` element that contains other `data-slot` elements is treated as a
wrapper and its own name is ignored, so `data-slot="actions"` around two links
simply yields two `cta` values. Lists nest: a footer column is a `data-item` that
itself carries a `data-list="links"`.

What a slot yields depends on the tag, not on a configuration file:
`<img>` gives `{src, alt}`, `<a>` gives `{text, href, variant}`, anything else
gives its text and its inner HTML.

## The vocabulary

| `data-sec` | Slots | Lists | Becomes, in Elementor |
|---|---|---|---|
| `hero` | `eyebrow` `heading` `body` `cta`* | | full-width container, background image + overlay, `h1`, text editor, buttons |
| `trustbar` | `media` | | bordered strip, one image widget |
| `split` | `eyebrow` `heading` `body` `cta`* `media` | | two flex containers, 48/48, stacking on mobile. `data-reverse` flips them |
| `cards` | `eyebrow` `heading` `body` | `items`: `title` `body` `cta` | heading block, then a wrapping row of card containers |
| `numbered` | `eyebrow` `heading` `body` | `items`: `index` `title` `kicker` `body` | same, with the step number on a global typography preset |
| `reviews` | `eyebrow` `heading` `rating` | `items`: `body` `author` `meta` | star rating widget, then native Testimonial widgets |
| `location` | `eyebrow` `heading` `body` `cta`* | | heading block and buttons |
| `cta` | `heading` `cta`* | | background image, centred heading, centred buttons |
| `footer` | `legal` | `columns`: `media` `title` `body` + `links` | a row of columns, native Icon List for link menus |

`*` means the slot can repeat.

Adding a type is one handler in `src/convert.mjs`. An unknown type is a hard
error, never a silent fallback: a page that does not convert should say so
loudly, at build time.

## Why impose a grammar at all

Two reasons, and the second is the one that matters.

**It makes the conversion deterministic.** The same page in gives the same JSON
out, byte for byte, because element ids are hashed from the structural path
rather than randomised. A pull request shows what changed in the page, not that
the generator ran again.

**It makes the design buildable in Elementor.** The vocabulary is small on
purpose: every type maps to constructs Elementor has natively, so fidelity is a
question of care rather than of luck. A page written free-hand with sticky
scroll canvases and CSS grid areas can be converted too, but only by falling
back to raw HTML blocks, and that is exactly the build a client cannot safely
edit. The grammar is the discipline that keeps the output editable.

It is not a restriction on how a page looks. Every page in this repository's demo
is the client's real content laid out freely: the grammar constrains what the
parts are called, never how they are designed.

## The check the grammar cannot do on its own

A grammar tells you how to convert what you were handed. It cannot tell you that
something was never handed over. Drop a section during design and the converter
produces a smaller template that imports cleanly and renders without an error,
and the fidelity score still reads 100%, because it compares the render to the
coded page.

That is what `demo/source-inventory.json` is for: the client's real sections and
the phrases each one carries, read off their live site, checked before anything
else. It is the cheapest file in the repository and the only one that would have
caught a page shipped with a piece missing.
