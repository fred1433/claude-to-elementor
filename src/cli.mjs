#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parsePage } from './parse.mjs';
import { convert, takeNotes } from './convert.mjs';
import { buildKit } from './kit.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };

if (cmd !== 'convert') {
  console.error('usage: node src/cli.mjs convert --in <coded.html> --out <dir> [--media-base <url>] [--title <t>]');
  process.exit(2);
}

const inFile = flag('in', 'demo/coded/index.html');
const outDir = flag('out', 'out');
const mediaBase = flag('media-base', '');
const title = flag('title', '');

const model = parsePage(fs.readFileSync(inFile, 'utf8'));
const template = convert(model, { mediaBase, title });
const notes = takeNotes();
const kit = buildKit();

fs.mkdirSync(outDir, { recursive: true });
const tplPath = path.join(outDir, 'template.json');
fs.writeFileSync(tplPath, JSON.stringify(template, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'kit.json'), JSON.stringify(kit, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'model.json'), JSON.stringify(model, null, 2) + '\n');

let widgets = 0, containers = 0; const kinds = {};
(function walk(list) {
  for (const e of list) {
    if (e.elType === 'widget') { widgets++; kinds[e.widgetType] = (kinds[e.widgetType] || 0) + 1; } else containers++;
    walk(e.elements || []);
  }
})(template.content);

console.log(`in       ${inFile}`);
console.log(`sections ${model.sections.length}  containers ${containers}  widgets ${widgets}`);
console.log(`widgets  ${Object.entries(kinds).sort().map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`out      ${tplPath}`);
if (notes.length) { console.log('notes:'); for (const n of notes) console.log(`  - [${n.section}] ${n.what}: ${n.why}`); }
