# Runbook: a finished, coded page into Elementor, without rebuilding it by hand

This is the answer to the only question that matters here, written as steps
someone on your team can follow on a Tuesday.

## 0. Before anything, decide what the page has to keep

Read the page you are replacing and write down its sections and a few phrases
each one must carry. That is `demo/source-inventory.json`. It takes ten minutes
and it is the only thing that will notice if a section quietly goes missing
between the design and the build. Everything downstream compares the build to
the coded page; this file is what compares the coded page to reality.

## 1. Design and code the page, as you already do

Claude Design for the concept, Claude Code for the page. The only new habit:
each section carries `data-sec="<type>"`, and its parts carry `data-slot` or
`data-list` / `data-item`. Semantic naming, nothing more, and no cost at design
time. The vocabulary is in `grammar/SECTIONS.md`.

One discipline is worth keeping: design in constructs Elementor has natively.
Boxed containers, flex rows that wrap, cards, background images with an overlay,
entrance animations. Not because the converter cannot do more, but because the
fallback for anything else is a raw HTML block, and a raw HTML block is exactly
the thing your client cannot safely edit.

## 2. Convert

```bash
node src/cli.mjs convert \
  --in path/to/page.html \
  --out out \
  --media-base "https://theclient.com/wp-content/uploads" \
  --title "Client, Home"
```

Out come two files. `out/template.json` is an Elementor library template, the
kind you drop into Templates > Import. `out/kit.json` is the design system:
palette, type scale, buttons, container width.

`--media-base` matters. Point it at the client's own uploads URL and the
template resolves against the media library the images already live in, so
nothing is downloaded and nothing is duplicated.

The conversion is deterministic: element ids are hashed from the structural
path, so the same page always produces the same JSON, byte for byte. A diff in
review means the page changed, not that the generator ran again.

## 3. Prove it before anyone sees it

```bash
node harness/run.mjs
```

Boots WordPress with a pinned Elementor (Playground, PHP-WASM, no Docker, no
local PHP), imports through Elementor's own importer, renders both pages in a
browser at three widths, and checks:

- the client's sections and phrases are all still there, against the inventory
- every string, link and image of the coded page, in the right section of the
  Elementor render, in the right order
- seven editability rules on the template itself

Non-zero exit on the first failure, and the per-section report lands in
`report/report.json` with screenshots beside it.

## 4. Put it on the client's site

Two ways in, and they are the same JSON.

**By hand, once:** Templates > Import, upload `out/template.json`, then apply it
to a page. Paste the kit into Site Settings.

**By script, every time:** `harness/setup.php` is the whole sequence, and it is
ordinary WordPress code. Media first, so the template resolves against real
attachments. Kit second. Then `Source_Local::import_template()`, which is the
code behind the Import button, so an invalid template fails there rather than
halfway down a page. Then `documents->create()` to publish it.

That last call is not interchangeable with `wp_insert_post()`. Only the document
manager writes `_elementor_edit_mode`, and without it WordPress serves
Elementor's plain-text fallback: a page that looks right in the editor and
renders unstyled to visitors.

## 5. Hand it over

The client edits text, images and offers in normal widget fields. Colours and
type live in Site Settings, so a rebrand is one screen rather than ninety
widgets. Sections are named in the navigator and carry stable CSS ids, so
"change the second block on the services page" is a sentence that means
something.

## What to do when a page will not convert

An unknown `data-sec` is a hard error, on purpose. Either the section is a real
new pattern, and it earns a handler in `src/convert.mjs` (an afternoon, once,
for every page after it), or it was a one-off flourish that should not have been
in a page a client has to maintain. Both answers are better than a silent
fallback to a raw HTML block.
