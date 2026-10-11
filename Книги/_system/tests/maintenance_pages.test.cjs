const assert = require('node:assert/strict'), { test } = require('node:test'), fs = require('node:fs');
const pages = require('../maintenance_pages.js'), createCore = require('../book_core.js');
const START = '<!-- BOOK-MAINTENANCE:START -->', END = '<!-- BOOK-MAINTENANCE:END -->';
const frontmatter = '---\r\ncustom: "Буквально $&"\r\ncssclasses: ["books-library"]\r\nobsidianUIMode: preview\r\n---\r\n';
const auditBody = '# Проверка библиотеки\n\n> Последняя проверка: **2026-10-12 12:34:56**  \n\n## Итог\n\n- Ошибок: **2**.\n- Предупреждений: **3**.\n- Произведений проверено: **214**.\n\n## ❌ Ошибки\n\n- [[Книги/Путь|Книга]]: буквальный $&.\n\n```md\n## Это код\n```\n\n## ⚠️ Предупреждения\n\n- Личный текст.\n  ';
const journalBody = '# Журнал изменений\n\nОписание.\n\n<!-- BOOK-LIBRARY-EVENT at="2026-10-12T10:00:00" normalization="false" structure="true" -->\n## 12.10.2026 10:00\n\n- Первая запись $& [[Книги/Книга|Книга]].\n\n```md\n## Заголовок в коде\n```\n\n<!-- BOOK-CINEMA-RELATIONS-20261010 -->\n## 10.10.2026 — Связи книг и кино\n\nРучная запись целиком.\n\n### Подраздел\n\n- Все подробности.\n\n<!-- BOOK-LIBRARY-EVENT at="2026-10-12T11:00:00" normalization="true" structure="true" -->\n## 12.10.2026 11:00\n\n- Последняя запись.\n  ';
test('page inserts one loader and preserves frontmatter plus all old Markdown byte-for-byte', () => {
    for (const [mode, body] of [['audit', auditBody], ['journal', journalBody]]) {
        const original = frontmatter + '\r\n' + body, next = pages.page(original, mode);
        assert.ok(next.startsWith(frontmatter)); assert.ok(next.endsWith('\r\n' + body));
        assert.match(next, new RegExp('mode: "' + mode + '"'));
        assert.equal(next.split(START).length - 1, 1); assert.equal(pages.page(next, mode), next);
    }
});
test('loader replacement preserves personal text and refuses broken or ambiguous managed markers', () => {
    const prefix = frontmatter + '\r\nЛичное предисловие $&\n';
    const suffix = '\nМой Markdown $& [[Ссылка]]\r\n  ';
    const next = pages.page(prefix + START + '\nСтарый loader\n' + END + suffix, 'journal');
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    for (const raw of [START, END, END + START, START + END + START + END, '<!-- BOOK-MAINTENANCE:BROKEN -->']) {
        assert.throws(() => pages.page(raw, 'journal'), /маркеры/);
        assert.throws(() => pages.clearJournal(raw), /маркеры/);
    }
    assert.throws(() => pages.page('', 'other'), /Неизвестный/);
});
test('clear removes all automatic and manual history while preserving properties and the loader', () => {
    const original = pages.page(frontmatter + journalBody, 'journal'), clear = pages.clearJournal(original);
    assert.ok(clear.startsWith(frontmatter)); assert.equal(clear.split(START).length - 1, 1);
    assert.equal(clear.match(/<!-- BOOK-MAINTENANCE:START -->[\s\S]*?<!-- BOOK-MAINTENANCE:END -->/)[0], original.match(/<!-- BOOK-MAINTENANCE:START -->[\s\S]*?<!-- BOOK-MAINTENANCE:END -->/)[0]);
    assert.match(clear, /# Журнал изменений/); assert.match(clear, /Автоматическая история/);
    assert.doesNotMatch(clear, /BOOK-LIBRARY-EVENT|BOOK-CINEMA-RELATIONS|Ручная запись|Первая запись|^## /m);
    assert.deepEqual(pages.parseJournal(clear), []); assert.equal(pages.clearJournal(clear), clear);
});
test('audit parser retains Markdown sections and extracts summary counts rather than counting list rows', () => {
    const parsed = pages.parseAudit(pages.page(frontmatter + auditBody, 'audit'));
    assert.equal(parsed.timestamp, '2026-10-12 12:34:56');
    assert.equal(parsed.checked, 214); assert.equal(parsed.errors, 2); assert.equal(parsed.warnings, 3);
    assert.deepEqual(parsed.sections.map(row => row.title), ['Итог', '❌ Ошибки', '⚠️ Предупреждения']);
    assert.equal(parsed.sections[1].markdown, '\n- [[Книги/Путь|Книга]]: буквальный $&.\n\n```md\n## Это код\n```\n\n');
    assert.equal(parsed.sections[2].markdown, '\n- Личный текст.\n  ');
    assert.deepEqual(pages.parseAudit(''), { timestamp: '', checked: 0, errors: 0, warnings: 0, sections: [] });
});
test('journal parser keeps manual entries, exact Markdown bodies and each event timestamp', () => {
    const entries = pages.parseJournal(pages.page(frontmatter + journalBody, 'journal'));
    assert.equal(entries.length, 3); assert.equal(entries[0].at, '2026-10-12T10:00:00');
    assert.equal(entries[1].at, ''); assert.equal(entries[2].at, '2026-10-12T11:00:00');
    assert.equal(entries[1].title, '10.10.2026 — Связи книг и кино');
    assert.equal(entries[0].markdown, '\n- Первая запись $& [[Книги/Книга|Книга]].\n\n```md\n## Заголовок в коде\n```\n\n');
    assert.equal(entries[1].markdown, '\nРучная запись целиком.\n\n### Подраздел\n\n- Все подробности.\n\n');
    assert.equal(entries[2].markdown, '\n- Последняя запись.\n  ');
});
function journalHarness() {
    const files = new Map(), journalPath = 'Книги/_system/Журнал изменений.md';
    files.set('Книги/_system/maintenance_pages.js', { text: fs.readFileSync(require.resolve('../maintenance_pages.js'), 'utf8') });
    const h = { files, journalPath, beforeProcess: null };
    const app = { vault: { getAbstractFileByPath: name => files.get(name), read: async file => file.text,
        create: async (name, text) => { if (files.has(name)) throw new Error('Exists'); const file = { path: name, text }; files.set(name, file); return file; },
        process: async (file, transform) => { h.beforeProcess?.(file); file.text = transform(file.text); return file.text; }
    } };
    h.core = createCore({ app, obsidian: {} });
    return h;
}
test('actual core append recreates journal design and appends after clear without restoring old entries', async () => {
    const h = journalHarness();
    await h.core.appendJournal(['Старая запись']);
    const journal = h.files.get(h.journalPath);
    assert.equal(pages.parseJournal(journal.text).length, 1); assert.match(journal.text, /mode: "journal"/);
    journal.text = pages.clearJournal(journal.text);
    const clear = journal.text;
    await h.core.appendJournal(['Новая запись $& [[Книги/Книга|Книга]]'], true, true);
    assert.ok(journal.text.startsWith(clear)); assert.doesNotMatch(journal.text, /Старая запись/);
    const entries = pages.parseJournal(journal.text);
    assert.equal(entries.length, 1); assert.match(entries[0].markdown, /Новая запись \$&/);
    assert.match(entries[0].at, /^\d{4}-\d\d-\d\dT/); assert.match(journal.text, /normalization="true" structure="true"/);
    assert.equal(journal.text.split(START).length - 1, 1);
});
test('actual core append merges latest text atomically and never strips existing history whitespace', async () => {
    const h = journalHarness(), original = frontmatter + journalBody;
    const file = { path: h.journalPath, text: original }; h.files.set(h.journalPath, file);
    const concurrent = '\r\nОдновременная личная запись $&\n  \r\n';
    h.beforeProcess = file => { file.text += concurrent; };
    await h.core.appendJournal(['Новое событие']);
    assert.ok(file.text.includes(journalBody + concurrent)); assert.ok(file.text.startsWith(frontmatter));
    assert.equal(pages.parseJournal(file.text).length, 4); assert.match(file.text, /mode: "journal"/);
});
