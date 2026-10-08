const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { parseYaml, stringifyYaml } = require('./yaml_fixture.cjs');
const root = path.resolve(__dirname, '../..');
const note = fs.readFileSync(path.join(root, '_index.md'), 'utf8');
const fallbackActions = note.match(/<p class="books-actions-fallback">[\s\S]*?<\/p>/u)?.[0];
assert(fallbackActions, 'The native home page retains its action links');
const sources = Object.fromEntries(['library_home.js', 'library-home.css', 'book_core.js', 'lazy_base.js', 'knowledge.js', 'reading_dashboard.js', 'reading-dashboard.css', 'books-library.css'].map(name => ['Книги/_system/' + name, fs.readFileSync(path.join(root, '_system', name), 'utf8')]));
const yamlSource = fs.readFileSync(path.join(__dirname, 'yaml_fixture.cjs'), 'utf8');
const thingsCss = fs.readFileSync(path.resolve(root, '../.obsidian/themes/Things/theme.css'), 'utf8');
const gruvboxCss = fs.readFileSync(path.resolve(root, '../.obsidian/snippets/Obsidian gruvbox.css'), 'utf8');
const dataviewCss = fs.readFileSync(path.resolve(root, '../.obsidian/plugins/dataview/styles.css'), 'utf8');
const core = require('../book_core.js')({ app: {}, obsidian: { parseYaml } }), knowledge = require('../knowledge.js');
const now = new Date(), year = now.getFullYear(), month = String(now.getMonth() + 1).padStart(2, '0');

function fixture(filePath, fm, entry, excerpt) {
    const text = `---\n${stringifyYaml(fm)}\n---\n\nЛичные заметки владельца.\n\n${core.HISTORY_START}\n${(Array.isArray(entry) ? entry : [entry]).map(row => core.renderEntry(row)).join('\n\n')}\n${core.HISTORY_END}\n\n${knowledge.renderExcerpt(excerpt)}\n`;
    return { path: filePath, name: filePath.split('/').at(-1), basename: filePath.split('/').at(-1).slice(0, -3), extension: 'md', fm, text, stat: { mtime: 1 } };
}
const bookFiles = [
    fixture('Книги/Художественные/Первая.md', { title: 'Первая книга с длинным названием для проверки переноса в узком окне', authors: ['Автор Первый с достаточно длинным именем'], date: `${year}-${month}-01`, rating: 8, read_count: 1, series: 'Одна серия', work_type: 'book' }, { number: 1, date: `${year}-${month}-01`, rating: 8, comment: 'Личные впечатления.' }, { id: 'book-excerpt-home-first', text: 'Первая цитата для проверки домашней страницы.\nС переносом строки.', section: 'Мышление', conclusion: 'Первый личный вывод.', savedDate: `${year}-${month}-01` }),
    fixture('Книги/Non-fiction/Вторая.md', { title: 'Вторая книга', authors: ['Другой автор'], date: `${year - 1}-${month}-02`, read_count: 1, work_type: 'book' }, { number: 1, date: `${year - 1}-${month}-02`, rating: null, comment: '' }, { id: 'book-excerpt-home-second', text: 'Вторая цитата из другого произведения.', section: 'Мышление', savedDate: `${year}-${month}-02` })
];
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:var(--background-primary);color:var(--text-normal);--editor-font:"JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-error:#a83232}main{width:100%;max-width:1100px;margin:auto;padding:24px;min-width:0}.markdown-preview-sizer{width:100%;max-width:820px;margin-inline:auto;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-error:#ff8585}body.theme-light,body.theme-dark{--text-accent:#efa76b;--interactive-accent:#efa76b}.bases-table-container{max-width:100%;overflow:auto}.bases-table{width:100%;table-layout:fixed;border-collapse:collapse}.bases-table :is(td,th){padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;border-bottom:1px solid var(--background-modifier-border)}`;

async function mount(browser, { width = 1024, pane, theme = 'theme-light', quickadd = true, missingModule = false, failWidget = false, delayNative = false, delayRead = false, files = bookFiles, mode = 'home' } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const paneStyle = pane ? ` style="width:${pane}px;margin-inline:0"` : '';
    await page.setContent(`<style>${baseline}</style><style>${thingsCss}</style><style>${gruvboxCss}</style><style>${dataviewCss}</style><style>${sources['Книги/_system/books-library.css']}</style><style>body.theme-light,body.theme-dark{--text-accent:#efa76b;--interactive-accent:#efa76b}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered books-library books-home-page"${paneStyle}><div class="markdown-preview-sizer markdown-preview-section"><div class="metadata-container">Свойства</div><div class="inline-title">_index</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div><div class="el-h1" id="native-title"><h1>Библиотека</h1></div><div class="el-p" id="native-actions">${fallbackActions}</div><div class="el-div" id="native-stats"><div class="callout" data-callout="quote"><div class="callout-title-inner">Библиотека</div><p>2 произведения · 2 автора · 1 серия</p></div></div><div class="el-p" id="native-body"><p>Исходная библиотека</p><a class="internal-link" data-href="Книги/_system/_Книги.base#Список" href="#">Весь каталог</a></div></div></main></body>`);
    await page.evaluate(async ({ sources, files, yamlSource, note, quickadd, missingModule, failWidget, delayNative, delayRead, mode }) => {
        const map = new Map(files.map(file => [file.path, file]));
        for (const [filePath, text] of Object.entries(sources)) map.set(filePath, { path: filePath, text });
        map.set('Книги/_index.md', { path: 'Книги/_index.md', name: '_index.md', basename: '_index', extension: 'md', text: note, fm: {} });
        if (missingModule) map.delete('Книги/_system/lazy_base.js');
        if (failWidget) map.get('Книги/_system/reading_dashboard.js').text = 'module.exports = async () => { throw new Error("Итоги временно недоступны."); };';
        const yaml = { exports: {} }; new Function('module', yamlSource)(yaml);
        for (const [method, tag] of [['createDiv', 'div'], ['createEl', null]]) Object.defineProperty(HTMLElement.prototype, method, { configurable: true, value: function (arg, options = {}) {
            if (!tag) { const node = document.createElement(arg); if (options.cls) node.className = options.cls; if (options.text !== undefined) node.textContent = options.text; if (options.href) node.setAttribute('href', options.href); this.append(node); return node; }
            return this.createEl(tag, arg || {});
        } });
        Object.defineProperty(HTMLElement.prototype, 'empty', { configurable: true, value: function () { this.replaceChildren(); } });
        class Events {
            constructor() { this.refs = new Set(); }
            on(name, callback) { const ref = { emitter: this, name, callback }; this.refs.add(ref); return ref; }
            offref(ref) { this.refs.delete(ref); }
            emit(name, ...args) { for (const ref of [...this.refs]) if (ref.name === name) ref.callback(...args); }
        }
        const components = [];
        class Component {
            constructor() { this.cleanups = []; this.refs = []; this.children = new Set(); this.unloaded = false; components.push(this); }
            register(callback) { if (this.unloaded) callback(); else this.cleanups.push(callback); }
            registerEvent(ref) { if (this.unloaded) ref.emitter.offref(ref); else this.refs.push(ref); }
            addChild(child) { if (this.unloaded) child.unload(); else this.children.add(child); return child; }
            removeChild(child) { this.children.delete(child); child.unload?.(); return child; }
            load() {}
            unload() { if (this.unloaded) return; this.unloaded = true; for (const child of this.children) child.unload?.(); this.children.clear(); for (const callback of this.cleanups.splice(0)) callback(); for (const ref of this.refs.splice(0)) ref.emitter.offref(ref); }
        }
        const vault = Object.assign(new Events(), { getAbstractFileByPath: filePath => map.get(filePath), getMarkdownFiles: () => [...map.values()].filter(file => file.extension === 'md'), read: async file => {
                if (delayRead && file.path === 'Книги/_system/library-home.css') await new Promise(resolve => { window.fixture.resolveInitialRead = resolve; });
                return file.text;
            }, cachedRead: async file => file.text,
            process: async () => { window.fixture.writes++; throw new Error('Home must not write notes'); }, create: async () => { window.fixture.writes++; throw new Error('Home must not create notes'); } });
        const metadataCache = Object.assign(new Events(), { getFileCache: file => ({ frontmatter: file.fm }), getFirstLinkpathDest: target => map.get(target) || map.get(target + '.md') });
        const opened = [], choices = [], notices = [], nativeCalls = [];
        const app = { vault, metadataCache, workspace: { openLinkText: (...args) => opened.push(args), getActiveFile: () => map.get('Книги/_index.md') }, plugins: { plugins: quickadd ? { quickadd: { api: { executeChoice: async choice => choices.push(choice) } } } : {} } };
        const component = new Component();
        window.fixture = { map, app, component, components, opened, choices, notices, nativeCalls, writes: 0,
            modify(filePath, changes) { const file = map.get(filePath); Object.assign(file.fm, changes); file.stat.mtime++; metadataCache.emit('changed', file); vault.emit('modify', file); },
            remove(filePath) { const file = map.get(filePath); map.delete(filePath); if (file) vault.emit('delete', file); },
            add(file) { map.set(file.path, file); vault.emit('create', file); },
            knowledgeState() { return Object.values(app).find(value => value?.listeners instanceof Set && value?.cache instanceof Map); }
        };
        const obsidian = { Component, parseYaml: yaml.exports.parseYaml, Notice: class { constructor(value) { notices.push(String(value)); } }, MarkdownRenderer: { render: async (_app, markdown, container, _source, child) => {
            nativeCalls.push({ markdown, child });
            if (delayNative) await new Promise(resolve => { window.fixture.resolveNative = resolve; });
            const wrapper = container.createDiv({ cls: 'bases-table-container' });
            const table = wrapper.createEl('table', { cls: 'bases-table' }), head = table.createEl('thead').createEl('tr');
            for (const label of ['Произведение', 'Автор', 'Дата']) head.createEl('th', { text: label });
            const body = table.createEl('tbody');
            for (const file of files) { const row = body.createEl('tr'); row.createEl('td', { text: file.fm.title }); row.createEl('td', { text: file.fm.authors.join(', ') }); row.createEl('td', { text: file.fm.date }); }
        } } };
        const dv = { container: document.querySelector('#content'), component, current: () => ({ file: { path: 'Книги/_index.md' } }), paragraph: text => document.querySelector('#content').createEl('p', { text }) };
        const module = { exports: {} }; new Function('module', sources['Книги/_system/' + (mode === 'home' ? 'library_home.js' : 'reading_dashboard.js')])(module);
        window.renderPromise = module.exports({ app, dv, obsidian, mode }).then(handle => { window.handle = handle; }, error => { if (!missingModule) throw error; window.fixture.initialError = error.message; });
        if (!delayNative && !delayRead) await window.renderPromise;
    }, { sources, files, yamlSource, note, quickadd, missingModule, failWidget, delayNative, delayRead, mode });
    return { page, errors };
}

async function assertBounded(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The library fits the viewport');
    const overflowing = await page.evaluate(() => ['.markdown-preview-view', '.markdown-preview-sizer', '#content', '.book-home-ui', '.book-home-masthead', '.book-home-stats', '.book-home-recent', '.book-home-reading', '.book-home-overviews'].flatMap(selector => {
        const node = document.querySelector(selector);
        if (!node?.getClientRects().length || node.scrollWidth <= node.clientWidth + 1) return [];
        return [{ selector, client: node.clientWidth, scroll: node.scrollWidth }];
    }));
    assert.deepEqual(overflowing, [], 'Obsidian, Dataview and home panels have no horizontal scrolling');
}
async function dispose(page) {
    await page.evaluate(() => { window.handle?.dispose?.(); window.fixture.component.unload(); });
    assert.equal(await page.locator('.book-home-ui').count(), 0);
    for (const selector of ['#native-title', '#native-actions', '#native-stats', '#native-body']) assert.equal(await page.locator(selector).isVisible(), true, 'Unload restores ' + selector);
    const leaks = await page.evaluate(() => {
        const state = window.fixture.knowledgeState(), shared = new Set(state?.eventRefs || []);
        return { listeners: state?.listeners.size || 0, childComponents: window.fixture.components.reduce((sum, value) => sum + value.children.size, 0), scopedRefs: [...window.fixture.app.vault.refs, ...window.fixture.app.metadataCache.refs].filter(ref => !shared.has(ref)).length };
    });
    assert.deepEqual(leaks, { listeners: 0, childComponents: 0, scopedRefs: 0 }, 'Unload removes widget subscriptions and native Bases children');
}
async function screenshot(page, name) {
    if (!process.env.LIBRARY_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.LIBRARY_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.LIBRARY_SCREENSHOT_DIR, name), fullPage: true });
}

async function assertNumbers(page) {
    const numbers = await page.locator('.book-home-stat strong, .book-home-reading .book-dashboard-metric strong').evaluateAll(nodes => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const rgb = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        return nodes.map(node => { const style = getComputedStyle(node); return { font: style.fontFamily, weight: style.fontWeight, numeric: style.fontVariantNumeric, color: rgb(style.color), normal: rgb(style.getPropertyValue('--text-normal').trim()), accent: rgb(style.getPropertyValue('--text-accent').trim()) }; });
    });
    assert.equal(numbers.length, 8, 'All five header and three reading figures share the numeric style');
    const distance = (left, right) => Math.hypot(...left.map((channel, index) => channel - right[index]));
    for (const number of numbers) {
        assert.match(number.font, /mono|Consolas|Courier|Menlo/iu, 'Numbers use a monospace font');
        assert.equal(number.weight, '700', 'Numbers have the requested bold weight');
        assert.match(number.numeric, /tabular-nums/u, 'Digits align in columns');
        assert.match(number.numeric, /lining-nums/u, 'Digits share their baseline');
        const normalDistance = distance(number.color, number.normal), accentDistance = distance(number.accent, number.normal);
        assert(normalDistance > 1, 'Numbers have a subtle accent rather than the plain text color');
        assert(normalDistance / accentDistance > .47 && normalDistance / accentDistance < .63, 'Number color uses approximately 55% accent');
    }
    assert.equal(new Set(numbers.map(number => number.color.join(','))).size, 1, 'Header and reading figures have the same color');
}

async function layoutChecks(browser) {
    let count = 0;
    const smoke = process.argv.includes('--smoke');
    const layouts = smoke ? [{ width: 390, theme: 'theme-light' }, { width: 1024, theme: 'theme-dark' }] : [{ width: 320 }, { width: 390 }, { width: 1024 }, { width: 1280, pane: 390 }];
    for (const layout of layouts) for (const theme of smoke ? [layout.theme] : ['theme-light', 'theme-dark']) {
        const { page, errors } = await mount(browser, { ...layout, theme });
        try {
            assert.equal(await page.locator('.book-home-ui[data-ready="true"]').count(), 1);
            assert.equal(await page.getByRole('heading', { name: 'Библиотека', level: 1, exact: true }).count(), 1);
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            assert.equal(await page.locator('.inline-title').isVisible(), false);
            for (const selector of ['#native-title', '#native-actions', '#native-stats', '#native-body']) assert.equal(await page.locator(selector).isVisible(), false);
            for (const [key, value] of [['books', 2], ['authors', 2], ['fictionRead', 1], ['nonfictionRead', 1], ['reread', 0]]) assert.equal(await page.locator(`[data-stat="${key}"]`).textContent(), String(value));
            assert.deepEqual(await page.locator('.book-home-stats [data-stat]').evaluateAll(values => values.map(value => value.dataset.stat)), ['books', 'authors', 'fictionRead', 'nonfictionRead', 'reread']);
            assert.equal(await page.locator('[data-stat="series"], [data-stat="rated"]').count(), 0, 'Series and rated cells are removed from the home header');
            assert.deepEqual(await page.locator('.book-home-stat > span').allTextContents(), ['Произведений', 'Авторов', 'Художественных', 'Нон-фикшн', 'Перечитано']);
            const targets = await page.locator('.book-home-recent .books-base-toggle').getAttribute('aria-expanded');
            assert.equal(targets, 'true', 'Recent works start expanded');
            assert.match(await page.evaluate(() => window.fixture.nativeCalls[0].markdown), /Книги\/_system\/_Книги\.base#Главная/u);
            assert.equal(await page.locator('.book-home-recent .bases-table tbody tr').count(), 2);
            assert.equal(await page.locator('.book-home-quotes, .book-home-columns').count(), 0, 'The quote panel and its columns wrapper are removed');
            assert.equal(await page.getByRole('heading', { name: 'Из заметок', exact: true }).count(), 0);
            assert.equal(await page.getByRole('button', { name: 'Другая цитата', exact: true }).count(), 0);
            assert.deepEqual(await page.locator('.book-home-reading .book-dashboard-metric strong').allTextContents(), ['1', '1', '2']);
            const recentBox = await page.locator('.book-home-recent').boundingBox(), readingBox = await page.locator('.book-home-reading').boundingBox();
            assert(Math.abs(recentBox.x - readingBox.x) <= 1 && Math.abs(recentBox.width - readingBox.width) <= 1, 'Reading metrics use the full panel width');
            assert(readingBox.y >= recentBox.y + recentBox.height, 'Reading metrics sit below recent works');
            await assertNumbers(page);
            assert.match(await page.locator('.book-home-reading .book-dashboard-reading-list').textContent(), /Вторая книга/u);
            assert.equal(await page.locator('.book-home-reading select').count(), 0, 'Detailed period controls stay on the results page');
            const nav = page.locator('.book-home-masthead');
            for (const [label, target] of [['Цитаты', 'Книги/Цитаты'], ['Стихи', 'Книги/Стихи'], ['Итоги чтения', 'Книги/_system/Итоги чтения']]) assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('data-href'), target);
            assert.deepEqual(await page.locator('.book-home-view-links a').evaluateAll(links => links.map(link => link.dataset.href)), ['Все', 'Любимые', 'Без оценки', 'По году', 'По типу'].map(view => 'Книги/_system/_Книги.base#' + view), 'Catalogue shortcuts retain the canonical Base anchors');
            assert.equal(await page.locator('.book-home-overviews').getByRole('link', { name: 'Стихи', exact: true }).getAttribute('data-href'), 'Книги/Стихи');
            for (const label of ['Авторы', 'Серии', 'Экранизации']) assert.equal(await page.locator('.book-home-overviews').getByRole('link', { name: label, exact: true }).getAttribute('href'), 'obsidian://quickadd?choice=' + encodeURIComponent('Книги - ' + label));
            assert.deepEqual(await page.locator('.book-home-footer a').evaluateAll(links => links.map(link => link.dataset.href)), ['Книги/_system/Проверка библиотеки', 'Книги/_system/Журнал изменений']);
            const actions = [['Записать произведение', 'Книги - Добавить книгу'], ['Записать чтение', 'Книги - Добавить чтение'], ['Редактировать чтение', 'Книги - Редактировать чтение'], ['Добавить цитату', 'Книги - Добавить выписку'], ['Поиск по библиотеке', 'Книги - Поиск по библиотеке']];
            assert.deepEqual(await page.locator('.book-home-actions > a').evaluateAll(links => links.map(link => link.getAttribute('aria-label') || link.textContent.trim())), actions.map(([label]) => label), 'All actions remain visible in the requested order');
            assert.equal(await page.locator('.book-home-more').count(), 0, 'Home actions have no extra disclosure menu');
            const search = page.locator('.book-home-action.is-icon');
            assert.equal(await search.count(), 1);
            assert.equal(await search.getAttribute('aria-label'), 'Поиск по библиотеке');
            assert.equal(await search.getAttribute('title'), 'Поиск по библиотеке');
            assert.equal(await search.locator('svg').count(), 1, 'Search uses a visible vector icon');
            if (layout.pane || layout.width < 480) {
                const quoteBox = await page.getByRole('link', { name: 'Добавить цитату', exact: true }).boundingBox(), searchBox = await search.boundingBox();
                assert(Math.abs(quoteBox.y - searchBox.y) <= 1 && quoteBox.x + quoteBox.width <= searchBox.x + 1, 'Narrow layouts place the quote action and search icon on one row');
            }
            for (const [label, choice] of actions) {
                const link = page.getByRole('link', { name: label, exact: true });
                assert.equal(await link.isVisible(), true);
                assert.equal(await link.getAttribute('href'), 'obsidian://quickadd?choice=' + encodeURIComponent(choice)); await link.click();
            }
            assert.deepEqual(await page.evaluate(() => window.fixture.choices), actions.map(([, choice]) => choice));
            await assertBounded(page);
            if (!layout.pane && (layout.width === 390 && theme === 'theme-light' || layout.width === 1024)) await screenshot(page, `library-${layout.width}-${theme}.png`);
            assert.equal(await page.evaluate(() => window.fixture.writes), 0);
            await dispose(page); assert.deepEqual(errors, []); count++;
        } finally { await page.close(); }
    }
    return count;
}

async function liveChecks(browser) {
    const { page, errors } = await mount(browser);
    try {
        await page.evaluate(filePath => window.fixture.modify(filePath, { read_count: 2 }), bookFiles[0].path);
        await page.waitForFunction(() => document.querySelector('[data-stat="reread"]')?.textContent === '1');
        await page.locator('.book-home-views > summary').click();
        const reread = page.locator('.book-home-reread .books-base-toggle');
        await reread.waitFor({ state: 'visible' }); await reread.click();
        await page.waitForFunction(() => window.fixture.nativeCalls.length === 2);
        assert.match(await page.evaluate(() => window.fixture.nativeCalls[1].markdown), /Книги\/_system\/_Книги\.base#Перечитанные/u);
        await reread.click();
        await page.locator('.book-home-recent .books-base-toggle').click();
        assert.equal(await page.locator('.book-home-recent .bases-table').count(), 0, 'Collapsing a Base unloads its native child');
        await page.locator('.book-home-recent .books-base-toggle').click();
        assert.equal(await page.locator('.book-home-recent .bases-table').count(), 1);
        await page.evaluate(filePath => window.fixture.remove(filePath), bookFiles[1].path);
        await page.waitForFunction(() => document.querySelector('[data-stat="books"]')?.textContent === '1');
        assert.equal(await page.locator('[data-stat="fictionRead"]').textContent(), '1');
        assert.equal(await page.locator('[data-stat="nonfictionRead"]').textContent(), '0', 'Deleting a nonfiction work updates its read count');
        await page.waitForFunction(() => document.querySelectorAll('.book-home-reading .book-dashboard-metric strong')[2]?.textContent === '1');
        assert.deepEqual(await page.locator('.book-home-reading .book-dashboard-metric strong').allTextContents(), ['1', '1', '1'], 'Quote counts still update inside the reading metrics');
        await page.evaluate(file => window.fixture.add(file), bookFiles[1]);
        await page.waitForFunction(() => document.querySelector('[data-stat="books"]')?.textContent === '2');
        assert.equal(await page.locator('[data-stat="fictionRead"]').textContent(), '1');
        assert.equal(await page.locator('[data-stat="nonfictionRead"]').textContent(), '1', 'Adding a nonfiction work restores its read count');
        await page.waitForFunction(() => document.querySelectorAll('.book-home-reading .book-dashboard-metric strong')[2]?.textContent === '2');
        assert.deepEqual(await page.locator('.book-home-reading .book-dashboard-metric strong').allTextContents(), ['1', '1', '2']);
        await assertBounded(page); await dispose(page); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function breakdownChecks(browser) {
    function work(folder, type, dates) {
        const title = folder + ' ' + type;
        return fixture(`Книги/${folder}/${type}.md`, { title, authors: ['Автор'], work_type: type, read_count: dates.length, date: dates.at(-1) },
            dates.map((date, index) => ({ number: index + 1, date, rating: null, comment: '' })),
            { id: 'book-excerpt-breakdown-' + (folder === 'Non-fiction' ? 'nonfiction' : 'fiction') + '-' + type, text: 'Выписка', savedDate: `${year}-${month}-01` });
    }
    const files = [work('Художественные', 'book', [`${year}-${month}-01`]), work('Художественные', 'story', [`${year}-${month}-02`, `${year}-${month}-03`, String(year)]),
        work('Non-fiction', 'book', [`${year}-${month}-04`, String(year)]), work('Non-fiction', 'lecture', [`${year}-${month}-05`])];
    const monthly = [{ genre: 'fiction', count: 3, types: [['book', 1], ['story', 2]] }, { genre: 'nonfiction', count: 2, types: [['book', 1], ['lecture', 1]] }];
    const annual = [{ genre: 'fiction', count: 4, types: [['book', 1], ['story', 3]] }, { genre: 'nonfiction', count: 3, types: [['book', 2], ['lecture', 1]] }];
    async function contents(page, period) {
        return page.locator(`.book-dashboard-breakdown-period[data-period="${period}"] .book-dashboard-breakdown-genre`).evaluateAll(groups => groups.map(group => ({ genre: group.dataset.genre,
            count: Number(group.querySelector('.book-dashboard-breakdown-total').textContent), types: [...group.querySelectorAll('.book-dashboard-breakdown-type')].map(row => [row.dataset.type, Number(row.querySelector('dd').textContent)]) })));
    }
    async function noEmptyTypes(page) {
        assert(await page.locator('.book-dashboard-breakdown-total, .book-dashboard-breakdown-count').evaluateAll(nodes => nodes.every(node => Number(node.textContent) > 0)), 'Empty genres and types are omitted');
        const overflow = await page.locator('.book-dashboard-breakdowns, .book-dashboard-breakdown-period, .book-dashboard-breakdown-groups, .book-dashboard-breakdown-genre').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className));
        assert.deepEqual(overflow, [], 'Genre and type breakdowns fit their containers');
    }
    for (const layout of [{ width: 320, theme: 'theme-light' }, { width: 1024, theme: 'theme-dark' }]) {
        const { page, errors } = await mount(browser, { ...layout, files });
        try {
            assert.deepEqual(await contents(page, `${year}-${month}`), monthly);
            assert.deepEqual(await contents(page, String(year)), annual, 'Year-only dates belong to the year, without being put in the current month');
            assert.equal(await page.locator('.book-dashboard-breakdown-type[data-type="article"], .book-dashboard-breakdown-type[data-type="other"]').count(), 0);
            await noEmptyTypes(page); await assertBounded(page);
            await screenshot(page, `library-breakdown-${layout.width}-${layout.theme}.png`);
            if (layout.width === 1024) {
                await page.evaluate(paths => paths.forEach(filePath => window.fixture.remove(filePath)), files.slice(2).map(file => file.path));
                await page.waitForFunction(() => document.querySelectorAll('.book-dashboard-breakdown-genre[data-genre="nonfiction"]').length === 0);
                assert.deepEqual(await contents(page, String(year)), annual.slice(0, 1));
                await page.evaluate(filePath => window.fixture.remove(filePath), files[1].path);
                await page.waitForFunction(() => document.querySelectorAll('.book-dashboard-breakdown-type[data-type="story"]').length === 0);
                assert.deepEqual(await contents(page, `${year}-${month}`), [{ genre: 'fiction', count: 1, types: [['book', 1]] }]);
                await page.evaluate(filePath => window.fixture.remove(filePath), files[0].path);
                await page.waitForFunction(() => document.querySelectorAll('.book-dashboard-breakdowns').length === 0);
                await page.evaluate(values => values.forEach(file => window.fixture.add(file)), files);
                await page.waitForFunction(period => document.querySelector(`.book-dashboard-breakdown-period[data-period="${period}"] [data-genre="fiction"] .book-dashboard-breakdown-total`)?.textContent === '3', `${year}-${month}`);
                assert.deepEqual(await contents(page, String(year)), annual);
            }
            await noEmptyTypes(page); assert.equal(await page.evaluate(() => window.fixture.writes), 0); await dispose(page); assert.deepEqual(errors, []);
        } finally { await page.close(); }
    }
    const older = work('Non-fiction', 'article', [`${year - 1}-${month}-08`]);
    const { page, errors } = await mount(browser, { files: [...files, older], mode: 'index' });
    try {
        const all = [annual[0], { genre: 'nonfiction', count: 4, types: [['book', 2], ['lecture', 1], ['article', 1]] }];
        assert.deepEqual(await contents(page, 'all'), all);
        await page.getByRole('combobox', { name: 'Год чтения', exact: true }).selectOption(String(year));
        assert.deepEqual(await contents(page, String(year)), annual);
        await page.getByRole('combobox', { name: 'Месяц чтения', exact: true }).selectOption(month);
        assert.deepEqual(await contents(page, `${year}-${month}`), monthly);
        await page.getByRole('combobox', { name: 'Год чтения', exact: true }).selectOption(String(year - 1));
        assert.deepEqual(await contents(page, `${year - 1}-${month}`), [{ genre: 'nonfiction', count: 1, types: [['article', 1]] }]);
        await page.getByRole('combobox', { name: 'Месяц чтения', exact: true }).selectOption(month === '12' ? '11' : '12');
        assert.equal(await page.locator('.book-dashboard-breakdown-period').count(), 0, 'An empty selected period has no genre or type rows');
        await page.getByRole('button', { name: 'За всё время', exact: true }).click();
        assert.deepEqual(await contents(page, 'all'), all); await noEmptyTypes(page);
        assert.equal(await page.evaluate(() => window.fixture.writes), 0);
        await page.evaluate(() => window.fixture.component.unload()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function fallbackChecks(browser) {
    for (const options of [{ missingModule: true }, { quickadd: false }, { failWidget: true }]) {
        const { page, errors } = await mount(browser, options);
        try {
            if (options.missingModule) {
                assert.equal(await page.locator('.book-home-ui').count(), 0, 'Missing modules preserve the native page');
                assert.equal(await page.locator('#native-title').isVisible(), true);
                assert.equal(await page.locator('#native-stats').isVisible(), true);
                assert.deepEqual(await page.locator('.books-actions-fallback a').evaluateAll(links => links.map(link => new URL(link.href).searchParams.get('choice'))), ['Книги - Добавить книгу', 'Книги - Добавить чтение', 'Книги - Редактировать чтение', 'Книги - Добавить выписку', 'Книги - Поиск по библиотеке'], 'Native fallback retains the same action order');
                assert.equal(await page.locator('#native-actions').getByRole('link', { name: 'Поиск по библиотеке', exact: true }).isVisible(), true);
                assert.match(await page.locator('#native-actions').textContent(), /Добавить цитату/u);
                assert(await page.evaluate(() => Boolean(window.fixture.initialError)));
            } else if (options.quickadd === false) {
                const link = page.getByRole('link', { name: 'Записать произведение', exact: true });
                assert.equal(await link.getAttribute('href'), 'obsidian://quickadd?choice=' + encodeURIComponent('Книги - Добавить книгу'));
                assert.equal(await link.isVisible(), true, 'QuickAdd URI actions remain available without its JavaScript API');
                await dispose(page);
            } else {
                assert.match(await page.locator('.book-home-widget-error').textContent(), /Итоги временно недоступны/u);
                assert.equal(await page.locator('[data-stat="books"]').textContent(), '2');
                assert.equal(await page.getByRole('link', { name: 'Записать произведение', exact: true }).isVisible(), true);
                await dispose(page);
            }
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    }
}

async function lateCleanupChecks(browser) {
    const { page, errors } = await mount(browser, { delayNative: true });
    try {
        await page.waitForFunction(() => typeof window.fixture.resolveNative === 'function');
        await page.evaluate(() => window.fixture.component.unload());
        await page.evaluate(async () => { window.fixture.resolveNative(); await window.renderPromise; });
        assert.equal(await page.locator('.book-home-ui').count(), 0, 'A late native render cannot resurrect an unloaded page');
        const leaks = await page.evaluate(() => ({ children: window.fixture.components.reduce((sum, item) => sum + item.children.size, 0), subscribers: window.fixture.knowledgeState()?.listeners.size || 0 }));
        assert.deepEqual(leaks, { children: 0, subscribers: 0 });
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function initialCleanupChecks(browser) {
    const { page, errors } = await mount(browser, { delayRead: true });
    try {
        await page.waitForFunction(() => typeof window.fixture.resolveInitialRead === 'function');
        assert.equal(await page.locator('.book-home-ui').count(), 0, 'Module reads finish before the enhanced page is created');
        await page.evaluate(() => window.fixture.component.unload());
        await page.evaluate(async () => { window.fixture.resolveInitialRead(); await window.renderPromise; });
        await dispose(page);
        assert.equal(await page.evaluate(() => window.fixture.writes), 0);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function main() {
    assert.match(note, /<!-- BOOK-HOME-STATS:START -->[\s\S]*<!-- BOOK-HOME-STATS:END -->/u, 'Native stats markers remain available for the snapshot updater');
    const blocks = [...note.matchAll(/\x60{3}dataviewjs\r?\n([\s\S]*?)\x60{3}/g)];
    assert.equal(blocks.length, 1, 'The home page uses one composite Dataview block');
    new (Object.getPrototypeOf(async () => {}).constructor)('dv', 'app', 'require', blocks[0][1]);
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        const layouts = await layoutChecks(browser);
        if (process.argv.includes('--layouts-only')) {
            if (process.argv.includes('--live')) await liveChecks(browser);
            if (process.argv.includes('--breakdown')) await breakdownChecks(browser);
            console.log(`${layouts} library Chromium layouts passed: full-width reading metrics, removed quote panel, Things/gruvbox/Dataview, hidden properties, action order, accessible search icon${process.argv.includes('--live') ? ', live work/quote counts and widget cleanup' : ''}${process.argv.includes('--breakdown') ? ', genre/type breakdowns, empty types, live updates and selected periods' : ''}.`);
        }
        else {
            await liveChecks(browser); await fallbackChecks(browser); await lateCleanupChecks(browser); await initialCleanupChecks(browser);
            console.log(`${layouts} library Chromium layouts passed: real core/reading widgets, retained quote metrics, Things/gruvbox/Dataview, narrow panes, hidden properties, live stats, QuickAdd URI fallback, native Bases targets/cleanup, error fallback and late unload.`);
        }
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
