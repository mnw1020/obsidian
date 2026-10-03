const assert = require('node:assert/strict');
const { test } = require('node:test');
const addBook = require('../QuickAdd/add_book.js');
const addReading = require('../QuickAdd/add_reading.js');

function harness({ cards = [], action = 'reading', section = 'Художественные', selected = 0, values = {} } = {}) {
    const input = { title: 'Тёмный лес', authors: 'Лю Цысинь', date: '2026-10-03', rating: '8', comment: 'Новое впечатление', ...values };
    const files = new Map();
    const mutations = [];
    const opened = [];
    const prompts = [];
    const notices = [];
    let formCount = 0;
    function file(path, fm = {}, text = '') {
        const name = path.split('/').at(-1);
        const entry = { path, extension: 'md', basename: name.slice(0, -3), parent: { path: path.slice(0, path.lastIndexOf('/')) }, fm, text };
        files.set(path, entry);
        return entry;
    }
    const history = 'Заметки, которые нужно сохранить\n\n<!-- BOOK-READINGS:START -->\n\n<!-- BOOK-READING:START number="1" date="2023-07-16" rating="6" -->\n### Чтение 1\n\n<!-- BOOK-READING:COMMENT -->\nПервое впечатление\n<!-- BOOK-READING:END -->\n\n<!-- BOOK-READINGS:END -->\n';
    const books = cards.map(card => file(card.path, { title: input.title, authors: ['Лю Цысинь'], read_count: 1, date: '2023-07-16', ...card.fm }, history));
    const home = file('Книги/_index.md', {}, '<!-- BOOK-HOME-STATS:START -->старые данные<!-- BOOK-HOME-STATS:END -->');
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: entry.fm }) },
        vault: {
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            getAbstractFileByPath: path => files.get(path),
            read: async entry => entry.text,
            modify: async (entry, text) => { mutations.push(['modify', entry.path]); entry.text = text; },
            createFolder: async path => { mutations.push(['folder', path]); files.set(path, { path }); },
            rename: async () => { throw new Error('Unexpected file move'); },
            create: async (path, text) => {
                mutations.push(['create', path]);
                const fm = path.endsWith('Журнал изменений.md') ? {} : { title: input.title, authors: input.authors.split(/[,;]+/).map(s => s.trim()), date: input.date, read_count: 1, ...(section === 'Художественные' ? { rating: Number(input.rating) } : {}) };
                return file(path, fm, text);
            }
        },
        fileManager: { processFrontMatter: async (entry, change) => { mutations.push(['frontmatter', entry.path]); change(entry.fm); } },
        workspace: { getActiveFile: () => home, getLeaf: () => ({ openFile: async entry => opened.push(entry.path) }) }
    };
    const quickAddApi = {
        date: { now: () => '2026-10-03' },
        requestInputs: async () => { formCount++; return input; },
        suggester: async (labels, options, prompt) => {
            prompts.push({ labels, prompt });
            if (prompt === 'Тип произведения') return '';
            if (prompt === 'Раздел') return section;
            if (prompt.startsWith('Похожий автор')) return options[0];
            if (prompt.startsWith('Найдено несколько')) return selected === null ? undefined : options[selected];
            if (prompt.startsWith('Книга уже есть')) return action;
            if (prompt === 'Серия') return '';
            throw new Error(`Unexpected prompt: ${prompt}`);
        },
        executeChoice: async (name, variables) => {
            assert.equal(name, 'Книги - Добавить чтение');
            await addReading({ app, quickAddApi, obsidian, variables });
        }
    };
    const obsidian = { Notice: class { constructor(message) { notices.push(message); } }, normalizePath: path => path };
    return { run: () => addBook({ app, quickAddApi, obsidian }), books, files, home, mutations, opened, prompts, notices, get formCount() { return formCount; }, app, quickAddApi, obsidian };
}

for (const path of ['Книги/Художественные/Лю Цысинь/Старое имя.md', 'Книги/Non-fiction/Карточка.md', 'Книги/Архив/Глубоко/Карточка.md', 'Книги/Карточка.md']) {
    test(`existing card at ${path} receives a reading`, async () => {
        const h = harness({ cards: [{ path }] });
        await h.run();
        assert.equal(h.books[0].fm.read_count, 2);
        assert.equal(h.books[0].fm.date, '2026-10-03');
        assert.match(h.books[0].text, /number="2" date="2026-10-03"/);
        assert.match(h.books[0].text, /Первое впечатление/);
        assert.match(h.books[0].text, /Заметки, которые нужно сохранить/);
        assert.match(h.books[0].text, /Новое впечатление/);
        assert.equal(h.formCount, 1);
        assert.deepEqual(h.opened, [path]);
        assert.ok(!h.mutations.some(([kind]) => kind === 'create' || kind === 'folder'));
        assert.match(h.home.text, /1 перечитано/);
        if (path.startsWith('Книги/Художественные/')) assert.equal(h.books[0].fm.rating, 8);
        else assert.ok(!Object.hasOwn(h.books[0].fm, 'rating'));
        assert.ok(!h.prompts.some(p => p.prompt === 'Серия'));
    });
}

test('normalization and author sets ignore case, whitespace, typography, ё and order', async () => {
    const h = harness({ cards: [{ path: 'Книги/Архив/Книга.md', fm: { title: '«Тёмный   лес»!', authors: [' Второй Автор ', 'ЛЮ ЦЫСИНЬ', 'ЛЮ ЦЫСИНЬ'] } }], values: { title: 'темный лес', authors: 'лю цысинь; второй автор' } });
    await h.run();
    assert.equal(h.books[0].fm.read_count, 2);
});

for (const fm of [{ authors: ['Другой писатель'] }, { authors: ['Лю Цысинь', 'Соавтор'] }, { title: 'Другая книга' }]) {
    test(`distinct title or full author set creates a book: ${JSON.stringify(fm)}`, async () => {
        const h = harness({ cards: [{ path: 'Книги/Архив/Карточка.md', fm }] });
        await h.run();
        assert.equal(h.books[0].fm.read_count, 1);
        assert.ok(h.mutations.some(([kind, path]) => kind === 'create' && path === 'Книги/Художественные/Лю Цысинь. Тёмный лес.md'));
    });
}

for (const action of ['cancel', undefined]) {
    test(`cancel confirmation leaves everything untouched (${action})`, async () => {
        const h = harness({ cards: [{ path: 'Книги/Архив/Карточка.md' }], action: action === undefined ? null : action });
        await h.run();
        assert.deepEqual(h.mutations, []);
        assert.deepEqual(h.opened, []);
    });
}

test('multiple matches display paths and update only selected card', async () => {
    const h = harness({ cards: [{ path: 'Книги/Архив/А.md' }, { path: 'Книги/Архив/Б.md' }], selected: 1 });
    await h.run();
    assert.equal(h.books[0].fm.read_count, 1);
    assert.equal(h.books[1].fm.read_count, 2);
    const prompt = h.prompts.find(p => p.prompt.startsWith('Найдено несколько'));
    assert.ok(prompt.labels.every(label => label.includes('Книги/Архив/')));
});

test('cancel card selection leaves everything untouched', async () => {
    const h = harness({ cards: [{ path: 'Книги/Архив/А.md' }, { path: 'Книги/Архив/Б.md' }], selected: null });
    await h.run();
    assert.deepEqual(h.mutations, []);
});

test('manual add reading still shows its form', async () => {
    const h = harness({ cards: [{ path: 'Книги/Художественные/А.md' }] });
    h.app.workspace.getActiveFile = () => h.books[0];
    await addReading({ app: h.app, quickAddApi: h.quickAddApi, obsidian: h.obsidian });
    assert.equal(h.formCount, 1);
    assert.equal(h.books[0].fm.read_count, 2);
});

test('matching metadata outside library is ignored', async () => {
    const h = harness({ cards: [{ path: 'Другое/Карточка.md' }] });
    await h.run();
    assert.equal(h.books[0].fm.read_count, 1);
    assert.ok(h.mutations.some(([kind, path]) => kind === 'create' && path.startsWith('Книги/Художественные/')));
});

test('invalid supplied date causes no writes', async () => {
    const h = harness({ cards: [{ path: 'Книги/Архив/А.md' }], values: { date: '2026-02-30' } });
    await h.run();
    assert.deepEqual(h.mutations, []);
});

test('occupied destination with different metadata is not overwritten', async () => {
    const h = harness({ cards: [{ path: 'Книги/Художественные/Лю Цысинь/Тёмный лес.md', fm: { title: 'Другая книга' } }] });
    for (const path of ['Книги/Художественные', 'Книги/Художественные/Лю Цысинь']) h.files.set(path, { path });
    await h.run();
    assert.deepEqual(h.mutations, []);
    assert.ok(h.notices.some(message => message.startsWith('Произведение уже существует')));
});

test('missing explicitly selected card does not fall back to active book', async () => {
    const h = harness({ cards: [{ path: 'Книги/Архив/А.md' }] });
    h.app.workspace.getActiveFile = () => h.books[0];
    await addReading({ app: h.app, quickAddApi: h.quickAddApi, obsidian: h.obsidian, variables: { bookReadingRequest: { path: 'Книги/Удалённая.md', values: {} } } });
    assert.deepEqual(h.mutations, []);
    assert.equal(h.formCount, 0);
});
