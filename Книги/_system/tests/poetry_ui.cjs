const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..'), poetry = require('../poetry.js');
const source = fs.readFileSync(path.join(root, '_system/poetry.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/poetry.css'), 'utf8');
const note = fs.readFileSync(path.join(root, 'Стихи.md'), 'utf8');
const thingsCss = fs.readFileSync(path.resolve(root, '../.obsidian/themes/Things/theme.css'), 'utf8');
const gruvboxCss = fs.readFileSync(path.resolve(root, '../.obsidian/snippets/Obsidian gruvbox.css'), 'utf8');
const dataviewCss = fs.readFileSync(path.resolve(root, '../.obsidian/plugins/dataview/styles.css'), 'utf8');
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:var(--background-primary);color:var(--text-normal);--editor-font:"JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e}main{width:100%;max-width:1100px;margin:auto;padding:24px;min-width:0}.markdown-preview-sizer{width:100%;max-width:820px;margin-inline:auto;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b}`;
const fixtureNote = `# Стихи

## Пётр Ёлкин

### Осенний дождь
Я помню ёлку, дождь и даль.  
Ещё одна строка без спешки.

### Слова без разметки
Текст <script>window.injected=true</script> & "кавычки".

## Другой автор

### Длинное название стихотворения для проверки узкой панели
${'Очень длинная строка стихотворения, которая должна переноситься внутри страницы. '.repeat(12)}

### Последний текст
Тихий вечер, ясный свет.
`;
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function mount(browser, { width = 1024, theme = 'theme-light', pane, text = note, failSourceRead = false } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const paneStyle = pane ? ` style="width:${pane}px;margin-inline:0"` : '';
    await page.setContent(`<style>${baseline}</style><style>${thingsCss}</style><style>${gruvboxCss}</style><style>${dataviewCss}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered book-poetry-page"${paneStyle}><div class="markdown-preview-sizer markdown-preview-section"><div class="metadata-container">Свойства</div><div class="inline-title">Стихи</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div><div class="el-h2" id="native-heading"><h2>Исходные тексты</h2></div><div class="el-p" id="native-source"><p>${escape(text).replaceAll('\n', '<br>')}</p></div></div></main></body>`);
    await page.evaluate(async ({ source, css, text, failSourceRead }) => {
        const file = { path: 'Книги/Стихи.md', basename: 'Стихи', extension: 'md', text, stat: { mtime: 1 } };
        const files = new Map([[file.path, file], ['Книги/_system/poetry.css', { path: 'Книги/_system/poetry.css', text: css }]]);
        const events = new Map(), disposers = [], openCalls = [], cursors = [], copies = [], notices = [];
        const on = (name, callback) => { const ref = { name, callback }; if (!events.has(name)) events.set(name, new Set()); events.get(name).add(ref); return ref; };
        const offref = ref => events.get(ref.name)?.delete(ref);
        const emit = (name, ...args) => { for (const ref of events.get(name) || []) ref.callback(...args); };
        const editor = { setCursor: value => cursors.push(value), focus: () => { window.fixture.editorFocus++; } };
        const leaf = { view: { editor }, openFile: async (...args) => openCalls.push(args) };
        const app = {
            vault: { getAbstractFileByPath: filePath => files.get(filePath), read: async value => {
                if (value.path === file.path) { window.fixture.reads++; if (failSourceRead) throw new Error('Source fixture is unavailable'); }
                return value.text;
            }, on, offref },
            workspace: { on, offref, getLeaf: newLeaf => { window.fixture.leafCalls.push(newLeaf); return leaf; }, openLinkText: (...args) => openCalls.push(args), getActiveViewOfType: () => null }
        };
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => copies.push(value) } });
        const obsidian = { Notice: class { constructor(message) { notices.push(String(message)); } }, MarkdownView: class {}, setIcon: (element, icon) => { element.dataset.icon = icon; } };
        window.fixture = { file, files, events, disposers, openCalls, cursors, copies, notices, leafCalls: [], editorFocus: 0, reads: 0, emit,
            modify(value) { file.text = value; file.stat.mtime++; emit('modify', file); },
            subscriptionCount() { return [...events.values()].reduce((sum, refs) => sum + refs.size, 0); }
        };
        const module = { exports: {} }; new Function('module', source)(module);
        try {
            window.handle = await module.exports({ app, obsidian, dv: { container: document.querySelector('#content'), current: () => ({ file: { path: file.path } }), component: { register: callback => disposers.push(callback), registerEvent: () => {} } } });
        } catch (error) {
            if (!failSourceRead) throw error;
            window.fixture.initialError = error.message;
        }
    }, { source, css, text, failSourceRead });
    return { page, errors };
}

async function showNavigation(page) {
    const button = page.getByRole('button', { name: 'Оглавление', exact: true });
    if (await button.isVisible() && await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function choose(page, title) {
    await showNavigation(page);
    await page.locator('.book-poetry-poem-button').filter({ hasText: title }).first().click();
    await page.waitForFunction(expected => document.querySelector('.book-poetry-title')?.textContent === expected, title);
}
async function assertBounded(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The page fits its viewport');
    const overflowing = await page.evaluate(() => ['.markdown-preview-view', '.markdown-preview-sizer', '#content', '.book-poetry-ui', '.book-poetry-navigation', '.book-poetry-reader', '.book-poetry-text'].flatMap(selector => {
        const node = document.querySelector(selector);
        if (!node?.getClientRects().length || node.scrollWidth <= node.clientWidth + 1) return [];
        return [{ selector, client: node.clientWidth, scroll: node.scrollWidth }];
    }));
    assert.deepEqual(overflowing, [], 'Obsidian, Dataview and reader containers do not scroll horizontally');
}
async function dispose(page) {
    await page.evaluate(() => { window.handle?.dispose?.(); for (const callback of window.fixture.disposers) callback(); });
    assert.equal(await page.evaluate(() => window.fixture.subscriptionCount()), 0, 'Unload removes vault and workspace subscriptions');
}
async function screenshot(page, filename) {
    if (!process.env.POETRY_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.POETRY_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.POETRY_SCREENSHOT_DIR, filename) });
}

async function layoutChecks(browser) {
    const poems = poetry.parsePoems(note); assert(poems.length > 1, 'The real poem collection is parsed');
    let count = 0;
    for (const layout of [{ width: 320 }, { width: 390 }, { width: 1024 }, { width: 1280, pane: 390 }]) for (const theme of ['theme-light', 'theme-dark']) {
        const { page, errors } = await mount(browser, { ...layout, theme });
        try {
            assert.equal(await page.getByRole('heading', { name: 'Стихи', level: 1, exact: true }).count(), 1);
            assert.equal(await page.locator('.book-poetry-title').textContent(), poems[0].title);
            assert.equal(await page.locator('.book-poetry-text').textContent(), poems[0].text);
            assert.equal(await page.locator('.book-poetry-poem-button').count(), poems.length);
            assert.equal(await page.locator('#native-source').isVisible(), false, 'Enhanced reading hides duplicate native texts');
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            assert.equal(await page.locator('.inline-title').isVisible(), false);
            const mobile = Boolean(layout.pane) || layout.width < 680;
            const toggle = page.getByRole('button', { name: 'Оглавление', exact: true });
            if (mobile) {
                assert.equal(await toggle.isVisible(), true);
                assert.equal(await page.locator('.book-poetry-navigation').isVisible(), false, 'Narrow panes start with collapsed contents');
                await toggle.click();
                assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
                assert.equal(await page.locator('.book-poetry-navigation').isVisible(), true);
            } else {
                const nav = await page.locator('.book-poetry-navigation').boundingBox(), reader = await page.locator('.book-poetry-reader').boundingBox();
                assert(nav.x + nav.width <= reader.x + 1, 'Desktop contents and reader occupy adjacent columns');
            }
            await assertBounded(page);
            const last = poems.at(-1), previous = poems.at(-2);
            await choose(page, last.title);
            assert.equal(await page.locator('.book-poetry-text').textContent(), last.text);
            if (mobile) {
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Selecting a poem closes narrow contents');
                assert.equal(await page.locator('.book-poetry-navigation').isVisible(), false);
            }
            await page.getByRole('button', { name: 'Предыдущее стихотворение', exact: true }).click();
            assert.equal(await page.locator('.book-poetry-title').textContent(), previous.title);
            await page.getByRole('button', { name: 'Следующее стихотворение', exact: true }).click();
            assert.equal(await page.locator('.book-poetry-title').textContent(), last.title);
            await page.getByLabel('Автор', { exact: true }).selectOption({ label: last.author });
            assert.equal(await page.locator('.book-poetry-poem-button').count(), poems.filter(poem => poem.author === last.author).length);
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            await page.getByLabel('Поиск стихов', { exact: true }).fill('бродский');
            assert.equal(await page.locator('.book-poetry-poem-button').count(), poems.filter(poem => poem.author.includes('Бродский')).length);
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            await page.getByLabel('Поиск стихов', { exact: true }).fill('никогда войдешь');
            assert.equal(await page.locator('.book-poetry-poem-button').count(), 1, 'Search finds words in the full poem with ё/е normalization');
            assert.match(await page.locator('.book-poetry-text').textContent(), /войдёшь/u);
            await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
            const all = page.getByRole('button', { name: 'Все тексты', exact: true });
            await all.click();
            assert.equal(await all.getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('#native-source').isVisible(), true, 'Native source remains available for full-page reading and anchors');
            await all.click();
            assert.equal(await page.locator('#native-source').isVisible(), false);
            await assertBounded(page);
            if (!layout.pane && (layout.width === 390 && theme === 'theme-light' || layout.width === 1024)) {
                await page.evaluate(() => window.scrollTo(0, 0));
                await screenshot(page, `poetry-${layout.width}-${theme}.png`);
            }
            assert.equal(await page.evaluate(() => window.fixture.file.text), note, 'Reading and navigation preserve the source note');
            await dispose(page); assert.deepEqual(errors, []); count++;
        } finally { await page.close(); }
    }
    return count;
}

async function interactionChecks(browser) {
    const poems = poetry.parsePoems(fixtureNote), { page, errors } = await mount(browser, { text: fixtureNote, width: 390 });
    try {
        await page.getByLabel('Поиск стихов', { exact: true }).fill('петр елкин');
        assert.equal(await page.locator('.book-poetry-poem-button').count(), 2, 'Author search normalizes ё/е');
        await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
        await page.getByLabel('Поиск стихов', { exact: true }).fill('помню елку');
        assert.equal(await page.locator('.book-poetry-poem-button').count(), 1);
        await page.getByRole('button', { name: 'Копировать стихотворение', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.fixture.copies), [poems[0].text], 'Copy preserves the full poem and its line breaks');
        await page.getByRole('button', { name: 'Редактировать стихотворение', exact: true }).click();
        const edit = await page.evaluate(() => ({ open: window.fixture.openCalls[0], cursor: window.fixture.cursors[0], leaves: window.fixture.leafCalls, focus: window.fixture.editorFocus }));
        assert.equal(edit.open[0].path, 'Книги/Стихи.md');
        assert.equal(edit.open[1].state.mode, 'source');
        assert.equal(edit.open[1].eState.line, poems[0].line);
        assert.deepEqual(edit.cursor, { line: poems[0].line, ch: 0 });
        assert.deepEqual(edit.leaves, [false]); assert.equal(edit.focus, 1);
        await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
        await choose(page, poems[1].title);
        assert.equal(await page.locator('.book-poetry-text').textContent(), poems[1].text);
        assert.equal(await page.evaluate(() => window.injected), undefined, 'Poems are rendered as text rather than executing markup');
        assert.equal(await page.locator('.book-poetry-text script').count(), 0);
        await choose(page, poems[2].title); await assertBounded(page);
        await choose(page, poems[0].title);
        const changed = fixtureNote.replace('Я помню ёлку, дождь и даль.', 'Теперь я помню обновлённую даль.');
        await page.evaluate(text => window.fixture.modify(text), changed);
        await page.waitForFunction(() => document.querySelector('.book-poetry-text')?.textContent.includes('обновлённую даль'));
        assert.equal(await page.locator('.book-poetry-title').textContent(), poems[0].title, 'Live updates retain the selected poem');
        await page.evaluate(() => window.fixture.emit('file-open', window.fixture.file));
        await page.waitForFunction(() => document.querySelector('.book-poetry-ui')?.dataset.sourceOpen === 'true');
        assert.equal(await page.locator('#native-source').isVisible(), true, 'Opening a native heading makes the source visible');
        await dispose(page);
        const reads = await page.evaluate(() => window.fixture.reads);
        await page.evaluate(() => window.fixture.modify('# Changed after unload'));
        assert.equal(await page.evaluate(() => window.fixture.reads), reads, 'Disposed readers do not read modified files');
        assert.equal(await page.evaluate(() => window.fixture.file.text), '# Changed after unload', 'The UI never writes poem notes');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function fallbackChecks(browser) {
    const { page, errors } = await mount(browser, { failSourceRead: true });
    try {
        assert.equal(await page.locator('#native-source').isVisible(), true, 'A read failure leaves native Markdown readable');
        assert.equal(await page.locator('.book-poetry-ui[data-ready="true"]').count(), 0);
        assert.equal(await page.evaluate(() => window.fixture.initialError), 'Source fixture is unavailable');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        const layouts = await layoutChecks(browser);
        await interactionChecks(browser); await fallbackChecks(browser);
        console.log(`${layouts} poetry Chromium layouts passed: Things, gruvbox and Dataview, narrow panes, overflow, author/text search, ё/е, selection, previous/next, native source, copy/edit, live updates and unload.`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
