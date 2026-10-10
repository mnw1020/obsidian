const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const audit = require('../QuickAdd/audit_library.js');
const { fromText, parseYaml } = require('./yaml_fixture.cjs');

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
    return { app, quickAddApi, obsidian, books, home, report, core, mutations, prompts, opened, set beforeProcess(callback) { beforeProcess = callback; } };
}

test('plain audit with author variants never prompts normalization or writes books/home', async () => {
    const h = harness(), originals = [...h.books, h.home].map(file => file.text);
    await audit(h);
    assert.deepEqual(h.prompts, []);
    assert.deepEqual(h.mutations, [h.report.path]);
    assert.deepEqual([...h.books, h.home].map(file => file.text), originals);
    assert.match(h.report.text, /Варианты написания одного автора/);
    assert.equal(fromText(h.report.text).obsidianUIMode, 'preview');
    assert.deepEqual(h.opened, [h.report.path]);
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
