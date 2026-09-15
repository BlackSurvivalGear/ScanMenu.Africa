import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const textExtensions = new Set(['.html', '.js', '.css', '.md', '.json', '.yml', '.yaml', '.txt']);
const ignored = new Set(['.git', 'node_modules']);
const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    if (full.endsWith(path.join('tests', 'no-melanin-references.test.mjs'))) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (/melanin\s*[-_.]?\s*maps?/i.test(content)) offenders.push(path.relative(root, full));
  }
}

walk(root);
if (offenders.length) {
  console.error(`MelaninMaps references remain in: ${offenders.join(', ')}`);
  process.exit(1);
}
console.log('No MelaninMaps references found.');
