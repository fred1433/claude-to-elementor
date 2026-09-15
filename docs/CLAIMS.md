# What is claimed, and what is not

Three objects, kept apart, because conversion work slides into overclaiming the
moment they are blurred:

| | |
|---|---|
| **A** | the source page: whatever exists today, on the live site |
| **B** | the coded page: the input to the conversion |
| **C** | the Elementor build: the output |

## Claimed

- **B to C is faithful.** Every expected string, link destination and image file
  of B is found in the right section of C, in the right order, at the widths
  captured, along with the rendered colour of each call to action. The
  expectations come from B and from a written inventory of what A must contain,
  never from a second reading of the converter's own output.
- **C is importable.** It goes into an empty WordPress through Elementor's own
  template importer, the code path behind Templates > Import, and is then
  published as a page.
- **C is driven by the kit.** No colour and no font size sits on any element.
  Changing one global colour in Site Settings moves every call to action on the
  page, and changing it back restores them. That is measured, not asserted.
- **C survives editing.** A much longer heading and a renamed offer are saved,
  the page is reloaded, and both are still there on the public page and at 390
  pixels wide.
- **The conversion is deterministic and replayable.** Same page in, byte
  identical JSON out, asserted in CI, replayed from an empty environment on
  every push, with a branch that removes a section and goes red.

## Not claimed

- **Nothing about A.** The harness never compares C to A. Whether B faithfully
  reproduces a particular live page is a design question, answered by looking at
  the two, not by this repository.
- **Nothing about somebody else's tooling.** No file produced by another
  agency's pipeline has been converted here.
- **Nothing about Elementor Pro.** Validated on Elementor Free. Pro, CRM,
  tracking and form integrations are not tested, and a feature that would need a
  Pro widget is mapped, never counted as converted.
- **Nothing about a specific installation.** A live site has a theme, plugins, a
  kit and a history. The only way to know is a trial on its staging.
- **Not "no human touched it".** "No manual rebuild in Elementor" is a narrower
  claim. Every human step of a run is listed in the report's interventions log.
- **Not "converts any HTML".** There is a documented conversion contract with a
  covered scope. A page outside it is reported with its exceptions rather than
  quietly simplified until it fits.

## Content and rights

The public repository ships a synthetic sample. Another company's site being
public does not make its copy and photographs available for redistribution in
someone else's demonstration, so a run on a real page stays out of this
repository: screenshots and the measured report only, no redistributable
sources, no forms, tracking pixels or CRM scripts from the original executing in
the copy, and the page presenting it is not indexed.
