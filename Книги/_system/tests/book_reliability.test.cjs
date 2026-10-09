const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const createCore = require('../book_core.js');
const addBook = require('../QuickAdd/add_book.js');
const addReading = require('../QuickAdd/add_reading.js');
const editReading = require('../QuickAdd/edit_reading.js');
const safeFix = require('../QuickAdd/safe_fix_library.js');
const linkAdaptation = require('../QuickAdd/link_adaptation.js');
const { parseYaml, stringifyYaml, fromText } = require('./yaml_fixture.cjs');

const HISTORY_START = '<!-- BOOK-READINGS:START -->';
const HISTORY_END = '<!-- BOOK-READINGS:END -->';
const entry = ({ number = 1, date = '2023-07-16', rating = 6, comment = 'Первое впечатление', marker = true } = {}) =>
    `<!-- BOOK-READING:START number="${number}" date="${date}" rating="${rating ?? ''}" -->\n### Чтение ${number} - ${date}\n\n` +
    (rating === null ? '' : `**Оценка:** ${rating}/10\n\n`) +
    (marker ? '<!-- BOOK-READING:COMMENT -->\n' : '') + comment + '\n<!-- BOOK-READING:END -->';
const history = entries => `## История чтений\n\n${HISTORY_START}\n\n${entries.map(entry).join('\n\n')}\n\n${HISTORY_END}\n`;
const makeText = (fm, body = history([{}])) => '---\n' + stringifyYaml(fm) + '\n---\n\n## Заметки\nИсходная заметка\n\n' + body;

function harness() {
    const files = new Map(), cache = new Map(), queues = new Map(), mutations = [], notices = [], forms = [];
    const h = { files, cache, mutations, notices, forms, beforeProcess: null, request: null, suggest: null, active: null };
    function file(filePath, fm = {}, text = makeText(fm)) {
        const extension = filePath.split('.').at(-1), basename = filePath.split('/').at(-1).slice(0, -(extension.length + 1));
        const value = { path: filePath, extension, basename, parent: { path: filePath.slice(0, filePath.lastIndexOf('/')) }, text, fm, stat: { mtime: 1 } };
        files.set(filePath, value);
        cache.set(filePath, JSON.parse(JSON.stringify(fm)));
        return value;
    }
    h.file = file;
    file('Книги/_system/book_core.js', {}, fs.readFileSync(require.resolve('../book_core.js'), 'utf8'));
    const app = {
        metadataCache: {
            getFileCache: file => file && cache.has(file.path) ? { frontmatter: cache.get(file.path) } : null,
            getFirstLinkpathDest: target => files.get(target.replace(/\.md$/, '') + '.md') ?? [...files.values()].find(file => file.basename === target)
        },
        vault: {
            getMarkdownFiles: () => [...files.values()].filter(file => file.extension === 'md'),
            getAbstractFileByPath: filePath => files.get(filePath),
            read: async file => file.text,
            process: (file, callback) => {
                const pending = (queues.get(file.path) ?? Promise.resolve()).catch(() => {}).then(async () => {
                    if (h.beforeProcess) await h.beforeProcess(file);
                    const updated = callback(file.text);
                    if (updated !== file.text) { mutations.push(file.path); file.text = updated; file.fm = fromText(updated); file.stat.mtime++; }
                    return updated;
                });
                queues.set(file.path, pending);
                return pending;
            },
            modify: async () => { throw new Error('Expected atomic Vault.process, not modify'); },
            create: async (filePath, text) => {
                if (files.has(filePath)) throw new Error('File exists');
                mutations.push(filePath);
                return file(filePath, fromText(text), text);
            },
            createFolder: async filePath => { mutations.push(filePath); files.set(filePath, { path: filePath, children: [] }); }
        },
        fileManager: { renameFile: async (file, filePath) => {
            if (files.has(filePath)) throw new Error('File exists');
            mutations.push(file.path + ' -> ' + filePath);
            files.delete(file.path); cache.delete(file.path);
            file.path = filePath; file.basename = filePath.split('/').at(-1).replace(/\.md$/, '');
            file.parent = { path: filePath.slice(0, filePath.lastIndexOf('/')) };
            files.set(filePath, file); cache.set(filePath, { ...file.fm });
        } },
        workspace: { getActiveFile: () => h.active, getLeaf: () => ({ openFile: async () => {} }) }
    };
    const obsidian = { parseYaml, stringifyYaml, normalizePath: value => value, Notice: class { constructor(message) { notices.push(message); } } };
    const quickAddApi = {
        date: { now: () => '2026-10-04' },
        requestInputs: async fields => {
            forms.push(fields);
            if (h.request) return h.request(fields, forms.length);
            return Object.fromEntries(fields.map(field => [field.id, field.defaultValue ?? '']));
        },
        suggester: async (labels, values, prompt) => h.suggest ? h.suggest(labels, values, prompt) : values[0]
    };
    h.params = { app, obsidian, quickAddApi };
    quickAddApi.executeChoice = async (name, variables) => { assert.equal(name, 'Книги - Добавить чтение'); await addReading({ app, obsidian, quickAddApi, variables }); };
    h.core = createCore({ app, obsidian });
    h.book = (filePath = 'Книги/Художественные/Тест.md', fm = {}, body) => {
        const metadata = { title: 'Тест', authors: ['Автор'], read_count: 1, date: '2023-07-16', rating: 6, ...fm };
        const value = file(filePath, metadata, makeText(metadata, body));
        h.active ??= value;
        return value;
    };
    return h;
}
const answer = (fields, values) => Object.fromEntries(fields.map(field => [field.id, values[field.id.split('__')[0]] ?? field.defaultValue ?? '']));

test('book predicate includes archive/root cards and excludes support notes', () => {
    const h = harness();
    for (const filePath of ['Книги/Тест.md', 'Книги/Архив/Тест.md']) assert.equal(h.core.isBook(h.book(filePath)), true);
    for (const filePath of ['Книги/_system/Тест.md', 'Книги/Цитаты/Тест.md', 'Книги/Конспекты/Тест.md', 'Другое/Тест.md']) assert.equal(h.core.isBook(h.book(filePath)), false);
    assert.equal(h.core.isBook(h.book('Книги/Идея.md', { note_type: 'idea' })), false);
    assert.equal(h.core.isCandidateBook(h.file('Книги/Цитата.md')), false);
    assert.equal(h.core.isCandidateBook(h.file('Книги/Non-fiction/Повреждённая.md')), true);
    assert.deepEqual(h.core.getFrontmatter(null), {});
});

for (const [name, damage] of [
    ['missing container', text => text.replace(HISTORY_END, '')],
    ['duplicate container', text => text + HISTORY_START],
    ['reversed container', text => text.replace(HISTORY_START, 'TEMP').replace(HISTORY_END, HISTORY_START).replace('TEMP', HISTORY_END)],
    ['incomplete reading', text => text.replace('<!-- BOOK-READING:END -->', '')],
    ['duplicate number', text => text.replace(HISTORY_END, entry({}) + '\n' + HISTORY_END)],
    ['invalid date', text => text.replace('date="2023-07-16"', 'date="2026-02-30"')],
    ['invalid rating', text => text.replace('rating="6"', 'rating="11"')]
]) {
    test(`damaged history fails before saving: ${name}`, async () => {
        const h = harness(), book = h.book();
        book.text = damage(book.text);
        const before = book.text;
        await assert.rejects(h.core.appendReading(book, { date: '2026', rating: null, comment: 'Новое' }), { code: 'BOOK_HISTORY_INVALID' });
        assert.equal(book.text, before);
        assert.deepEqual(h.mutations, []);
    });
}

test('append retains synced notes, YAML comments, manual history text and unmarked comments', async () => {
    const h = harness(), book = h.book(undefined, {}, history([{ marker: false, comment: 'Ручная цитата\n[[Связь]]' }]));
    book.text = book.text.replace('## Заметки', '# YAML stays in place\n\n## Заметки').replace('authors:', '# author comment\nauthors:').replace('rating: 6', 'rating: 6 # personal scale').replace(HISTORY_END, 'Ручной текст между чтениями\n\n' + HISTORY_END);
    h.beforeProcess = file => {
        if (file === book) { file.text = file.text.replace('Исходная заметка', 'Правка синхронизации').replace('title: "Тест"', 'title: "Изменённый заголовок"'); h.beforeProcess = null; }
    };
    await h.core.appendReading(book, { date: '2026-10', rating: 8, comment: 'Новое чтение' });
    assert.match(book.text, /Правка синхронизации/);
    assert.match(book.text, /Изменённый заголовок/);
    assert.match(book.text, /# author comment/);
    assert.match(book.text, /rating: 8 # personal scale/);
    assert.match(book.text, /Ручная цитата\n\[\[Связь\]\]/);
    assert.match(book.text, /Ручной текст между чтениями/);
    assert.equal(book.fm.read_count, 2);
    assert.deepEqual(h.mutations, [book.path]);
});

test('parallel appends use current history and unique sequential numbers', async () => {
    const h = harness(), book = h.book(), otherCore = createCore(h.params);
    await Promise.all([h.core.appendReading(book, { date: '2025', rating: null, comment: 'Второе' }), otherCore.appendReading(book, { date: '2026', rating: 9, comment: 'Третье' })]);
    assert.deepEqual(h.core.parseHistory(book.text).entries.map(item => item.number), [1, 2, 3]);
    assert.equal(book.fm.read_count, 3);
    assert.match(book.text, /Второе/); assert.match(book.text, /Третье/);
});

test('a missing YAML delimiter refuses the atomic save without rewriting the document', async () => {
    const h = harness(), book = h.book();
    book.text = book.text.replace('\n---\n', '\nBROKEN DELIMITER\n');
    const before = book.text;
    await assert.rejects(h.core.appendReading(book, { date: '2026', rating: null, comment: '' }), /YAML карточки повреждён/);
    assert.equal(book.text, before); assert.deepEqual(h.mutations, []);
});

test('current book properties are checked inside the save despite a valid old cache', async () => {
    const h = harness(), book = h.book();
    book.text = book.text.replace('authors: ["Автор"]', 'authors: []');
    const before = book.text;
    await assert.rejects(h.core.appendReading(book, { date: '2026', rating: null, comment: '' }), /title или authors/);
    assert.equal(book.text, before); assert.deepEqual(h.mutations, []);
});

test('edit changes only the selected reading and retains manual prefixes', async () => {
    const h = harness(), book = h.book(undefined, {}, history([{}, { number: 2, date: '2024', comment: 'Второе' }]));
    book.text = book.text.replace('<!-- BOOK-READING:COMMENT -->', 'Ручной префикс\n<!-- BOOK-READING:COMMENT -->');
    const original = h.core.parseHistory(book.text).entries[0], other = h.core.parseHistory(book.text).entries[1].raw;
    h.beforeProcess = file => { if (file === book) { file.text = file.text.replace('Исходная заметка', 'Новая заметка'); h.beforeProcess = null; } };
    await h.core.editReading(book, original, { date: '2025', rating: 7, comment: 'Новая мысль\nВторая строка' });
    assert.match(book.text, /Ручной префикс/); assert.match(book.text, /Новая заметка/);
    assert.ok(book.text.includes(other));
    assert.equal(book.fm.date, '2025'); assert.equal(book.fm.rating, 7);
});

test('editing a concurrently changed reading refuses the write', async () => {
    const h = harness(), book = h.book(), original = h.core.parseHistory(book.text).entries[0];
    book.text = book.text.replace('Первое впечатление', 'Изменение с телефона');
    const before = book.text;
    await assert.rejects(h.core.editReading(book, original, { date: '2026', rating: 8, comment: 'Мой ввод' }), error => error.code === 'BOOK_READING_CONFLICT' && error.currentEntry.comment === 'Изменение с телефона');
    assert.equal(book.text, before); assert.deepEqual(h.mutations, []);
});

test('invalid date retry keeps fields and uses fresh QuickAdd variable IDs', async () => {
    const h = harness(), book = h.book();
    h.request = (fields, attempt) => {
        if (attempt === 1) return answer(fields, { date: '2026-02-30', rating: '9', comment: 'Не терять' });
        assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Не терять');
        assert.equal(fields.find(field => field.id.startsWith('rating__')).defaultValue, '9');
        return answer(fields, { date: '2026-02-28' });
    };
    await addReading(h.params);
    assert.equal(h.forms.length, 2);
    assert.ok(h.forms[0].every(field => !h.forms[1].some(other => other.id === field.id)));
    assert.match(book.text, /Не терять/); assert.equal(book.fm.date, '2026-02-28');
});

test('edit conflict reopens with entered fields and a fresh form', async () => {
    const h = harness(), book = h.book();
    h.request = (fields, attempt) => {
        if (attempt === 1) { book.text = book.text.replace('Первое впечатление', 'С телефона'); return answer(fields, { date: '2026-10-04', rating: '8', comment: 'Мой ввод' }); }
        assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Мой ввод');
        return answer(fields, {});
    };
    h.suggest = (labels, values, prompt) => prompt.startsWith('Чтение изменилось') ? 'retry' : values[0];
    await editReading(h.params);
    assert.equal(h.forms.length, 2);
    assert.match(book.text, /Мой ввод/); assert.equal(book.fm.rating, 8);
    assert.ok(h.forms[0].every(field => !h.forms[1].some(other => other.id === field.id)));
});

test('a deleted selected reading reopens the retained draft before explicit restoration', async () => {
    const h = harness(), book = h.book(), original = h.core.parseHistory(book.text).entries[0];
    h.request = (fields, attempt) => {
        if (attempt === 1) { book.text = book.text.replace(original.raw, ''); return answer(fields, { date: '2026-10-04', rating: '8', comment: 'Сохранить этот ввод' }); }
        assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Сохранить этот ввод');
        assert.equal(fields.find(field => field.id.startsWith('date__')).label, 'Дата нового чтения');
        return answer(fields, {});
    };
    h.suggest = (labels, values, prompt) => prompt.startsWith('Выбранное чтение удалено') ? 'restore' : values[0];
    await editReading(h.params);
    assert.equal(h.forms.length, 2);
    assert.equal(book.fm.read_count, 1); assert.match(book.text, /Сохранить этот ввод/);
    assert.ok(h.notices.some(message => message.includes('Ввод сохранён новым чтением')));
});

test('failed add save keeps its draft, refuses damage and retries after repair', async () => {
    const h = harness(), book = h.book();
    let repaired = false;
    h.request = (fields, attempt) => {
        if (attempt === 1) { book.text = book.text.replace(HISTORY_END, 'DAMAGED'); return answer(fields, { comment: 'Черновик после ошибки' }); }
        assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Черновик после ошибки');
        return answer(fields, {});
    };
    h.suggest = (labels, values, prompt) => {
        if (prompt.includes('История чтений повреждена')) { assert.deepEqual(h.mutations, []); book.text = book.text.replace('DAMAGED', HISTORY_END); repaired = true; return 'retry'; }
        return values[0];
    };
    await addReading(h.params);
    assert.equal(repaired, true); assert.equal(h.forms.length, 2);
    assert.match(book.text, /Черновик после ошибки/); assert.equal(book.fm.read_count, 2);
});

test('failed edit save reopens retained fields after a transient storage failure', async () => {
    const h = harness(), book = h.book();
    h.beforeProcess = file => { if (file === book) { h.beforeProcess = null; throw new Error('Storage unavailable'); } };
    h.request = (fields, attempt) => {
        if (attempt > 1) assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Черновик правки');
        return answer(fields, attempt === 1 ? { comment: 'Черновик правки', date: '2026-10-04' } : {});
    };
    h.suggest = (labels, values, prompt) => prompt.includes('Storage unavailable') ? 'retry' : values[0];
    await editReading(h.params);
    assert.equal(h.forms.length, 2); assert.match(book.text, /Черновик правки/);
});

const newBookValues = { section: 'Художественные', workType: 'Книга', authors: 'Автор', title: 'Новая', date: '2026-10-04', rating: '8', comment: 'Новый комментарий', series: '', seriesIndex: '' };

test('canonical series names receive their actual next number', async () => {
    const h = harness();
    h.book('Книги/Архив/Старая.md', { series: 'Тёмная серия', series_index: 4 });
    h.request = fields => answer(fields, { ...newBookValues, series: 'Темная серия' });
    await addBook(h.params);
    const created = h.files.get('Книги/Художественные/Автор. Новая.md');
    assert.equal(created.fm.series, 'Тёмная серия'); assert.equal(created.fm.series_index, 5);
});

test('series collision returns to a fresh form without losing entered values', async () => {
    const h = harness();
    h.book('Книги/Архив/Старая.md', { series: 'Серия', series_index: 1 });
    h.request = (fields, attempt) => {
        if (attempt === 1) return answer(fields, { ...newBookValues, series: 'Серия', seriesIndex: '1', comment: 'Сохрани впечатление' });
        assert.deepEqual(h.mutations, []);
        assert.equal(fields.find(field => field.id.startsWith('title__')).defaultValue, 'Новая');
        assert.equal(fields.find(field => field.id.startsWith('comment__')).defaultValue, 'Сохрани впечатление');
        return answer(fields, { seriesIndex: '2' });
    };
    await addBook(h.params);
    const created = h.files.get('Книги/Художественные/Автор. Новая.md');
    assert.equal(created.fm.series_index, 2); assert.match(created.text, /Сохрани впечатление/);
    assert.ok(h.forms[0].every(field => !h.forms[1].some(other => other.id === field.id)));
});

test('legacy destination collision aborts before any folders or file moves', async () => {
    const h = harness(), existing = h.book('Книги/Художественные/Автор. Новая.md', { title: 'Другая книга' });
    h.request = fields => answer(fields, newBookValues);
    await addBook(h.params);
    assert.deepEqual(h.mutations, []); assert.equal(existing.path, 'Книги/Художественные/Автор. Новая.md');
});

test('colliding sanitized legacy destinations abort all regrouping', async () => {
    const h = harness();
    h.book('Книги/Художественные/Автор. Старое..md', { title: 'Первое' });
    h.book('Книги/Художественные/Автор. Старое.md', { title: 'Второе' });
    h.request = fields => answer(fields, newBookValues);
    await addBook(h.params);
    assert.deepEqual(h.mutations, []);
    assert.ok(h.notices.some(message => message.includes('Перенос отменён')));
});

test('invalid reading markers in a new-book comment never trigger legacy moves', async () => {
    const h = harness();
    h.book('Книги/Художественные/Автор. Старая.md', { title: 'Старая' });
    h.request = (fields, attempt) => attempt === 1 ? answer(fields, { ...newBookValues, comment: HISTORY_END }) : null;
    await addBook(h.params);
    assert.deepEqual(h.mutations, []); assert.equal(h.forms.length, 2);
});

test('new-book form IDs are unique across repeated command sessions', async () => {
    const h = harness();
    h.request = (fields, attempt) => answer(fields, { ...newBookValues, title: attempt === 1 ? 'Первая' : 'Вторая' });
    await addBook(h.params); await addBook(h.params);
    assert.equal(h.forms.length, 2);
    assert.ok(h.forms[0].every(field => !h.forms[1].some(other => other.id === field.id)));
});

test('a synced unindexed root card gets a reading instead of a duplicate', async () => {
    const h = harness();
    let synced;
    h.request = fields => {
        synced = h.book('Книги/Архив/Полученная.md', { title: 'Новая' });
        h.cache.delete(synced.path);
        return answer(fields, newBookValues);
    };
    h.suggest = (labels, values, prompt) => prompt.startsWith('Книга уже есть') ? 'reading' : values[0];
    await addBook(h.params);
    assert.equal(synced.fm.read_count, 2);
    assert.equal(h.files.has('Книги/Художественные/Автор. Новая.md'), false);
    assert.ok(!h.mutations.some(filePath => filePath.includes(' -> ')));
});

test('CRLF and non-fiction rating rules survive an atomic append', async () => {
    const h = harness(), book = h.book('Книги/Non-fiction/Тест.md');
    book.text = book.text.replace(/\n/g, '\r\n');
    await h.core.appendReading(book, { date: '2026', rating: 9, comment: 'Одна\nДве' });
    assert.ok(!/(^|[^\r])\n/.test(book.text));
    assert.ok(!Object.hasOwn(book.fm, 'rating'));
    assert.equal(h.core.parseHistory(book.text).entries[1].rating, null);
});

test('safe fixes are idempotent even while metadataCache stays stale', async () => {
    const h = harness(), a = h.book('Книги/Художественные/A.md', { related: ['[[Книги/Художественные/B]]'] }), b = h.book('Книги/Художественные/B.md');
    await safeFix(h.params);
    assert.deepEqual(b.fm.related, ['[[Книги/Художественные/A]]']);
    assert.equal(h.cache.get(b.path).related, undefined);
    h.mutations.length = 0;
    await safeFix(h.params);
    assert.deepEqual(h.mutations, []);
    assert.deepEqual(a.fm.related, ['[[Книги/Художественные/B]]']);
});

test('safe deduplication retains links added after the maintenance snapshot', async () => {
    const h = harness(), a = h.book('Книги/Художественные/A.md', { related: ['[[Неизвестное]]', '[[Неизвестное]]'] });
    let visits = 0;
    h.beforeProcess = file => {
        if (file === a && ++visits === 2) file.text = file.text.replace('related: ["[[Неизвестное]]","[[Неизвестное]]"]', 'related: ["[[Неизвестное]]","[[Неизвестное]]","[[Новая связь]]"]');
    };
    await safeFix(h.params);
    assert.deepEqual(a.fm.related, ['[[Неизвестное]]', '[[Новая связь]]']);
});

test('link command checks current values and avoids duplicate links on a repeated run', async () => {
    const h = harness(), book = h.book(), movie = h.file('Кино/Тест.md', { tags: ['movies'] });
    await linkAdaptation(h.params);
    assert.deepEqual(book.fm.adaptations, ['[[Кино/Тест]]']);
    assert.deepEqual(movie.fm['Первоисточники'], ['[[Книги/Художественные/Тест]]']);
    h.mutations.length = 0;
    await linkAdaptation(h.params);
    assert.deepEqual(h.mutations, []);
});

test('failed reciprocal link rollback preserves a concurrently added unrelated link', async () => {
    const h = harness(), book = h.book(undefined, { adaptations: ['[[Кино/Другая]]'] }), movie = h.file('Кино/Тест.md', { tags: ['movies'] });
    h.beforeProcess = file => {
        if (file === movie) {
            book.text = book.text.replace('adaptations: ["[[Кино/Другая]]","[[Кино/Тест]]"]', 'adaptations: ["[[Кино/Другая]]","[[Кино/Тест]]","[[Кино/С телефона]]"]');
            throw new Error('Simulated second-file failure');
        }
    };
    await linkAdaptation(h.params);
    assert.deepEqual(book.fm.adaptations, ['[[Кино/Другая]]', '[[Кино/С телефона]]']);
    assert.equal(movie.fm['Первоисточники'], undefined);
    assert.ok(h.notices.some(message => message.includes('Simulated second-file failure')));
});

test('writeIfChanged refuses to overwrite a concurrent generated-page edit', async () => {
    const h = harness(), page = h.file('Книги/_system/Страница.md', {}, 'Исходный текст');
    h.beforeProcess = file => { if (file === page) { file.text = 'Изменение с телефона'; h.beforeProcess = null; } };
    await assert.rejects(h.core.writeIfChanged(page.path, 'Новая сводка'), /изменился/);
    assert.equal(page.text, 'Изменение с телефона'); assert.deepEqual(h.mutations, []);
});

test('generated Markdown pages default to preview and retain it on regeneration', async () => {
    const h = harness();
    const page = await h.core.writeIfChanged('Книги/_system/Новая.md', '# Сводка\n\nТекст.\n');
    assert.equal(fromText(page.text).obsidianUIMode, 'preview');
    assert.ok(page.text.endsWith('# Сводка\n\nТекст.\n'));
    await h.core.writeIfChanged(page.path, '# Обновлённая сводка\n');
    assert.equal(fromText(page.text).obsidianUIMode, 'preview');
    const other = await h.core.writeIfChanged('Другая папка/Файл.md', '# Другой раздел\n');
    assert.equal(other.text, '# Другой раздел\n');
    const base = await h.core.writeIfChanged('Книги/_system/Вид.base', 'views: []\n');
    assert.equal(base.text, 'views: []\n');
    await h.core.appendJournal(['Событие']);
    assert.equal(fromText(h.files.get('Книги/_system/Журнал изменений.md').text).obsidianUIMode, 'preview');
});

test('home statistics reflect the just-written book despite a stale metadata cache', async () => {
    const h = harness(), book = h.book(), home = h.file('Книги/_index.md', {}, '<!-- BOOK-HOME-STATS:START -->old<!-- BOOK-HOME-STATS:END -->');
    await h.core.appendReading(book, { date: '2026', rating: null, comment: '' });
    await h.core.updateHomeStats();
    assert.match(home.text, /1 перечитано/);
    assert.equal(h.cache.get(book.path).read_count, 1);
    assert.equal(h.core.stats().readings, 2);
});

test('date validation supports precise/partial dates and early years', () => {
    const h = harness();
    for (const value of ['2026', '2026-10', '2024-02-29', '0001-01-01']) assert.equal(h.core.isValidDate(value), true, value);
    for (const value of ['0000', '0000-01', '2026-00', '2026-02-29', '2026-02-30', 'tomorrow']) assert.equal(h.core.isValidDate(value), false, value);
});

test('property updates retain YAML list comments and hashes inside quoted values', () => {
    const h = harness(), book = h.book();
    book.text = book.text.replace('authors: ["Автор"]', 'authors:\n  - "Автор # label" # item explanation\n\n  - "Автор # label"\ncustom: "keep # inside"');
    const updated = h.core.patchProperties(book.text, { authors: ['Автор # label'] });
    assert.match(updated, /authors: \["Автор # label"\]\n/);
    assert.match(updated, /# item explanation/);
    assert.match(updated, /custom: "keep # inside"/);
});

test('existing library reading blocks pass the new strict parser (read-only)', () => {
    const h = harness(), root = path.resolve(__dirname, '../..');
    let inspected = 0;
    function visit(directory) {
        for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
            const full = path.join(directory, file.name);
            if (file.isDirectory()) visit(full);
            else if (file.name.endsWith('.md') && file.name !== '_index.md') {
                const text = fs.readFileSync(full, 'utf8');
                if (text.includes(HISTORY_START)) { assert.doesNotThrow(() => h.core.parseHistory(text), full); inspected++; }
            }
        }
    }
    visit(path.join(root, 'Художественные')); visit(path.join(root, 'Non-fiction'));
    assert.ok(inspected >= 190, `Inspected ${inspected} existing cards`);
});
