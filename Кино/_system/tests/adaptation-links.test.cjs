const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const links = require('../adaptation_links.js');
const bookRoot = path.resolve(__dirname, '../../../Книги/_system');
const command = require(path.join(bookRoot, 'QuickAdd/link_adaptation.js'));
const { parseYaml, stringifyYaml, fromText } = require(path.join(bookRoot, 'tests/yaml_fixture.cjs'));
function fixture() {
    const files = new Map(), cache = new Map(), writes = [], events = [], notices = [], handlers = new Map();
    const context = { beforeProcess: null, selected: null, active: null, prompts: [] };
    const note = (p, fm, body = '## Мои заметки\nСохранить этот текст.\n') => {
        const f = { path: p, basename: p.split('/').at(-1).replace(/\.md$/, ''), extension: p.split('.').at(-1),
            text: '---\n' + stringifyYaml(fm) + '\n---\n\n' + body, stat: { mtime: 1 } };
        files.set(p, f); cache.set(p, structuredClone(fm)); return f;
    };
    for (const [p, source] of [['Книги/_system/book_core.js', fs.readFileSync(path.join(bookRoot, 'book_core.js'), 'utf8')],
        ['Кино/_system/adaptation_links.js', fs.readFileSync(path.resolve(__dirname, '../adaptation_links.js'), 'utf8')]]) files.set(p, { path: p, text: source, extension: 'js' });
    const app = {
        vault: { getMarkdownFiles: () => [...files.values()].filter(f => f.extension === 'md'), getAbstractFileByPath: p => files.get(p),
            read: async f => f.text, process: async (f, callback) => {
                if (context.beforeProcess) await context.beforeProcess(f);
                const next = callback(f.text);
                if (next !== f.text) { f.text = next; f.stat.mtime++; writes.push(f.path); for (const cb of handlers.get('modify') || []) cb(f); }
            },
            create: async (p, text) => { const f = note(p, fromText(text)); f.text = text; return f; },
            on: (name, cb) => { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(cb); return { name, cb }; } },
        metadataCache: { getFileCache: f => ({ frontmatter: cache.get(f.path) }), getFirstLinkpathDest: raw => {
            const target = raw.replace(/\.md$/i, '');
            return files.get(target + '.md') || [...files.values()].find(f => f.basename === target || links.values(cache.get(f.path)?.aliases).includes(target));
        } },
        workspace: { getActiveFile: () => context.active, trigger: (name, data) => events.push({ name, data }) }
    };
    const params = { app, obsidian: { parseYaml, Notice: class { constructor(text) { notices.push(text); } } },
        quickAddApi: { suggester: async (labels, values, prompt) => { context.prompts.push({ labels, values, prompt }); return context.selected === null ? values[0] : context.selected; } } };
    const book = note('Книги/Художественные/Автор/Книга.md', { title: 'Название книги', authors: ['Автор'], aliases: ['Книжный псевдоним'], rating: 8 });
    const movie = note('Кино/Media/Фильм.md', { tags: ['movies'], Оценка: 7, Релиз: '2001-01-01' });
    const serial = note('Кино/Media/Сериал.md', { tags: ['#serial'], Оценка: 9 });
    context.active = book; context.selected = movie;
    return { ...context, context, params, app, files, cache, writes, events, notices, note, book, movie, serial, fm: f => fromText(f.text) };
}
test('shared relations combine explicit/reverse links, aliases and peers without inference or duplicate destinations', () => {
    const f = fixture();
    f.cache.set(f.book.path, { ...f.cache.get(f.book.path), adaptations: ['[[Фильм|Моя подпись]]', '[[Кино/Media/Фильм.md]]', '[[Кино/Media/Нет файла]]'] });
    f.cache.set(f.serial.path, { tags: ['serial'], adapted_from: ['[[Книжный псевдоним]]'] });
    const peer = f.note('Книги/Художественные/Соседняя.md', { title: 'Связанная книга', authors: ['Второй автор'], related: ['[[Книжный псевдоним]]'] });
    f.note('Кино/_system/Не карточка.md', { tags: ['movies'], Первоисточники: ['[[Книжный псевдоним]]'] });
    const result = links.related({ app: f.app, file: f.book });
    assert.deepEqual(result.map(v => [v.target, v.type, v.missing]), [
        ['Кино/Media/Фильм', 'movies', false], ['Кино/Media/Нет файла', 'movies', true], ['Кино/Media/Сериал', 'serial', false], [peer.path.slice(0, -3), 'book', false] ]);
    assert.equal(result[0].label, 'Моя подпись'); assert.equal(result[0].year, '2001');
    assert.deepEqual(links.related({ app: f.app, file: f.movie }).map(v => v.target), [f.book.path.slice(0, -3)]);
    assert.equal(f.writes.length, 0);
});
for (const direction of ['book', 'cinema']) test(`command from ${direction} creates both sides, preserves text and returns saved values before metadata refresh`, async () => {
    const f = fixture(), payloads = [], active = direction === 'book' ? f.book : f.movie;
    f.context.active = f.serial; f.context.selected = direction === 'book' ? f.movie : f.book;
    f.params.variables = { adaptationRequest: { path: active.path, onLinked: value => payloads.push(value) } };
    const original = [f.book, f.movie].map(file => file.text.split('\n---\n')[1]);
    const result = await command(f.params);
    assert.equal(result.changed, true); assert.equal(f.context.prompts[0].values.every(v => direction === 'book' ? v.path.startsWith('Кино/') : v.path.startsWith('Книги/')), true);
    assert.deepEqual(f.fm(f.book).adaptations, ['[[Кино/Media/Фильм]]']);
    assert.deepEqual(f.fm(f.movie)['Первоисточники'], [`[[${f.book.path.slice(0, -3)}]]`]);
    assert.deepEqual([f.book, f.movie].map(file => file.text.split('\n---\n')[1]), original);
    assert.equal(f.fm(f.book).rating, 8); assert.equal(f.fm(f.movie).Оценка, 7); assert.equal(payloads[0].bookFm.title, 'Название книги');
    assert.equal(f.events[0].name, 'kino:adaptations-changed'); assert.equal(f.events[0].data, payloads[0]);
    assert.equal(links.related({ app: f.app, file: f.movie, fm: f.cache.get(f.movie.path) })[0].target, f.book.path.slice(0, -3));
    const count = f.writes.length; await command(f.params); assert.equal(f.writes.length, count); assert.equal(payloads.length, 2);
});
test('one-sided alias links are completed without duplicates; related/adapted_from and all other fields survive', async () => {
    const f = fixture();
    f.book.text = f.book.text.replace('rating: 8', 'rating: 8\nadaptations: ["[[Фильм|Подпись]]"]\nrelated: ["[[Другая книга]]"]');
    f.movie.text = f.movie.text.replace('Оценка: 7', 'Оценка: 7\nadapted_from: ["[[Книжный псевдоним]]"]\nrelated: ["[[Сериал]]"]');
    await command(f.params);
    assert.deepEqual(f.fm(f.book).adaptations, ['[[Фильм|Подпись]]']);
    assert.deepEqual(f.fm(f.book).related, ['[[Другая книга]]']);
    assert.deepEqual(f.fm(f.movie).adapted_from, ['[[Книжный псевдоним]]']);
    assert.deepEqual(f.fm(f.movie).related, ['[[Сериал]]']);
    assert.deepEqual(f.fm(f.movie)['Первоисточники'], [`[[${f.book.path.slice(0, -3)}]]`]);
    assert.equal(f.writes.filter(p => p === f.book.path).length, 0);
});
test('rollback removes only this invocation link and retains another edit while cache stays stale', async () => {
    const f = fixture();
    f.context.beforeProcess = file => {
        if (file !== f.movie) return;
        f.book.text = f.book.text.replace('adaptations: ["[[Кино/Media/Фильм]]"]', 'adaptations: ["[[Кино/Media/Фильм]]","[[Кино/Media/Другой]]"]');
        throw Error('Диск недоступен');
    };
    const result = await command(f.params);
    assert.match(result.error, /Диск недоступен/); assert.deepEqual(f.fm(f.book).adaptations, ['[[Кино/Media/Другой]]']);
    assert.equal(f.fm(f.movie)['Первоисточники'], undefined); assert.equal(f.events.length, 0); assert.equal(f.app.__kinoAdaptationLinkLock, undefined);
});
test('cancelled chooser and concurrent invocation cannot write partial or duplicate relations', async () => {
    const f = fixture(); f.context.selected = undefined;
    assert.equal((await command(f.params)).cancelled, true); assert.deepEqual(f.writes, []);
    let resume; f.params.quickAddApi.suggester = () => new Promise(resolve => resume = resolve);
    const pending = command(f.params);
    while (!resume) await new Promise(resolve => setImmediate(resolve));
    assert.equal((await command(f.params)).busy, true); resume(f.movie); await pending;
    assert.deepEqual(f.fm(f.book).adaptations, ['[[Кино/Media/Фильм]]']); assert.equal(f.app.__kinoAdaptationLinkLock, undefined);
});
test('fresh read rejects selected card whose stale cache reports the wrong collection type', async () => {
    const f = fixture(); f.movie.text = f.movie.text.replace('tags: ["movies"]', 'tags: ["other"]');
    await command(f.params); assert.deepEqual(f.writes, []); assert.ok(f.notices.some(message => message.includes('Тип выбранной')));
});
test('new cards missing from the metadata cache are available immediately in the opposite-side chooser', async () => {
    const f = fixture(); f.cache.delete(f.movie.path);
    await command(f.params);
    assert.ok(f.context.prompts[0].values.includes(f.movie));
    assert.deepEqual(f.fm(f.book).adaptations, ['[[Кино/Media/Фильм]]']);
    assert.deepEqual(f.fm(f.movie)['Первоисточники'], [`[[${f.book.path.slice(0, -3)}]]`]);
});
test('saved render metadata yields to external changes and empty relations produce an empty list', () => {
    const f = fixture(); const fresh = { ...f.cache.get(f.movie.path), Первоисточники: [`[[${f.book.path.slice(0, -3)}]]`] };
    links.remember(f.app, f.movie, fresh);
    assert.equal(links.related({ app: f.app, file: f.movie, fm: f.cache.get(f.movie.path) }).length, 1);
    f.cache.set(f.movie.path, { ...f.cache.get(f.movie.path), changed: true });
    assert.deepEqual(links.related({ app: f.app, file: f.movie }), []);
    assert.deepEqual(links.related({ app: f.app, file: f.book }), []);
});
