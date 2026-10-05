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
    const books = cards.map(card => file(card.path, card.text ?? managedHistory, { title: 'Книга', authors: ['Автор'], read_count: 1, date: '2024-10', rating: 8, ...card.fm }));
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: entry.fm }) },
        vault: {
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            getAbstractFileByPath: filePath => files.get(filePath),
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
    const obsidian = { Notice: class { constructor(message) { notices.push(message); } } };
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
    assert.equal(entry.type, 'idea');
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

test('excerpt filters combine text, theme, author and type with Russian ё normalisation', () => {
    const entries = [{ id: '1', text: 'Ёж и познание', conclusion: 'Проверить идею', location: 'Глава 1', title: 'Книга', authors: ['Автор'], themes: ['Мышление'], type: 'idea' }, { id: '2', text: 'Другая цитата', conclusion: '', location: '', title: 'Книга', authors: ['Автор'], themes: [], type: 'quote' }];
    assert.deepEqual(knowledge.filterExcerpts(entries, { query: 'еж', author: 'Автор', theme: 'мышление', type: 'idea' }).map(entry => entry.id), ['1']);
    assert.equal(knowledge.filterExcerpts(entries, { query: 'проверить', type: 'quote' }).length, 0);
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
    h.app.__bookKnowledgeV1 = { cache: new Map([[h.books[0].path, { mtime: 1, text: raw, excerpts: [{ id: 'book-excerpt-new-format', type: 'idea', text: 'Новая идея' }], history: [] }]]) };
    const service = await knowledge.getService(h), records = await service.snapshot();
    assert.equal(records[0].excerpts[0].savedDate, '2026-10-04');
    assert.equal(dashboard.buildDashboard(records, { year: '2026' }).ideas, 1);
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
    assert.equal(result.ideas, 1);
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
    assert.equal(records[0].history[0].date, '2024-10');
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
    assert.equal(result.ideas, 1);
    assert.equal(result.quotes, 1);
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

test('QuickAdd saves atomically with fresh field ids and can cancel without any write', async () => {
    const h = harness([{ path: 'Книги/Художественные/Книга.md' }]);
    const ids = [];
    const api = {
        date: { now: () => '2026-10-04' },
        suggester: async (labels, values) => values[0],
        requestInputs: async fields => {
            ids.push(fields.map(field => field.id));
            return Object.fromEntries(fields.map(field => [field.id, field.id.endsWith('-text') ? 'Новая цитата' : '']));
        }
    };
    await addExcerpt({ ...h, quickAddApi: api });
    await addExcerpt({ ...h, quickAddApi: api });
    assert.equal(h.changes.length, 2);
    assert.ok(h.changes[0].next.startsWith(managedHistory));
    assert.equal(knowledge.parseExcerpts(h.books[0].text).length, 2);
    assert.ok(knowledge.parseExcerpts(h.books[0].text).every(entry => entry.savedDate === '2026-10-04'));
    assert.equal(new Set(ids.flat()).size, ids.flat().length);
    assert.match(h.opened[0][0], /#\^book-excerpt-/);
    await addExcerpt({ ...h, quickAddApi: { ...api, requestInputs: async () => undefined } });
    assert.equal(h.changes.length, 2);
});

test('format command uses the editor selection and refuses a concurrent source change', async () => {
    const raw = 'До\n\nСтарый абзац\n\nПосле\n\n' + managedHistory;
    const h = harness([{ path: 'Книги/Художественные/Книга.md', text: raw }]);
    const from = raw.indexOf('Старый абзац'), to = from + 'Старый абзац'.length;
    h.app.workspace.activeEditor = { file: h.books[0], editor: {
        getValue: () => raw, getSelection: () => 'Старый абзац',
        getCursor: side => side === 'from' ? from : to, posToOffset: value => value
    } };
    let concurrent = false;
    const api = {
        suggester: async (labels, values, prompt) => prompt === 'Как использовать выделение?' ? 'format' : 'quote',
        requestInputs: async fields => {
            if (concurrent) h.books[0].text += '\nКонкурирующая правка';
            return Object.fromEntries(fields.map(field => [field.id, field.defaultValue ?? '']));
        }
    };
    await addExcerpt({ ...h, quickAddApi: api });
    assert.equal(h.changes.length, 1);
    assert.equal(knowledge.parseExcerpts(h.books[0].text)[0].text, 'Старый абзац');
    assert.ok(h.books[0].text.endsWith('После\n\n' + managedHistory));
    h.books[0].text = raw;
    concurrent = true;
    await addExcerpt({ ...h, quickAddApi: api });
    assert.equal(h.changes.length, 1);
    assert.match(h.notices.at(-1), /изменился/);
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
    const records = files.map(full => {
        const raw = fs.readFileSync(full, 'utf8');
        return { file: { path: 'Книги/' + path.relative(root, full).split(path.sep).join('/'), basename: path.basename(full) }, fm: { title: path.basename(full), authors: ['Автор'] }, history: core.parseHistory(raw).entries, excerpts: knowledge.parseExcerpts(raw) };
    });
    const originalDates = records.flatMap(record => record.history.map(entry => entry.date));
    const result = dashboard.buildDashboard(records, { now: new Date(2026, 9, 4) });
    assert.equal(result.readings, originalDates.length);
    assert.deepEqual(records.flatMap(record => record.history.map(entry => entry.date)), originalDates);
    assert.ok(originalDates.some(date => date.length === 7));
    assert.equal(result.invalidHistory, 0);
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
    assert.equal(dashboard.buildDashboard(records, { year: '2026' }).quotes, 0);
    assert.equal((await service.snapshot()).length, 1);
    const changed = h.files.get('Книги/Цитаты/Без источника.md');
    changed.text += '\n' + knowledge.renderExcerpt({ id: 'book-excerpt-standalone-next', text: 'Новая мысль', type: 'idea', savedDate: '2026-10-05' });
    changed.stat.mtime++; h.emit('modify', changed);
    const next = await service.snapshot({ includeCollections: true });
    assert.equal(service.excerpts(next).length, 2);
    assert.equal(dashboard.buildDashboard(next, { year: '2026' }).ideas, 1);
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
                const source = all(container).find(node => node.tagName === 'a');
                assert.equal(source.attributes['data-href'], 'Книги/Художественные/Книга#^book-excerpt-render');
                if (mode === 'index') assert.equal(all(container).filter(node => node.tagName === 'select').length, 3);
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
        assert.match(container.textContent, /Добавь первую выписку/);
        assert.ok(container.textContent.trim());
        handle.dispose();
    }
});
