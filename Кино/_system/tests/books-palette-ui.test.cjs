// Read-only Chromium checks of actual book renderers and installed snippet colours.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('playwright');
const vault = path.resolve(__dirname, '../../..'), books = path.join(vault, 'Книги');
const css = fs.readFileSync(path.join(books, '_system/books-library.css'), 'utf8');
const palette = css.match(/\/\* BOOKS:PALETTE:START[\s\S]*?\/\* BOOKS:PALETTE:END \*\//)?.[0];
const out = path.join(vault, 'Кино/_system/redesign-backups/books-palette-20261011/previews');
const allSnippets = JSON.parse(fs.readFileSync(path.join(vault, '.obsidian/appearance.json'), 'utf8')).enabledCssSnippets
    .map(name => fs.readFileSync(path.join(vault, '.obsidian/snippets', name + '.css'), 'utf8')).join('\n');
const dynamicCss = fs.readFileSync(path.join(vault, '.obsidian/plugins/dynamic-views/styles.css'), 'utf8');

// Reuse the existing safe adapters without invoking their scenario runners.
function harness(file, marker, names) {
    const source = fs.readFileSync(file, 'utf8'), index = source.indexOf(marker);
    assert(index > 0, 'existing read-only adapter entry point: ' + file);
    const mod = { exports: {} };
    new Function('require', '__dirname', 'module', 'exports', source.slice(0, index) + '\nmodule.exports = {' + names.join(',') + '};')
        (createRequire(file), path.dirname(file), mod, mod.exports);
    return mod.exports;
}
const home = harness(path.join(books, '_system/tests/library_home_ui.cjs'), 'async function assertBounded', ['mount']);
const reading = harness(path.join(books, '_system/tests/reading_dashboard_ui.cjs'), 'async function assertBounded', ['mount']);
const quotes = harness(path.join(books, '_system/tests/quotes_index_ui.cjs'), 'async function expectStatus', ['mount', 'makeFile']);
const poetry = harness(path.join(books, '_system/tests/poetry_ui.cjs'), 'async function showNavigation', ['mount']);
const card = harness(path.join(__dirname, 'book-relations-ui.test.cjs'), "test('book relations", ['setup']);
const authors = harness(path.join(books, '_system/tests/authors_ui_layout.cjs'), 'async function main()', ['source', 'css', 'records', 'baseline']);

async function authorPage(browser, width) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    await page.setContent('<style>' + authors.baseline + '</style><style>' + allSnippets + '</style><body class="theme-dark"><main class="markdown-preview-view books-entity"><div id="content"></div></main></body>');
    await page.evaluate(async ({ source, css, records }) => {
        const service = { core: { displayDate: value => value }, snapshot: async () => records, subscribe: () => () => {} };
        window.authorService = service;
        const app = { vault: { getAbstractFileByPath: path => ({ path }), read: async file => file.path.endsWith('.css') ? css : 'module.exports.getService=async()=>window.authorService;' }, workspace: { openLinkText() {} } };
        const mod = { exports: {} }; new Function('module', source)(mod);
        window.authorHandle = await mod.exports({ app, dv: { container: document.querySelector('#content'), current: () => ({ file: { path: 'Книги/_system/Авторы.md' } }) }, mode: 'index' });
    }, authors);
    return page;
}

async function stableTypographyAndGeometry(page) {
    const result = await page.evaluate(() => {
        const targets = [...document.querySelectorAll('h1,h2,h3,.book-card-primary,.book-home-stat strong,.book-dashboard-metric strong,.book-authors-stat-value,.book-quote-text,.book-poetry-text')].slice(0, 30);
        const capture = () => targets.map(node => {
            const style = getComputedStyle(node), box = node.getBoundingClientRect();
            return { font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, line: style.lineHeight, spacing: style.letterSpacing,
                width: Math.round(box.width * 100) / 100, height: Math.round(box.height * 100) / 100 };
        });
        const after = capture();
        const styles = [...document.querySelectorAll('style')].filter(node => node.textContent.includes('/* BOOKS:PALETTE:START'));
        const originals = styles.map(node => node.textContent);
        styles.forEach(node => { node.textContent = node.textContent.replace(/\/\* BOOKS:PALETTE:START[\s\S]*?\/\* BOOKS:PALETTE:END \*\//g, ''); });
        const before = capture();
        styles.forEach((node, index) => { node.textContent = originals[index]; });
        return { before, after, count: targets.length };
    });
    assert(result.count > 0);
    assert.deepEqual(result.after, result.before, 'the palette preserves fonts, weights and element geometry');
}

test('shared book palette colours actual cards, home, authors, quotes, poems and reading totals at 390/1440', async () => {
    assert(palette, 'central palette exists');
    assert.equal(css, fs.readFileSync(path.join(vault, '.obsidian/snippets/books-library.css'), 'utf8'), 'active snippet is synchronized');
    assert.doesNotMatch(palette, /(?:font(?:-family|-size|-weight)?|width|height|margin|padding|display|gap|grid-template-columns)\s*:/, 'palette contains no layout or type changes');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    fs.mkdirSync(out, { recursive: true });
    try {
        const quoteFiles = [quotes.makeFile('Книги/Non-fiction/Источник.md', { title: 'О внимании', authors: ['Автор'] }, [
            { id: 'book-excerpt-palette-1', text: 'Читать — значит дать мысли достаточно времени.', section: 'Чтение', savedDate: '2026-10-11' },
            { id: 'book-excerpt-palette-2', text: 'Из прочитанного остаётся то, к чему возвращаешься.', section: 'Память', savedDate: '2026-10-10' }
        ])];
        const cases = [
            { name: 'card', create: async width => ({ page: await card.setup(browser, width) }), heading: '.book-card-title', number: '.book-card-rating strong' },
            { name: 'home', create: width => home.mount(browser, { width, theme: 'theme-dark' }), heading: '.book-home-title', number: '.book-home-stat strong', late: 'library-home.css' },
            { name: 'authors', create: async width => ({ page: await authorPage(browser, width) }), heading: '.book-authors-name', number: '.book-authors-stat-value', late: 'authors-ui.css' },
            { name: 'quotes', create: width => quotes.mount(browser, quoteFiles, { width, theme: 'theme-dark' }), heading: '.book-quotes-title', late: 'quotes-index.css' },
            { name: 'poetry', create: width => poetry.mount(browser, { width, theme: 'theme-dark', text: '# Стихи\n\n## Автор\n\n### Тихий вечер\nТихий вечер, ясный свет.\nЕщё один прекрасный день.\n' }), heading: '.book-poetry-heading h1', late: 'poetry.css' },
            { name: 'reading', create: width => reading.mount(browser, { width, theme: 'theme-dark' }), heading: '.book-dashboard-title', number: '.book-dashboard-metric strong', late: 'reading-dashboard.css' }
        ];
        for (const width of [390, 1440]) for (const item of cases) {
            const { page, errors = [] } = await item.create(width);
            try {
                await page.addStyleTag({ content: css });
                if (item.late) await page.addStyleTag({ content: fs.readFileSync(path.join(books, '_system', item.late), 'utf8') });
                if (item.name === 'reading') {
                    const select = page.getByLabel('Год чтения', { exact: true });
                    const year = await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value).find(Boolean));
                    assert(year, 'the real reading history offers a year');
                    await select.selectOption(year);
                }
                const root = page.locator('.markdown-preview-view').first();
                assert.equal(await root.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(22, 24, 28)', item.name + ' background');
                assert.equal(await root.evaluate(node => getComputedStyle(node).getPropertyValue('--text-normal').trim()), '#f0ece3', item.name + ' text token');
                assert.equal(await page.locator(item.heading).first().evaluate(node => getComputedStyle(node).color), 'rgb(184, 151, 96)', item.name + ' heading');
                if (item.number) assert.equal(await page.locator(item.number).first().evaluate(node => getComputedStyle(node).color), 'rgb(184, 151, 96)', item.name + ' numbers');
                if (item.name === 'reading') assert.equal(await page.locator('.book-dashboard-month-bar').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(203, 156, 77)', 'bars retain the quieter gold after late CSS');
                await stableTypographyAndGeometry(page);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, item.name + ' no page overflow');
                assert.deepEqual(errors, [], item.name + ' no browser errors');
                await page.screenshot({ path: path.join(out, item.name + '-' + width + '.png'), fullPage: false });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
});

test('native book Bases and book dialogs use local colours while other notes, Bases and dialogs keep theirs', async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const width of [390, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 1100 } });
            await page.setContent('<style>body{margin:0;padding:16px;font:16px/1.5 monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--text-normal:#302e2a;--text-muted:#716b62;--text-accent:#a46830;--background-modifier-border:#d8d3c9;background:var(--background-primary);color:var(--text-normal)}section{padding:16px;margin-bottom:16px;border:1px solid var(--background-modifier-border);background:var(--background-primary)}h1{color:var(--text-normal);font:600 24px/1.3 serif}a{color:var(--text-accent)}button{font:inherit;color:var(--text-normal);background:var(--background-secondary);border:1px solid var(--background-modifier-border)}.card{padding:16px;max-width:100%;background:var(--dynamic-views-background-primary-alt,var(--background-secondary))}.modal{position:static}</style><style>' + dynamicCss + '</style><body class="theme-light"><section class="markdown-preview-view" id="neutral"><h1>Обычная заметка</h1><p>Остальные папки сохраняют свои цвета.</p><a href="#">Ссылка</a><button>Кнопка</button></section><section class="workspace-leaf-content" data-type="bases" id="neutral-base"><div class="bases-view"><div class="bases-td"><a class="internal-link" data-href="Другое/Проект">Обычная база</a></div></div></section><section class="workspace-leaf-content" data-type="bases" id="book-base"><div class="bases-view"><div class="bases-td"><a class="internal-link" data-href="Книги/Художественные/Произведение">Книжная база</a></div><div class="dynamic-views"><div class="card" data-path="Книги/Художественные/Произведение.md">Книжная карточка</div></div></div></section><section class="modal" id="neutral-modal"><h1>Обычный диалог</h1><button>Сохранить</button></section><section class="modal book-poetry-modal" id="book-modal"><h1>Стихотворение</h1><button>Сохранить</button></section></body>');
            const snapshot = () => page.evaluate(() => [...document.querySelectorAll('#neutral,#neutral *,#neutral-base,#neutral-base *,#neutral-modal,#neutral-modal *')].map(node => { const style = getComputedStyle(node); return { color: style.color, bg: style.backgroundColor, border: style.borderColor, font: style.fontFamily, size: style.fontSize }; }));
            const before = await snapshot();
            await page.addStyleTag({ content: css });
            // Dynamic Views animates background colours when a snippet is enabled.
            await page.waitForFunction(() => getComputedStyle(document.querySelector('#book-base .card')).backgroundColor === 'rgb(32, 35, 41)');
            assert.deepEqual(await snapshot(), before, 'all unrelated note/base/dialog colours and fonts stay unchanged');
            assert.equal(await page.locator('#book-base').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(22, 24, 28)');
            const cardColour = await page.locator('#book-base .card').evaluate(node => {
                const style = getComputedStyle(node);
                return { background: style.backgroundColor, wrapperToken: style.getPropertyValue('--dynamic-views-background-primary-alt'), surface: style.getPropertyValue('--books-surface'), cardToken: style.getPropertyValue('--card-bg') };
            });
            assert.equal(cardColour.background, 'rgb(32, 35, 41)', JSON.stringify(cardColour));
            assert.equal(await page.locator('#book-modal').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(22, 24, 28)');
            assert.equal(await page.locator('#book-modal h1').evaluate(node => getComputedStyle(node).color), 'rgb(184, 151, 96)');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.screenshot({ path: path.join(out, 'scope-and-native-bases-' + width + '.png'), fullPage: true });
            await page.close();
        }
    } finally { await browser.close(); }
});
