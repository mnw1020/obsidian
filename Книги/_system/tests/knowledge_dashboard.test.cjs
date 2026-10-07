const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const knowledge = require('../knowledge.js');
const dashboard = require('../reading_dashboard.js');
const createCore = require('../book_core.js');
const addExcerpt = require('../QuickAdd/add_excerpt.js');
const searchLibrary = require('../QuickAdd/library_search.js');

const coreSource = fs.readFileSync(path.join(__dirname, '../book_core.js'), 'utf8');
const knowledgeSource = fs.readFileSync(path.join(__dirname, '../knowledge.js'), 'utf8');
const managedHistory = '<!-- BOOK-READINGS:START -->\n\n<!-- BOOK-READING:START number="1" date="2024-10" rating="8" -->\n### Чтение 1\n\n<!-- BOOK-READING:COMMENT -->\nНужно сохранить исходный комментарий.\n<!-- BOOK-READING:END -->\n\n<!-- BOOK-READINGS:END -->';

function harness(cards = []) {
    const files = new Map(), reads = new Map(), events = new Map(), changes = [], opened = [], notices = [];
    function file(filePath, text, fm = {}, mtime = 1) {
        const entry = { path: filePath, basename: filePath.split('/').at(-1).replace(/\.md$/, ''), extension: 'md', stat: { mtime }, fm, text };
        files.set(filePath, entry);
        return entry;
    }
    file('Книги/_system/book_core.js', coreSource);
    file('Книги/_system/knowledge.js', knowledgeSource);
    for (const name of ['quote_add', 'quote_storage']) file(`Книги/_system/${name}.js`, fs.readFileSync(path.join(__dirname, `../${name}.js`), 'utf8'));
    file('Книги/_system/quote_create.js', 'module.exports = async ({initial, books, onSave}) => ({initial, books, save: onSave});');
    files.set('Книги', { path: 'Книги', children: [] });
    files.set('Книги/Цитаты', { path: 'Книги/Цитаты', children: [] });
    const books = cards.map(card => file(card.path, card.text ?? managedHistory, { title: 'Книга', authors: ['Автор'], read_count: 1, date: '2024-10', rating: 8, ...card.fm }));
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: entry.fm }) },
        vault: {
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            getAbstractFileByPath: filePath => files.get(filePath),
            createFolder: async filePath => { if (files.has(filePath)) throw Error('Path exists'); const folder = { path: filePath, children: [] }; files.set(filePath, folder); return folder; },
            create: async (filePath, text) => {
                if (files.has(filePath)) throw Error('Path exists');
                const entry = file(filePath, text, require('./yaml_fixture.cjs').fromText(text));
                changes.push({ path: filePath, next: text }); emit('create', entry); return entry;
            },
            read: async entry => { reads.set(entry.path, (reads.get(entry.path) || 0) + 1); return entry.text; },
            process: async (entry, callback) => {
                const old = entry.text, next = callback(old);
                changes.push({ path: entry.path, old, next });
                entry.text = next;
                entry.stat.mtime++;
            },
            modify: async () => { throw Error('Unexpected non-atomic modify'); },
            on: (name, callback) => { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); return { name, callback }; }
        },
        workspace: {
            getActiveFile: () => books[0],
            openLinkText: async (...args) => opened.push(args),
            getLeaf: () => ({ openFile: async (...args) => opened.push(args) })
        }
    };
    const obsidian = { Notice: class { constructor(message) { notices.push(message); } },
        parseYaml: yaml => require('./yaml_fixture.cjs').fromText('---\n' + yaml + '\n---\n') };
    function emit(name, ...args) { for (const callback of events.get(name) || []) callback(...args); }
    return { app, obsidian, books, files, reads, changes, opened, notices, file, emit };
}

test('explicit callout round-trips raw excerpt text, themes, conclusion and a separate stable block id', () => {
    const input = { id: 'book-excerpt-test-1', type: 'idea', text: '**Темы:** это часть цитаты\n\n> вложенная цитата', themes: ['Мышление', 'мышление', 'Ёж'], conclusion: 'Первая строка\n**Темы:** это часть вывода\nВторая строка', location: 'Глава 2, стр. 17' };
    const raw = knowledge.renderExcerpt(input);
    assert.match(raw, /\n\n\^book-excerpt-test-1\n$/);
    const [entry] = knowledge.parseExcerpts(raw);
    assert.equal(entry.text, input.text);
    assert.equal(entry.conclusion, input.conclusion);
    assert.deepEqual(entry.themes, ['Мышление', 'Ёж']);
    assert.equal(entry.location, input.location);
    assert.equal(entry.type, 'quote');
    assert.match(raw, /> \[!quote\] Цитата/);
    assert.equal(entry.id, input.id);
});

test('unmarked legacy callouts and examples inside fenced code are excluded', () => {
    const explicit = knowledge.renderExcerpt({ text: 'Включённая цитата', id: 'book-excerpt-included', type: 'quote' });
    const raw = '> [!quote] Старый конспект\n> Пока без регистрации\n\n```md\n' + explicit + '```\n\n' + explicit;
    assert.deepEqual(knowledge.parseExcerpts(raw).map(entry => entry.id), ['book-excerpt-included']);
    assert.equal(knowledge.parseExcerpts(explicit.replace('^book-excerpt-included', '> ^book-excerpt-included')).length, 0);
});

test('excerpt saved dates are optional, validated and never inferred from an id or old text', () => {
    const raw = knowledge.renderExcerpt({ text: 'Датированная мысль', type: 'idea', id: 'book-excerpt-dated', savedDate: '2026-10-04' });
    assert.match(raw, /\*\*Сохранено:\*\* 2026-10-04/);
    assert.equal(knowledge.parseExcerpts(raw)[0].savedDate, '2026-10-04');
    const legacy = knowledge.renderExcerpt({ text: 'Старая мысль', id: 'book-excerpt-2024-10-04' });
    assert.equal(knowledge.parseExcerpts(legacy)[0].savedDate, '');
    assert.doesNotMatch(legacy, /Сохранено/);
    assert.throws(() => knowledge.renderExcerpt({ text: 'Мысль', savedDate: '2026-02-30' }), /действительной датой/);
    assert.equal(knowledge.parseExcerpts(raw.replace('2026-10-04', '2026-02-30'))[0].savedDate, '');
    assert.equal(knowledge.localDate(new Date(2026, 9, 4, 0, 5)), '2026-10-04');
});

test('append leaves every byte of frontmatter, notes and reading history intact', () => {
    const raw = ('---\ntitle: "Книга"\n---\n\nЛичный конспект\n\n' + managedHistory + '\n  ').replace(/\n/g, '\r\n');
    const next = knowledge.applyExcerpt(raw, { text: 'Новая мысль', type: 'idea', id: 'book-excerpt-append' });
    assert.equal(next.slice(0, raw.length), raw);
    assert.equal(next.slice(raw.length).replace(/\r\n/g, '' ).includes('\n'), false);
    assert.equal(knowledge.parseExcerpts(next).length, 1);
});

test('formatting a full old paragraph preserves mixed raw newlines and all surrounding source', () => {
    const raw = 'До\r\n\r\nСтарый абзац\n\nПосле\r\n\r\n' + managedHistory;
    const baseline = raw.replace(/\r\n/g, '\n');
    const from = baseline.indexOf('Старый абзац'), to = from + 'Старый абзац'.length;
    const next = knowledge.applyExcerpt(raw, { text: 'Старый абзац', id: 'book-excerpt-old', type: 'quote' }, { baseline, text: 'Старый абзац', from, to });
    assert.ok(next.startsWith('До\r\n\r\n'));
    assert.ok(next.endsWith('\n\nПосле\r\n\r\n' + managedHistory));
    assert.equal(knowledge.parseExcerpts(next).length, 1);
});

test('concurrent edits, partial selections, YAML and managed history cause zero replacement', () => {
    const raw = '---\ntitle: "Книга"\n---\n\nАбзац\n\n' + managedHistory;
    const value = { text: 'Текст', id: 'book-excerpt-safe' };
    assert.throws(() => knowledge.applyExcerpt(raw + 'изменение', value, { baseline: raw, text: 'Абзац', from: raw.indexOf('Абзац'), to: raw.indexOf('Абзац') + 5 }), /изменился/);
    assert.throws(() => knowledge.applyExcerpt(raw, value, { baseline: raw, text: 'бза', from: raw.indexOf('Абзац') + 1, to: raw.indexOf('Абзац') + 4 }), /полный абзац/);
    assert.throws(() => knowledge.applyExcerpt(raw, value, { baseline: raw, text: '---', from: 0, to: 3 }), /Свойства/);
    const hs = raw.indexOf('<!-- BOOK-READINGS:START -->');
    assert.throws(() => knowledge.applyExcerpt(raw, value, { baseline: raw, text: raw.slice(hs), from: hs, to: raw.length }), /Историю чтений/);
});

test('an existing excerpt cannot be registered again or replaced by a nested excerpt', () => {
    const raw = knowledge.renderExcerpt({ text: 'Цитата', id: 'book-excerpt-once' });
    assert.throws(() => knowledge.applyExcerpt(raw, { text: 'Ещё', id: 'book-excerpt-once' }), /уже есть/);
    const from = raw.indexOf('> Цитата');
    assert.throws(() => knowledge.applyExcerpt(raw, { text: 'Ещё', id: 'book-excerpt-twice' }, { baseline: raw, text: '> Цитата', from, to: from + '> Цитата'.length }), /уже оформлен/);
});

test('quote filters combine text, theme and author with Russian ё normalisation', () => {
    const entries = [{ id: '1', text: 'Ёж и познание', conclusion: 'Проверить идею', location: 'Глава 1', title: 'Книга', authors: ['Автор'], themes: ['Мышление'], type: 'idea' }, { id: '2', text: 'Другая цитата', conclusion: '', location: '', title: 'Книга', authors: ['Автор'], themes: [], type: 'quote' }];
    assert.deepEqual(knowledge.filterExcerpts(entries, { query: 'еж', author: 'Автор', theme: 'мышление' }).map(entry => entry.id), ['1']);
    assert.equal(knowledge.filterExcerpts(entries, { query: 'проверить' }).length, 1);
});

test('explicit theme branches include descendants once and keep independent themes intact', () => {
    const base = { title: 'Источник', authors: [], text: 'Цитата', path: 'Книги/Источник.md' };
    const entries = [
        { ...base, id: 'a', themes: ['Психология/Привычки/Сон', 'Психология/Тревога'] },
        { ...base, id: 'b', themes: ['Психология/Привычки'] },
        { ...base, id: 'c', themes: ['Мотивация', 'Сон'] },
        { ...base, id: 'd', themes: ['Психология другая/Привычки'] }
    ];
    const original = JSON.stringify(entries);
    assert.deepEqual(knowledge.filterExcerpts(entries, { theme: 'психология' }).map(entry => entry.id), ['a', 'b']);
    assert.deepEqual(knowledge.filterExcerpts(entries, { theme: 'Психология / Привычки' }).map(entry => entry.id), ['a', 'b']);
    assert.deepEqual(knowledge.filterExcerpts(entries, { theme: 'сон' }).map(entry => entry.id), ['c']);
    assert.deepEqual(knowledge.themeOptions(entries), ['Мотивация', 'Психология', 'Психология другая', 'Психология другая/Привычки', 'Психология/Привычки', 'Психология/Привычки/Сон', 'Психология/Тревога', 'Сон']);
    assert.equal(JSON.stringify(entries), original);
});

test('full text word search combines source and theme without merging equal source titles', () => {
    const base = { title: 'Одинаковое название', authors: ['Автор'], themes: ['Мышление'], text: 'Ёж замечает ' + 'длинный текст '.repeat(200) + 'редкую подробность', conclusion: 'Другой порядок слов' };
    const entries = [{ ...base, id: 'a', path: 'Книги/А.md' }, { ...base, id: 'b', path: 'Книги/Б.md' }];
    assert.deepEqual(knowledge.filterExcerpts(entries, { query: 'подробность ЕЖ', theme: 'мышление', source: 'Книги/Б.md' }).map(entry => entry.id), ['b']);
    assert.equal(knowledge.filterExcerpts(entries, { query: 'порядок автор' }).length, 2);
    assert.equal(knowledge.filterExcerpts(entries, { query: 'несуществующее' }).length, 0);
});

test('stable pagination covers a large collection once and clamps the last page after removal', () => {
    const entries = Array.from({ length: 1001 }, (_, n) => ({ id: `id-${n}`, path: `Книги/${String(n).padStart(4, '0')}.md`, title: 'Название', line: n, savedDate: n === 4 ? '2026-10-05' : '' }));
    const original = JSON.stringify(entries), sorted = knowledge.sortExcerpts([...entries].reverse());
    assert.equal(sorted[0].id, 'id-4');
    assert.deepEqual(sorted, knowledge.sortExcerpts(entries));
    const visited = [];
    for (let page = 1; page <= 51; page++) {
        const result = knowledge.excerptPage(sorted, page);
        assert.ok(result.entries.length <= 20); visited.push(...result.entries.map(entry => entry.id));
    }
    assert.equal(visited.length, entries.length); assert.equal(new Set(visited).size, entries.length);
    assert.deepEqual(knowledge.excerptPage([], 500), { page: 1, pages: 1, start: 0, end: 0, entries: [] });
    assert.equal(knowledge.excerptPage(sorted.slice(0, 980), 51).page, 49);
    assert.equal(knowledge.excerptPage(sorted, -1).page, 1);
    assert.equal(JSON.stringify(entries), original);
});

test('quote sections and provenance round-trip separately from themes and ignore opaque metadata', () => {
    const input = { id: 'book-excerpt-structured', text: 'Цитата', section: 'Мышление / Память', themes: ['сон'], conclusion: 'Мой вывод\nВторая строка', sourceTitle: 'Произведение', sourceAuthors: ['Фамилия, Имя', 'Другой автор'] };
    const raw = knowledge.renderExcerpt(input) + '';
    const [entry] = knowledge.parseExcerpts(raw.replace('> **Место в источнике:**', '> **Своё поле:** сохранить\n> **Место в источнике:**'));
    assert.equal(entry.section, 'Мышление/Память'); assert.deepEqual(entry.themes, ['сон']);
    assert.equal(entry.conclusion, input.conclusion); assert.equal(entry.sourceTitle, 'Произведение');
    assert.deepEqual(entry.sourceAuthors, input.sourceAuthors);
    const [legacy] = knowledge.parseExcerpts(knowledge.renderExcerpt({ id: 'book-excerpt-no-section', text: 'Старый текст' }));
    assert.equal(legacy.section, undefined); assert.equal(legacy.sourceAuthors, undefined);
    const [cleared] = knowledge.parseExcerpts(knowledge.renderExcerpt({ text: 'Текст', section: '', sourceAuthors: [] }));
    assert.equal(cleared.section, ''); assert.deepEqual(cleared.sourceAuthors, []);
});

test('tree counts explicit sections once, preserves hierarchy and keeps identically titled books separate', () => {
    const base = { title: 'Одинаковая книга', authors: ['Автор'], themes: ['Нельзя создавать раздел'], text: 'Цитата', collection: false };
    const entries = [{ ...base, id: 'a', path: 'Книги/А.md', section: 'Мышление/Память' }, { ...base, id: 'b', path: 'Книги/Б.md', section: 'мышление/Внимание' }, { ...base, id: 'c', path: 'Книги/В.md', section: '' }];
    const tree = knowledge.buildQuoteTree(entries);
    assert.equal(tree[0].label, 'Мышление'); assert.equal(tree[0].count, 2); assert.equal(tree[0].children.length, 2);
    assert.equal(tree[1].label, 'Неразобранное'); assert.equal(tree[1].count, 1);
    assert.equal(knowledge.buildQuoteTree(entries, 'sources').length, 3);
    assert.deepEqual(entries.filter(entry => knowledge.quoteInNode(entry, 'section:мышление')).map(entry => entry.id), ['a', 'b']);
    const unknown = { ...base, collection: true, authors: [], title: 'Название подборки', path: 'Книги/Цитаты/Заметка.md' };
    assert.equal(knowledge.quoteSource(unknown).key, 'source:unknown'); assert.equal(knowledge.quoteSource(unknown).title, '');
    const attributed = { ...unknown, sourceTitle: 'Внешнее произведение', sourceAuthors: ['Писатель'] };
    assert.equal(knowledge.quoteSource(attributed).title, 'Внешнее произведение');
    assert.deepEqual(knowledge.quoteSource({ ...unknown, authors: ['Унаследованный автор'], sourceAuthors: [] }).authors, []);
});

test('cache reuses unchanged content and invalidates modification, rename and deletion', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md' }]);
    const service = await knowledge.getService(h);
    await Promise.all([service.snapshot(), service.snapshot()]);
    await service.snapshot();
    assert.equal(h.reads.get(h.books[0].path), 1);
    h.books[0].text += '\n' + knowledge.renderExcerpt({ text: 'Идея', type: 'idea', id: 'book-excerpt-cache' });
    h.emit('modify', h.books[0]);
    assert.equal(service.excerpts(await service.snapshot()).length, 1);
    assert.equal(h.reads.get(h.books[0].path), 2);
    const oldPath = h.books[0].path;
    h.files.delete(oldPath);
    h.books[0].path = 'Книги/Художественные/Новое имя.md';
    h.files.set(h.books[0].path, h.books[0]);
    h.emit('rename', h.books[0], oldPath);
    assert.equal(service.excerpts(await service.snapshot())[0].path, h.books[0].path);
    h.files.delete(h.books[0].path);
    h.emit('delete', h.books[0]);
    assert.equal((await service.snapshot()).length, 0);
});

test('new excerpt metadata does not reuse an older live parser cache', async () => {
    const raw = managedHistory + '\n\n' + knowledge.renderExcerpt({ text: 'Новая идея', type: 'idea', id: 'book-excerpt-new-format', savedDate: '2026-10-04' });
    const h = harness([{ path: 'Книги/Художественные/Книга.md', text: raw }]);
    h.app.__bookKnowledgeV3 = { cache: new Map([[h.books[0].path, { mtime: 1, text: raw, excerpts: [{ id: 'book-excerpt-new-format', type: 'idea', text: 'Новая идея' }], history: [] }]]) };
    const service = await knowledge.getService(h), records = await service.snapshot();
    assert.equal(records[0].excerpts[0].savedDate, '2026-10-04');
    assert.equal(dashboard.buildDashboard(records, { year: '2026' }).quotes, 1);
    assert.equal(records[0].excerpts[0].type, 'quote');
    assert.equal(h.reads.get(h.books[0].path), 1);
});

test('full text search covers book notes and excludes other vault and system cards', async () => {
    const h = harness([
        { path: 'Книги/Художественные/Первая.md', text: 'Конспект о редкой идее\n\n' + managedHistory },
        { path: 'Другое/Личная.md', text: 'Редкая идея' },
        { path: 'Книги/_system/Личная.md', text: 'Редкая идея' }
    ]);
    const service = await knowledge.getService(h);
    const results = service.search(await service.snapshot(), 'редкой идее');
    assert.equal(results.length, 1);
    assert.equal(results[0].file.path, h.books[0].path);
    assert.match(results[0].snippet, /Конспект/);
    assert.equal(h.reads.has('Другое/Личная.md'), false);
});

test('damaged history remains visible as an error without hiding valid excerpts or using read_count', async () => {
    const h = harness([{ path: 'Книги/Художественные/Ошибка.md', text: '<!-- BOOK-READINGS:START -->\n' + knowledge.renderExcerpt({ text: 'Мысль', type: 'idea', id: 'book-excerpt-valid' }), fm: { read_count: 12 } }]);
    const service = await knowledge.getService(h), records = await service.snapshot();
    assert.equal(service.excerpts(records).length, 1);
    assert.ok(records[0].historyError);
    const result = dashboard.buildDashboard(records);
    assert.equal(result.invalidHistory, 1);
    assert.equal(result.readings, 0);
    assert.equal(result.fictionReadings, 0);
    assert.equal(result.nonfictionReadings, 0);
    assert.deepEqual(result.fictionTypes, []);
    assert.deepEqual(result.nonfictionTypes, []);
    assert.equal(result.quotes, 1);
});

test('reading totals count rereadings and preserve month/year precision without fabricated dates', () => {
    const records = [
        { file: { path: 'Книги/Художественные/А.md', basename: 'А' }, fm: { title: 'А', authors: ['Автор'] }, excerpts: [{ type: 'idea' }], history: [{ number: 1, date: '2024-10', rating: 10 }, { number: 2, date: '2026-10-03', rating: 8 }] },
        { file: { path: 'Книги/Non-fiction/Б.md', basename: 'Б' }, fm: { title: 'Б', authors: ['Другой автор'], work_type: 'lecture', rating: 10 }, excerpts: [{ type: 'quote' }], history: [{ number: 1, date: '2023', rating: null }] }
    ];
    const result = dashboard.buildDashboard(records, { now: new Date(2026, 9, 4) });
    assert.equal(result.readings, 3);
    assert.equal(result.reread, 1);
    assert.equal(result.currentMonth, 1);
    assert.equal(result.imprecise, 2);
    assert.equal(result.earlierThisMonth[0].date, '2024-10');
    assert.deepEqual(result.favoriteBooks.map(row => row.title), ['А']);
    assert.equal(result.favoriteBooks[0].rating, 8);
    assert.equal(result.authorRows.find(row => row.name === 'Другой автор').average, null);
    assert.deepEqual(result.types.map(row => [row.type, row.count]), [['book', 2], ['lecture', 1]]);
    assert.equal(result.fictionReadings, 2);
    assert.equal(result.nonfictionReadings, 1);
    assert.deepEqual(result.fictionTypes, [{ type: 'book', label: 'Книги', count: 2 }]);
    assert.deepEqual(result.nonfictionTypes, [{ type: 'lecture', label: 'Лекции', count: 1 }]);
    assert.equal(records[0].history[0].date, '2024-10');
});

test('genre and type breakdowns use selected history entries, preserve precision and omit every empty type', () => {
    let serial = 0;
    function record(folder, type, dates, extra = {}) {
        const title = `Источник ${++serial}`;
        return { file: { path: `Книги/${folder}/${title}.md`, basename: title },
            fm: { title, authors: ['Автор'], read_count: 999, ...(type === undefined ? {} : { work_type: type }) },
            history: dates.map((date, index) => ({ number: index + 1, date, rating: null })), excerpts: [], ...extra };
    }
    // Deliberately unordered types expose sorting by collection order instead of TYPE_LABELS.
    const records = [
        record('Художественные', 'unknown', ['2026-10']),
        record('Художественные', 'article', ['2026-04-02']),
        record('Художественные', 'story', ['2026-10-03', '2026-10-04']),
        record('Художественные', 'lecture', ['2026']),
        record('Художественные', undefined, ['2025-10', '2026-10-02']),
        record('Non-fiction', 'unknown', ['2026-10-06']),
        record('Non-fiction', 'article', ['2026-09']),
        record('Non-fiction', undefined, ['2026']),
        record('Non-fiction', 'lecture', ['2025', '2026-10-05']),
        // Keep the existing years classification: every non-fiction-folder reading is nonfiction.
        record('Другая папка', 'article', ['2026-10-07']),
        record('Художественные', 'book', [], { excerpts: [{ savedDate: '2026-10-08' }] }),
        record('Цитаты', 'article', ['2026-10-09'], { collection: true, excerpts: [{ savedDate: '2026-10-09' }] }),
        record('Художественные', 'book', [], { historyError: 'Повреждена история', excerpts: [{ savedDate: '2026-10-10' }] })
    ];
    const before = JSON.stringify(records), now = new Date(2026, 9, 12);
    const tuples = rows => rows.map(({ type, label, count }) => [type, label, count]);
    const periods = [
        [{}, 7, 6, 6,
            [['book', 'Книги', 2], ['story', 'Рассказы', 2], ['lecture', 'Лекции', 1], ['article', 'Статьи', 1], ['other', 'Другие', 1]],
            [['book', 'Книги', 1], ['lecture', 'Лекции', 2], ['article', 'Статьи', 2], ['other', 'Другие', 1]]],
        [{ year: '2026' }, 6, 5, 4,
            [['book', 'Книги', 1], ['story', 'Рассказы', 2], ['lecture', 'Лекции', 1], ['article', 'Статьи', 1], ['other', 'Другие', 1]],
            [['book', 'Книги', 1], ['lecture', 'Лекции', 1], ['article', 'Статьи', 2], ['other', 'Другие', 1]]],
        [{ year: '2026', month: '10' }, 4, 3, 1,
            [['book', 'Книги', 1], ['story', 'Рассказы', 2], ['other', 'Другие', 1]],
            [['lecture', 'Лекции', 1], ['article', 'Статьи', 1], ['other', 'Другие', 1]]]
    ];
    for (const [period, fiction, nonfiction, imprecise, fictionTypes, nonfictionTypes] of periods) {
        const model = dashboard.buildDashboard(records, { now, ...period });
        assert.equal(model.fictionReadings, fiction);
        assert.equal(model.nonfictionReadings, nonfiction);
        assert.equal(model.readings, fiction + nonfiction);
        assert.equal(model.imprecise, imprecise);
        assert.equal(model.reread, 3);
        assert.equal(model.quotes, 3);
        assert.equal(model.invalidHistory, 1);
        assert.deepEqual(tuples(model.fictionTypes), fictionTypes);
        assert.deepEqual(tuples(model.nonfictionTypes), nonfictionTypes);
        assert.equal(model.fictionTypes.reduce((sum, row) => sum + row.count, 0), fiction);
        assert.equal(model.nonfictionTypes.reduce((sum, row) => sum + row.count, 0), nonfiction);
    }
    const empty = dashboard.buildDashboard(records, { now, year: '2030', month: '01' });
    assert.equal(empty.readings, 0);
    assert.equal(empty.fictionReadings, 0);
    assert.equal(empty.nonfictionReadings, 0);
    assert.deepEqual(empty.fictionTypes, []);
    assert.deepEqual(empty.nonfictionTypes, []);
    const onlyFiction = dashboard.buildDashboard(records.filter(row => row.file.path.startsWith('Книги/Художественные/')), { now, year: '2026' });
    assert.equal(onlyFiction.nonfictionReadings, 0); assert.deepEqual(onlyFiction.nonfictionTypes, []);
    const onlyNonfiction = dashboard.buildDashboard(records.filter(row => row.file.path.startsWith('Книги/Non-fiction/')), { now, year: '2026' });
    assert.equal(onlyNonfiction.fictionReadings, 0); assert.deepEqual(onlyNonfiction.fictionTypes, []);
    assert.equal(JSON.stringify(records), before);
});

test('year summaries use selected history ratings and dated excerpts without YAML counts or fabricated legacy years', () => {
    const records = [
        { file: { path: 'Книги/Художественные/А.md', basename: 'А' }, fm: { title: 'А', authors: ['Автор А'], rating: 10, read_count: 999, work_type: 'story' }, history: [
            { number: 1, date: '2024-10', rating: 10 }, { number: 2, date: '2025-10', rating: 4 }, { number: 3, date: '2025-11-02', rating: null }
        ], excerpts: [{ type: 'quote', savedDate: '2025-03-02' }, { type: 'idea', savedDate: '' }] },
        { file: { path: 'Книги/Non-fiction/Б.md', basename: 'Б' }, fm: { title: 'Б', authors: ['Автор Б'], work_type: 'lecture', rating: 9 }, history: [{ number: 1, date: '2025', rating: 9 }], excerpts: [{ type: 'quote', savedDate: '2024-05-01' }] },
        { file: { path: 'Книги/Художественные/В.md', basename: 'В' }, fm: { title: 'В', authors: ['Автор В'], rating: 9 }, history: [{ number: 1, date: '2020-01-01', rating: 9 }], excerpts: [{ type: 'idea', savedDate: '2025-10-04' }] },
        { file: { path: 'Книги/Художественные/Г.md', basename: 'Г' }, fm: { title: 'Г', authors: ['Автор Г'] }, history: [], excerpts: [{ type: 'quote', savedDate: '2027-01-01' }] }
    ];
    const original = JSON.stringify(records), now = new Date(2026, 9, 4);
    const result = dashboard.buildDashboard(records, { now, year: '2025' });
    assert.equal(result.books, 3);
    assert.equal(result.authors, 3);
    assert.equal(result.readings, 3);
    assert.equal(result.reread, 1);
    assert.equal(result.ideas, 0);
    assert.equal(result.quotes, 2);
    assert.equal(result.undatedExcerpts, 1);
    assert.deepEqual(result.types.map(row => [row.type, row.count]), [['story', 2], ['lecture', 1]]);
    assert.deepEqual(result.favoriteBooks, []);
    assert.equal(result.authorRows.find(row => row.name === 'Автор А').average, 4);
    assert.equal(result.authorRows.find(row => row.name === 'Автор В').readings, 0);
    assert.equal(result.authorRows.find(row => row.name === 'Автор В').average, null);
    assert.ok(result.earlierThisMonth.some(entry => entry.date === '2024-10'));
    assert.deepEqual(dashboard.availableYears(records), ['2027', '2025', '2024', '2020']);
    const previous = dashboard.buildDashboard(records, { now, year: 2024 });
    assert.equal(previous.favoriteBooks[0].rating, 10);
    const excerptsOnly = dashboard.buildDashboard(records, { now, year: '2027' });
    assert.equal(excerptsOnly.books, 1);
    assert.equal(excerptsOnly.readings, 0);
    assert.equal(excerptsOnly.quotes, 1);
    assert.deepEqual(excerptsOnly.types, []);
    assert.equal(JSON.stringify(records), original);
});

test('QuickAdd opens the shared creation form without writing and saves only on submit', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md' }]);
    const api = { date: { now: () => '2026-10-04' },
        suggester: async () => { throw Error('Unexpected source menu'); },
        requestInputs: async () => { throw Error('The native creation form owns the inputs'); } };
    const first = await addExcerpt({ ...h, quickAddApi: api });
    assert.equal(first.initial.sourceKind, 'book');
    assert.equal(first.initial.bookPath, h.books[0].path);
    assert.equal(h.changes.length, 0);
    await first.save({ ...first.initial, text: 'Новая цитата' });
    const second = await addExcerpt({ ...h, quickAddApi: api });
    await second.save({ ...second.initial, text: 'Ещё цитата' });
    assert.equal(h.changes.length, 2);
    assert.ok(h.changes[0].next.startsWith(managedHistory));
    const quotes = knowledge.parseExcerpts(h.books[0].text);
    assert.equal(quotes.length, 2);
    assert.equal(new Set(quotes.map(quote => quote.id)).size, 2);
    assert.ok(quotes.every(quote => quote.savedDate === '2026-10-04'));
    assert.match(h.opened[0][0], /#\^book-excerpt-/);
    await addExcerpt({ ...h, quickAddApi: api }); // Closing without submit performs no write.
    assert.equal(h.changes.length, 2);
});

test('book action preselects its source and partial selection; concurrent notes stay intact', async () => {
    const raw = 'До\n\nСтарый абзац\n\nПосле\n\n' + managedHistory;
    const h = harness([{ path: 'Книги/Художественные/Книга.md', text: raw }]);
    h.app.workspace.activeEditor = { file: h.books[0], editor: { getSelection: () => 'тарый абза' } };
    const form = await addExcerpt(h);
    assert.equal(form.initial.text, 'тарый абза');
    assert.equal(form.initial.sourceKind, 'book');
    assert.equal(h.changes.length, 0);
    h.books[0].text += '\nКонкурирующая правка';
    await form.save({ ...form.initial, section: 'Мотивация/в' });
    assert.ok(h.books[0].text.startsWith(raw + '\nКонкурирующая правка'));
    assert.equal(knowledge.parseExcerpts(h.books[0].text)[0].text, 'тарый абза');
    assert.ok(h.files.get('Книги/Цитаты/Мотивация/в').children);
});

test('book action without selection opens a fresh blank quote form', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md' }]);
    const first = await addExcerpt(h);
    assert.equal(first.initial.text, '');
    await first.save({ ...first.initial, text: 'Цитата без выделения' });
    const second = await addExcerpt(h);
    assert.equal(second.initial.text, '');
    assert.equal(knowledge.parseExcerpts(h.books[0].text).length, 1);
});

test('creation works without books and indexes an arbitrary source in its physical section folder', async () => {
    const h = harness([]);
    const form = await addExcerpt(h);
    assert.equal(form.initial.sourceKind, 'free');
    assert.equal(form.books.length, 0);
    assert.equal(h.changes.length, 0);
    await form.save({ ...form.initial, text: 'Произвольная цитата', section: 'Мотивация/в', sourceAuthors: ['Автор'], sourceTitle: 'Беседа', conclusion: 'Мой вывод' });
    const service = await knowledge.getService(h);
    const entries = service.excerpts(await service.snapshot({ includeCollections: true }));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].section, 'Мотивация/в');
    assert.equal(entries[0].conclusion, 'Мой вывод');
    assert.deepEqual(knowledge.quoteSource(entries[0]).authors, ['Автор']);
    assert.equal(knowledge.quoteSource(entries[0]).title, 'Беседа');
    assert.equal(entries[0].path, 'Книги/Цитаты/Мотивация/в/_Выписки.md');
});

test('search command opens the selected book at the matching note line and cancellation is read-only', async () => {
    const h = harness([{ path: 'Книги/Non-fiction/Книга.md', text: 'Важная редкая мысль\n\n' + managedHistory }]);
    const api = {
        requestInputs: async fields => ({ [fields[0].id]: 'редкая мысль' }),
        suggester: async (labels, values) => values[0]
    };
    await searchLibrary({ ...h, quickAddApi: api });
    assert.equal(h.opened[0][0], h.books[0]);
    assert.equal(h.opened[0][1].eState.line, 0);
    assert.deepEqual(h.changes, []);
    await searchLibrary({ ...h, quickAddApi: { ...api, suggester: async () => undefined } });
    assert.equal(h.opened.length, 1);
});

test('all current library histories aggregate in memory without changing their original date values', () => {
    const root = path.join(__dirname, '../..');
    const files = [];
    function collect(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) collect(full);
            else if (entry.name.endsWith('.md') && entry.name !== '_index.md') files.push(full);
        }
    }
    collect(path.join(root, 'Художественные'));
    collect(path.join(root, 'Non-fiction'));
    const core = createCore({ app: {}, obsidian: {} });
    const { fromText } = require('./yaml_fixture.cjs');
    const records = files.map(full => {
        const raw = fs.readFileSync(full, 'utf8');
        return { file: { path: 'Книги/' + path.relative(root, full).split(path.sep).join('/'), basename: path.basename(full) }, fm: fromText(raw), history: core.parseHistory(raw).entries, excerpts: knowledge.parseExcerpts(raw) };
    });
    const originalDates = records.flatMap(record => record.history.map(entry => entry.date));
    const result = dashboard.buildDashboard(records, { now: new Date(2026, 9, 4) });
    assert.equal(result.readings, originalDates.length);
    assert.deepEqual(records.flatMap(record => record.history.map(entry => entry.date)), originalDates);
    assert.ok(originalDates.some(date => date.length === 7));
    assert.equal(result.invalidHistory, 0);
    assert.equal(result.fictionReadings + result.nonfictionReadings, result.readings);
    assert.equal(result.fictionTypes.reduce((sum, row) => sum + row.count, 0), result.fictionReadings);
    assert.equal(result.nonfictionTypes.reduce((sum, row) => sum + row.count, 0), result.nonfictionReadings);
});

test('standalone quote collections join the excerpt index without inflating library totals', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md' }]);
    h.file('Книги/Цитаты/Без источника.md', knowledge.renderExcerpt({ id: 'book-excerpt-standalone-test', text: 'Сохранённое высказывание', themes: ['мышление'] }), { note_type: 'excerpt_collection', title: 'Без источника', authors: [] });
    h.file('Книги/Цитаты/Не коллекция.md', knowledge.renderExcerpt({ id: 'book-excerpt-excluded-test', text: 'Не включать автоматически' }), { title: 'Другая заметка' });
    const service = await knowledge.getService(h);
    assert.equal((await service.snapshot()).length, 1);
    const records = await service.snapshot({ includeCollections: true });
    assert.equal(records.length, 2);
    const collection = records.find(record => record.collection);
    assert.equal(collection.historyError, '');
    assert.deepEqual(collection.history, []);
    assert.deepEqual(service.excerpts(records)[0].authors, []);
    const total = dashboard.buildDashboard(records);
    assert.equal(total.books, 1); assert.equal(total.authors, 1);
    assert.equal(total.readings, 1); assert.equal(total.quotes, 1); assert.equal(total.invalidHistory, 0);
    assert.equal(total.fictionReadings, 1); assert.equal(total.nonfictionReadings, 0);
    assert.deepEqual(total.fictionTypes, [{ type: 'book', label: 'Книги', count: 1 }]);
    assert.deepEqual(total.nonfictionTypes, []);
    assert.equal(dashboard.buildDashboard(records, { year: '2026' }).quotes, 0);
    assert.equal((await service.snapshot()).length, 1);
    const changed = h.files.get('Книги/Цитаты/Без источника.md');
    changed.text += '\n' + knowledge.renderExcerpt({ id: 'book-excerpt-standalone-next', text: 'Новая мысль', type: 'idea', savedDate: '2026-10-05' });
    changed.stat.mtime++; h.emit('modify', changed);
    const next = await service.snapshot({ includeCollections: true });
    assert.equal(service.excerpts(next).length, 2);
    assert.equal(dashboard.buildDashboard(next, { year: '2026' }).quotes, 1);
    assert.equal(dashboard.buildDashboard(next, { year: '2026' }).books, 0);
});

test('all 18 migrated quotes are searchable and retain unknown saving dates', async () => {
    const h = harness([]);
    const { fromText } = require('./yaml_fixture.cjs');
    const folder = path.join(__dirname, '../../Цитаты');
    for (const name of fs.readdirSync(folder)) {
        if (!name.endsWith('.md')) continue;
        const text = fs.readFileSync(path.join(folder, name), 'utf8');
        h.file('Книги/Цитаты/' + name, text, fromText(text));
    }
    const service = await knowledge.getService(h), records = await service.snapshot({ includeCollections: true });
    const excerpts = service.excerpts(records);
    assert.equal(excerpts.length, 18);
    assert.equal(new Set(excerpts.map(entry => entry.id)).size, 18);
    assert.ok(excerpts.every(entry => !entry.savedDate));
    assert.equal(knowledge.filterExcerpts(excerpts, { author: 'Сергей Стиллавин' }).length, 1);
    assert.equal(knowledge.filterExcerpts(excerpts, { theme: 'мотивация' }).length, 11);
    assert.equal(knowledge.filterExcerpts(excerpts, { query: 'мелкой моторики' }).length, 1);
    assert.equal(dashboard.buildDashboard(records).books, 0);
    assert.equal(dashboard.buildDashboard(records).quotes, 18);
});

test('both read-only renderers work in home and full modes with native DOM controls', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md', text: managedHistory + '\n\n' + knowledge.renderExcerpt({ text: 'Цитата для показа', id: 'book-excerpt-render', type: 'quote' }) }]);
    const document = { createElement: tag => new Node(tag) };
    class Node {
        constructor(tag) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.style = {}; this.attributes = {}; this.events = {}; this.ownText = ''; }
        set textContent(value) { this.ownText = String(value); this.children = []; }
        get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren(...children) { this.children = children; this.ownText = ''; }
        setAttribute(name, value) { this.attributes[name] = value; }
        addEventListener(name, callback) { this.events[name] = callback; }
    }
    function all(node) { return [node, ...node.children.flatMap(all)]; }
    for (const renderer of [knowledge, dashboard]) {
        for (const mode of ['home', 'index']) {
            const container = document.createElement('div'), cleanup = [];
            const dv = { container, component: { register: callback => cleanup.push(callback) } };
            const handle = await renderer({ ...h, dv, mode });
            assert.doesNotMatch(container.textContent, /Не удалось|Загружаю|Считаю/);
            if (renderer === knowledge) {
                assert.match(container.textContent, /Цитата для показа/);
                const source = all(container).find(node => node.className?.split(' ').includes('book-quote-work-link'));
                assert.equal(source.attributes['data-href'], 'Книги/Художественные/Книга#^book-excerpt-render');
                if (mode === 'index') {
                    assert.equal(all(container).filter(node => node.tagName === 'select').length, 0);
                    assert.ok(all(container).some(node => node.className === 'book-quotes-tree'));
                    assert.ok(all(container).some(node => node.className === 'book-quote-edit'));
                }
            } else {
                const selects = all(container).filter(node => node.tagName === 'select');
                assert.equal(selects.length, mode === 'home' ? 0 : 2);
                if (mode === 'home') {
                    assert.match(container.textContent, /Чтений в этом месяце/);
                    assert.match(container.textContent, /В этом месяце раньше/);
                    assert.doesNotMatch(container.textContent, /Прочитано за период|Сбросить месяц/);
                } else {
                    assert.match(container.textContent, /1Чтений за период/);
                    assert.deepEqual(selects[0].children.map(option => option.value), ['', String(new Date().getFullYear()), '2024']);
                    selects[0].value = '2024';
                    selects[0].events.change();
                    assert.match(container.textContent, /1Чтений за период/);
                    assert.equal(all(container).filter(node => node.className?.startsWith('book-dashboard-month ') || node.className === 'book-dashboard-month').length, 12);
                    selects[1].value = '04';
                    selects[1].events.change();
                    assert.match(container.textContent, /За этот период чтения ещё не записаны/);
                    const monthReset = all(container).find(node => node.className === 'book-dashboard-month-reset');
                    assert.equal(monthReset.textContent, 'апрель ×');
                    monthReset.events.click();
                    assert.equal(selects[1].value, '');
                    assert.match(container.textContent, /1Чтений за период/);
                    const october = all(container).find(node => node.attributes['aria-label'] === 'Октябрь: 1 чтений. Показать месяц');
                    october.events.click();
                    assert.equal(selects[1].value, '10');
                    const active = all(container).find(node => node.attributes['aria-pressed'] === 'true');
                    active.events.click();
                    assert.equal(selects[1].value, '');
                    selects[1].value = '10'; selects[1].events.change();
                    all(container).find(node => node.textContent === 'Сбросить месяц').events.click();
                    assert.equal(selects[1].value, '');
                    all(container).find(node => node.textContent === 'Этот месяц').events.click();
                    assert.equal(selects[0].value, String(new Date().getFullYear()));
                    assert.equal(selects[1].value, String(new Date().getMonth()+1).padStart(2, '0'));
                    const reset = all(container).find(node => node.tagName === 'button' && node.textContent === 'За всё время');
                    reset.events.click();
                    assert.equal(selects[0].value, ''); assert.equal(selects[1].value, '');
                    assert.equal(selects[1].disabled, true);
                    assert.match(container.textContent, /Выписок без даты сохранения: 1/);
                    assert.match(container.textContent, /Прочитано за период/);
                }
            }
            handle.dispose();
            for (const callback of cleanup) callback();
        }
    }
    assert.deepEqual(h.changes, []);
    assert.equal(h.reads.get(h.books[0].path), 1);
    h.books[0].text = managedHistory;
    h.books[0].stat.mtime++;
    h.emit('modify', h.books[0]);
    for (const mode of ['home', 'index']) {
        const container = document.createElement('div');
        const handle = await knowledge({ ...h, dv: { container, component: { register: () => {} } }, mode });
        assert.match(container.textContent, /Добавь первую цитату/);
        assert.ok(container.textContent.trim());
        handle.dispose();
    }
});
