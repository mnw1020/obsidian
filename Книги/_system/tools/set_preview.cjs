// Apply the books-only default without reserializing YAML or changing note bodies.
const fs = require('node:fs');
const path = require('node:path');
const { ensurePreview } = require('../preview-defaults/main.js');
const root = path.resolve(__dirname, '../..');
const apply = process.argv.includes('--apply');

function parts(text) {
    const opening = /^\uFEFF?---[ \t]*\r?\n/.exec(text);
    if (!opening) return { yaml: null, body: text.replace(/^\uFEFF/, '') };
    const ending = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(text.slice(opening[0].length));
    if (!ending) throw new Error('Frontmatter has no closing delimiter');
    return { yaml: text.slice(opening[0].length, opening[0].length + ending.index), body: text.slice(opening[0].length + ending.index + ending[0].length) };
}

const plans = [];
let total = 0;
function scan(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) { scan(file); continue; }
        if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
        const bytes = fs.readFileSync(file), before = bytes.toString('utf8');
        if (!bytes.equals(Buffer.from(before, 'utf8'))) throw new Error(`Not UTF-8: ${file}`);
        const after = ensurePreview(before), original = parts(before), updated = parts(after);
        total++;
        if (original.body !== updated.body) throw new Error(`Body changed: ${file}`);
        const mode = /^(?:obsidianUIMode|'obsidianUIMode'|"obsidianUIMode")[ \t]*:[ \t]*preview[ \t]*(?:#.*)?\r?$/m;
        if (!mode.test(updated.yaml || '')) throw new Error(`Missing preview property: ${file}`);
        if (original.yaml !== null && !/^(?:obsidianUIMode|'obsidianUIMode'|"obsidianUIMode")[ \t]*:/m.test(original.yaml)) {
            const withoutAddition = updated.yaml.replace(/^obsidianUIMode:[^\r\n]*(?:\r?\n|$)/m, '');
            if (withoutAddition !== original.yaml) throw new Error(`Other YAML changed: ${file}`);
        }
        if (before !== after) plans.push({ file, bytes, after });
    }
}
scan(root);
if (apply) {
    for (const plan of plans) {
        if (!fs.readFileSync(plan.file).equals(plan.bytes)) throw new Error(`Concurrent edit: ${plan.file}`);
        fs.writeFileSync(plan.file, plan.after, 'utf8');
    }
}
console.log(JSON.stringify({ markdown: total, changed: plans.length, applied: apply, bodiesPreserved: true, otherYamlPreserved: true }));
