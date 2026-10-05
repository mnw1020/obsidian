const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const knowledge = require('../knowledge.js');
const pages = require('../author_pages.js');
const sources = {
    'Книги/_system/book_core.js': fs.readFileSync(path.join(__dirname, '../book_core.js'), 'utf8'),
    'Книги/_system/QuickAdd/open_author.js': fs.readFileSync(path.join(__dirname, '../QuickAdd/open_author.js'), 'utf8'),
    'Книги/_system/author_pages.js': fs.readFileSync(path.join(__dirname, '../author_pages.js'), 'utf8')
};

class Node {
    constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.style = {}; this.attributes = {}; this.events = {}; this.className = ''; this._text = ''; }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(name, callback) { this.events[name] = callback; }
    set textContent(value) { this._text = String(value ?? ''); this.children = []; }
    get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
}
const find = (root, cls) => [root, ...root.children.flatMap(node => find(node, cls))].filter(node => node.className.split(' ').includes(cls));

function harness({ collection = true, bookAuthors = ['Леонид Каганов', 'Имя/Автор:Второй.'] } = {}) {
    const files = new Map(), reads = new Map(), created = [], processed = [], leaves = [], opened = [], notices = [];
    const document = { createElement: tag => new Node(tag, document) };
    const container = new Node('div', document);
    function file(filePath, text, fm = {}) {
        const entry = { path: filePath, basename: filePath.split('/').at(-1).replace(/\.md$/, ''), extension: filePath.split('.').at(-1), stat: { mtime: 1 }, text, fm };
        files.set(filePath, entry); return entry;
    }
    for (const [filePath, text] of Object.entries(sources)) file(filePath, text);
    const book = file('Книги/Художественные/Магия.md', '<!-- BOOK-READINGS:START -->\n<!-- BOOK-READINGS:END -->\n\n' + knowledge.renderExcerpt({ id: 'book-excerpt-author-book', text: 'Текст из книги', section: 'Раздел' }), { title: 'Магия', authors: bookAuthors });
    if (collection) file('Книги/Цитаты/Женщина и гордость.md', knowledge.renderExcerpt({ id: 'book-excerpt-author-collection', text: 'Текст коллекции', section: 'Раздел' }), { note_type: 'excerpt_collection', title: 'Женщина и гордость', authors: ['Сергей Стиллавин'] });
    const app = {
        metadataCache: { getFileCache: entry => ({ frontmatter: entry.fm }) },
        vault: {
            getAbstractFileByPath: filePath => files.get(filePath),
            getMarkdownFiles: () => [...files.values()].filter(entry => entry.extension === 'md'),
            read: async entry => { reads.set(entry.path, (reads.get(entry.path) || 0) + 1); return entry.text; },
            createFolder: async filePath => { created.push(filePath); files.set(filePath, { path: filePath }); },
            create: async (filePath, text) => { created.push(filePath); return file(filePath, text); },
            process: async (entry, transform) => { const next = transform(entry.text); processed.push(entry.path); entry.text = next; },
            on: () => ({})
        },
        workspace: {
            getActiveFile: () => book,
            getLeaf: newLeaf => { leaves.push(newLeaf); return { openFile: async entry => opened.push(entry.path) }; },
            openLinkText: async (...args) => opened.push(args)
        }
    };
    const obsidian = {
        Notice: class { constructor(message) { notices.push(message); } },
        normalizePath: value => value.replace(/\\/g, '/'),
        parseYaml: value => {
            const author = /^selected_author:\s*(.*)$/m.exec(value)?.[1];
            return author ? { selected_author: JSON.parse(author) } : {};
        }
    };
    const dv = { container, component: { register: () => {} } };
    return { app, obsidian, dv, container, files, reads, created, processed, leaves, opened, notices, file };
}
const click = (link, modifiers = {}) => link.events.click({ preventDefault() {}, stopPropagation() {}, ...modifiers });

test('every effective author has a separate canonical link; viewing creates nothing and work links keep exact quote anchors', async () => {
    const h = harness();
    const rendered = await knowledge({ app: h.app, obsidian: h.obsidian, dv: h.dv });
    const links = find(h.container, 'book-quote-author-link');
    assert.deepEqual(links.map(link => link.textContent), ['Сергей Стиллавин', 'Леонид Каганов', 'Имя/Автор:Второй.']);
    assert.ok(links.every(link => link.className.includes('internal-link')));
    const bookLine = find(h.container, 'book-quote-authors').find(line => line.textContent.includes('Каганов'));
    assert.equal(bookLine.textContent, 'Леонид Каганов, Имя/Автор:Второй.');
    const works = find(h.container, 'book-quote-work-link');
    assert.deepEqual(works.map(link => link.attributes['data-href']).sort(), ['Книги/Цитаты/Женщина и гордость#^book-excerpt-author-collection', 'Книги/Художественные/Магия#^book-excerpt-author-book'].sort());
    assert.equal(h.created.length, 0);
    assert.equal(h.processed.length, 0);
    assert.equal(h.reads.get('Книги/_system/QuickAdd/open_author.js'), undefined);
    await click(works.find(link => link.textContent === 'Магия'), { ctrlKey: true });
    assert.deepEqual(h.opened[0], ['Книги/Художественные/Магия#^book-excerpt-author-book', 'Книги/Художественные/Магия.md', true]);
    rendered.dispose();
});

test('author click uses the canonical command lazily, caches it per render, and opens Ctrl/Meta in a new leaf', async () => {
    const h = harness();
    const rendered = await knowledge({ app: h.app, obsidian: h.obsidian, dv: h.dv });
    const links = find(h.container, 'book-quote-author-link');
    const first = links.find(link => link.textContent === 'Имя/Автор:Второй.');
    await click(first);
    assert.equal(h.opened[0], first.attributes['data-href'] + '.md');
    assert.equal(h.leaves[0], false);
    assert.ok(h.files.get(h.opened[0]).text.includes('selected_author: "Имя/Автор:Второй."'));
    const author = links.find(link => link.textContent === 'Сергей Стиллавин');
    await click(author, { metaKey: true });
    assert.equal(h.opened[1], author.attributes['data-href'] + '.md');
    assert.equal(h.leaves[1], true);
    const originalGetLeaf = h.app.workspace.getLeaf;
    await click(author, { ctrlKey: true });
    assert.equal(h.leaves[2], true);
    assert.equal(h.app.workspace.getLeaf, originalGetLeaf);
    assert.equal(h.reads.get('Книги/_system/QuickAdd/open_author.js'), 1);
    assert.equal(h.created.filter(path => path.endsWith('.md')).length, 2);
    rendered.dispose();
});

test('opening an existing author merges only its generated region and preserves properties and personal notes', async () => {
    const h = harness({ collection: false, bookAuthors: ['Леонид Каганов'] });
    const rendered = await knowledge({ app: h.app, obsidian: h.obsidian, dv: h.dv });
    const link = find(h.container, 'book-quote-author-link')[0];
    const prefix = '---\r\nselected_author: "Леонид Каганов"\r\ncustom: true\r\n---\r\n\r\n';
    const personal = '\r\n\r\n## Мои заметки\r\nМой текст $& [[Ссылка]]\n';
    h.files.set('Книги/_system/Авторы', { path: 'Книги/_system/Авторы' });
    const authorPage = h.file(link.attributes['data-href'] + '.md', prefix + '<!-- BOOK-AUTHOR-GENERATED:START -->\r\nСтарое оформление\r\n<!-- BOOK-AUTHOR-GENERATED:END -->' + personal);
    await click(link);
    assert.ok(authorPage.text.startsWith(prefix));
    assert.ok(authorPage.text.endsWith(personal));
    assert.ok(authorPage.text.includes(pages.authorRegion().replace(/\n/g, '\r\n')));
    assert.equal(h.created.length, 0);
    assert.deepEqual(h.processed, [authorPage.path]);
    rendered.dispose();
});

test('home quotes use author links too; missing command produces a visible error and can be retried', async () => {
    const h = harness({ collection: false, bookAuthors: ['Леонид Каганов'] });
    const commandPath = 'Книги/_system/QuickAdd/open_author.js';
    const command = h.files.get(commandPath); h.files.delete(commandPath);
    const rendered = await knowledge({ app: h.app, obsidian: h.obsidian, dv: h.dv, mode: 'home' });
    const link = find(h.container, 'book-quote-author-link')[0];
    assert.equal(link.textContent, 'Леонид Каганов');
    await click(link);
    assert.match(h.notices[0], /Не удалось открыть автора:.*команда/);
    assert.equal(h.created.length, 0);
    h.files.set(commandPath, command);
    await click(link);
    assert.equal(h.opened[0], link.attributes['data-href'] + '.md');
    rendered.dispose();
});
