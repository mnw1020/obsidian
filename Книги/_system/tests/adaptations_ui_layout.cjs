const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { fromText } = require('./yaml_fixture.cjs');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const sources = Object.fromEntries(['adaptations_ui.js', 'book_core.js', 'authors-ui.css', 'books-library.css'].map(name => ['Книги/_system/' + name, fs.readFileSync(path.join(root, '_system', name), 'utf8')]));
const bookPaths = ['Художественные/Лю Цысинь/Память о прошлом Земли. 03. Вечная жизнь смерти.md', 'Художественные/Филип Пулман/Тёмные начала. 01. Северное сияние.md'];
function fixture(filePath, diskPath) {
    return { path: filePath, basename: filePath.split('/').at(-1).replace(/\.md$/, ''), extension: 'md', fm: fromText(fs.readFileSync(diskPath, 'utf8')) };
}
const books = bookPaths.map(filePath => fixture('Книги/' + filePath, path.join(root, filePath)));
const mediaPaths = [...new Set(books.flatMap(file => file.fm.adaptations.map(link => link.replace(/^\[\[([^\]|]+).*$/, '$1') + '.md')))];
const movies = mediaPaths.map(filePath => fixture(filePath, path.join(root, '..', filePath)));
const files = [...books, ...movies];
async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        for (const width of [320, 390, 1100]) {
            const page = await browser.newPage({ viewport: { width, height: 1200 } }), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#20242a;color:#eee;font:16px/1.5 Arial;--background-primary:#20242a;--background-secondary:#292e36;--background-modifier-border:#454b56;--text-muted:#b4b8c2;--text-normal:#eee;--text-accent:#efa76b;--interactive-accent:#efa76b;--text-on-accent:#20242a}main{padding:16px;max-width:1000px;margin:auto}a{color:#efa76b}button,input,select{font:inherit}</style><body class="theme-dark"><main class="markdown-preview-view books-library"><div id="content"></div></main></body>');
            await page.evaluate(async ({ files, sources }) => {
                class Events {
                    constructor() { this.refs = new Set(); }
                    on(name, callback) { const ref = { name, callback }; this.refs.add(ref); return ref; }
                    offref(ref) { this.refs.delete(ref); }
                    emit(name, ...args) { for (const ref of [...this.refs]) if (ref.name === name) ref.callback(...args); }
                }
                const map = new Map(files.map(file => [file.path, file]));
                for (const [filePath, text] of Object.entries(sources)) map.set(filePath, { path: filePath, text });
                const resolve = target => [...map.values()].find(file => file.path === target || file.path === target + '.md' || file.basename === target);
                const vault = Object.assign(new Events(), { getAbstractFileByPath: target => map.get(target), getMarkdownFiles: () => [...map.values()].filter(file => file.extension === 'md'), read: async file => file.text });
                const metadataCache = Object.assign(new Events(), { getFileCache: file => ({ frontmatter: file.fm }), getFirstLinkpathDest: resolve });
                const opened = [], commands = [], app = { vault, metadataCache, workspace: { openLinkText: (...args) => opened.push(args) },
                    plugins: { plugins: { quickadd: { api: { executeChoice: async (...args) => commands.push(args) } } } } };
                const cleanups = [], component = { register: callback => cleanups.push(callback) };
                const module = { exports: {} }; new Function('module', sources['Книги/_system/adaptations_ui.js'])(module);
                const container = document.querySelector('#content'), dv = { container, component, current: () => ({ file: { path: 'Книги/_system/Экранизации.md' } }) };
                let originalCalls = 0;
                const original = component.render = async () => { originalCalls++; container.replaceChildren(); window.handle = await module.exports({ app, dv }); };
                window.fixture = { map, app, component, opened, commands, original, cleanups, originalCalls: () => originalCalls,
                    unload() { for (const callback of cleanups) callback(); },
                    modify(filePath, changes) { const file = map.get(filePath); Object.assign(file.fm, changes); metadataCache.emit('changed', file); } };
                await component.render();
            }, { files, sources });
            assert.equal(await page.locator('.book-adaptations-card').count(), 2);
            assert.equal(await page.locator('.book-adaptations-media').count(), 4);
            await page.locator('.book-authors-author-link').filter({ hasText: 'Лю Цысинь' }).click();
            assert.deepEqual(await page.evaluate(() => window.fixture.commands.at(-1)), ['Книги - Открыть автора', { author: 'Лю Цысинь' }]);
            await page.evaluate(() => {
                const host = document.querySelector('main');
                for (const cls of ['metadata-container', 'frontmatter-container']) {
                    const node = document.createElement('div'); node.className = cls; node.textContent = 'YAML'; host.prepend(node);
                }
            });
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            assert.equal(await page.locator('.frontmatter-container').isVisible(), false);
            assert.equal(await page.locator('.book-authors-stat').count(), 4);
            assert.deepEqual(await page.locator('.book-authors-stat-value').allTextContents(), ['2', '4', '0', '4']);
            assert.deepEqual((await page.locator('.book-adaptations-media-rating').allTextContents()).sort(), ['10/10', '7/10', '8/10', '9/10']);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
            if (process.env.ADAPTATIONS_SCREENSHOT_DIR && [390, 1100].includes(width)) {
                fs.mkdirSync(process.env.ADAPTATIONS_SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.ADAPTATIONS_SCREENSHOT_DIR, `adaptations-${width}.png`), fullPage: true });
            }
            await page.getByRole('button', { name: 'Фильмы', exact: true }).click();
            assert.equal(await page.locator('.book-adaptations-card').count(), 0);
            assert.equal(await page.getByText('Ничего не найдено', { exact: true }).count(), 1);
            await page.getByRole('button', { name: 'Сериалы', exact: true }).click();
            assert.equal(await page.locator('.book-adaptations-card').count(), 2);
            await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill('Задача 3 тел');
            assert.equal(await page.locator('.book-adaptations-card').count(), 1);
            assert.equal(await page.locator('.book-adaptations-media').count(), 3, 'Searching a media title keeps the full work together');
            await page.getByText('Задача 3 тел', { exact: true }).click();
            assert.deepEqual(await page.evaluate(() => window.fixture.opened.at(-1)), ['Кино/Media/Задача 3 тел', 'Книги/_system/Экранизации.md', false]);
            await page.evaluate(async () => { const root = document.querySelector('.book-adaptations-ui'); await window.fixture.component.render(); if (document.querySelector('.book-adaptations-ui') !== root || window.fixture.originalCalls() !== 1) throw new Error('Dataview refresh rebuilt the view'); });
            await page.getByRole('searchbox', { name: 'Поиск', exact: true }).fill('Лю Цысинь');
            await page.evaluate(() => window.fixture.modify('Кино/Media/Задача 3 тел.md', { Оценка: '6' }));
            await page.waitForFunction(() => document.querySelector('[data-href="Кино/Media/Задача 3 тел"]')?.closest('li')?.querySelector('.book-adaptations-media-rating')?.textContent === '6/10');
            assert.equal(await page.getByRole('searchbox').inputValue(), 'Лю Цысинь');
            assert.equal(await page.getByRole('button', { name: 'Сериалы', exact: true }).getAttribute('aria-pressed'), 'true');
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            assert.equal(await page.locator('.book-adaptations-card').count(), 2);
            await page.evaluate(() => {
                window.fixture.unload();
                if (window.fixture.app.vault.refs.size || window.fixture.app.metadataCache.refs.size) throw new Error('Leaked vault subscriptions');
                if (window.fixture.component.render !== window.fixture.original) throw new Error('Dataview render not restored');
            });
            assert.deepEqual(errors, []);
            await page.close();
        }
        console.log('3 browser widths passed: 2 grouped works / 4 adaptations, search, filters, links, live ratings, refresh persistence, cleanup, no overflow.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
