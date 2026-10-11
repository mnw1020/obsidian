// Validate every migration first, then replace presentation with recoverable originals.
const fs = require('node:fs'), path = require('node:path'), pages = require('../series_pages.js');
const root = path.resolve(__dirname, '../..'), backup = path.join(root, '_system/backups/series-redesign');
const jobs = [{ file: path.join(root, '_system/Серии.md'), merge: pages.mergeOverview }];
const folder = path.join(root, '_system/Серии');
if (fs.existsSync(folder)) for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) jobs.push({ file: path.join(folder, entry.name), merge: pages.mergeSeries });
}
const changes = jobs.filter(({ file }) => fs.existsSync(file)).map(({ file, merge }) => {
    const original = fs.readFileSync(file, 'utf8');
    return { file, original, next: merge(original) };
}).filter(({ original, next }) => original !== next);
for (const { file, original, next } of changes) {
    const relative = path.relative(root, file), target = path.join(backup, relative + '.before');
    if (fs.readFileSync(file, 'utf8') !== original) throw new Error('Concurrent edit: ' + relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, original, 'utf8');
    fs.writeFileSync(file, next, 'utf8');
}
console.log(`Series pages updated: ${changes.length}. Properties and personal notes preserved.`);
