# The sample, and why it is not a real client's page

`demo/coded/` is **Northbridge Roofworks**, a roofing contractor that does not
exist. The copy is written for this fixture, the phone numbers are in the 555
reserved range, the reviews are labelled as fictional, and the images are drawn
by `make-sample-media.mjs` rather than photographed by anyone.

That is deliberate. This repository is public, and a site being public does not
make its copy and its photographs free for someone else to redistribute in a
demonstration. So the public fixture is synthetic, and it is built to exercise
the same ten section types, the same repeaters, the same nested footer lists and
the same media paths that a real page does.

The run on a real local business page, done for one named prospect, lives
outside this repository: the coded page, its media and its inventory stay local,
and only the screenshots and the measured report are shown. Nothing about the
pipeline differs between the two runs; the harness takes the page and the
inventory as arguments:

```bash
CTE_CODED=../somewhere/coded/index.html \
CTE_INVENTORY=../somewhere/source-inventory.json \
node harness/run.mjs
```

## What the fixture is and is not

It **is** a faithful exercise of the conversion contract: every section type, a
six card repeater, a five step numbered list, testimonials, a two column split
in both directions, background images with overlays, and a footer whose columns
carry nested link lists.

It **is not** a reproduction of any particular site's design. When the job is to
move an existing page onto Elementor, the coded page reproduces that page:
same layout, same copy, same spacing, no redesign smuggled in alongside the
migration.
