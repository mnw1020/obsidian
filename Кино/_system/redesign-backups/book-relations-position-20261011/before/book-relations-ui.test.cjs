const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const vault = path.resolve(__dirname, '../../..');
const renderer = fs.readFileSync(path.join(vault, 'Книги/_system/book_card.js'), 'utf8');
const relationSource = fs.readFileSync(path.join(vault, 'Кино/_system/adaptation_links.js'), 'utf8');
const css = fs.readFileSync(path.join(vault, 'Книги/_system/books-library.css'), 'utf8');
const installed = fs.readFileSync(path.join(vault, '.obsidian/snippets/books-library.css'), 'utf8');
const appearance = JSON.parse(fs.readFileSync(path.join(vault, '.obsidian/appearance.json'), 'utf8'));
const activeCss = appearance.enabledCssSnippets.map(name => fs.readFileSync(path.join(vault, '.obsidian/snippets', name + '.css'), 'utf8')).join('\n');
const baseline = '*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:#151719;color:#ddd;--background-primary:#17191c;--background-secondary:#202327;--background-modifier-border:#383b40;--text-muted:#a1a5ad;--text-normal:#ddd;--text-accent:#dba66c;--text-error:#f27f7f;--interactive-accent:#dba66c;--text-on-accent:#181818;--font-interface:Arial,sans-serif}.markdown-preview-view{max-width:900px;margin:auto;padding:20px;min-width:0}button,input,a{font:inherit}a{color:var(--text-accent)}button{cursor:pointer}';

async function setup(browser, width = 390, shared = true, delay = false) {
    const page = await browser.newPage({ viewport: { width, height: 1080 } });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body class="theme-dark"><div class="markdown-preview-view book-card"><div id="container"></div></div></body></html>');
    await page.addStyleTag({ content: baseline + '\n' + css });
    await page.evaluate(async ({ renderer, relationSource, shared, delay }) => {
        class Events {
            constructor() { this.refs = new Set(); }
            on(name, callback) { const ref = { name, callback }; this.refs.add(ref); return ref; }
            offref(ref) { this.refs.delete(ref); }
            trigger(name, ...args) { for (const ref of [...this.refs]) if (ref.name === name) ref.callback(...args); }
        }
        const make = (path, fm) => ({ path, extension: 'md', basename: path.split('/').pop().slice(0, -3), fm });
        const book = make('Книги/Художественные/Герберт. Дюна.md', { title: 'Дюна', authors: ['Фрэнк Герберт'], aliases: ['Книга'], work_type: 'novel', date: '2026-10-01', read_count: 2, rating: 9, adaptations: ['[[Кино/Media/Дюна (1984)]]'] });
        const film = make('Кино/Media/Дюна (1984).md', { tags: ['movies'], Релиз: '1984-12-14' });
        const serial = make('Кино/Media/Дюна (2000).md', { tags: ['serial'], adapted_from: ['[[Книга]]'], Релиз: '2000-12-03' });
        const newFilm = make('Кино/Media/Дюна (2021).md', { tags: ['movies'], Релиз: '2021-09-15' });
        const other = make('Книги/Художественные/Другая.md', { title: 'Другая книга', authors: ['Автор'] });
        const files = [book, film, serial, newFilm, other], map = new Map(files.map(file => [file.path, file]));
        if (shared) map.set('Кино/_system/adaptation_links.js', { path: 'Кино/_system/adaptation_links.js', text: relationSource });
        const resolve = target => files.find(file => file.path === target || file.path === target + '.md' || file.basename === target || [].concat(file.fm.aliases || []).includes(target));
        const vault = Object.assign(new Events(), {
            getMarkdownFiles: () => files, getAbstractFileByPath: target => map.get(target),
            read: async file => { if (delay) await new Promise(resolve => { window.releaseRead = resolve; }); return file.text; }
        });
        const metadataCache = Object.assign(new Events(), { getFileCache: file => ({ frontmatter: file.fm }), getFirstLinkpathDest: resolve });
        const container = document.getElementById('container'), cleanups = [], choices = [], opened = [];
        let active = other;
        const sourceLeaf = { view: { file: book, containerEl: container.parentNode } };
        const workspace = Object.assign(new Events(), { getLeavesOfType: () => [sourceLeaf], setActiveLeaf: leaf => { active = leaf.view.file; }, getActiveFile: () => active, openLinkText: (...args) => opened.push(args) });
        const app = { vault, metadataCache, workspace, plugins: { plugins: { quickadd: { api: { executeChoice: async (name, variables) => {
            choices.push({ name, path: variables.adaptationRequest?.path, active: active.path });
            const bookFm = { ...book.fm, adaptations: [...book.fm.adaptations, '[[Кино/Media/Дюна (2021)]]'] };
            const mediaFm = { ...newFilm.fm, Первоисточники: ['[[Книги/Художественные/Герберт. Дюна]]'] };
            if (shared) {
                const mod = { exports: {} }; new Function('module', 'exports', relationSource)(mod, mod.exports);
                mod.exports.remember(app, book, bookFm); mod.exports.remember(app, newFilm, mediaFm);
            }
            const payload = { bookPath: book.path, mediaPath: newFilm.path, bookFm, mediaFm };
            variables.adaptationRequest.onLinked(payload);
            workspace.trigger('kino:adaptations-changed', payload);
        } } } } } };
        const component = { register: callback => cleanups.push(callback) };
        const dv = { current: () => ({ file: { path: book.path } }), container, component };
        const mod = { exports: {} }; new Function('module', renderer)(mod);
        window.fixture = { app, book, film, serial, newFilm, other, files, map, choices, opened, component, dv, renderer: mod.exports,
            unload() { for (const callback of cleanups) callback(); },
            refs() { return [vault, metadataCache, workspace].reduce((sum, emitter) => sum + emitter.refs.size, 0); }
        };
        window.rendering = mod.exports.render({ app, dv });
        if (!delay) await window.rendering;
    }, { renderer, relationSource, shared, delay });
    // The active snippets can load after Dataview's DOM, as they do on a live note.
    await page.addStyleTag({ content: activeCss });
    return page;
}

test('book relations use compact rows, explicit pane source, immediate saved links and cache-driven hide/show', async () => {
    assert.equal(css, installed, 'active snippet matches the source stylesheet');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const width of [390, 1440]) {
            const page = await setup(browser, width);
            const rows = page.locator('.book-card-adaptation');
            const panel = page.locator('.book-card-adaptations');
            const summary = panel.locator('summary');
            assert.equal(await panel.evaluate(node => node.tagName), 'DETAILS');
            assert.equal(await panel.evaluate(node => node.open), true);
            assert.equal(await summary.locator('.book-card-related-heading').textContent(), 'Связанные произведения');
            assert.deepEqual(await panel.evaluate(node => ({ radius: getComputedStyle(node).borderRadius,
                headingSize: getComputedStyle(node.querySelector('.book-card-related-heading')).fontSize,
                headingColor: getComputedStyle(node.querySelector('.book-card-related-heading')).color })),
                { radius: '11px', headingSize: '21px', headingColor: 'rgb(184, 151, 96)' });
            assert.equal(await rows.count(), 2);
            assert.equal(await page.locator('.book-card-adaptation-meta').allTextContents().then(values => values.join('|')), 'Фильм · 1984|Сериал · 2000');
            await rows.first().click({ modifiers: ['Control'] });
            assert.deepEqual(await page.evaluate(() => fixture.opened[0]), ['Кино/Media/Дюна (1984)', 'Книги/Художественные/Герберт. Дюна.md', true]);
            await summary.press('Enter');
            assert.equal(await panel.evaluate(node => node.open), false);
            assert.equal(await rows.first().isVisible(), false);
            await page.getByRole('link', { name: 'Связать с кино', exact: true }).click();
            assert.equal(await rows.count(), 3);
            assert.equal(await panel.evaluate(node => node.open), false, 'adding a relation preserves a collapsed panel');
            await summary.press('Space');
            assert.equal(await panel.evaluate(node => node.open), true);
            assert.equal(await rows.first().isVisible(), true);
            assert.deepEqual(await page.evaluate(() => fixture.choices), [{ name: 'Книги - Связать с кино', path: 'Книги/Художественные/Герберт. Дюна.md', active: 'Книги/Художественные/Герберт. Дюна.md' }]);
            assert.equal(await page.evaluate(() => fixture.book.fm.adaptations.length), 1, 'saved callback works before cache refresh');
            assert.equal(await page.locator('.book-card-adaptations-count').textContent(), '3');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
            assert.ok(await rows.evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height <= 80)), 'rows stay compact');
            const previews = path.join(vault, 'Кино/_system/redesign-backups/previews'); fs.mkdirSync(previews, { recursive: true });
            await page.screenshot({ path: path.join(previews, 'book-relations-style-20261011-' + width + '.png'), fullPage: true });
            await summary.press('Enter');
            await page.evaluate(() => {
                fixture.book.fm = { ...fixture.book.fm, adaptations: [] };
                fixture.serial.fm.adapted_from = [];
                fixture.app.vault.trigger('modify', fixture.book);
                fixture.app.vault.trigger('modify', fixture.newFilm);
                fixture.app.metadataCache.trigger('changed', fixture.book);
                fixture.app.metadataCache.trigger('changed', fixture.serial);
            });
            await page.waitForFunction(() => document.querySelector('.book-card-adaptations').hidden);
            assert.equal(await rows.count(), 0);
            await page.evaluate(() => {
                fixture.film.fm['Первоисточники'] = ['[[Книга]]'];
                fixture.app.metadataCache.trigger('changed', fixture.film);
            });
            await page.waitForFunction(() => document.querySelectorAll('.book-card-adaptation').length === 1);
            assert.equal(await panel.evaluate(node => node.open), false, 'hide/show retains the chosen fold state');
            await summary.press('Enter');
            await page.evaluate(() => {
                fixture.book.fm.adaptations = ['[[Кино/Media/Дюна (2021)|<img src=x onerror=alert(1)>]]'];
                fixture.app.metadataCache.trigger('changed', fixture.book);
            });
            await page.waitForFunction(() => document.querySelectorAll('.book-card-adaptation').length === 2);
            assert.equal(await page.locator('.book-card-adaptation-title').first().textContent(), '<img src=x onerror=alert(1)>');
            assert.equal(await page.locator('.book-card-adaptation img').count(), 0, 'aliases are rendered as text');
            // A reverse relation saved in another book must update without a global resolved event.
            await page.evaluate(() => {
                fixture.other.fm.related = ['[[Книга]]'];
                fixture.app.metadataCache.trigger('changed', fixture.other);
            });
            await page.waitForFunction(() => document.querySelector('.book-card-adaptation[data-type="book"]'));
            assert.equal(await page.locator('.book-card-adaptation[data-type="book"] .book-card-adaptation-title').textContent(), 'Другая книга');
            assert.equal(await page.locator('.book-card-adaptation[data-type="book"] .book-card-adaptation-meta').textContent(), 'Книга · Автор');
            await page.evaluate(() => {
                const oldPath = fixture.other.path;
                fixture.map.delete(oldPath);
                fixture.other.path = 'Книги/Художественные/Переименованная.md';
                fixture.other.basename = 'Переименованная';
                fixture.map.set(fixture.other.path, fixture.other);
                fixture.app.vault.trigger('rename', fixture.other, oldPath);
            });
            await page.waitForFunction(() => document.querySelector('.book-card-adaptation[data-type="book"]')?.getAttribute('href') === 'Книги/Художественные/Переименованная');
            await page.evaluate(() => {
                fixture.files.splice(fixture.files.indexOf(fixture.other), 1);
                fixture.map.delete(fixture.other.path);
                fixture.other.fm = {}; // Deletion can arrive after the metadata has already gone.
                fixture.app.vault.trigger('delete', fixture.other);
            });
            await page.waitForFunction(() => !document.querySelector('.book-card-adaptation[data-type="book"]'));
            await page.evaluate(() => {
                fixture.other.fm = { title: 'Другая книга', authors: ['Автор'], related: ['[[Книга]]'] };
                fixture.files.push(fixture.other); fixture.map.set(fixture.other.path, fixture.other);
                fixture.app.vault.trigger('create', fixture.other);
            });
            await page.waitForFunction(() => document.querySelector('.book-card-adaptation[data-type="book"]'));
            await page.evaluate(() => {
                fixture.other.fm.related = [];
                fixture.app.metadataCache.trigger('changed', fixture.other);
            });
            await page.waitForFunction(() => !document.querySelector('.book-card-adaptation[data-type="book"]'));
            await page.evaluate(() => fixture.unload());
            assert.equal(await page.evaluate(() => fixture.refs()), 3, 'only the shared app-level cache listeners remain');
            const before = await rows.count();
            await page.evaluate(() => fixture.app.workspace.trigger('kino:adaptations-changed', { bookPath: fixture.book.path, bookFm: { ...fixture.book.fm, adaptations: [] } }));
            assert.equal(await rows.count(), before, 'unloaded renderer ignores late command events');
            await page.close();
        }
    } finally { await browser.close(); }
});

test('standalone books retain direct and reverse links when the cinema module is absent', async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await setup(browser, 390, false);
        assert.equal(await page.locator('.book-card-adaptation').count(), 2);
        await page.getByRole('link', { name: 'Связать с кино', exact: true }).click();
        assert.equal(await page.locator('.book-card-adaptation').count(), 3);
        await page.evaluate(() => fixture.unload());
        assert.equal(await page.evaluate(() => fixture.refs()), 0);
    } finally { await browser.close(); }
});

test('an unloaded card cannot render or register listeners after a late module read', async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await setup(browser, 390, true, true);
        await page.evaluate(async () => { fixture.unload(); window.releaseRead(); await window.rendering; });
        assert.equal(await page.locator('.book-card-hero').count(), 0);
        assert.equal(await page.evaluate(() => fixture.refs()), 0);
    } finally { await browser.close(); }
});
