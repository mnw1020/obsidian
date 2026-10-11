const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fromText } = require('./yaml_fixture.cjs'), core = require('../book_core.js')({ app: {}, obsidian: {} }), knowledge = require('../knowledge.js');
const root = path.resolve(__dirname, '../..'), records = [], selectedSeries = 'Память о прошлом Земли';

function scan(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith('.md')) {
            const text = fs.readFileSync(full, 'utf8'), fm = fromText(text);
            if (fm.title && fm.authors) records.push({ fm, file: { path: 'Книги/' + path.relative(root, full).replaceAll('\\', '/'), basename: entry.name.slice(0, -3) }, history: core.parseHistory(text).entries, excerpts: knowledge.parseExcerpts(text) });
        }
    }
}
scan(path.join(root, 'Художественные')); scan(path.join(root, 'Non-fiction'));
const source = fs.readFileSync(path.join(root, '_system/authors_ui.js'), 'utf8'), css = fs.readFileSync(path.join(root, '_system/authors-ui.css'), 'utf8');
const seriesRecords = records.filter(record => record.fm.series === selectedSeries);
assert(seriesRecords.length > 1, 'The real series fixture must contain several parts');
const compare = (a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true });
const parts = [...seriesRecords].sort((a, b) => Number(a.fm.series_index) - Number(b.fm.series_index) || compare(a.fm.title, b.fm.title));
const authors = [...new Set(seriesRecords.flatMap(record => Array.isArray(record.fm.authors) ? record.fm.authors : [record.fm.authors]))];
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:var(--background-primary);color:var(--text-normal);--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e;--interactive-accent:#9b561e;--font-interface:Arial}main{max-width:1100px;margin:auto;padding:24px;min-width:0}button,select{font:inherit;cursor:pointer}a{color:var(--text-accent)}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b;--interactive-accent:#efa76b}p{margin:12px 0}@media(max-width:500px){main{padding:16px}}`;
// The installed gruvbox snippet's heading rules are intentionally retained here,
// so this regression runs on other machines without reading their .obsidian folder.
const gruvboxHeadings = `.cm-header-1,.markdown-preview-section h1{font-weight:900!important;font-size:2.2em!important;color:var(--text-title-h1)!important}.cm-header-2,.markdown-preview-section h2{font-weight:900!important;font-size:2em!important;color:var(--text-title-h2)!important}.cm-header-3,.markdown-preview-section h3{font-weight:900!important;font-size:1.8em!important;color:var(--text-title-h3)!important}`;
const libraryCss = fs.readFileSync(path.join(root, '_system/books-library.css'), 'utf8');

async function assertTypography(page, layout, mode) {
    const metrics = await page.locator('.book-authors-ui').evaluate(ui => ({
        width: ui.getBoundingClientRect().width,
        nameSize: parseFloat(getComputedStyle(ui.querySelector('.book-authors-name')).fontSize),
        sectionSize: parseFloat(getComputedStyle(ui.querySelector('.book-authors-section-heading h2')).fontSize),
        rows: [...ui.querySelectorAll('.book-authors-row')].map(row => {
            const title = row.querySelector('h3.book-authors-row-title'), style = getComputedStyle(title);
            const marker = row.querySelector('.book-authors-row-monogram') || row.querySelector('.book-authors-row-number');
            return { title: title.textContent, size: parseFloat(style.fontSize), marginTop: parseFloat(style.marginTop), topDelta: title.getBoundingClientRect().top - marker.getBoundingClientRect().top, mainColumn: getComputedStyle(title.parentElement).gridColumnStart };
        })
    }));
    const context = `${mode}, ${JSON.stringify(layout)}`;
    for (const row of metrics.rows) {
        assert.equal(row.size, 15, `Row heading size: ${row.title}, ${context}`);
        assert.equal(row.marginTop, 0, `Row heading top margin: ${row.title}, ${context}`);
        assert(Math.abs(row.topDelta) <= 6, `Row title aligns with its marker: ${JSON.stringify(row)}, ${context}`);
        if (mode === 'series-index' && metrics.width <= 620) assert.equal(row.mainColumn, '2', `Series row keeps the title in the second column: ${row.title}, ${context}`);
    }
    assert.equal(metrics.sectionSize, 21, `Section heading size: ${context}`);
    const expectedNameSize = metrics.width <= 620 ? 29 : Math.min(43, Math.max(29, layout.width * .04));
    assert(Math.abs(metrics.nameSize - expectedNameSize) <= .02, `Page heading size: ${metrics.nameSize}, expected ${expectedNameSize}, ${context}`);
}

async function assertCompactSeriesMetrics(page, layout) {
    const rows = await page.locator('.book-authors-person-row').evaluateAll(rows => rows.map(row => {
        const main = row.querySelector('.book-authors-row-main').getBoundingClientRect(), root = row.closest('.book-series-ui').getBoundingClientRect();
        return { mainRight: main.right, metrics: [...row.querySelectorAll('.book-authors-chip')].map(chip => {
            const rect = chip.getBoundingClientRect(), style = getComputedStyle(chip), value = chip.querySelector('strong'), range = document.createRange();
            range.selectNodeContents(value);
            const textRect = range.getBoundingClientRect(), valueStyle = getComputedStyle(value);
            const labelRange = document.createRange(); labelRange.selectNodeContents(chip.querySelector('span'));
            const labelRect = labelRange.getBoundingClientRect();
            return { text: chip.textContent, width: rect.width, height: rect.height, left: rect.left, inRoot: rect.left >= root.left - 1 && rect.right <= root.right + 1,
                borders: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].map(key => parseFloat(style[key])),
                labelInside: labelRect.left >= rect.left - 1 && labelRect.right <= rect.right + 1 && labelRect.top >= rect.top - 1 && labelRect.bottom <= rect.bottom + 1,
                value: { text: value.textContent, height: textRect.height, lineHeight: parseFloat(valueStyle.lineHeight), nowrap: valueStyle.whiteSpace, inside: textRect.left >= rect.left - 1 && textRect.right <= rect.right + 1 && textRect.top >= rect.top - 1 && textRect.bottom <= rect.bottom + 1 } };
        }) };
    }));
    for (const row of rows) {
        assert.equal(row.metrics.length, 3, 'Each series card has three metrics');
        for (const metric of row.metrics) {
            assert.deepEqual(metric.borders, [1, 1, 1, 1], `Series metrics retain frames: ${metric.text}, ${JSON.stringify(layout)}`);
            assert(Math.abs(metric.width - metric.height) <= 1, `Series metrics are square: ${metric.text}, ${JSON.stringify(layout)}`);
            assert(Math.abs(metric.width - row.metrics[0].width) <= 1 && Math.abs(metric.height - row.metrics[0].height) <= 1, 'The three squares have equal dimensions');
            assert(metric.left >= row.mainRight - 1, `Series metrics stay to the right of the title and author: ${metric.text}, ${JSON.stringify(layout)}`);
            assert(metric.inRoot, `Series metric stays within the root: ${metric.text}, ${JSON.stringify(layout)}`);
            assert(metric.labelInside, `Metric label stays within its square: ${metric.text}, ${JSON.stringify(layout)}`);
            const value = metric.value;
            assert.equal(value.nowrap, 'nowrap', `Number or date stays intact: ${value.text}, ${JSON.stringify(layout)}`);
            assert(value.height <= value.lineHeight + 1, `Number or date occupies one line: ${JSON.stringify(value)}, ${JSON.stringify(layout)}`);
            assert(value.inside, `Number or date stays within its square: ${value.text}, ${JSON.stringify(layout)}`);
        }
    }
    if (layout.width === 688) assert((await page.locator('.book-authors-row').first().boundingBox()).height <= 110, 'The first series row stays compact at 688px');
}

function expectedStats(mode) {
    const items = mode === 'series' ? seriesRecords : records.filter(record => String(record.fm.series || '').trim());
    const ratings = items.filter(record => record.file.path.startsWith('Книги/Художественные/') && Number.isFinite(Number(record.fm.rating)) && Number(record.fm.rating) >= 1 && Number(record.fm.rating) <= 10).map(record => Number(record.fm.rating));
    const shared = { 'Произведений': String(items.length), 'Любимые 8–10': String(ratings.filter(value => value >= 8).length) };
    if (mode === 'series-index') return { ...shared, 'Серий': String(new Set(items.map(record => record.fm.series)).size), 'С оценкой': String(ratings.length) };
    const years = [...new Set(items.flatMap(record => record.history.map(entry => entry.date.slice(0, 4))))].sort();
    delete shared['Произведений'];
    return { ...shared, 'В коллекции': String(items.length), 'Средняя моя оценка': ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1).replace('.', ',') : '—', 'Годы чтения': !years.length ? '—' : years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}` };
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let checks = 0;
    try {
        for (const layout of [{ width: 320 }, { width: 390 }, { width: 640 }, { width: 688 }, { width: 768 }, { width: 1024 }, { width: 1440, pane: 390 }]) for (const mode of ['series-index', 'series']) for (const theme of ['theme-light', 'theme-dark']) {
            const page = await browser.newPage({ viewport: { width: layout.width, height: 1100 } }), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.setContent(`<style>${baseline}</style><style>${gruvboxHeadings}</style><style>${libraryCss}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered ${mode === 'series-index' ? 'books-library' : 'books-entity'}" style="${layout.pane ? 'width:' + layout.pane + 'px;' : ''}${mode === 'series-index' ? "--font-interface:'JetBrains Mono',monospace;" : ''}"><div class="markdown-preview-sizer markdown-preview-section"><div class="inline-title">Прежний заголовок</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div><h2>Мои заметки</h2><p id="personal">Личные впечатления $& [[Ссылка]]</p></div></main></body>`);
            await page.evaluate(async ({ source, css, records, mode, selectedSeries }) => {
                const module = { exports: {} }; new Function('module', source)(module);
                window.seriesCalls = []; window.linkCalls = []; window.renderCalls = []; window.subscriptions = 0;
                window.seriesService = { core: { displayDate: value => value.split('-').reverse().join('.') }, snapshot: async () => records, subscribe: callback => {
                    window.refreshSeries = callback; window.subscriptions++;
                    let active = true; return () => { if (active) { active = false; window.subscriptions--; } };
                } };
                window.seriesComponent = { children: new Set(), disposers: [], register(callback) { this.disposers.push(callback); }, addChild(child) { this.children.add(child); return child; }, removeChild(child) { this.children.delete(child); child.unload(); } };
                const app = { vault: { getAbstractFileByPath: path => ({ path }), read: async file => file.path.endsWith('.css') ? css : 'module.exports.getService=async()=>window.seriesService;' }, workspace: { openLinkText: (...args) => window.linkCalls.push(args) }, plugins: { plugins: { quickadd: { api: { executeChoice: async (...args) => window.seriesCalls.push(args) } } } } };
                const obsidian = { Component: class { unload() { this.unloaded = true; } }, MarkdownRenderer: { render: async (_app, markdown, container, source, child) => { window.renderCalls.push({ markdown, source }); container.textContent = 'Таблица серии'; window.tableChild = child; } } };
                window.seriesFixture = { render: module.exports, app, obsidian };
                window.originalSeriesSnapshot = window.seriesService.snapshot;
                window.seriesHandle = await module.exports({ app, obsidian, dv: { container: document.querySelector('#content'), component: window.seriesComponent, current: () => ({ selected_series: selectedSeries, file: { path: 'Книги/_system/Серии/Память о прошлом Земли.md' } }) }, mode });
            }, { source, css, records, mode, selectedSeries });

            assert.equal(await page.locator('.inline-title').isVisible(), false);
            assert.equal(await page.locator('.book-authors-ui.book-series-ui').count(), 1);
            assert.equal(await page.locator('.book-series-ui :is(.book-authors-monogram,.book-authors-row-monogram)').count(), 0, 'Series pages omit decorative monograms');
            assert.doesNotMatch(await page.locator('.book-series-ui').innerText(), /прочитано/iu, 'Series pages omit the redundant read counter');
            const initial = await page.locator('.book-authors-row').count(); assert(initial > 0);
            await assertTypography(page, layout, mode);
            if (mode === 'series-index') {
                assert.equal(await page.locator('.book-authors-person-row .book-authors-row-examples').count(), 0, 'Series cards omit the list of book titles');
                await assertCompactSeriesMetrics(page, layout);
                if (process.env.SERIES_SCREENSHOT_DIR && layout.width === 688 && theme === 'theme-dark') await page.locator('.book-authors-row').first().screenshot({ path: path.join(process.env.SERIES_SCREENSHOT_DIR, 'series-row-688.png') });
            }
            const stats = await page.locator('.book-authors-stat').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.querySelector('.book-authors-stat-label').textContent, node.querySelector('.book-authors-stat-value').textContent])));
            assert.deepEqual(stats, expectedStats(mode));
            assert.equal(await page.evaluate(() => window.renderCalls.length), 0, 'The Base is not rendered before expansion');
            const searchLabel = mode === 'series-index' ? 'Поиск среди серий' : 'Поиск среди произведений';
            if (mode === 'series-index') {
                await page.getByLabel(searchLabel, { exact: true }).fill(selectedSeries);
                assert.equal(await page.locator('.book-authors-row').count(), 1);
                await page.getByRole('link', { name: selectedSeries, exact: true }).click();
                assert.deepEqual(await page.evaluate(() => window.seriesCalls[0]), ['Книги - Открыть серию', { series: selectedSeries }]);
                await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
                await page.getByLabel('Сортировка', { exact: true }).selectOption('name');
            } else {
                assert.equal(await page.getByLabel('Сортировка', { exact: true }).inputValue(), 'order');
                assert.deepEqual(await page.locator('.book-authors-row-title a').allTextContents(), parts.map(record => record.fm.title));
                assert.deepEqual(await page.locator('.book-authors-row-number').allTextContents(), parts.map(record => String(record.fm.series_index).padStart(2, '0')));
                assert.deepEqual((await page.locator('.book-series-authors a').allTextContents()).sort(), [...authors].sort());
                const authorName = await page.locator('.book-series-authors a').first().textContent();
                await page.locator('.book-series-authors a').first().click();
                assert.deepEqual(await page.evaluate(() => window.seriesCalls[0]), ['Книги - Открыть автора', { author: authorName }]);
                await page.getByLabel(searchLabel, { exact: true }).fill('шаровая молния');
                assert.equal(await page.locator('.book-authors-row').count(), 1);
                await page.locator('.book-authors-row-title a').click();
                assert.match((await page.evaluate(() => window.linkCalls[0]))[0], /Шаровая молния$/u);
                await page.getByLabel('Сортировка', { exact: true }).selectOption('name');
                await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
                assert.equal(await page.getByLabel('Сортировка', { exact: true }).inputValue(), 'order');
                const summary = page.getByText('Таблица и представления', { exact: true });
                await summary.click();
                await page.waitForFunction(() => window.renderCalls.length === 1);
                assert.equal(await page.evaluate(() => window.renderCalls[0].markdown), '![[Книги/_system/_Книги.base#Серия]]');
                assert.equal(await page.evaluate(() => window.seriesComponent.children.size), 1);
                await summary.click(); await summary.click();
                assert.equal(await page.evaluate(() => window.renderCalls.length), 1, 'Reopening reuses the existing Base component');
            }

            await page.getByRole('button', { name: 'Non-fiction', exact: true }).click();
            if (mode === 'series') assert.equal(await page.locator('.book-authors-row').count(), 0);
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            assert.equal(await page.locator('.book-authors-row').count(), initial);
            assert.equal(await page.getByLabel(searchLabel, { exact: true }).inputValue(), '');
            const yearOptions = await page.getByLabel('Год чтения', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value));
            const selectedYear = yearOptions.find(value => /^\d{4}$/u.test(value));
            if (selectedYear) {
                await page.getByLabel('Год чтения', { exact: true }).selectOption(selectedYear);
                assert((await page.locator('.book-authors-row').count()) <= initial);
                await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
                assert.equal(await page.getByLabel('Год чтения', { exact: true }).inputValue(), '');
            }
            await page.getByRole('button', { name: 'Любимые 8–10', exact: true }).click();
            assert((await page.locator('.book-authors-row').count()) <= initial);
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            assert.equal(await page.locator('#personal').textContent(), 'Личные впечатления $& [[Ссылка]]');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode},${theme},${JSON.stringify(layout)}`);
            const clipped = await page.locator('.book-series-ui').evaluate(root => [...root.querySelectorAll('input,select,.book-authors-chip,.book-authors-row-title')].filter(node => node.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).map(node => node.className));
            assert.deepEqual(clipped, []);
            if (process.env.SERIES_SCREENSHOT_DIR && !layout.pane && (layout.width === 390 && theme === 'theme-light' || [688, 1024].includes(layout.width) && theme === 'theme-dark')) {
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({ path: path.join(process.env.SERIES_SCREENSHOT_DIR, `series-${mode}-${layout.width}.png`), fullPage: true });
            }

            await page.evaluate(selectedSeries => {
                window.seriesService.snapshot = async () => [...await window.originalSeriesSnapshot(), { file: { path: 'Книги/Художественные/Новая книга серии.md', basename: 'Новая книга серии' }, fm: { title: 'Новая книга серии', authors: ['Лю Цысинь'], series: selectedSeries, rating: 9, work_type: 'book' }, history: [{ date: '2026-10-05', number: 1, rating: 9 }], excerpts: [] }];
                window.refreshSeries();
            }, selectedSeries);
            if (mode === 'series-index') {
                await page.getByLabel(searchLabel, { exact: true }).fill(selectedSeries);
                await page.waitForFunction(count => document.querySelector('.book-authors-chips strong')?.textContent === String(count), seriesRecords.length + 1);
                await assertCompactSeriesMetrics(page, layout);
            } else {
                await page.waitForFunction(count => document.querySelector('.book-authors-result-count')?.textContent === `Произведений: ${count}`, seriesRecords.length + 1);
                assert.equal(await page.locator('.book-authors-row-title a').last().textContent(), 'Новая книга серии', 'A part without a series index appears last');
            }
            assert.equal(await page.locator('#personal').textContent(), 'Личные впечатления $& [[Ссылка]]');
            assert((await page.evaluate(() => window.seriesComponent.disposers.length)) > 0, 'The view registers cleanup with Dataview');
            await page.evaluate(() => window.seriesHandle.dispose());
            assert.equal(await page.evaluate(() => window.subscriptions), 0);
            assert.equal(await page.evaluate(() => window.seriesComponent.children.size), 0);
            if (mode === 'series') assert.equal(await page.evaluate(() => window.tableChild.unloaded), true);
            if (mode === 'series' && layout.width === 390 && theme === 'theme-light') {
                await page.evaluate(async () => {
                    document.querySelector('#content').replaceChildren();
                    const { render, app, obsidian } = window.seriesFixture;
                    window.emptySeriesHandle = await render({ app, obsidian, mode: 'series', dv: { container: document.querySelector('#content'), component: window.seriesComponent, current: () => ({ selected_series: '', file: { path: 'Книги/_system/Серии/Пустая.md' } }) } });
                });
                assert.equal(await page.locator('.book-authors-name').textContent(), 'Серия не выбрана');
                assert.equal(await page.locator('.book-authors-row').count(), 0);
                assert.equal(await page.locator('.book-authors-result-count').textContent(), 'Произведений: 0');
                assert.equal(await page.getByRole('link', { name: 'Выбрать серию', exact: true }).getAttribute('data-href'), 'Книги/_system/Серии');
                assert.equal(await page.locator('#personal').textContent(), 'Личные впечатления $& [[Ссылка]]');
                await page.evaluate(() => window.emptySeriesHandle.dispose());
                assert.equal(await page.evaluate(() => window.subscriptions), 0);
            }
            assert.deepEqual(errors, []);
            checks++; await page.close();
        }
    } finally { await browser.close(); }
    console.log(`${checks} series Chromium scenarios passed: real library, part order, search, filters, reset, QuickAdd, lazy Base, stats, automatic refresh, personal notes, themes, narrow panes and cleanup.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
