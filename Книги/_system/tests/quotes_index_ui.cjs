const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fromText } = require('./yaml_fixture.cjs');
const knowledge = require('../knowledge.js'), root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '_system/knowledge.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '_system/book_core.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/quotes-index.css'), 'utf8');
const libraryCss = fs.readFileSync(path.join(root, '_system/books-library.css'), 'utf8');
const thingsCss = fs.readFileSync(path.resolve(root, '../.obsidian/themes/Things/theme.css'), 'utf8');
const gruvboxCss = fs.readFileSync(path.resolve(root, '../.obsidian/snippets/Obsidian gruvbox.css'), 'utf8');
const dataviewCss = fs.readFileSync(path.resolve(root, '../.obsidian/plugins/dataview/styles.css'), 'utf8');
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:var(--background-primary);color:var(--text-normal);--editor-font:"JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e}main{width:100%;max-width:1100px;margin:auto;padding:24px;min-width:0}.markdown-preview-sizer{width:100%;max-width:820px;margin-inline:auto;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b}`;

function realFiles() {
    const files = [];
    function scan(folder) {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) scan(full);
            else if (entry.name.endsWith('.md')) {
                const text = fs.readFileSync(full, 'utf8');
                files.push({ path: 'Книги/' + path.relative(root, full).replaceAll('\\', '/'), basename: entry.name.slice(0, -3), extension: 'md', text, fm: fromText(text), stat: { mtime: 1 } });
            }
        }
    }
    for (const folder of ['Художественные', 'Non-fiction', 'Цитаты']) scan(path.join(root, folder));
    return files;
}

function makeFile(filePath, fm, excerpts) {
    return { path: filePath, basename: filePath.split('/').at(-1).replace(/\.md$/u, ''), extension: 'md', stat: { mtime: 1 }, fm,
        text: excerpts.map(excerpt => knowledge.renderExcerpt(excerpt)).join('\n') };
}
function syntheticFiles() {
    return Array.from({ length: 130 }, (_, index) => {
        const suffix = String(index).padStart(3, '0');
        const excerpts = Array.from({ length: 9 }, (_, number) => ({
            id: `book-excerpt-synthetic-${suffix}-${number}`,
            text: index === 0 && number === 0 ? 'Начало длинной цитаты. ' + 'Полный текст длинной цитаты для проверки переноса и поиска. '.repeat(120) + '\nУникальныйХвост в самом конце.' : `Цитата ${suffix}/${number}. Текст для проверки большого каталога.`,
            section: `${index < 65 ? 'Психология' : 'Практика'}/Раздел ${suffix}/Подраздел ${number}`,
            themes: ['Не раздел', 'Служебная метка'], conclusion: number === 0 ? `Вывод ${suffix}` : '', location: `Глава ${number + 1}`, savedDate: number === 8 ? '' : '2026-10-05'
        }));
        return makeFile(`Книги/Non-fiction/synthetic-${suffix}.md`, { title: index >= 128 ? 'Одинаковое название' : `Источник ${suffix}`, authors: [`Автор ${suffix}`] }, excerpts);
    });
}

async function mount(browser, files, { width = 1024, theme = 'theme-light', embeddedWidth } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const paneStyle = embeddedWidth ? ` style="width:${Number(embeddedWidth)}px;margin-inline:0"` : '';
    await page.setContent(`<style>${baseline}</style><style>${thingsCss}</style><style>${gruvboxCss}</style><style>${dataviewCss}</style><style>${libraryCss}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered book-quotes-page book-quotes-tree-page"${paneStyle}><div class="markdown-preview-sizer markdown-preview-section"><div class="metadata-container">Свойства<div>cssclasses: book-quotes-page</div></div><div class="inline-title">_Цитаты</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div></div></main></body>`);
    await page.evaluate(async ({ source, core, css, files }) => {
        const map = new Map(files.map(file => [file.path, file]));
        map.set('Книги/_system/book_core.js', { path: 'Книги/_system/book_core.js', text: core });
        map.set('Книги/_system/quotes-index.css', { path: 'Книги/_system/quotes-index.css', text: css });
        map.set('Книги/_system/quote_edit.js', { path: 'Книги/_system/quote_edit.js', text: 'module.exports = async ({entry, onSaved}) => { window.fixture.editCalls.push({entry, onSaved}); };' });
        map.get('Книги/_system/quote_edit.js').text += ' module.exports.deleteQuote = async args => { window.fixture.deleteCalls.push(args); };';
        map.set('Книги/_system/quote_add.js', { path: 'Книги/_system/quote_add.js', text: 'module.exports = async args => { window.fixture.createCalls.push(args); };' });
        map.set('Книги/_system/QuickAdd/open_author.js', { path: 'Книги/_system/QuickAdd/open_author.js', text: 'module.exports = async ({app, variables}) => { window.fixture.authorCalls.push(variables.author); app.workspace.getLeaf(false); };' });
        const events = new Map(), opened = [], disposers = [], editCalls = [], deleteCalls = [], createCalls = [], authorCalls = [], authorLeafCalls = [];
        const on = (name, callback) => { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); return { name, callback }; };
        const emit = (name, ...args) => { for (const callback of events.get(name) || []) callback(...args); };
        const app = { vault: { getAbstractFileByPath: filePath => map.get(filePath), read: async file => file.text, getMarkdownFiles: () => [...map.values()].filter(file => file.extension === 'md'), on },
            metadataCache: { getFileCache: file => ({ frontmatter: file.fm }), on }, workspace: { openLinkText: (...args) => { opened.push(args); }, getLeaf: newLeaf => { authorLeafCalls.push(newLeaf); return { openFile: async () => {} }; } } };
        const module = { exports: {} }; new Function('module', source)(module);
        window.fixture = { map, app, opened, emit, disposers, editCalls, deleteCalls, createCalls, authorCalls, authorLeafCalls,
            remove(paths) { for (const filePath of paths) { const file = map.get(filePath); map.delete(filePath); if (file) emit('delete', file); } },
            add(file) { map.set(file.path, file); emit('create', file); },
            modify(filePath, text) { const file = map.get(filePath); file.text = text; file.stat.mtime++; emit('modify', file); } };
        window.handle = await module.exports({ app, obsidian: {}, dv: { container: document.querySelector('#content'), component: { register: callback => disposers.push(callback) } }, mode: 'index' });
    }, { source, core, css, files });
    return { page, errors };
}

async function expectStatus(page, value) {
    const range = value.match(/^(\d+)–(\d+) из (\d+) цитат$/u);
    if (range && Number(range[3]) <= 20) {
        const total = Number(range[3]);
        assert.equal(Number(range[1]), total ? 1 : 0, 'A single-page expectation starts at its first quote');
        assert.equal(Number(range[2]), total, 'A single-page expectation includes exactly the expected number of quotes');
        const noun = total % 10 === 1 && total % 100 !== 11 ? 'цитата' : [2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100) ? 'цитаты' : 'цитат';
        value = `${total} ${noun}`;
    }
    await page.waitForFunction(expected => document.querySelector('.book-quotes-status')?.textContent === expected, value);
    assert.equal(await page.locator('.book-quotes-status').textContent(), value);
}
async function rowTargets(page) { return page.locator('.book-quotes-row a.book-quote-work-link').evaluateAll(links => links.map(link => link.getAttribute('data-href'))); }
function treeNode(page, key) { return page.locator(`.book-quotes-tree-row[data-node-key=${JSON.stringify(key)}]`); }
async function showNavigation(page) {
    const button = page.getByRole('button', { name: 'Навигация', exact: true });
    if (await button.isVisible() && await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function choose(page, key) { await showNavigation(page); await treeNode(page, key).click(); }
async function mode(page, label) { await page.locator('.book-quotes-modes').getByRole('button', { name: label, exact: true }).click(); }
async function search(page, query) {
    const input = page.getByLabel('Поиск цитат', { exact: true });
    if (!(await input.isVisible())) await page.getByRole('button', { name: 'Поиск', exact: true }).click();
    await input.fill(query);
}
async function assertBounded(page, expectedRows, maxDom = 1200) {
    assert.equal(await page.locator('.book-quotes-row').count(), expectedRows);
    assert.equal(await page.locator('.book-quotes-row .book-quote-text').count(), expectedRows);
    assert.equal(await page.locator('.book-quotes-row a.book-quote-work-link').count(), expectedRows);
    assert.equal(await page.getByRole('button', { name: 'Редактировать цитату', exact: true }).count(), expectedRows);
    assert.equal(await page.getByRole('button', { name: 'Удалить цитату', exact: true }).count(), expectedRows);
    assert((await page.locator('.book-quotes-index *').count()) < maxDom, 'The catalogue DOM stays bounded');
    assert.equal(await page.locator('.book-quotes-section-tile, .book-quotes-group, .book-quote-details').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The page fits its viewport');
    const overflowing = await page.evaluate(() => ['.markdown-preview-view', '.markdown-preview-sizer', '#content', '.book-quotes-index', '.book-quotes-shell', '.book-quotes-reading', '.book-knowledge-results', '.book-quotes-tree'].flatMap(selector => {
        const element = document.querySelector(selector);
        if (!element || !element.getClientRects().length || element.scrollWidth <= element.clientWidth) return [];
        return [{ selector, client: element.clientWidth, scroll: element.scrollWidth }];
    }));
    assert.deepEqual(overflowing, [], 'Nested Obsidian and Dataview containers do not have horizontal scrolling');
}

async function assertMasthead(page) {
    assert.equal(await page.getByRole('heading', { name: 'Цитаты', level: 1, exact: true }).count(), 1);
    assert.equal(await page.locator('.book-quotes-masthead .book-quotes-subtitle').textContent(), 'Из книг и собственных записей');
    const nav = page.getByRole('navigation', { name: 'Навигация библиотеки', exact: true });
    assert.equal(await nav.getByRole('link', { name: '← Библиотека', exact: true }).getAttribute('data-href'), 'Книги/_index');
    assert.equal(await nav.getByRole('link', { name: 'Итоги чтения', exact: true }).getAttribute('data-href'), 'Книги/_system/Итоги чтения');
    assert.equal(await page.getByRole('link', { name: '+ Добавить цитату', exact: true }).getAttribute('href'), 'obsidian://quickadd?choice=' + encodeURIComponent('Книги - Добавить выписку'));
    assert.equal(await page.locator('.metadata-container').isVisible(), false, 'Note properties are hidden on this page');
    assert.equal(await page.locator('.inline-title').isVisible(), false, 'The raw filename title is hidden');
}
async function screenshot(page, name) {
    if (!process.env.QUOTES_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.QUOTES_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.QUOTES_SCREENSHOT_DIR, name) });
}

async function realCollectionChecks(browser) {
    const files = realFiles(); let checks = 0;
    for (const width of [320, 390, 1024]) for (const theme of ['theme-light', 'theme-dark']) {
        const { page, errors } = await mount(browser, files, { width, theme });
        try {
            await expectStatus(page, '1–11 из 11 цитат'); await assertBounded(page, 11);
            await assertMasthead(page);
            assert.equal(await page.locator('.book-quotes-reading-title').textContent(), 'Мотивация');
            assert.equal(await page.locator('.book-quotes-modes').getByRole('button', { name: 'Разделы', exact: true }).getAttribute('aria-pressed'), 'true');
            assert.equal(await page.getByLabel('Поиск цитат', { exact: true }).isVisible(), false);
            const navigation = page.getByRole('button', { name: 'Навигация', exact: true });
            if (width < 600) {
                assert.equal(await page.locator('.book-quotes-tree').isVisible(), false);
                await navigation.click(); assert.equal(await navigation.getAttribute('aria-expanded'), 'true');
                assert.equal(await page.locator('.book-quotes-tree').isVisible(), true);
            } else {
                const treeBox = await page.locator('.book-quotes-tree').boundingBox(), readingBox = await page.locator('.book-quotes-reading').boundingBox();
                assert(treeBox.x + treeBox.width <= readingBox.x, 'Desktop tree and reading are adjacent columns');
            }
            for (const [key, count] of [['мотивация', 11], ['мышление', 1], ['отношения', 1], ['юмор', 4], ['воспитание', 1]]) {
                assert.equal(await treeNode(page, `section:${key}`).locator('.book-quotes-tree-count').textContent(), String(count));
            }
            await choose(page, 'section:воспитание'); await expectStatus(page, '1–1 из 1 цитат');
            if (width < 600) {
                assert.equal(await navigation.getAttribute('aria-expanded'), 'false', 'Selecting a mobile node closes navigation');
                assert.equal(await page.locator('.book-quotes-tree').isVisible(), false);
                await showNavigation(page);
                assert.equal(await navigation.getAttribute('aria-expanded'), 'true', 'Navigation reopens after a selection');
                assert.equal(await page.locator('.book-quotes-tree').isVisible(), true);
                await navigation.click();
            }
            assert.match(await page.locator('.book-quote-text').textContent(), /мелкой моторики/u);
            await search(page, 'мелкой моторики'); await expectStatus(page, '1–1 из 1 цитат');
            assert.equal(await page.locator('.book-quotes-reading-title').textContent(), 'Результаты поиска');
            await page.getByRole('button', { name: 'Сбросить поиск', exact: true }).click();
            await choose(page, 'section:мотивация'); await expectStatus(page, '1–11 из 11 цитат');
            if (theme === 'theme-light' && [390, 1024].includes(width)) {
                if (await page.getByLabel('Поиск цитат', { exact: true }).isVisible()) await page.getByRole('button', { name: 'Поиск', exact: true }).click();
                await page.evaluate(() => window.scrollTo(0, 0));
                await screenshot(page, width === 390 ? 'quotes-tree-mobile.png' : 'quotes-tree-desktop.png');
                if (width === 390) { await showNavigation(page); await screenshot(page, 'quotes-tree-mobile-navigation.png'); }
            }
            if (theme === 'theme-dark' && width === 1024) { await page.evaluate(() => window.scrollTo(0, 0)); await screenshot(page, 'quotes-tree-desktop-dark.png'); }
            await mode(page, 'Источники'); await showNavigation(page);
            assert.equal(await treeNode(page, 'source:unknown').locator('.book-quotes-tree-label').textContent(), 'Без источника');
            assert.equal(await page.locator('.book-quotes-tree-label').filter({ hasText: /^Мотивация$/u }).count(), 0, 'Old collection titles are not fictional sources');
            const book = files.find(file => file.path === 'Книги/Художественные/Леонид Каганов/Гастарбайтер.md');
            const quotes = knowledge.parseExcerpts(book.text);
            await choose(page, 'source:' + book.path); await expectStatus(page, `1–${quotes.length} из ${quotes.length} цитат`);
            assert.deepEqual(await page.locator('.book-quote-author-link').allTextContents(), Array(quotes.length).fill('Леонид Каганов'));
            assert.deepEqual(await page.locator('.book-quote-conclusion p').allTextContents(), quotes.filter(quote => quote.conclusion).map(quote => quote.conclusion));
            if (theme === 'theme-light' && [390, 1024].includes(width)) {
                await page.evaluate(() => window.scrollTo(0, 0));
                await screenshot(page, width === 390 ? 'quotes-tree-source-mobile.png' : 'quotes-tree-source-desktop.png');
            }
            await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []); checks++;
        } finally { await page.close(); }
    }
    return checks;
}

async function embeddedPaneChecks(browser) {
    const files = realFiles(), book = files.find(file => file.path === 'Книги/Художественные/Леонид Каганов/Гастарбайтер.md');
    const count = knowledge.parseExcerpts(book.text).length;
    let checks = 0;
    for (const embeddedWidth of [320, 390, 500, 600, 650, 700]) for (const theme of ['theme-light', 'theme-dark']) {
        const { page, errors } = await mount(browser, files, { width: 1280, embeddedWidth, theme });
        try {
            await assertMasthead(page); await expectStatus(page, '1–11 из 11 цитат'); await assertBounded(page, 11);
            assert.equal(await page.getByRole('button', { name: 'Навигация', exact: true }).isVisible(), true, 'The embedded container controls the narrow layout in a wide viewport');
            assert.equal(await page.locator('.book-quotes-tree').isVisible(), false);
            await showNavigation(page); await assertBounded(page, 11);
            await mode(page, 'Источники'); await choose(page, 'source:' + book.path);
            await expectStatus(page, `1–${count} из ${count} цитат`); await assertBounded(page, count);
            await search(page, 'мелкой моторики'); await expectStatus(page, '1–1 из 1 цитат'); await assertBounded(page, 1);
            await page.getByRole('button', { name: 'Сбросить поиск', exact: true }).click();
            await choose(page, 'source:' + book.path);
            if (embeddedWidth === 650 && theme === 'theme-light') {
                await page.getByRole('button', { name: 'Поиск', exact: true }).click();
                await showNavigation(page); await page.evaluate(() => window.scrollTo(0, 0));
                await screenshot(page, 'quotes-tree-embedded-pane.png');
            }
            await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []); checks++;
        } finally { await page.close(); }
    }
    return checks;
}

async function largeCollectionChecks(browser) {
    const files = syntheticFiles(), total = 1170, { page, errors } = await mount(browser, files);
    try {
        await expectStatus(page, '1–20 из 585 цитат'); await assertBounded(page, 20);
        assert.equal(await page.locator('.book-quotes-tree-label').filter({ hasText: 'Не раздел' }).count(), 0, 'Themes are not sections');
        const rootBranch = page.locator('.book-quotes-tree-branch').filter({ has: page.locator('summary[aria-label="Подразделы: Психология"]') }).first();
        assert.equal(await rootBranch.getAttribute('open'), null);
        await choose(page, 'section:психология');
        assert.equal(await rootBranch.getAttribute('open'), null, 'Selecting a branch does not expand it');
        await rootBranch.evaluate(branch => { branch.open = true; });
        await treeNode(page, 'section:психология/раздел 000').waitFor({ state: 'visible' });
        assert.equal(await rootBranch.locator(':scope > .book-quotes-tree-children > .book-quotes-tree-branch').count(), 40);
        assert.equal(await rootBranch.getByRole('button', { name: 'Ещё разделы', exact: true }).count(), 1);
        await assertBounded(page, 20);
        await rootBranch.getByRole('button', { name: 'Ещё разделы', exact: true }).click();
        assert.equal(await rootBranch.locator(':scope > .book-quotes-tree-children > .book-quotes-tree-branch').count(), 65);
        await choose(page, 'section:психология/раздел 000'); await expectStatus(page, '1–9 из 9 цитат');
        const childBranch = treeNode(page, 'section:психология/раздел 000').locator('xpath=../..');
        await childBranch.evaluate(branch => { branch.open = true; });
        await treeNode(page, 'section:психология/раздел 000/подраздел 0').waitFor({ state: 'visible' });
        await choose(page, 'section:психология/раздел 000/подраздел 0'); await expectStatus(page, '1–1 из 1 цитат');
        assert.match(await page.locator('.book-quote-text').textContent(), /УникальныйХвост/u);
        assert.equal(await page.locator('.book-quote-conclusion p').textContent(), 'Вывод 000');

        await page.getByRole('button', { name: 'Редактировать цитату', exact: true }).click();
        await page.waitForFunction(() => window.fixture.editCalls.length === 1);
        assert.equal(await page.evaluate(() => window.fixture.editCalls[0].entry.id), 'book-excerpt-synthetic-000-0');
        const edited = knowledge.parseExcerpts(files[0].text).map(entry => knowledge.renderExcerpt(entry.id.endsWith('-0') ? { ...entry, text: 'Отредактированная цитата.', section: 'Редактирование/Новый раздел', conclusion: 'Отредактированный вывод' } : entry)).join('\n');
        await page.evaluate(async ({ filePath, text }) => { window.fixture.modify(filePath, text); await window.fixture.editCalls[0].onSaved({ path: filePath, id: 'book-excerpt-synthetic-000-0' }); }, { filePath: files[0].path, text: edited });
        await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quotes-reading-title').textContent(), 'Новый раздел', 'Saving follows a quote moved to another section');
        assert.equal(await page.locator('.book-quote-conclusion p').textContent(), 'Отредактированный вывод');

        await mode(page, 'Источники'); await expectStatus(page, '1–9 из 9 цитат');
        assert.equal(await page.locator('.book-quotes-tree-row').count(), 41, 'Source tree starts with at most 40 sources and All');
        await page.getByRole('button', { name: 'Ещё источники', exact: true }).click();
        assert.equal(await page.locator('.book-quotes-tree-row').count(), 81);
        await page.getByLabel('Поиск разделов и источников', { exact: true }).fill('Одинаковое название');
        assert.equal(await page.locator('.book-quotes-tree-row').count(), 3);
        await choose(page, 'source:Книги/Non-fiction/synthetic-129.md'); await expectStatus(page, '1–9 из 9 цитат');
        assert((await rowTargets(page)).every(target => target.startsWith('Книги/Non-fiction/synthetic-129#^')));
        await search(page, 'Хвоста больше нет'); await expectStatus(page, '0–0 из 0 цитат');
        await search(page, 'Отредактированный 000 Автор'); await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quote-conclusion p').textContent(), 'Отредактированный вывод');
        const target = 'Книги/Non-fiction/synthetic-000#^book-excerpt-synthetic-000-0';
        await page.locator('.book-quotes-row a.book-quote-work-link').click({ modifiers: ['Control'] });
        assert.deepEqual(await page.evaluate(() => window.fixture.opened.at(-1)), [target, files[0].path, true]);
        await page.getByRole('button', { name: 'Сбросить поиск', exact: true }).click();
        await choose(page, 'all'); await expectStatus(page, '1–20 из 1170 цитат');
        const initialTargets = await rowTargets(page), visited = [];
        for (let number = 1; number <= 59; number++) {
            const count = Math.min(20, total - (number - 1) * 20);
            await expectStatus(page, `${(number - 1) * 20 + 1}–${(number - 1) * 20 + count} из ${total} цитат`);
            await assertBounded(page, count); visited.push(...await rowTargets(page));
            if (number < 59) await page.getByRole('button', { name: 'Далее', exact: true }).click();
        }
        assert.equal(visited.length, total); assert.equal(new Set(visited).size, total, 'Every quote appears exactly once across pages');
        assert.equal(await page.getByRole('button', { name: 'Далее', exact: true }).isDisabled(), true);
        await page.evaluate(paths => window.fixture.remove(paths), files.slice(110).map(file => file.path));
        await expectStatus(page, '981–990 из 990 цитат'); await assertBounded(page, 10);
        await choose(page, 'all'); assert.deepEqual(await rowTargets(page), initialTargets, 'All restores stable initial ordering');
        const live = makeFile('Книги/Non-fiction/synthetic-live.md', { title: 'А свежий источник', authors: ['Живой Автор'] }, [{ id: 'book-excerpt-live', text: 'Новая цитата для живого обновления.', section: 'Новая/Подраздел', savedDate: '2026-10-06' }]);
        await page.evaluate(file => window.fixture.add(file), live); await expectStatus(page, '1–20 из 991 цитат');
        assert.equal((await rowTargets(page))[0], 'Книги/Non-fiction/synthetic-live#^book-excerpt-live');
        await search(page, 'Живая правка'); await expectStatus(page, '0–0 из 0 цитат');
        const changed = knowledge.renderExcerpt({ id: 'book-excerpt-live', text: 'Живая правка цитаты.', section: 'Новая/Подраздел', conclusion: 'Живой вывод', savedDate: '2026-10-06' });
        await page.evaluate(({ filePath, text }) => window.fixture.modify(filePath, text), { filePath: live.path, text: changed });
        await expectStatus(page, '1–1 из 1 цитат'); assert.equal(await page.locator('.book-quote-conclusion p').textContent(), 'Живой вывод');
        await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function attributionChecks(browser) {
    const files = [makeFile('Книги/Цитаты/catalog-a.md', { note_type: 'excerpt_collection', title: 'Каталог А', authors: [], quote_section: 'Архив/Мысли' }, [
        { id: 'book-excerpt-external-1', text: 'Первый фрагмент.', sourceTitle: 'Один источник', sourceAuthors: ['Настоящий Автор'], conclusion: 'Осмысленный вывод\nСтрока2' },
        { id: 'book-excerpt-unknown', text: 'Неизвестный фрагмент.', section: '' }
    ]), makeFile('Книги/Цитаты/catalog-b.md', { note_type: 'excerpt_collection', title: 'Каталог Б', authors: [], quote_section: 'Архив/Мысли' }, [
        { id: 'book-excerpt-external-2', text: 'Второй фрагмент.', sourceTitle: 'Один источник', sourceAuthors: ['Настоящий Автор'] },
        { id: 'book-excerpt-author', text: 'Только автор.', section: '', sourceAuthors: ['Автор без произведения'] }
    ])];
    const { page, errors } = await mount(browser, files);
    try {
        await expectStatus(page, '1–2 из 2 цитат'); assert.equal(await page.locator('.book-quotes-reading-title').textContent(), 'Архив');
        assert.equal(await page.locator('.book-quote-conclusion p').textContent(), 'Осмысленный вывод\nСтрока2');
        await choose(page, 'all'); await expectStatus(page, '1–4 из 4 цитат');
        assert(!/Каталог [АБ]/u.test(await page.locator('.book-knowledge-results').textContent()), 'Collection labels are not presented as source titles');
        await mode(page, 'Источники');
        await choose(page, 'external:один источник:настоящий автор'); await expectStatus(page, '1–2 из 2 цитат');
        assert.equal(await page.locator('.book-quotes-row .book-quote-authors').first().textContent(), 'Настоящий Автор');
        await choose(page, 'source:unknown'); await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quote-source a.book-quote-work-link').textContent(), 'Источник не указан');
        assert.equal(await page.locator('.book-quote-source').textContent(), 'Источник не указан', 'An unknown source has one concise linked label');
        await choose(page, 'author:автор без произведения'); await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quote-authors').textContent(), 'Автор без произведения');
        await search(page, 'Строка2 Настоящий Один'); await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quote-conclusion p').isVisible(), true, 'Saved conclusions are visible without expansion');
        await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function sectionCaseChecks(browser) {
    const files = ['Память/Обучение', 'память/обучение', 'Другое'].map((section, index) => makeFile(`Книги/Non-fiction/case-${index}.md`, { title: `Источник ${index}`, authors: ['Автор'] }, [{ id: `book-excerpt-case-${index}`, text: `Цитата ${index}`, section, themes: ['Не раздел'] }]));
    const { page, errors } = await mount(browser, files);
    try {
        await expectStatus(page, '1–2 из 2 цитат');
        const branch = page.locator('summary[aria-label="Подразделы: Память"]').locator('xpath=..');
        await branch.evaluate(node => { node.open = true; }); await treeNode(page, 'section:память/обучение').waitFor({ state: 'visible' });
        await choose(page, 'section:память/обучение'); await expectStatus(page, '1–2 из 2 цитат');
        await page.evaluate(() => window.handle.reload()); assert.equal(await treeNode(page, 'section:память/обучение').getAttribute('aria-current'), 'page');
        const changed = knowledge.renderExcerpt({ id: 'book-excerpt-case-0', text: 'Цитата 0', section: 'ПАМЯТЬ/ОБУЧЕНИЕ' });
        await page.evaluate(async ({ filePath, text }) => { window.fixture.modify(filePath, text); await window.handle.reload(); }, { filePath: files[0].path, text: changed });
        await expectStatus(page, '1–2 из 2 цитат'); assert.equal(await page.locator('.book-quotes-reading-title').textContent(), 'ОБУЧЕНИЕ');
        assert.equal(await treeNode(page, 'section:память/обучение').getAttribute('aria-current'), 'page');
        await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function authorLinkChecks(browser) {
    const files = [
        makeFile('Книги/Non-fiction/author-single.md', { title: 'Одиночная книга', authors: ['Один Автор'] }, [{ id: 'book-excerpt-author-single', text: 'Один автор книги.', section: 'Ссылки', sourceAuthors: ['Ложный Автор'], sourceTitle: 'Ложный источник' }]),
        makeFile('Книги/Non-fiction/author-multiple.md', { title: 'Совместная книга', authors: ['Первый Автор', 'Второй Автор'] }, [{ id: 'book-excerpt-author-multiple', text: 'Два автора книги.', section: 'Ссылки' }]),
        makeFile('Книги/Цитаты/author-inheritance.md', { note_type: 'excerpt_collection', title: 'Коллекция с автором', authors: ['Наследованный Автор'], quote_section: 'Ссылки' }, [
            { id: 'book-excerpt-author-inherited', text: 'Автор из свойств коллекции.', sourceTitle: 'Первый источник' },
            { id: 'book-excerpt-author-overridden', text: 'Собственные авторы цитаты.', sourceTitle: 'Второй источник', sourceAuthors: ['Переопределённый Автор', 'Второй Автор'] }
        ]),
        makeFile('Книги/Цитаты/author-empty.md', { note_type: 'excerpt_collection', title: 'Коллекция без автора', authors: [], quote_section: 'Ссылки' }, [{ id: 'book-excerpt-author-empty', text: 'Автор неизвестен.' }])
    ];
    const canonical = {
        'Один Автор': 'Книги/_system/Авторы/Один Автор-9b700c4a',
        'Первый Автор': 'Книги/_system/Авторы/Первый Автор-8c8391ad',
        'Второй Автор': 'Книги/_system/Авторы/Второй Автор-0e9be0b0',
        'Наследованный Автор': 'Книги/_system/Авторы/Наследованный Автор-d1a375d3',
        'Переопределённый Автор': 'Книги/_system/Авторы/Переопределённый Автор-e470e885'
    };
    const cases = [
        ['book-excerpt-author-single', ['Один Автор']],
        ['book-excerpt-author-multiple', ['Первый Автор', 'Второй Автор']],
        ['book-excerpt-author-inherited', ['Наследованный Автор']],
        ['book-excerpt-author-overridden', ['Переопределённый Автор', 'Второй Автор']],
        ['book-excerpt-author-empty', []]
    ];
    const { page, errors } = await mount(browser, files);
    const snapshot = () => page.evaluate(() => [...window.fixture.map].map(([filePath, file]) => ({ path: filePath, text: file.text, fm: file.fm ?? null, mtime: file.stat?.mtime ?? null })));
    try {
        await expectStatus(page, '1–5 из 5 цитат'); await assertBounded(page, 5);
        const before = await snapshot(), clicked = [];
        for (const [id, expectedAuthors] of cases) {
            const row = page.locator('.book-quotes-row').filter({ has: page.locator(`a.book-quote-work-link[data-href$=${JSON.stringify('#^' + id)}]`) });
            const links = row.locator('a.book-quote-author-link.internal-link');
            assert.deepEqual(await links.allTextContents(), expectedAuthors, `Each author has its own link: ${id}`);
            for (let index = 0; index < expectedAuthors.length; index++) {
                const author = expectedAuthors[index], link = links.nth(index);
                assert.equal(await link.getAttribute('href'), canonical[author]);
                assert.equal(await link.getAttribute('data-href'), canonical[author]);
                await link.click(); clicked.push(author);
                await page.waitForFunction(expected => window.fixture.authorCalls.length === expected, clicked.length);
                assert.deepEqual(await page.evaluate(() => window.fixture.authorCalls), clicked, 'The existing command receives the exact clicked author');
            }
        }
        const single = page.locator('.book-quotes-row').filter({ has: page.locator('a.book-quote-work-link[data-href$="#^book-excerpt-author-single"]') });
        assert.equal(await single.locator('a.book-quote-work-link').textContent(), 'Одиночная книга', 'Books retain their canonical source and authors');
        assert.deepEqual(await page.evaluate(() => window.fixture.authorLeafCalls), Array(clicked.length).fill(false));
        await single.locator('a.book-quote-author-link').click({ modifiers: ['Control'] });
        await page.waitForFunction(expected => window.fixture.authorCalls.length === expected, clicked.length + 1);
        assert.equal(await page.evaluate(() => window.fixture.authorLeafCalls.at(-1)), true, 'Ctrl opens the author in a new leaf');
        await single.locator('a.book-quote-author-link').click();
        await page.waitForFunction(expected => window.fixture.authorCalls.length === expected, clicked.length + 2);
        assert.equal(await page.evaluate(() => window.fixture.authorLeafCalls.at(-1)), false, 'A modifier click does not change the shared workspace behavior');
        assert.deepEqual(await snapshot(), before, 'Rendering and author-command stubs do not rewrite source notes');
        await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function creationNavigationChecks(browser) {
    const original = makeFile('Книги/Non-fiction/create-existing.md', { title: 'Книга', authors: ['Автор'] }, [{ id: 'book-excerpt-create-existing', text: 'Уже сохранённая цитата', section: 'Мотивация/в' }]);
    const { page, errors } = await mount(browser, [original]);
    try {
        await page.locator('.book-quotes-tree-branch').first().evaluate(branch => { branch.open = true; });
        await treeNode(page, 'section:мотивация/в').waitFor({ state: 'visible' });
        await choose(page, 'section:мотивация/в');
        await page.getByRole('link', { name: '+ Добавить цитату', exact: true }).click();
        await page.waitForFunction(() => window.fixture.createCalls.length === 1);
        assert.deepEqual(await page.evaluate(() => window.fixture.createCalls[0].initial), { sourceKind: 'free', text: '', section: 'Мотивация/в' });
        assert.equal(await page.evaluate(() => window.fixture.createCalls[0].openAfterSave), false, 'The catalogue stays open after creation');
        assert.equal(await page.locator('.book-quotes-row').count(), 1, 'Opening or cancelling the form does not create a quote');
        const created = makeFile('Книги/Цитаты/Другой/Раздел/_Выписки.md', { note_type: 'excerpt_collection', title: 'Раздел', authors: [] }, [{ id: 'book-excerpt-created-from-index', text: 'Новая произвольная цитата', section: 'Другой/Раздел', sourceTitle: 'Беседа', sourceAuthors: ['Собеседник'] }]);
        // Obsidian can index frontmatter after Vault.create resolves. The pending selection survives that delay.
        await page.evaluate(async file => {
            await window.fixture.createCalls[0].onSaved({ path: file.path, id: 'book-excerpt-created-from-index' });
            window.fixture.add(file);
        }, created);
        await page.waitForFunction(() => document.querySelector('.book-quotes-reading-title')?.textContent === 'Раздел');
        await expectStatus(page, '1 цитата'); await assertBounded(page, 1);
        assert.equal(await page.locator('.book-quote-text').textContent(), 'Новая произвольная цитата');
        assert.equal(await page.locator('.book-quote-author-link').textContent(), 'Собеседник');
        assert.equal(await page.evaluate(() => window.fixture.opened.length), 0);
        await page.getByRole('button', { name: 'Удалить цитату', exact: true }).click();
        await page.waitForFunction(() => window.fixture.deleteCalls.length === 1);
        assert.equal(await page.evaluate(() => window.fixture.deleteCalls[0].entry.id), 'book-excerpt-created-from-index');
        await page.evaluate(async path => {
            window.fixture.modify(path, '');
            await window.fixture.deleteCalls[0].onDeleted({ path, id: 'book-excerpt-created-from-index' });
        }, created.path);
        await assertBounded(page, 1);
        assert.equal(await page.locator('.book-quote-text').textContent(), 'Уже сохранённая цитата');
        assert.equal(await page.evaluate(path => window.fixture.map.has(path), created.path), true, 'Deleting a quote keeps its source note');
        await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        const checks = await realCollectionChecks(browser), embeddedChecks = await embeddedPaneChecks(browser); await largeCollectionChecks(browser); await attributionChecks(browser); await sectionCaseChecks(browser); await authorLinkChecks(browser); await creationNavigationChecks(browser);
        console.log(`${checks} real quote layouts, ${embeddedChecks} embedded Obsidian panes, a 1170-quote tree scenario, attribution, author links and section-case regressions passed: masthead, hidden properties, nested overflow, hierarchy, bounded DOM, full text and conclusions, exact sources, AND search, edit callback, pagination and live updates.`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
