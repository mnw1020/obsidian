const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const storage = require('../quote_storage.js');
const knowledge = require('../knowledge.js');
const createCore = require('../book_core.js');

function parseYaml(value) {
    const result = {};
    for (const line of value.split(/\r?\n/)) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (!match) continue;
        const [, key, raw] = match;
        if (!raw) continue;
        try { result[key] = JSON.parse(raw); } catch { result[key] = raw; }
    }
    return result;
}
function harness() {
    const files = new Map(), folders = [], creates = [], processes = [], reads = [];
    const h = { files, folders, creates, processes, reads };
    function register(entry) {
        files.set(entry.path, entry);
        const parent = files.get(entry.path.slice(0, entry.path.lastIndexOf('/')));
        if (parent?.children && !parent.children.some(child => child.path === entry.path)) parent.children.push(entry);
        return entry;
    }
    const folder = folderPath => register({ path: folderPath, name: folderPath.split('/').at(-1), children: [] });
    const file = (filePath, text, fm = {}) => register({ path: filePath, basename: filePath.split('/').at(-1).replace(/\.md$/, ''), extension: filePath.includes('.') ? filePath.split('.').at(-1) : '', stat: { mtime: 1 }, text, fm });
    folder('Книги'); folder('Книги/Цитаты'); folder('Книги/Художественные');
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: entry.fm }) },
        vault: {
            getAbstractFileByPath: filePath => files.get(filePath),
            getAllLoadedFiles: () => [...files.values()],
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            read: async entry => { reads.push(entry.path); return entry.text; },
            createFolder: async folderPath => {
                if (h.beforeFolder) await h.beforeFolder(folderPath);
                if (files.has(folderPath)) throw new Error('Folder already exists');
                const entry = folder(folderPath); folders.push(folderPath); return entry;
            },
            create: async (filePath, text) => {
                if (h.beforeCreate) await h.beforeCreate(filePath, text);
                if (files.has(filePath)) throw new Error('File already exists');
                const entry = file(filePath, text); creates.push({ path: filePath, text });
                if (h.afterCreate) await h.afterCreate(entry);
                return entry;
            },
            process: async (entry, transform) => {
                if (h.beforeProcess) await h.beforeProcess(entry);
                const old = entry.text, next = transform(old);
                entry.text = next; entry.stat.mtime++;
                processes.push({ path: entry.path, old, next });
            },
            modify: async () => { throw new Error('Non-atomic modify forbidden'); }
        }
    };
    const core = createCore({ app, obsidian: { parseYaml, normalizePath: value => value } });
    Object.assign(h, { app, core, knowledge, file, folder, save: value => storage.saveQuote({ app, core, knowledge, value }) });
    return h;
}
const free = (changes = {}) => ({ sourceKind: 'free', text: 'Новая цитата', section: 'Мотивация/в', themes: ['Тема'], conclusion: 'Мой вывод', location: 'Страница 12', sourceTitle: 'Внешнее произведение', sourceAuthors: ['Автор'], savedDate: '2026-10-06', ...changes });
const collection = (quote, changes = {}) => {
    const fm = { note_type: 'excerpt_collection', title: 'Подборка', authors: [], quote_section: 'Мотивация/в', ...changes };
    return '---\n' + Object.entries(fm).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\nМой вводный текст\n\n' + quote;
};

test('section normalization keeps arbitrary depth and Cyrillic, rejecting Windows-invalid and traversal paths', () => {
    assert.equal(storage.normalizeSectionPath(' Мотивация / в '), 'Мотивация/в');
    assert.equal(storage.normalizeSectionPath('А/Б/В/Г/Д/Е'), 'А/Б/В/Г/Д/Е');
    assert.equal(storage.normalizeSectionPath(''), '');
    assert.equal(storage.normalizeSectionPath(undefined), '');
    for (const invalid of ['.', '..', '../Вне', 'А/../Вне', '/А', 'А/', 'А//Б', 'А/ /Б', 'А\\Б', 'E:/Вне', 'А?', 'А*', 'А"', 'А<', 'А>', 'А|', 'А\nБ', 'А\u0000Б', 'А.', 'CON', 'con.txt', 'NUL', 'PRN', 'AUX', 'COM1', 'LPT9.txt', 'COM¹', 'А'.repeat(256)]) {
        assert.throws(() => storage.normalizeSectionPath(invalid), undefined, invalid);
    }
});

test('section folders create parent and leaf once, and reuse existing spelling of case-insensitive paths', async () => {
    const h = harness();
    assert.equal(await storage.ensureSectionFolders(h.app, 'Мотивация/в'), 'Книги/Цитаты/Мотивация/в');
    assert.deepEqual(h.folders, ['Книги/Цитаты/Мотивация', 'Книги/Цитаты/Мотивация/в']);
    assert.equal(await storage.ensureSectionFolders(h.app, 'мотивация/В'), 'Книги/Цитаты/Мотивация/в');
    assert.equal(h.folders.length, 2);
    assert.equal(await storage.ensureSectionFolders(h.app, ''), 'Книги/Цитаты/Неразобранное');
});

test('concurrent folder creation is reconciled safely; a file conflict aborts before creating folders', async () => {
    const h = harness();
    h.beforeFolder = async () => { await Promise.resolve(); };
    const paths = await Promise.all([storage.ensureSectionFolders(h.app, 'Мотивация/в'), storage.ensureSectionFolders(h.app, 'Мотивация/в')]);
    assert.deepEqual(paths, ['Книги/Цитаты/Мотивация/в', 'Книги/Цитаты/Мотивация/в']);
    assert.equal(h.folders.length, 2);
    const conflict = harness();
    const source = conflict.file('Книги/Цитаты/Мотивация', 'Личная запись');
    await assert.rejects(storage.ensureSectionFolders(conflict.app, 'Мотивация/в'), /уже есть файл/);
    assert.equal(source.text, 'Личная запись');
    assert.equal(conflict.folders.length, 0);
});

test('book quotes append atomically to the original source, preserving every old byte and ignoring manual provenance', async () => {
    const h = harness();
    const raw = '---\r\ntitle: "Книга"\r\nauthors: ["Автор книги"]\r\n---\r\n\r\nИсходный конспект\n\n<!-- BOOK-READINGS:START -->\r\nСуществующая история $&\r\n<!-- BOOK-READINGS:END -->\r\n  ';
    const book = h.file('Книги/Художественные/Книга.md', raw, { title: 'Книга', authors: ['Автор книги'] });
    h.beforeProcess = entry => { entry.text += '\r\nПараллельная заметка\r\n'; };
    const result = await h.save({ ...free(), sourceKind: 'book', bookPath: book.path, sourceTitle: 'Не тот источник', sourceAuthors: ['Не тот автор'] });
    assert.equal(result.file, book);
    assert.equal(result.path, book.path);
    assert.equal(h.processes.length, 1);
    assert.equal(h.creates.length, 0);
    assert.ok(book.text.startsWith(raw + '\r\nПараллельная заметка\r\n'));
    const [entry] = knowledge.parseExcerpts(book.text);
    assert.equal(entry.id, result.id);
    assert.equal(entry.section, 'Мотивация/в');
    assert.equal(entry.sourceTitle, '');
    assert.equal(entry.sourceAuthors, undefined);
    assert.equal(entry.conclusion, 'Мой вывод');
    assert.equal(entry.savedDate, '2026-10-06');
    const added = book.text.slice((raw + '\r\nПараллельная заметка\r\n').length);
    assert.equal(added.replace(/\r\n/g, '').includes('\n'), false);
    assert.ok(h.files.has('Книги/Цитаты/Мотивация/в'));
    assert.equal(h.files.has('Книги/Цитаты/Мотивация/в/_Выписки.md'), false);
});

test('unavailable books and invalid inputs fail before folder/note creation; a later failed book check prevents the atomic write', async () => {
    for (const value of [free({ text: '' }), free({ savedDate: '2026-02-30' }), free({ section: '../Вне' }), free({ sourceKind: 'other' }), { ...free(), sourceKind: 'book', bookPath: 'Книги/Отсутствует.md' }]) {
        const h = harness();
        await assert.rejects(h.save(value));
        assert.equal(h.folders.length + h.creates.length + h.processes.length, 0);
    }
    const h = harness();
    const book = h.file('Книги/Художественные/Книга.md', 'Конспект без YAML в тесте', { title: 'Книга', authors: ['Автор'] });
    h.beforeProcess = entry => { entry.fm = { ...entry.fm, note_type: 'quote' }; };
    await assert.rejects(h.save({ ...free(), sourceKind: 'book', bookPath: book.path }), /книга больше не доступна/);
    assert.equal(h.processes.length, 0);
    assert.equal(book.text, 'Конспект без YAML в тесте');
});

test('a free quote creates one complete collection note with manual provenance and no intermediate empty note', async () => {
    const h = harness();
    const result = await h.save(free({ sourceAuthors: 'Фамилия, Имя; Другой автор', section: ' Мотивация / в ' }));
    assert.equal(result.path, 'Книги/Цитаты/Мотивация/в/_Выписки.md');
    assert.equal(h.creates.length, 1);
    assert.equal(h.processes.length, 0);
    const fm = h.core.readFrontmatter(result.file.text);
    assert.equal(fm.note_type, 'excerpt_collection');
    assert.equal(fm.title, 'в');
    assert.equal(fm.quote_section, 'Мотивация/в');
    assert.deepEqual(fm.authors, []);
    assert.equal(h.core.getFrontmatter(result.file).note_type, 'excerpt_collection');
    const [entry] = knowledge.parseExcerpts(result.file.text);
    assert.equal(entry.id, result.id);
    assert.equal(entry.section, 'Мотивация/в');
    assert.equal(entry.sourceTitle, 'Внешнее произведение');
    assert.deepEqual(entry.sourceAuthors, ['Фамилия, Имя', 'Другой автор']);
    assert.equal(entry.text, 'Новая цитата');
});

test('blank section stores anonymous quotes under Unsorted, preserving the central index and explicit empty provenance', async () => {
    const h = harness();
    const index = h.file('Книги/Цитаты.md', 'Существующий Dataview-индекс');
    const result = await h.save(free({ section: '', sourceTitle: '', sourceAuthors: undefined }));
    assert.equal(result.path, 'Книги/Цитаты/Неразобранное/_Выписки.md');
    assert.equal(index.text, 'Существующий Dataview-индекс');
    const [entry] = knowledge.parseExcerpts(result.file.text);
    assert.equal(entry.section, '');
    assert.deepEqual(entry.sourceAuthors, []);
    assert.equal(entry.sourceTitle, '');
    assert.equal(h.core.readFrontmatter(result.file.text).title, 'Произвольные цитаты');
});

test('existing collections append against fresh raw text without rewriting old properties, IDs, quotes or personal notes', async () => {
    const h = harness();
    h.folder('Книги/Цитаты/Мотивация'); h.folder('Книги/Цитаты/Мотивация/в');
    const oldQuote = knowledge.renderExcerpt({ id: 'book-excerpt-storage-old', text: 'Старая цитата', sourceAuthors: ['Старый автор'] });
    const raw = (collection(oldQuote, { authors: ['Автор файла'], custom: 'Мои свойства' }) + '\nЛичный текст\n  ').replace(/\n/g, '\r\n');
    const destination = h.file('Книги/Цитаты/Мотивация/в/_Выписки.md', raw);
    h.beforeProcess = entry => { entry.text += '\r\nПоздняя заметка\r\n'; };
    const result = await h.save(free({ sourceTitle: '', sourceAuthors: [] }));
    assert.equal(result.file, destination);
    assert.equal(h.creates.length, 0);
    assert.equal(h.processes.length, 1);
    assert.ok(destination.text.startsWith(raw + '\r\nПоздняя заметка\r\n'));
    const entries = knowledge.parseExcerpts(destination.text);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, 'book-excerpt-storage-old');
    assert.equal(entries[1].id, result.id);
    assert.deepEqual(entries[1].sourceAuthors, []);
    assert.equal(entries[1].sourceTitle, '');
});

test('unrelated notes and folders at the collection path are never overwritten; collection type is checked inside process', async () => {
    const h = harness();
    h.folder('Книги/Цитаты/Мотивация'); h.folder('Книги/Цитаты/Мотивация/в');
    const targetPath = 'Книги/Цитаты/Мотивация/в/_Выписки.md';
    const personal = h.file(targetPath, 'Личный файл без свойств');
    await assert.rejects(h.save(free()), /не является подборкой/);
    assert.equal(personal.text, 'Личный файл без свойств');
    assert.equal(h.processes.length, 0);
    h.files.delete(targetPath); h.folder(targetPath);
    await assert.rejects(h.save(free()), /уже есть папка/);
    assert.equal(h.creates.length, 0);
    h.files.delete(targetPath);
    const destination = h.file(targetPath, collection(''));
    h.beforeProcess = entry => { entry.text = entry.text.replace('"excerpt_collection"', '"personal"'); };
    await assert.rejects(h.save(free()), /не является подборкой/);
    assert.equal(h.processes.length, 0);
    assert.equal(knowledge.parseExcerpts(destination.text).length, 0);
});

test('racing external collection creation appends once; a create failure after commit returns the same saved quote without duplication', async () => {
    const raced = harness();
    raced.beforeCreate = (targetPath, text) => {
        raced.file(targetPath, collection(knowledge.renderExcerpt({ id: 'book-excerpt-storage-external', text: 'Цитата из другой вкладки' })));
    };
    const externalResult = await raced.save(free());
    const externalEntries = knowledge.parseExcerpts(externalResult.file.text);
    assert.equal(externalEntries.length, 2);
    assert.equal(externalEntries[0].id, 'book-excerpt-storage-external');
    assert.equal(externalEntries[1].id, externalResult.id);
    assert.equal(raced.processes.length, 1);
    const committed = harness();
    committed.afterCreate = () => { throw new Error('Create transport failed after commit'); };
    const result = await committed.save(free());
    assert.equal(committed.creates.length, 1);
    assert.equal(committed.processes.length, 0);
    const entries = knowledge.parseExcerpts(result.file.text);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, result.id);
});

test('app-scoped save queue works across separately loaded module instances and recovers from a failed create', async () => {
    const h = harness();
    const mod = { exports: {} };
    new Function('module', fs.readFileSync(path.join(__dirname, '../quote_storage.js'), 'utf8'))(mod);
    h.beforeCreate = async () => { await Promise.resolve(); };
    const results = await Promise.all([
        h.save(free({ text: 'Первая цитата' })),
        mod.exports.saveQuote({ app: h.app, core: h.core, knowledge, value: free({ text: 'Вторая цитата' }) })
    ]);
    assert.equal(h.creates.length, 1);
    assert.equal(h.processes.length, 1);
    assert.equal(results[0].file, results[1].file);
    assert.notEqual(results[0].id, results[1].id);
    assert.deepEqual(knowledge.parseExcerpts(results[0].file.text).map(entry => entry.text), ['Первая цитата', 'Вторая цитата']);
    const recovery = harness();
    recovery.beforeCreate = () => { throw new Error('No file was committed'); };
    await assert.rejects(recovery.save(free()), /No file was committed/);
    assert.equal(recovery.creates.length, 0);
    recovery.beforeCreate = undefined;
    const recovered = await recovery.save(free());
    assert.equal(knowledge.parseExcerpts(recovered.file.text).length, 1);
});
