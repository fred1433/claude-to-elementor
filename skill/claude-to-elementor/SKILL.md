---
name: claude-to-elementor
description: Turn a finished, coded page into a client-editable Elementor build without rebuilding it by hand. Use when a page designed and coded in Claude Code has to ship on WordPress as an Elementor page a non-technical client can edit, when an Elementor JSON template has to be generated from HTML, or when a conversion needs to be proven faithful before it goes to a client.
---

# Claude to Elementor

The conversion is **code, not a prompt**. A model is good at writing the page and
at naming its parts; it is a poor and expensive way to emit five thousand lines
of Elementor JSON, and it will emit them slightly differently every time. So the
model's job stops at the coded page, and a deterministic converter does the rest.
That split is why the second conversion is faster than the first, and the tenth
faster still.

## The loop

1. **Design and code the page.** Normal work. The one rule is that every section
   carries `data-sec`, and its parts carry `data-slot` / `data-list` +
   `data-item`. See `grammar/SECTIONS.md`. It is semantic naming, nothing more,
   and it costs nothing at design time.
2. **Convert.** `node src/cli.mjs convert --in page.html --out out --media-base <the client's uploads URL>`
   Writes `out/template.json` (an Elementor library template) and `out/kit.json`
   (the design system: colours, type scale, buttons, container width).
3. **Prove it.** `node harness/run.mjs`
   Boots a real WordPress with Elementor, imports the template through
   Elementor's own importer, renders both pages in a browser, and checks every
   string, link and image of the coded page against the Elementor render. Exits
   non-zero on the first thing that does not match.
4. **Ship.** Import `out/template.json` in Templates > Import. Paste the kit into
   Site Settings, or apply it with the WP-CLI step in `harness/import.php`.

## Rules that earn their place

- **An unknown `data-sec` is a hard error.** No silent fallback to a raw HTML
  block. A page that does not convert has to say so at build time, because the
  fallback is precisely the build a client cannot edit.
- **No colour and no font size on any element.** Both live in the kit. This is
  what makes a rebrand one screen instead of ninety widgets, and the editability
  audit fails the build if a literal creeps in.
- **Element ids are hashed from the structural path**, never random, so the same
  page converts to byte-identical JSON and a diff means a real change.
- **Media by reference.** Point `--media-base` at the client's own uploads URL:
  the images are already in their library, so the import resolves instantly and
  nothing is duplicated.
- **Fidelity is measured against the page model, not between two screenshots.**
  Every string the coded page declares is one check. Pixel similarity is
  reported next to the checks and deliberately excluded from the score: two
  rendering engines never agree to the pixel, and a number that cannot reach 100
  tells a client nothing.

## What has been validated, and what has not

Everything here is **validated on Elementor Free**. Pro, CRM, tracking and form
integrations are **not tested**: no licence was used. Playground can install Pro
from a ZIP, so that is a licence question rather than a technical one, and a
feature that would need a Pro widget counts as mapped, never as converted.
`docs/PRO-MAPPING.md` says which Pro widget each grammar type would target.
Nothing in the converter depends on free versus Pro: the Pro path is a different
set of widget names inside the same handlers.

## What this does not do

It does not design the page, it does not write the copy, and it does not invent
content. It moves a finished page into Elementor and proves it arrived intact.

It is also not a promise about a particular installation. A conversion contract
covers a documented scope; a page written outside that scope is reported with
its exceptions rather than silently simplified to fit. Before promising anything
about a specific site, run it on a staging copy of that site.
