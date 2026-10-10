// Add a styling class only to the seven existing library pages without one.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const cinema = path.resolve(__dirname, '../../..'), vault = path.dirname(cinema), books = path.join(vault, 'Книги');
const core = require(path.join(books, '_system/book_core.js'))({ app: {}, obsidian: {} });
const names = ['Non-fiction/_index.md', '_system/Журнал изменений.md', '_system/Приёмка.md',
    '_system/Проверка библиотеки.md', '_system/Проверка связей с кино.md', '_system/Редизайн карточек.md', 'Цитата.md'];
const split = text => {
    const header = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(header, 'Expected existing YAML');
    return { yaml: header[1], body: text.slice(header[0].length) };
};
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const staged = names.map(name => {
    const file = path.resolve(books, name);
    assert.ok(file.startsWith(books + path.sep));
    const before = fs.readFileSync(file, 'utf8'), original = split(before);
    assert.ok(!/^(?:cssclasses|"cssclasses"|'cssclasses')\s*:/m.test(original.yaml), name);
    const after = core.patchProperties(before, { cssclasses: ['books-library'] }), updated = split(after);
    assert.equal(original.body, updated.body, name + ' body');
    assert.equal(original.yaml.trimEnd(), updated.yaml.replace(/^cssclasses:[^\r\n]*(?:\r?\n|$)/m, '').trimEnd(), name + ' other YAML');
    return { name, file, before, after };
});
for (const row of staged) {
    const destination = path.join(__dirname, 'pages-before', row.name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, row.before);
    assert.equal(fs.readFileSync(row.file, 'utf8'), row.before, 'Concurrent change: ' + row.name);
}
if (process.argv.includes('--apply')) for (const row of staged) fs.writeFileSync(row.file, row.after);
const report = { mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', changed: staged.map(row => ({ path: 'Книги/' + row.name,
    before: digest(row.before), after: digest(row.after) })), personalTextPreserved: true, otherYamlPreserved: true };
fs.writeFileSync(path.join(__dirname, 'pages-' + report.mode + '.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
