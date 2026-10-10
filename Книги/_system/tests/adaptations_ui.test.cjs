const assert = require('node:assert/strict'), { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path');
const ui = require('../adaptations_ui.js');
const file = (path, fm) => ({ path, basename: path.split('/').at(-1).replace(/\.md$/, ''), extension: 'md', fm });
function fixture() {
    const book = file('Книги/Художественные/Книга.md', { title: 'Ёлка', authors: ['Автор', 'Автор'], rating: 7, adaptations: ['[[Фильм]]', '[[Кино/Media/Фильм|Дубль]]', '[[Нет файла]]'] });
    const second = file('Книги/Non-fiction/Вторая.md', { title: 'Вторая', authors: ['Другой автор'], rating: 10 });
    const film = file('Кино/Media/Фильм.md', { tags: ['movies'], Название: 'Original movie', Оценка: '8', Релиз: '1999-03-10', Первоисточники: ['[[Книга]]'] });
    const serial = file('Кино/Media/Сериал.md', { tags: ['#serial'], Оценка: '0', adapted_from: ['[[Книга]]'], Первоисточники: ['[[Книга]]'] });
    const shared = file('Кино/Media/Общая экранизация.md', { tags: ['serial'], Оценка: '9', Первоисточники: ['[[Книга]]', '[[Вторая]]'] });
    const ignored = file('Кино/_system/Служебная.md', { tags: ['movies'], Первоисточники: ['[[Книга]]'] });
    const files = [book, second, film, serial, shared, ignored];
    const resolve = target => files.find(file => file.path === target || file.path === target + '.md' || file.basename === target);
    const app = { vault: { getMarkdownFiles: () => files, getAbstractFileByPath: resolve }, metadataCache: { getFirstLinkpathDest: resolve } };
    const core = { snapshot: () => [book, second].map(file => ({ file, fm: file.fm })), getFrontmatter: file => file.fm, isFiction: file => file.path.includes('/Художественные/') };
    return { app, core, book, second, files };
}
test('one work keeps all distinct direct and reverse adaptations, shared media is counted once', () => {
    const result = ui.buildOverview(fixture());
    assert.equal(result.items.length, 2);
    const book = result.items.find(item => item.title === 'Ёлка');
    assert.equal(book.media.length, 3); assert.deepEqual(book.authors, ['Автор']); assert.equal(book.rating, 7);
    assert.equal(book.media.find(item => item.title === 'Сериал').rating, null);
    assert.equal(book.media.find(item => item.title === 'Фильм').year, '1999');
    assert.equal(result.items.find(item => item.title === 'Вторая').rating, null);
    assert.deepEqual(result.stats, { books: 2, media: 3, links: 4, movies: 1, serials: 2 });
    assert.equal(result.unresolved, 1);
});

test('franchise links resolve existing pages, deduplicate aliases and participate in search', () => {
    const env = fixture();
    const page = file('Кино/Франшизы/Вселенная.md', { tags: ['franchise'] });
    env.files.push(page);
    env.files.find(item => item.basename === 'Фильм').fm['Франшиза'] = ['[[Вселенная]]', '[[Кино/Франшизы/Вселенная|Алиас]]', '[[Нет франшизы]]', '[[Книга]]'];
    const overview = ui.buildOverview(env);
    const movie = overview.items.find(item => item.title === 'Ёлка').media.find(item => item.title === 'Фильм');
    assert.deepEqual(movie.franchises, [{ target: 'Кино/Франшизы/Вселенная', title: 'Вселенная' }]);
    assert.equal(ui.filterItems(overview.items, { query: 'вселенная' }).length, 1);
});
test('search and type filters preserve work grouping without mutating the full overview', () => {
    const items = ui.buildOverview(fixture()).items;
    const search = ui.filterItems(items, { query: 'елка' });
    assert.equal(search.length, 1); assert.equal(search[0].media.length, 3);
    const mediaSearch = ui.filterItems(items, { query: 'original movie' });
    assert.equal(mediaSearch.length, 1); assert.equal(mediaSearch[0].media.length, 3);
    const movies = ui.filterItems(items, { type: 'movie' });
    assert.equal(movies.length, 1); assert.equal(movies[0].media.length, 1);
    assert.equal(ui.filterItems(items, { type: 'serial', query: 'original movie' }).length, 0);
    assert.equal(ui.filterItems(items, { sort: 'count' })[0].title, 'Ёлка');
    assert.equal(ui.filterItems(items, { query: 'нет такого' }).length, 0);
    assert.equal(items.find(item => item.title === 'Ёлка').media.length, 3);
});
test('page migration preserves properties and trailing notes, repeated generation is idempotent', () => {
    const original = fs.readFileSync(path.join(__dirname, '../backups/adaptations-redesign/Экранизации.md.before'), 'utf8');
    const notes = '\r\n## Мои заметки\r\nНе потерять $& [[Ссылка]]';
    const next = ui.mergeOverview(original + notes);
    assert.ok(next.startsWith(original.slice(0, original.indexOf('# 🎬')))); assert.ok(next.endsWith(notes));
    assert.match(next, /adaptations_ui\.js/); assert.doesNotMatch(next, /\| Произведение \|/);
    assert.equal(ui.mergeOverview(next), next);
    assert.throws(() => ui.mergeOverview('Моя произвольная заметка'), /Исходный текст сохранён/);
    assert.throws(() => ui.mergeOverview(ui.overviewPage() + ui.overviewPage()), /маркеры/);
});
