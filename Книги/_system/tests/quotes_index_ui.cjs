const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fromText } = require('./yaml_fixture.cjs');
const knowledge = require('../knowledge.js'), root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '_system/knowledge.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '_system/book_core.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/quotes-index.css'), 'utf8');
const libraryCss = fs.readFileSync(path.join(root, '_system/books-library.css'), 'utf8');
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:var(--background-primary);color:var(--text-normal);--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e}main{max-width:900px;margin:auto;padding:20px;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b}`;

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

function syntheticFiles() {
    return Array.from({ length: 130 }, (_, index) => {
        const suffix = String(index).padStart(3, '0');
        const excerpts = Array.from({ length: 9 }, (_, number) => ({
            id: `book-excerpt-synthetic-${suffix}-${number}`,
            text: index === 0 && number === 0 ? 'Начало длинной цитаты. ' + 'Текст, который не требуется добавлять в DOM до раскрытия. '.repeat(120) + '\nУникальныйХвост в самом конце.' : `Цитата ${suffix}/${number}. Текст для проверки большого каталога.`,
            themes: [`${index < 65 ? 'Психология' : 'Практика'}/Тема ${suffix}/Подтема ${number}`, 'Общее'],
            conclusion: number === 0 ? `Вывод ${suffix}` : '', location: `Глава ${number + 1}`, savedDate: number === 8 ? '' : '2026-10-05'
        }));
        return { path: `Книги/Non-fiction/synthetic-${suffix}.md`, basename: `synthetic-${suffix}`, extension: 'md', stat: { mtime: 1 },
            fm: { title: index >= 128 ? 'Одинаковое название' : `Источник ${suffix}`, authors: [`Автор ${suffix}`] },
            text: excerpts.map(excerpt => knowledge.renderExcerpt(excerpt)).join('\n') };
    });
}

async function mount(browser, files, { width = 1024, theme = 'theme-light' } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>${baseline}</style><style>${libraryCss}</style><body class="${theme}"><main><h1>Цитаты</h1><div id="content"></div></main></body>`);
    await page.evaluate(async ({ source, core, css, files }) => {
        const map = new Map(files.map(file => [file.path, file]));
        map.set('Книги/_system/book_core.js', { path: 'Книги/_system/book_core.js', text: core });
        map.set('Книги/_system/quotes-index.css', { path: 'Книги/_system/quotes-index.css', text: css });
        const events = new Map(), opened = [], disposers = [];
        const on = (name, callback) => { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); return { name, callback }; };
        const emit = (name, ...args) => { for (const callback of events.get(name) || []) callback(...args); };
        const app = { vault: { getAbstractFileByPath: filePath => map.get(filePath), read: async file => file.text, getMarkdownFiles: () => [...map.values()].filter(file => file.extension === 'md'), on },
            metadataCache: { getFileCache: file => ({ frontmatter: file.fm }), on }, workspace: { openLinkText: (...args) => { opened.push(args); } } };
        const module = { exports: {} }; new Function('module', source)(module);
        window.fixture = { map, app, opened, emit, disposers,
            remove(paths) { for (const filePath of paths) { const file = map.get(filePath); map.delete(filePath); if (file) emit('delete', file); } },
            add(file) { map.set(file.path, file); emit('create', file); },
            modify(filePath, text) { const file = map.get(filePath); file.text = text; file.stat.mtime++; emit('modify', file); } };
        window.handle = await module.exports({ app, obsidian: {}, dv: { container: document.querySelector('#content'), component: { register: callback => disposers.push(callback) } }, mode: 'index' });
    }, { source, core, css, files });
    return { page, errors };
}

async function expectStatus(page, value) {
    await page.waitForFunction(expected => { const actual = document.querySelector('.book-quotes-status')?.textContent; return actual === expected || actual?.startsWith(expected + ' · всего '); }, value);
    const actual = await page.locator('.book-quotes-status').textContent();
    assert(actual === value || actual.startsWith(value + ' · всего '), `Quote status: ${actual}`);
}
async function rowTargets(page) { return page.locator('.book-quotes-row a.internal-link').evaluateAll(links => links.map(link => link.getAttribute('data-href'))); }
async function assertBounded(page, expectedRows) {
    assert.equal(await page.locator('.book-quotes-row').count(), expectedRows);
    assert.equal(await page.locator('.book-quotes-row .book-quote-details').count(), expectedRows);
    assert.equal(await page.locator('.book-quotes-row a.internal-link').count(), expectedRows);
    assert((await page.locator('.book-quote-text').count()) <= expectedRows, 'Full quote texts are limited to the current page');
    assert((await page.locator('.book-quotes-index *').count()) < 1000, 'The catalogue DOM stays bounded');
    for (const label of ['Тема', 'Источник']) assert((await page.getByLabel(label, { exact: true }).locator('option').count()) <= 43, `${label} options stay bounded`);
    assert.equal(await page.locator('.book-quotes-section-tile, .book-quotes-group').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The page fits its viewport');
}
async function reset(page) { await page.getByRole('button', { name: 'Сбросить', exact: true }).click(); }
async function chooseTheme(page, label) {
    const select = page.getByLabel('Тема', { exact: true });
    const value = await select.locator('option').evaluateAll((options, expected) => options.find(option => option.textContent.trim().replace(/\s*[·(]\s*\d+\)?\s*$/, '') === expected)?.value, label);
    assert(value, `Theme option is available: ${label}`);
    await select.selectOption(value);
}

async function realCollectionChecks(browser) {
    const files = realFiles(); let checks = 0;
    for (const width of [320, 390, 1024]) for (const theme of ['theme-light', 'theme-dark']) {
        const { page, errors } = await mount(browser, files, { width, theme });
        try {
            const status = await page.locator('.book-quotes-status').textContent(), total = Number(status.match(/из (\d+) цитат/u)?.[1]);
            assert(total >= 18, `Real collection loaded: ${status}`);
            await expectStatus(page, `1–${Math.min(20, total)} из ${total} цитат`);
            await assertBounded(page, Math.min(20, total));
            assert.equal(await page.locator('.book-quote-text').count(), 0, 'Initial rows do not contain complete quote texts');
            assert.equal(await page.getByRole('button', { name: 'Сбросить', exact: true }).isVisible(), false);
            await page.locator('.book-quote-details > summary').first().click();
            await page.locator('.book-quote-text').first().waitFor({ state: 'visible' });
            assert.equal(await page.locator('.book-quote-text').count(), 1);
            assert.equal(await page.locator('.book-quote-text').first().isVisible(), true);
            await page.locator('.book-quotes-filters > summary').click();
            assert.equal(await page.getByLabel('Найти тему', { exact: true }).isVisible(), true);
            assert.equal(await page.getByLabel('Найти источник', { exact: true }).isVisible(), true);
            await page.getByLabel('Поиск цитат', { exact: true }).fill('мелкой моторики');
            await expectStatus(page, '1–1 из 1 цитат');
            assert.equal(await page.locator('.book-quotes-row').count(), 1);
            await page.locator('.book-quote-details > summary').click();
            assert.match(await page.locator('.book-quote-text').textContent(), /мелкой моторики/u);
            await reset(page);
            await expectStatus(page, `1–${Math.min(20, total)} из ${total} цитат`);
            await assertBounded(page, Math.min(20, total));
            if (process.env.QUOTES_SCREENSHOT_DIR && [390, 1024].includes(width) && theme === 'theme-light') {
                fs.mkdirSync(process.env.QUOTES_SCREENSHOT_DIR, { recursive: true });
                await page.locator('.book-quotes-filters').evaluate(details => { details.open = false; });
                await page.screenshot({ path: path.join(process.env.QUOTES_SCREENSHOT_DIR, width === 390 ? 'quotes-minimal.png' : 'quotes-minimal-desktop.png') });
            }
            await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []); checks++;
        } finally { await page.close(); }
    }
    return checks;
}

async function largeCollectionChecks(browser) {
    const files = syntheticFiles(), total = 1170, { page, errors } = await mount(browser, files);
    try {
        await expectStatus(page, '1–20 из 1170 цитат'); await assertBounded(page, 20);
        assert.equal(await page.locator('.book-quote-text').count(), 0);
        assert.equal(await page.getByRole('navigation', { name: 'Страницы цитат', exact: true }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: 'Назад', exact: true }).isDisabled(), true);
        assert.match(await page.getByRole('navigation', { name: 'Страницы цитат', exact: true }).textContent(), /1\s*\/\s*59/u);
        const initialTargets = await rowTargets(page);
        await page.locator('.book-quotes-filters > summary').click();
        for (const label of ['Тема', 'Источник']) assert((await page.getByLabel(label, { exact: true }).locator('option:disabled').count()) > 0, `${label} prompts to narrow the option search`);
        await page.getByLabel('Найти тему', { exact: true }).fill('Психология'); await chooseTheme(page, 'Психология');
        await expectStatus(page, '1–20 из 585 цитат');
        const psychologyTargets = await rowTargets(page);
        assert.equal(new Set(psychologyTargets).size, 20);
        assert(psychologyTargets.every(target => Number(target.match(/synthetic-(\d+)/u)[1]) < 65), 'A parent theme includes child themes');
        assert.match(await page.getByRole('navigation', { name: 'Страницы цитат', exact: true }).textContent(), /1\s*\/\s*30/u);
        await page.getByLabel('Найти тему', { exact: true }).fill('Тема 000/Подтема 0'); await chooseTheme(page, 'Психология/Тема 000/Подтема 0');
        await expectStatus(page, '1–1 из 1 цитат');
        assert.equal((await rowTargets(page))[0], 'Книги/Non-fiction/synthetic-000#^book-excerpt-synthetic-000-0'); await reset(page);

        await page.getByLabel('Найти источник', { exact: true }).fill('Одинаковое название');
        const sameTitleOptions = await page.getByLabel('Источник', { exact: true }).locator('option').evaluateAll(options => options.filter(option => option.textContent.includes('Одинаковое название')).map(option => option.value));
        assert.deepEqual(sameTitleOptions.sort(), ['Книги/Non-fiction/synthetic-128.md', 'Книги/Non-fiction/synthetic-129.md']);
        await page.getByLabel('Источник', { exact: true }).selectOption('Книги/Non-fiction/synthetic-129.md');
        await expectStatus(page, '1–9 из 9 цитат');
        assert((await rowTargets(page)).every(target => target.startsWith('Книги/Non-fiction/synthetic-129#^')));
        await page.getByLabel('Найти источник', { exact: true }).fill('такого источника нет');
        assert.equal(await page.getByLabel('Источник', { exact: true }).inputValue(), 'Книги/Non-fiction/synthetic-129.md', 'Narrowing options retains the active source'); await reset(page);

        await page.getByLabel('Поиск цитат', { exact: true }).fill('УникальныйХвост 000 Автор');
        await expectStatus(page, '1–1 из 1 цитат');
        assert.equal(await page.locator('.book-quote-text').count(), 0, 'Search indexes the full quote without rendering it');
        assert((await page.locator('.book-quote-details > summary').textContent()).length < 700, 'A long quote preview stays short');
        await page.locator('.book-quote-details > summary').click(); assert.match(await page.locator('.book-quote-text').textContent(), /УникальныйХвост/u);
        const exactTarget = 'Книги/Non-fiction/synthetic-000#^book-excerpt-synthetic-000-0';
        await page.locator('.book-quotes-row a.internal-link').click({ modifiers: ['Control'] });
        assert.deepEqual(await page.evaluate(() => window.fixture.opened.at(-1)), [exactTarget, 'Книги/Non-fiction/synthetic-000.md', true]);
        await reset(page); assert.deepEqual(await rowTargets(page), initialTargets, 'Reset restores stable initial ordering');

        const visited = [];
        for (let number = 1; number <= 59; number++) {
            const count = Math.min(20, total - (number - 1) * 20);
            await expectStatus(page, `${(number - 1) * 20 + 1}–${(number - 1) * 20 + count} из ${total} цитат`);
            await assertBounded(page, count); visited.push(...await rowTargets(page));
            if (number < 59) await page.getByRole('button', { name: 'Далее', exact: true }).click();
        }
        assert.equal(visited.length, total); assert.equal(new Set(visited).size, total, 'Pagination contains every quote exactly once');
        assert.equal(await page.getByRole('button', { name: 'Далее', exact: true }).isDisabled(), true);
        await page.evaluate(paths => window.fixture.remove(paths), files.slice(110).map(file => file.path));
        await expectStatus(page, '981–990 из 990 цитат'); await assertBounded(page, 10);
        assert.match(await page.getByRole('navigation', { name: 'Страницы цитат', exact: true }).textContent(), /50\s*\/\s*50/u);
        await page.getByLabel('Поиск цитат', { exact: true }).fill('УникальныйХвост'); await expectStatus(page, '1–1 из 1 цитат');
        await reset(page); await expectStatus(page, '1–20 из 990 цитат');
        const live = { path: 'Книги/Non-fiction/synthetic-live.md', basename: 'synthetic-live', extension: 'md', stat: { mtime: 1 }, fm: { title: 'А свежий источник', authors: ['Живой Автор'] },
            text: knowledge.renderExcerpt({ id: 'book-excerpt-live', text: 'Новая цитата для живого обновления.', themes: ['Новая/Подтема'], savedDate: '2026-10-06' }) };
        await page.evaluate(file => window.fixture.add(file), live); await expectStatus(page, '1–20 из 991 цитат');
        assert.equal((await rowTargets(page))[0], 'Книги/Non-fiction/synthetic-live#^book-excerpt-live', 'A newly saved quote sorts first');
        await page.getByLabel('Поиск цитат', { exact: true }).fill('Живая правка');
        await page.waitForFunction(() => document.querySelectorAll('.book-quotes-row').length === 0);
        const changed = knowledge.renderExcerpt({ id: 'book-excerpt-live', text: 'Живая правка цитаты.', themes: ['Новая/Подтема'], savedDate: '2026-10-06' });
        await page.evaluate(({ filePath, text }) => window.fixture.modify(filePath, text), { filePath: live.path, text: changed });
        await expectStatus(page, '1–1 из 1 цитат'); await page.locator('.book-quote-details > summary').click();
        assert.equal(await page.locator('.book-quote-text').textContent(), 'Живая правка цитаты.');
        await reset(page); await assertBounded(page, 20); await page.evaluate(() => window.handle.dispose()); assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        const checks = await realCollectionChecks(browser); await largeCollectionChecks(browser);
        console.log(`${checks} real quote layouts and a 1170-quote Chromium scenario passed: lazy text, bounded filters and DOM, hierarchy, exact sources, AND search, pagination, reset, deletion and live updates.`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
