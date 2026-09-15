/**
 * Does the coded page still carry the whole source page?
 *
 * The fidelity score compares the Elementor render to the coded page it was
 * given, so if a section is dropped upstream, in the design step, both sides
 * lose it and the score still reads 100%. That is the one failure this pipeline
 * could hide, and it is the expensive one: a template that imports cleanly,
 * renders without an error, and quietly ships a client site with a piece
 * missing.
 *
 * demo/source-inventory.json is what remembers. It lists the client's real
 * sections and a few phrases each one has to carry, read off their live site.
 * This check runs first and fails the build on its own.
 */
const strip = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

export function coverage(inventory, model, rendered) {
  const modelIds = new Set(model.sections.map((s) => s.id));
  const renderedText = new Map(rendered.map((s) => [s.id, strip(s.text)]));
  const checks = [];

  for (const want of inventory.sections) {
    const inModel = modelIds.has(want.id);
    checks.push({
      name: `${want.name}: present in the coded page`,
      ok: inModel,
      detail: inModel ? '' : `the source page has a "${want.name}" section and the coded page does not`,
    });
    const text = renderedText.get(want.id);
    const missing = text === undefined ? want.must : want.must.filter((m) => !text.includes(strip(m)));
    if (want.must.length) {
      checks.push({
        name: `${want.name}: ${want.must.length} required phrase${want.must.length > 1 ? 's' : ''} rendered`,
        ok: missing.length === 0,
        detail: missing.length ? `not on the Elementor page: ${missing.join(' | ')}` : '',
      });
    }
  }
  const pass = checks.filter((c) => c.ok).length;
  return { checks, pass, total: checks.length, ok: pass === checks.length };
}
