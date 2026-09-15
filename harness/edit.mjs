/**
 * The proof an agency owner actually cares about: open the page in the Elementor
 * editor, change it the way a client would, press Update, close, reopen, and
 * see the change on the public page and on a phone.
 *
 * Everything here goes through the editor's own interface. What the editor
 * cannot be driven through reliably is done through Elementor's document save
 * instead, and said so in the log rather than quietly counted as an editor
 * edit.
 */
import { SETTLE } from './extract.mjs';

const log = [];
const note = (what, how) => log.push({ what, how });

async function openEditor(page, base, pageId) {
  await page.goto(`${base}/wp-admin/post.php?post=${pageId}&action=elementor`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#elementor-panel, #elementor-editor-wrapper', { timeout: 180000, state: 'attached' });
  await page.waitForSelector('#elementor-preview-iframe', { timeout: 180000, state: 'attached' });
  const frame = await page.frameLocator('#elementor-preview-iframe');
  await frame.locator('.elementor-widget-heading').first().waitFor({ timeout: 180000 });
  await page.waitForSelector('#elementor-panel-saver-button-publish, #elementor-panel-saver-button-save-options', { timeout: 180000, state: 'attached' });
  return frame;
}

async function diagnose(page) {
  try {
    return {
      url: page.url(),
      title: await page.title(),
      hasPanel: await page.locator('#elementor-panel').count(),
      hasWrapper: await page.locator('#elementor-editor-wrapper').count(),
      hasIframe: await page.locator('#elementor-preview-iframe').count(),
      snippet: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 220),
    };
  } catch (e) { return { error: e.message }; }
}

async function editWidgetTitle(page, frame, selector, value) {
  await frame.locator(selector).first().click({ timeout: 30000 });
  const field = page.locator('#elementor-panel [data-setting="title"]').first();
  await field.waitFor({ timeout: 30000 });
  // Real keystrokes, not a value assignment. Elementor's controls are backed by
  // a model listening for input events; setting the DOM value directly leaves
  // the model holding the old text, and Update then saves the old text while
  // the panel shows the new one.
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.pressSequentially(value, { delay: 4 });
  await field.dispatchEvent('change');
  // The preview is a second WordPress request inside PHP-WASM; give it room
  // before deciding the model never took the change.
  let shown = '';
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    shown = await frame.locator('body').innerText();
    if (shown.includes(value)) break;
  }
  if (!shown.includes(value)) throw new Error(`the editor preview did not pick up "${value.slice(0, 40)}..."`);
}

async function saved(page) {
  // Elementor's own notion of "there is nothing left to save".
  for (let i = 0; i < 40; i++) {
    const clean = await page.evaluate(() => {
      try { return !!(window.elementor && window.elementor.saver && !window.elementor.saver.isEditorChanged()); } catch { return false; }
    });
    if (clean) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function update(page) {
  const btn = page.locator('#elementor-panel-saver-button-publish').first();
  await btn.waitFor({ state: 'visible', timeout: 60000 });
  await btn.click({ timeout: 30000 });
  if (!(await saved(page))) throw new Error('the editor still reports unsaved changes after Update');
}

/**
 * When the editor interface cannot be driven, the same edits go through
 * Elementor's document save and are labelled as such. The point of the exercise
 * is whether a change survives a save, a reload and a phone, and that is worth
 * measuring either way, as long as nobody pretends a button was clicked.
 */
async function editByApi(page, base, targets) {
  const r = await page.evaluate(async ([b, body]) => {
    const res = await fetch(`${b}/cte/setup.php?step=edit-text`, { method: 'POST', body: JSON.stringify(body) });
    return { status: res.status, text: await res.text() };
  }, [base, targets]);
  return JSON.parse(r.text);
}

// Elementor regenerates element ids when it imports a template, so edits are
// addressed by the text they are replacing, not by an id from the source JSON.

export async function editInEditor({ browser, base, pageId, shotDir, shoot, fallbackTargets, longTitle, newOffer }) {
  const LONG_TITLE = longTitle;
  const NEW_OFFER = newOffer;
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const result = { ok: false, log, edits: [] };
  try {
    const r = await page.goto(`${base}/cte/setup.php?step=login`, { waitUntil: 'domcontentloaded' });
    if (!r.ok()) throw new Error('could not sign in');
    note('signed in as administrator', 'wp_set_auth_cookie; the client role was not tested');

    let frame = await openEditor(page, base, pageId);
    await page.waitForTimeout(2500);
    await shoot(page, 'editor-before');

    await editWidgetTitle(page, frame, '#hero .elementor-widget-heading:nth-of-type(2), #hero .elementor-widget-heading', LONG_TITLE);
    note('hero heading replaced with a much longer one', 'typed into the editor panel');
    result.edits.push({ field: 'hero heading', value: LONG_TITLE });

    await editWidgetTitle(page, frame, '#services-card-1 .elementor-widget-heading', NEW_OFFER);
    note('first offer renamed', 'typed into the editor panel');
    result.edits.push({ field: 'first offer', value: NEW_OFFER });

    await update(page);
    note('saved with the editor Update button', 'editor; Elementor then reported no unsaved changes');
    await shoot(page, 'editor-after-save');

    // close the editor and open it again from scratch
    await page.goto(`${base}/wp-admin/`, { waitUntil: 'domcontentloaded' });
    frame = await openEditor(page, base, pageId);
    await page.waitForTimeout(2500);
    const reopened = await frame.locator('body').innerText();
    result.persistedInEditor = reopened.includes(LONG_TITLE) && reopened.includes(NEW_OFFER);
    await shoot(page, 'editor-reopened');
    note('editor closed and reopened', 'both edits still present: ' + result.persistedInEditor);

    // swap a photo for another from the media library
    const sw = await page.goto(`${base}/cte/setup.php?step=swap-image`, { waitUntil: 'domcontentloaded' });
    const swj = JSON.parse(await sw.text());
    if (swj.ok) {
      result.swappedImage = swj.now;
      note(`photo replaced with ${swj.now} from the media library`, 'Elementor document save, NOT the editor interface');
      result.edits.push({ field: 'a photo', value: swj.now });
    }

    result.ok = result.persistedInEditor === true;
    result.path = 'editor interface';
  } catch (e) {
    result.error = e.message;
    result.diagnosis = await diagnose(page);
    try { await shoot(page, 'editor-failure'); } catch {}
    note('the editor interface could not be driven', e.message.split('\n')[0]);

    // fall back to the document save, and say so
    try {
      const api = await editByApi(page, base, fallbackTargets);
      if (!api.ok) note('the document save fallback was refused', JSON.stringify(api).slice(0, 160));
      if (api.ok) {
        result.path = 'Elementor document save (the call the editor Update button makes), NOT the editor interface';
        result.edits = Object.entries(fallbackTargets).map(([id, value]) => ({ field: id, value }));
        note(`${api.edited.length} text edits applied`, 'Elementor document save, not the editor interface');
        const sw = await page.goto(`${base}/cte/setup.php?step=swap-image`, { waitUntil: 'domcontentloaded' });
        const swj = JSON.parse(await sw.text());
        if (swj.ok) { result.swappedImage = swj.now; note(`photo replaced with ${swj.now}`, 'Elementor document save'); }
        result.ok = true;
        result.viaApi = true;
      }
    } catch (e2) { note('the document save fallback also failed', e2.message); }
  } finally {
    await ctx.close();
  }
  return result;
}

export async function checkPublic({ browser, base, expect, shotDir, shoot }) {
  const out = {};
  for (const [label, width] of [['desktop', 1440], ['mobile', 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
    // Same settling as the measurement pass: entrance animations hold elements
    // at visibility:hidden, and innerText returns nothing for those.
    await page.evaluate(SETTLE).catch(() => {});
    const text = await page.evaluate(() => document.body.innerText);
    out[label] = expect.every((e) => text.includes(e));
    await shoot(page, `public-after-edit-${label}`, true);
    await ctx.close();
  }
  return out;
}

export async function ctaColours({ browser, base }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const colours = await page.evaluate(() => Array.from(document.querySelectorAll('a.elementor-button'))
    .map((a) => getComputedStyle(a).backgroundColor)
    .filter((c) => c && !/rgba\(0, 0, 0, 0\)/.test(c)));
  await ctx.close();
  return colours;
}
