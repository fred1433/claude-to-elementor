#!/usr/bin/env node
/**
 * The fidelity harness, end to end, in one process.
 *
 *   convert -> boot a real WordPress -> import through Elementor -> render both
 *   pages in a browser -> compare against the model -> write the report.
 *
 * Exits non-zero if a single check fails. That is the point: the harness is
 * what makes "faithful" a fact instead of a claim.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { parsePage } from '../src/parse.mjs';
import { convert } from '../src/convert.mjs';
import { buildKit } from '../src/kit.mjs';
import { score, writeJson } from './fidelity.mjs';
import { auditEditability } from './editability.mjs';
import { coverage } from './coverage.mjs';
import { EXTRACT, SETTLE } from './extract.mjs';
import { crop, similarity } from './imgutil.mjs';
import { editInEditor, checkPublic, ctaColours } from './edit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WP_PORT = Number(process.env.CTE_WP_PORT || 9411);
const CODED_PORT = Number(process.env.CTE_CODED_PORT || 9412);
const WP_VERSION = process.env.CTE_WP_VERSION || '6.8';
const EL_VERSION = fs.readFileSync(new URL('./elementor.version', import.meta.url), 'utf8').trim();
const OUT = path.join(ROOT, 'report');
const SHOTS = path.join(OUT, 'shots');
const WIDTHS = [[1440, 'desktop'], [768, 'tablet'], [390, 'mobile']];
const CODED = process.env.CTE_CODED || path.join(ROOT, 'demo/coded/index.html');
const INVENTORY = process.env.CTE_INVENTORY || path.join(path.dirname(path.dirname(CODED)), 'source-inventory.json');

const log = (...a) => console.log('[harness]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ 1. convert */
log('converting', path.relative(ROOT, CODED));
const model = parsePage(fs.readFileSync(CODED, 'utf8'));
const template = convert(model, { mediaBase: process.env.CTE_MEDIA_BASE || '', title: process.env.CTE_TITLE || model.title });
const kit = buildKit();
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/template.json'), JSON.stringify(template, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'out/kit.json'), JSON.stringify(kit, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'out/model.json'), JSON.stringify(model, null, 2) + '\n');

/* -------------------------------------------------------------- 2. stage */
const MNT = path.join(ROOT, 'harness/.mnt');
fs.rmSync(MNT, { recursive: true, force: true });
fs.mkdirSync(MNT, { recursive: true });
for (const f of ['out/template.json', 'out/kit.json', 'harness/setup.php']) fs.copyFileSync(path.join(ROOT, f), path.join(MNT, path.basename(f)));
// media travels with the page, not from a fixed folder: the harness has to be
// pointable at any coded page, not just the one in this repository
fs.cpSync(path.join(path.dirname(CODED), 'assets'), path.join(MNT, 'assets'), { recursive: true });

const bpPath = path.join(ROOT, 'harness/blueprint.json');

/* ------------------------------------- 2b. Elementor, pinned and cached */
const CACHE = path.join(ROOT, 'harness/.cache');
const EL_DIR = path.join(CACHE, `elementor-${EL_VERSION}`);
if (!fs.existsSync(path.join(EL_DIR, 'elementor/elementor.php'))) {
  fs.mkdirSync(EL_DIR, { recursive: true });
  const url = `https://downloads.wordpress.org/plugin/elementor.${EL_VERSION}.zip`;
  log('downloading Elementor', EL_VERSION, '(pinned, cached after the first run)');
  const zip = path.join(CACHE, `elementor-${EL_VERSION}.zip`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download Elementor ${EL_VERSION}: HTTP ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  await new Promise((res2, rej) => {
    const p = spawn('unzip', ['-q', '-o', zip, '-d', EL_DIR], { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res2() : rej(new Error('unzip failed'))));
  });
}

/* ------------------------------------------- 3. a real WordPress, booting */
log(`booting WordPress ${WP_VERSION} + Elementor ${EL_VERSION} (WordPress Playground, PHP-WASM, no Docker)`);
const pg = spawn('npx', ['@wp-playground/cli', 'server', '--port', String(WP_PORT), '--wp', WP_VERSION, '--blueprint', bpPath,
  '--mount', `${MNT}:/wordpress/cte`,
  '--mount', `${path.join(EL_DIR, 'elementor')}:/wordpress/wp-content/plugins/elementor`],
  // detached so that the whole process group can be killed: npx spawns the real
  // server as a child and would otherwise leave it holding the port.
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let pgOut = '';
pg.stdout.on('data', (d) => { pgOut += d; });
pg.stderr.on('data', (d) => { pgOut += d; });
let pgDead = false;
pg.on('exit', (c) => { pgDead = true; log('playground exited with', c); });

const shut = () => { try { process.kill(-pg.pid, 'SIGKILL'); } catch { try { pg.kill('SIGKILL'); } catch {} } };
process.on('exit', shut); process.on('SIGINT', () => { shut(); process.exit(130); });

async function waitHttp(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pgDead) throw new Error(`WordPress Playground exited early:\n${pgOut.split('\n').filter((l) => !/\d+%/.test(l)).slice(-25).join('\n')}`);
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${url}\n${pgOut.split('\n').filter((l) => !/\d+%/.test(l)).slice(-25).join('\n')}`);
}
await waitHttp(`http://127.0.0.1:${WP_PORT}/`, 420000);
log('WordPress is up on', `http://127.0.0.1:${WP_PORT}/`);

/* ------------------------------ 3b. activate, then import, over HTTP */
async function drive(step) {
  const r = await fetch(`http://127.0.0.1:${WP_PORT}/cte/setup.php?step=${step}`);
  const body = await r.text();
  let json; try { json = JSON.parse(body); } catch { throw new Error(`setup.php?step=${step} did not return JSON (HTTP ${r.status}):\n${body.slice(0, 1200)}`); }
  if (!json.ok) throw new Error(`setup.php?step=${step} failed: ${json.error}`);
  return json;
}
const act = await drive('activate');
log(`  wp: Elementor ${act.elementor} activated`);
const imp = await drive('import');
for (const l of imp.log) log('  wp:', l);

/* ----------------------------------------- 4. serve the coded page as http */
const codedDir = path.dirname(CODED);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const statics = http.createServer((req, res) => {
  const p = path.join(codedDir, decodeURIComponent(req.url.split('?')[0]) === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(codedDir) || !fs.existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(CODED_PORT);

/* --------------------------------------------------- 5. render and measure */
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const shots = {};
let codedExtract = null, wpExtract = null;

for (const [width, label] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  for (const [side, url] of [['coded', `http://127.0.0.1:${CODED_PORT}/`], ['elementor', `http://127.0.0.1:${WP_PORT}/`]]) {
    const page = await ctx.newPage();
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', (e) => failed.push(`js: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    const settled = await page.evaluate(SETTLE).catch((e) => ({ stillInvisible: -1, brokenImages: [], error: e.message }));
    if (settled.stillInvisible) log(`  ${side}-${label}: ${settled.stillInvisible} elements never finished their entrance animation`);
    for (const src of settled.brokenImages) {
      let status = 'unreachable';
      try { const r = await fetch(src); status = `HTTP ${r.status} ${r.headers.get('content-type') || ''} ${r.headers.get('content-length') || ''}B`; } catch (e) { status = e.message; }
      log(`  ${side}-${label}: image did not render: ${src} -> ${status}`);
    }
    const file = path.join(SHOTS, `${side}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots[`${side}-${label}`] = path.relative(OUT, file);
    if (width === 1440) {
      const data = await page.evaluate(EXTRACT);
      if (side === 'coded') codedExtract = data; else wpExtract = data;
      fs.writeFileSync(path.join(OUT, `${side}.html`), await page.content());
      if (failed.length) { log(`  ${side}: ${failed.length} failed requests / errors`); for (const f of failed.slice(0, 8)) log('   ', f); }
    }
    await page.close();
  }
  await ctx.close();
  log('captured', label);
}
statics.close();

/* ------------------------------- 5b. a global colour, changed and followed */
const WP = `http://127.0.0.1:${WP_PORT}`;
const shoot = async (page, name, full = false) => { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full }); };
const before = await ctaColours({ browser, base: WP });
const TEST_COLOUR = '#1D63FF';
await drive(`recolor&color=%23${TEST_COLOUR.slice(1)}`);
const after = await ctaColours({ browser, base: WP });
await drive(`recolor&color=%23ED1B24`);
const restored = await ctaColours({ browser, base: WP });
const globalColour = {
  buttons: before.length,
  before: before[0] || null,
  changedTo: after[0] || null,
  allChanged: after.length > 0 && after.every((c) => c === 'rgb(29, 99, 255)'),
  restored: restored.every((c) => c === before[0]),
  testColour: TEST_COLOUR,
};
log(`global colour: ${globalColour.buttons} buttons, all followed the kit: ${globalColour.allChanged}, restored: ${globalColour.restored}`);

/* ----------------------------- 5c. a real edit, in the Elementor editor */
// the two widgets a client would realistically change: the page heading and the
// name of the first offer
const heroHeading = template.content[0].elements.find((e) => e.widgetType === 'heading' && e.settings.header_size === 'h1').settings.title;
const firstOffer = (template.content.find((c) => c.settings._element_id === 'services') || { elements: [] })
  .elements.flatMap((e) => e.elements || []).flatMap((e) => e.elements || [])
  .filter((e) => e.widgetType === 'heading')[0]?.settings.title;
const LONG = `${heroHeading}, and every thaw in between, which is a far longer heading than the one the designer wrote and has to reflow without breaking the section`;
const OFFER = `${firstOffer}, Rolled On Site`;
// addressed by the text being replaced: Elementor regenerates element ids on import
const fallbackTargets = { [heroHeading]: LONG, ...(firstOffer ? { [firstOffer]: OFFER } : {}) };
const editResult = await editInEditor({ browser, base: WP, pageId: imp.page_id, shotDir: SHOTS, shoot, fallbackTargets, longTitle: LONG, newOffer: OFFER });
let publicAfter = {};
if (editResult.ok) {
  publicAfter = await checkPublic({ browser, base: WP, expect: editResult.edits.filter((e) => e.field !== 'a photo').map((e) => e.value), shoot });
  log(`edit: saved in the editor, still there after reopening: ${editResult.persistedInEditor}; on the public page ${JSON.stringify(publicAfter)}`);
} else {
  log(`edit: FAILED, ${editResult.error}`);
}

await browser.close();

/* ------------------------------------------------------------- 6. compare */
const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
const cover = coverage(inventory, model, wpExtract);
const result = score(model, wpExtract);
const edit = auditEditability(template, model);

const codedPng = PNG.sync.read(fs.readFileSync(path.join(SHOTS, 'coded-desktop.png')));
const wpPng = PNG.sync.read(fs.readFileSync(path.join(SHOTS, 'elementor-desktop.png')));
/**
 * One more check per section, and the only one that compares the two renders
 * rather than the render to the model: does the filled call to action come out
 * the same colour on both sides. This exists because it caught a real failure,
 * a black Call button where the client's brand red belonged.
 */
const codedCta = new Map(codedExtract.map((s) => [s.id, s.ctaColor]));
for (const sec of result.sections) {
  const a = codedCta.get(sec.id);
  const b = (wpExtract.find((w) => w.id === sec.id) || {}).ctaColor;
  if (!a && !b) continue;
  const ok = a === b;
  sec.checks.push({ name: 'call to action colour', ok, detail: ok ? '' : `coded ${a || 'none'}, Elementor ${b || 'none'}` });
  sec.ok = sec.checks.every((c) => c.ok);
  result.total++; if (ok) result.pass++;
}
result.percent = result.total ? Math.round((result.pass / result.total) * 1000) / 10 : 0;

const codedBox = new Map(codedExtract.map((s) => [s.id, s.box]));
const wpBox = new Map(wpExtract.map((s) => [s.id, s.box]));
for (const s of result.sections) {
  const a = codedBox.get(s.id), b = wpBox.get(s.id);
  if (!a || !b || a.height < 10 || b.height < 10) { s.visual = null; continue; }
  const ca = crop(codedPng, a.top, a.height), cb = crop(wpPng, b.top, b.height);
  s.visual = similarity(ca, cb).percent;
  s.heights = { coded: a.height, elementor: b.height };
  fs.writeFileSync(path.join(SHOTS, `sec-${s.id}-coded.png`), PNG.sync.write(ca));
  fs.writeFileSync(path.join(SHOTS, `sec-${s.id}-elementor.png`), PNG.sync.write(cb));
}

const report = {
  generatedAt: new Date().toISOString(),
  source: path.relative(ROOT, CODED),
  wordpress: WP_VERSION,
  sections: result.sections,
  fidelity: { passed: result.pass, total: result.total, percent: result.percent },
  extraSections: result.extra,
  editability: edit,
  coverage: cover,
  globalColour,
  editorEdit: { ...editResult, publicAfter },
  counts: {
    containers: JSON.stringify(template).match(/"elType":"container"/g)?.length || 0,
    widgets: (JSON.stringify(template).match(/"elType":"widget"/g) || []).length,
  },
  shots,
};
writeJson(path.join(OUT, 'report.json'), report);

const bad = result.sections.filter((s) => !s.ok);
log('');
for (const s of result.sections) {
  const v = s.visual === null ? ' visual   n/a' : ` visual ${String(s.visual).padStart(5)}%`;
  log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.id.padEnd(20)} ${String(s.checks.filter((c) => c.ok).length).padStart(2)}/${String(s.checks.length).padEnd(2)} checks ${v}`);
  for (const c of s.checks.filter((c) => !c.ok)) log(`        -> ${c.name}: ${c.detail}`);
}
log('');
log(`coverage     ${cover.pass}/${cover.total} of the client's own sections and phrases`);
for (const c of cover.checks.filter((c) => !c.ok)) log(`        -> ${c.name}: ${c.detail}`);
log(`fidelity     ${result.pass}/${result.total} checks (${result.percent}%)`);
log(`editability  ${edit.findings.filter((f) => f.ok).length}/${edit.findings.length} assertions`);
for (const f of edit.findings.filter((f) => !f.ok)) log(`        -> ${f.name}: ${f.detail}`);
if (result.extra.length) log(`extra sections in the Elementor render: ${result.extra.join(', ')}`);
log(`report       ${path.relative(ROOT, path.join(OUT, 'report.json'))}`);

shut();
process.exit(bad.length === 0 && edit.ok && cover.ok && result.extra.length === 0 ? 0 : 1);
