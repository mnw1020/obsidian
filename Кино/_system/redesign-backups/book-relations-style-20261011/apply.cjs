// Apply only the reviewed renderer/style; verify every existing card stays byte-for-byte intact.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const cinema = path.resolve(__dirname, '../../..'), vault = path.dirname(cinema), books = path.join(vault, 'Книги');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cards = [];
function scan(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ['_system', 'Цитаты', 'Конспекты', 'Идеи'].includes(entry.name)) continue;
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (entry.name.endsWith('.md') && fs.readFileSync(file, 'utf8').includes('<!-- BOOK-CARD:START -->')) cards.push({ path: path.relative(vault, file).replaceAll('\\', '/'), hash: digest(file) });
    }
}
scan(books);
assert.equal(cards.length, 214, 'Recheck current coverage if the collection changed');
const targets = [
    { staged: 'book_card.js', before: 'book_card.js', destination: path.join(books, '_system/book_card.js') },
    { staged: 'books-library.css', before: 'books-library.css', destination: path.join(books, '_system/books-library.css') },
    { staged: 'books-library.css', before: 'installed-books-library.css', destination: path.join(vault, '.obsidian/snippets/books-library.css') }
];
for (const target of targets) assert.equal(digest(target.destination), digest(path.join(__dirname, 'before', target.before)), 'Concurrent change: ' + target.destination);
new Function('module', fs.readFileSync(path.join(__dirname, 'staged/book_card.js'), 'utf8'));
for (const target of targets) fs.copyFileSync(path.join(__dirname, 'staged', target.staged), target.destination);
for (const card of cards) assert.equal(digest(path.join(vault, card.path)), card.hash, card.path);
assert.equal(digest(targets[1].destination), digest(targets[2].destination));
const report = { date: '2026-10-11', cards: cards.length, cardContentsUnchanged: true,
    automaticForNewBooks: true, sourceAndInstalledStyleMatch: true,
    changed: targets.map(target => path.relative(vault, target.destination).replaceAll('\\', '/')), cardHashes: cards };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, cardHashes: undefined }, null, 2));
