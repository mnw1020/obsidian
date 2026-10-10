// Bounded documentation/report updates and preservation verification for this repair.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cinema = path.resolve(__dirname, '../../..'), vault = path.dirname(cinema), books = path.join(vault, 'Книги');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const backup = path.join(__dirname, 'docs-before');
fs.mkdirSync(backup, { recursive: true });
const bookFile = name => path.join(books, '_system', name);
const names = ['Как пользоваться.md', 'Журнал изменений.md', 'Проверка связей с кино.md'];
for (const name of names) {
    const destination = bookFile(name);
    assert.equal(path.dirname(destination), path.join(books, '_system'));
    if (fs.existsSync(destination) && !fs.existsSync(path.join(backup, name))) fs.copyFileSync(destination, path.join(backup, name));
}
const { auditCollections, renderReport } = require(bookFile('tools/audit_adaptations.cjs'));
const summary = auditCollections({ library: books, vault });
assert.deepEqual(summary.issues, []);
const repair = JSON.parse(fs.readFileSync(path.join(__dirname, 'repair-apply.json'), 'utf8'));
for (const row of repair.changedFiles) {
    const actual = path.resolve(vault, row.path);
    assert.ok(actual.startsWith(vault + path.sep));
    assert.equal(hash(actual), row.after, 'Repaired card changed: ' + row.path);
    assert.equal(hash(path.join(__dirname, 'data-before', row.path)), row.before, 'Backup changed: ' + row.path);
}
assert.equal(hash(path.join(cinema, '_system/kino-design.css')), hash(path.join(vault, '.obsidian/snippets/kino-design.css')));
assert.equal(hash(bookFile('books-library.css')), hash(path.join(vault, '.obsidian/snippets/books-library.css')));

const help = bookFile('Как пользоваться.md');
let text = fs.readFileSync(help, 'utf8');
const newline = text.includes('\r\n') ? '\r\n' : '\n';
const section = [
    '## Экранизации и связанные произведения', '',
    'В книге нажми **Связать с кино**, в фильме или сериале — **Связать с книгой**. Прежняя команда **Книги - Связать с кино** работает из обеих коллекций: выбери второе произведение, и ссылки сразу сохранятся в обеих карточках. Открытые карточки обновляются сразу. Повторное добавление не создаёт дублей.', '',
    'Экранизации хранятся как `adaptations` у книги и `Первоисточники` у кино; прежнее `adapted_from` тоже учитывается. Другие связи хранятся двусторонне в `related`. В карточках показаны компактные строки с названием, типом и годом; пустой раздел скрыт.', '',
    '«Проверить библиотеку» проверяет цели, дубли и обратные ссылки; «Исправить безопасное» восстанавливает однозначные обратные связи. Отдельный структурный отчёт: [[Книги/_system/Проверка связей с кино|Проверка связей с кино]]. Совпадения названий автоматически не связываются.', '', ''
].join(newline);
if (!text.includes('## Экранизации и связанные произведения')) {
    assert.ok(text.includes('## Обслуживание'));
    text = text.replace('## Обслуживание', section + '## Обслуживание');
    fs.writeFileSync(help, text);
}

const journal = bookFile('Журнал изменений.md');
let history = fs.readFileSync(journal, 'utf8');
if (!history.includes('<!-- BOOK-CINEMA-RELATIONS-20261010 -->')) {
    const nl = history.includes('\r\n') ? '\r\n' : '\n';
    history += [ '', '<!-- BOOK-CINEMA-RELATIONS-20261010 -->', '## 10.10.2026 — Связи книг и кино', '',
        '- Восстановлены 12 двусторонних связей по явным ссылкам в личных заметках: 5 экранизаций и 7 других связанных произведений. Изменены только свойства связей в 12 карточках; отзывы, оценки, даты и прежние ссылки сохранены.',
        '- В обеих коллекциях связи оформлены компактными строками; пустой раздел скрывается. Кнопки используют прежнюю команду «Книги - Связать с кино», сохраняют обе стороны и сразу обновляют открытые карточки.',
        '- Проверка библиотеки, безопасное исправление и отдельный аудит согласованно поддерживают related между книгами и кино и прежнее adapted_from.',
        `- Структурная проверка: ${summary.books} книг, ${summary.media} карточек кино; ${summary.links} экранизаций и ${summary.relatedLinks} других связей, ошибок нет.`,
        '- Резервные копии и точка продолжения: Кино/_system/redesign-backups/adaptation-links-20261010 и Кино/_system/Редизайн — прогресс.md.', ''
    ].join(nl);
    fs.writeFileSync(journal, history);
}
fs.writeFileSync(bookFile('Проверка связей с кино.md'), renderReport(summary, new Date('2026-10-10T12:00:00+05:00')));
const result = { audit: summary, repairedCardsVerified: repair.changedFiles.length, backupHashesMatch: true,
    repairedHashesMatch: true, snippetsMatchSources: true,
    personalMarkdownPreserved: repair.personalMarkdownPreserved, unrelatedYamlPreserved: repair.unrelatedYamlPreserved,
    existingRelationsPreserved: repair.existingRelationsPreserved, documentationUpdated: names };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
