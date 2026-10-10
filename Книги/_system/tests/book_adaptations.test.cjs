const { test } = require('node:test');
const assert = require('node:assert/strict');
const { adaptationLinks } = require('../book_card.js');

test('card exposes direct and reverse links, deduplicates resolved aliases and keeps unavailable targets visible', () => {
    const file = { path: 'Книги/Художественные/Книга.md' };
    const media = { path: 'Кино/Media/Фильм.md', basename: 'Фильм', fm: { tags: ['movies'], Первоисточники: ['[[Книга]]'] } };
    const reverse = { path: 'Кино/Media/Сериал.md', basename: 'Сериал', fm: { tags: ['#serial'], adapted_from: ['[[Книга]]'] } };
    const ignored = { path: 'Кино/_system/Служебная.md', fm: { tags: ['movies'], Первоисточники: ['[[Книга]]'] } };
    const app = {
        vault: { getMarkdownFiles: () => [media, reverse, ignored] },
        metadataCache: {
            getFileCache: file => ({ frontmatter: file.fm }),
            getFirstLinkpathDest: target => target === 'Книга' ? file : ['Фильм', 'Кино/Media/Фильм'].includes(target) ? media : null
        }
    };
    const links = adaptationLinks({ app, file, fm: { adaptations: ['[[Фильм]]', '[[Кино/Media/Фильм|Название]]', '[[Кино/Нет файла]]'] } });
    assert.deepEqual(links, [
        { target: 'Кино/Media/Фильм', label: 'Название' },
        { target: 'Кино/Нет файла', label: 'Нет файла' },
        { target: 'Кино/Media/Сериал', label: 'Сериал' }
    ]);
});
