// Scoped, repeatable migration. Original cards are kept for rollback.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { header } = require('../book_card.js');
const { fromText } = require('../tests/yaml_fixture.cjs');
const root = path.resolve(__dirname, '../..');

function migrate(text) {
    if (text.includes('<!-- BOOK-CARD:START -->')) return text;
    const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return text;
    const fm = fromText(text);
    if (!fm.title || !fm.authors) return text;
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    let yaml = match[1];
    if (fm.cssclasses !== undefined) {
        // Existing classes are preserved, including a scalar class name.
        const classes = Array.isArray(fm.cssclasses) ? fm.cssclasses : [fm.cssclasses];
        if (!classes.includes('book-card')) classes.push('book-card');
        yaml = yaml.replace(/^cssclasses:[^\r\n]*(?:\r?\n[ \t]+-[^\r\n]*)*/m, 'cssclasses: ' + JSON.stringify(classes));
    } else yaml += newline + 'cssclasses:' + newline + '  - book-card';
    let body = text.slice(match[0].length);
    // Only the two known generated panels at the beginning of the note.
    body = body.replace(/^\s*> \[!info\] 🧭 Навигация\r?\n> \[\[Книги\/_index[^\r\n]*\r?\n\r?\n> \[!abstract\] ⚡ Действия\r?\n> \[[^\r\n]*\r?\n/, '');
    const first = body.match(/^\s*# ([^\r\n]+)\r?\n/);
    if (first && first[1] === String(fm.title)) body = body.slice(first[0].length);
    // Notes without a section heading get one; their original text is untouched.
    const notesHeading = /^\s*(?:#|```|<!-- BOOK-READINGS)/.test(body) || !body.trim() ? '' : '## Заметки' + newline + newline;
    const next = (text.startsWith('\uFEFF') ? '\uFEFF' : '') + '---' + newline + yaml + newline + '---' + newline + newline + header.replace(/\n/g, newline) + newline + newline + notesHeading + body;
    const history = /<!-- BOOK-READINGS:START -->[\s\S]*?<!-- BOOK-READINGS:END -->/;
    assert.equal(next.match(history)?.[0], text.match(history)?.[0], 'Reading history must remain byte-identical');
    for (const [key, value] of Object.entries(fm)) if (key !== 'cssclasses') assert.deepEqual(fromText(next)[key], value, 'Changed metadata: ' + key);
    return next;
}

function main() {
    const changes = [];
    function scan(folder) {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) { scan(full); continue; }
            if (!entry.name.endsWith('.md') || entry.name === '_index.md') continue;
            const original = fs.readFileSync(full, 'utf8');
            const next = migrate(original);
            if (original !== next) changes.push({ full, original, next });
        }
    }
    scan(path.join(root, 'Художественные'));
    scan(path.join(root, 'Non-fiction'));
    if (process.argv.includes('--apply')) {
        for (const change of changes) {
            if (fs.readFileSync(change.full, 'utf8') !== change.original) throw new Error('Concurrent edit: ' + change.full);
            const backup = path.join(root, '_system/backups/card-redesign', path.relative(root, change.full) + '.before');
            fs.mkdirSync(path.dirname(backup), { recursive: true });
            if (!fs.existsSync(backup)) fs.writeFileSync(backup, change.original);
            fs.writeFileSync(change.full, change.next);
        }
    }
    console.log(JSON.stringify({ cards: changes.length, applied: process.argv.includes('--apply'), preserved: 'metadata, reading history, all note text' }));
}

module.exports = { migrate };
if (require.main === module) main();
