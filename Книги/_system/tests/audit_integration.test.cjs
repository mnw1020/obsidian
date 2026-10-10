const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const audit = require('../QuickAdd/audit_library.js');
const { fromText, parseYaml, stringifyYaml } = require('./yaml_fixture.cjs');

function harness() {
    const reportPath = 'Книги/_system/Проверка библиотеки.md';
    const files = new Map(), mutations = [], prompts = [], opened = [];
    const history = '<!-- BOOK-READINGS:START -->\n\n<!-- BOOK-READING:START number="1" date="2024-10" rating="8" -->\n### Чтение 1\n\n<!-- BOOK-READING:COMMENT -->\nИсходный комментарий\n<!-- BOOK-READING:END -->\n\n<!-- BOOK-READINGS:END -->';
    function file(filePath, text) {
        const entry = { path: filePath, basename: path.basename(filePath, path.extname(filePath)), extension: path.extname(filePath).slice(1), text };
        files.set(filePath, entry);
        return entry;
    }
    const core = file('Книги/_system/book_core.js', fs.readFileSync(path.join(__dirname, '../book_core.js'), 'utf8'));
    const report = file(reportPath, 'Исходный отчёт');
    const home = file('Книги/_index.md', '<!-- BOOK-HOME-STATS:START -->Не менять<!-- BOOK-HOME-STATS:END -->');
    const books = ['Автор', 'автор'].map((author, i) => file(`Книги/Художественные/${i}.md`, `---\ntitle: "Книга ${i}"\nauthors: ["${author}"]\ndate: "2024-10"\nread_count: 1\nrating: 8\n---\n\n${history}`));
    let beforeProcess;
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: fromText(entry.text), links: [], embeds: [] }), getFirstLinkpathDest: () => null },
        vault: {
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            getFiles: () => [...files.values()],
            getAbstractFileByPath: filePath => files.get(filePath),
            read: async entry => entry.text,
            process: async (entry, callback) => {
                assert.equal(entry.path, reportPath, 'diagnostics may only touch the report');
                beforeProcess?.(entry);
                const next = callback(entry.text);
                if (next !== entry.text) { mutations.push(entry.path); entry.text = next; }
            },
            create: async () => { throw Error('Unexpected create'); },
            modify: async () => { throw Error('Unexpected modify'); }
        },
        fileManager: { processFrontMatter: async () => { throw Error('Unexpected frontmatter write'); } },
        workspace: { getLeaf: () => ({ openFile: async entry => opened.push(entry.path) }) }
    };
    const quickAddApi = { suggester: async () => { prompts.push('normalization'); throw Error('Diagnostics must not ask normalization'); } };
    const obsidian = { Notice: class {}, normalizePath: value => value, parseYaml };
    return { app, quickAddApi, obsidian, books, home, report, core, file, mutations, prompts, opened, set beforeProcess(callback) { beforeProcess = callback; } };
}

test('plain audit with author variants never prompts normalization or writes books/home', async () => {
    const h = harness(), originals = [...h.books, h.home].map(file => file.text);
    await audit(h);
    assert.deepEqual(h.prompts, []);
    assert.deepEqual(h.mutations, [h.report.path]);
    assert.deepEqual([...h.books, h.home].map(file => file.text), originals);
    assert.match(h.report.text, /Варианты написания одного автора/);
    assert.equal(fromText(h.report.text).obsidianUIMode, 'preview');
    assert.deepEqual(fromText(h.report.text).cssclasses, ['books-library']);
    assert.deepEqual(h.opened, [h.report.path]);
    h.report.text += '\nПредыдущее состояние отчёта.\n';
    await audit(h);
    assert.deepEqual(fromText(h.report.text).cssclasses, ['books-library'], 'report regeneration retains the palette scope');
    assert.deepEqual([...h.books, h.home].map(file => file.text), originals);
});

test('audit refuses to overwrite a concurrently changed service report and leaves other files alone', async () => {
    const h = harness(), originals = [...h.books, h.home].map(file => file.text);
    h.beforeProcess = report => { report.text = 'Правка отчёта с телефона'; };
    await assert.rejects(audit(h), /изменился/);
    assert.equal(h.report.text, 'Правка отчёта с телефона');
    assert.deepEqual(h.mutations, []);
    assert.deepEqual(h.prompts, []);
    assert.deepEqual([...h.books, h.home].map(file => file.text), originals);
});

function addFields(file, fields) {
    file.text = file.text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '---\n' + stringifyYaml({ ...fromText(file.text), ...fields }) + '\n---');
}
const relationSection = (report, title) => report.split('## ' + title + '\n\n')[1]?.split('\n## ')[0];

test('audit accepts related within and between collections and adapted_from as an adaptation reverse without writing works', async () => {
    const h = harness(), [a, b] = h.books;
    const movie = h.file('Кино/Media/Фильм.md', '---\ntags: ["movies"]\nadapted_from: ["[[Книги/Художественные/0]]"]\nrelated: ["[[Книги/Художественные/0]]", "[[Кино/Media/Сериал]]"]\n---\nКомментарий кино');
    const serial = h.file('Кино/Media/Сериал.md', '---\ntags: ["#serial"]\nПервоисточники: ["[[Книги/Художественные/1]]"]\nadapted_from: ["[[Книги/Художественные/1]]"]\nrelated: ["[[Кино/Media/Фильм]]"]\n---\nКомментарий сериала');
    addFields(a, { adaptations: ['[[Кино/Media/Фильм]]'], related: ['[[Книги/Художественные/1]]', '[[Кино/Media/Фильм]]'], continued_by: ['[[Книги/Художественные/1]]'] });
    addFields(b, { adaptations: ['[[Кино/Media/Сериал]]'], related: ['[[Книги/Художественные/0]]'], continues: ['[[Книги/Художественные/0]]'] });
    const works = [a, b, movie, serial, h.home], originals = works.map(file => file.text);
    await audit(h);
    assert.match(relationSection(h.report.text, '🎬 Связи с кино'), /^Ошибок двусторонних связей/);
    assert.match(relationSection(h.report.text, '🔗 Прочие взаимные связи'), /^Ошибок прочих взаимных связей/);
    assert.match(h.report.text, /связей книга ↔ кино: \*\*2\*\*; полностью взаимных: \*\*2\*\*/);
    assert.match(h.report.text, /Прочих взаимных связей: \*\*4\*\*; полностью взаимных: \*\*4\*\*/);
    assert.deepEqual(works.map(file => file.text), originals);
    assert.deepEqual(h.mutations, [h.report.path]);
    assert.deepEqual(h.prompts, []);
});

test('audit flags missing reverse related across collections and keeps adaptation and continuation diagnostics separate', async () => {
    const h = harness(), [a, b] = h.books;
    h.file('Кино/Media/Фильм.md', '---\ntags: ["movies"]\nadapted_from: ["[[Книги/Художественные/1]]"]\n---\nИсходное кино');
    addFields(a, { related: ['[[Кино/Media/Фильм]]'], continued_by: ['[[Книги/Художественные/1]]'] });
    const originals = h.app.vault.getMarkdownFiles().filter(file => file !== h.report).map(file => [file.path, file.text]);
    await audit(h);
    const general = relationSection(h.report.text, '🔗 Прочие взаимные связи');
    assert.match(general, /Кино\/Media\/Фильм[^\n]+нет обратной ссылки в `related` \(related\)/);
    assert.match(general, /нет обратной ссылки в `continues` \(продолжение\)/);
    assert.doesNotMatch(general, /adapted_from|adaptations|Первоисточники|неверного типа/);
    const cinema = relationSection(h.report.text, '🎬 Связи с кино');
    assert.match(cinema, /нет обратной ссылки в `adaptations`/);
    assert.doesNotMatch(cinema, /нет обратной ссылки в `Первоисточники`/);
    assert.deepEqual(h.app.vault.getMarkdownFiles().filter(file => file !== h.report).map(file => [file.path, file.text]), originals);
    assert.deepEqual(h.mutations, [h.report.path]);
});

test('audit still rejects related pointing to service notes and reports canonical duplicate targets', async () => {
    const h = harness(), [a] = h.books;
    h.file('Книги/Идеи/Служебная.md', '---\ntitle: "Служебная"\nauthors: ["Автор"]\nrelated: ["[[Книги/Художественные/0]]"]\n---\nИдея');
    h.file('Кино/Media/Фильм.md', '---\ntags: ["movies"]\nrelated: ["[[Книги/Художественные/0]]"]\n---\nКино');
    addFields(a, { related: ['[[Кино/Media/Фильм]]', '[[Кино/Media/Фильм.md|Алиас]]', '[[Книги/Идеи/Служебная]]'] });
    await audit(h);
    const general = relationSection(h.report.text, '🔗 Прочие взаимные связи');
    assert.match(general, /в `related` повторяется ссылка/);
    assert.match(general, /`related` ведет на объект неверного типа/);
    assert.doesNotMatch(general, /нет обратной ссылки/);
    assert.deepEqual(h.mutations, [h.report.path]);
});

test('offline relation audit excludes service notes, accepts both adaptation reverses and catches missing related reverses', t => {
    const os = require('node:os');
    const { auditCollections, renderReport } = require('../tools/audit_adaptations.cjs');
    const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'book-relations-audit-'));
    t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
    const write = (target, fm) => {
        const full = path.join(vault, target + '.md');
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, '---\n' + stringifyYaml(fm) + '\n---\nИсходный текст\n');
    };
    const a = 'Книги/Художественные/А', b = 'Книги/Художественные/Б', m = 'Кино/Media/Фильм', s = 'Кино/Media/Сериал';
    write(a, { title: 'А', authors: ['Автор'], adaptations: ['[[' + m + ']]'], related: ['[[' + m + ']]', '[[' + b + ']]'], continued_by: ['[[' + b + ']]'] });
    write(b, { title: 'Б', authors: ['Автор'], adaptations: ['[[' + s + ']]'], related: ['[[' + a + ']]'], continues: ['[[' + a + ']]'] });
    write(m, { tags: ['movies'], adapted_from: ['[[' + a + ']]'], related: ['[[' + a + ']]', '[[' + s + ']]'] });
    write(s, { tags: ['#serial'], Первоисточники: ['[[' + b + ']]'], adapted_from: ['[[' + b + ']]'], related: ['[[' + m + ']]'] });
    for (const folder of ['Цитаты', 'Конспекты', 'Идеи', '_system']) write('Книги/' + folder + '/Служебная', { title: 'Служебная', authors: ['Автор'], related: ['[[Отсутствует]]'] });
    const library = path.join(vault, 'Книги');
    assert.deepEqual(auditCollections({ library, vault }), { books: 2, media: 2, links: 2, relatedLinks: 3, continuationLinks: 1, issues: [] });
    const validReport = renderReport(auditCollections({ library, vault }), new Date('2026-10-10T00:00:00Z'));
    assert.equal(fromText(validReport).obsidianUIMode, 'preview');
    assert.deepEqual(fromText(validReport).cssclasses, ['books-library']);
    assert.match(validReport, /Проверено 10\.10\.2026/);
    const regeneratedReport = renderReport({ ...auditCollections({ library, vault }), relatedLinks: 4 }, new Date('2026-10-11T00:00:00Z'));
    assert.deepEqual(fromText(regeneratedReport).cssclasses, ['books-library'], 'offline report keeps its style when regenerated');
    assert.match(regeneratedReport, /Связанных произведений: 4\./);
    write(m, { tags: ['movies'], adapted_from: ['[[' + a + ']]'], related: ['[[' + s + ']]'] });
    const missing = auditCollections({ library, vault });
    assert.equal(missing.issues.length, 1);
    assert.match(missing.issues[0], /отсутствует обратная ссылка в related \(related\)/);
    write(a, { title: 'А', authors: ['Автор'], adaptations: ['[[' + m + ']]'], related: ['[[' + m + ']]', '[[' + m + '.md|Алиас]]', '[[Книги/Цитаты/Служебная]]'] });
    const invalid = auditCollections({ library, vault });
    assert.ok(invalid.issues.some(issue => /related — дубль/.test(issue)));
    assert.ok(invalid.issues.some(issue => /related — недоступная или неподходящая цель/.test(issue)));
});
