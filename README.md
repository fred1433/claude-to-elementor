# claude-to-elementor

Turn a finished, coded page into a **client-editable Elementor build**, without
rebuilding it by hand, and prove the result rather than claim it.

The conversion is code. Not a prompt, not a model call: there is no AI API in
this repository, in its tests or in its CI. A model is very good at designing and
writing the page; it is a poor and expensive way to emit five thousand lines of
Elementor JSON, and it emits them slightly differently every time. So the model's
work stops at the coded page, and a deterministic converter does the rest. That
split is why the second conversion is faster than the first.

```
coded page (HTML + the section grammar)
        |  src/parse.mjs        three data attributes, nothing else is read
        v
     page model
        |  src/convert.mjs      one pure handler per section type
        v
out/template.json               an Elementor library template
out/kit.json                    the design system: colours, type scale, buttons
        |  harness/run.mjs
        v
a real WordPress + Elementor, imported through Elementor's own importer,
rendered in a browser, and checked string by string against the model.
```

## Run it

```bash
npm install
npx playwright install chromium

# convert
node src/cli.mjs convert --in demo/coded/index.html --out out \
  --media-base "https://cleancutautoshield.com/wp-content/uploads/cte"

# prove it: boots WordPress + Elementor, imports, renders, compares, scores
node harness/run.mjs
```

The harness needs no Docker and no local PHP. It runs WordPress in
[WordPress Playground](https://wordpress.github.io/wordpress-playground/)
(PHP-WASM), installs a pinned Elementor, and drives the site over HTTP the way a
deploy script would. It exits non-zero the moment a section, a sentence, a link
or an image fails to survive the conversion.

## The demo

`demo/coded/` is one real homepage of a working auto-protection studio, rebuilt
as a modern coded page: same copy, same offers, same phone numbers, same reviews,
same photos. Every string and every image is sourced in
[`demo/content-provenance.md`](demo/content-provenance.md). Nothing was written,
embellished or invented, and no price appears anywhere, because the site does not
publish any.

## What gets measured

**Fidelity** is measured against the page model, not by eyeballing two
screenshots. Every string, href and image file the coded page declares becomes
one check the Elementor render has to satisfy, in the right section, in the right
order. Pixel similarity is measured per section too and reported next to the
checks, but deliberately kept out of the score: two rendering engines never agree
to the pixel, and a number that cannot reach 100 tells a client nothing.

**Coverage** runs first, and it is the check that exists because of what the
others cannot see. The fidelity score compares the render to the coded page it
was given, so a section dropped upstream, during design, disappears from both
sides and the score still reads 100%.
[`demo/source-inventory.json`](demo/source-inventory.json) lists the client's
real sections and the phrases each has to carry, read off their live site. It is
the only thing that remembers what the page was supposed to contain.

The branch `demo/harness-blocks-a-dropped-section` removes the Reviews section
from the coded page and changes nothing else. Its CI run is worth reading:
the tests pass, the conversion is valid and byte-for-byte reproducible, the
editability audit passes, Elementor imports the template, WordPress renders it,
and **fidelity comes back 42 of 42, 100%**. Only coverage fails, 17 of 19, and
the build goes red. That gap, between a page that is faithful to what it was
given and a page that is faithful to the client's site, is the whole reason the
inventory exists.

**Editability** is seven assertions on the template that ships, in
[`harness/editability.mjs`](harness/editability.mjs):

- no raw HTML or shortcode widget carries client content
- every text on the page is a widget field a client can type into
- every photo is a media field, not a background hack
- no font size on any element: typography comes from the kit
- no colour is hard-coded: every one resolves through the kit
- every section is named and has a stable CSS id
- no custom CSS, no inline styles

The last two matter more than they look. A build whose colours live in ninety
widgets is a build nobody dares rebrand.

## Design decisions worth arguing about

- **Element ids are hashed from the structural path**, never random. The same
  page converts to byte-identical JSON, so a diff in a pull request means the
  page changed, not that the generator ran again. CI asserts this.
- **An unknown section type is a hard error**, never a silent fallback to a raw
  HTML block. The silent fallback is exactly the build a client cannot edit.
- **Media by reference.** `--media-base` points at the client's own uploads URL,
  so the imported template resolves against the library the images already live
  in and nothing is duplicated. The harness runs offline, so it re-points the
  same template at a local library before importing; that rewrite is the only
  thing it changes.
- **Free-tier widgets only.** Elementor Pro is licensed and Playground installs
  from the plugin directory, so the demonstration could not honestly use it.
  [`docs/PRO-MAPPING.md`](docs/PRO-MAPPING.md) says what is free, what is Pro,
  and which Pro widget each grammar type would target instead. Nothing is faked.

## Layout

| Path | What |
|---|---|
| `grammar/SECTIONS.md` | the section grammar, and why it exists |
| `src/` | parser, converter, kit, widget factories |
| `harness/` | Playground boot, the WordPress side, the fidelity and editability checks |
| `skill/claude-to-elementor/` | the Claude Code skill: the loop and the rules that earn their place |
| `docs/RUNBOOK.md` | the whole loop as steps, including how to put it on a client's site |
| `docs/PRO-MAPPING.md` | free vs Pro, mapped not faked |
| `demo/` | the coded page, the provenance of its content, and the source inventory |
| `out/`, `report/` | generated: the template, the kit, the fidelity report |

MIT.
