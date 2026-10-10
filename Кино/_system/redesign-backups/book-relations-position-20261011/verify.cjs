const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const cinema = path.resolve(__dirname, '../../..'), vault = path.dirname(cinema);
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous = JSON.parse(fs.readFileSync(path.join(cinema, '_system/redesign-backups/book-relations-style-20261011/verification.json'), 'utf8').replace(/^\uFEFF/, ''));
for (const card of previous.cardHashes) assert.equal(digest(path.join(vault, card.path)), card.hash, card.path);
const pages = JSON.parse(fs.readFileSync(path.join(cinema, '_system/redesign-backups/books-palette-20261011/pages-apply.json'), 'utf8'));
for (const page of pages.changed) assert.equal(digest(path.join(vault, page.path)), page.after, page.path);
const css = path.join(vault, 'Книги/_system/books-library.css'), installed = path.join(vault, '.obsidian/snippets/books-library.css');
assert.equal(digest(css), digest(installed));
const { auditCollections } = require(path.join(vault, 'Книги/_system/tools/audit_adaptations.cjs'));
const audit = auditCollections(); assert.deepEqual(audit.issues, []);
const report = { date: '2026-10-11', bookCardsVerified: previous.cardHashes.length, bookCardsUnchanged: true,
    servicePagesChangedOnlyInStylingClass: pages.changed.length, serviceTextAndOtherYamlPreserved: pages.personalTextPreserved && pages.otherYamlPreserved,
    installedStyleMatchesSource: true, linksAudit: audit };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
