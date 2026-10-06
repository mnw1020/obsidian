const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = fs.readFileSync(path.resolve(__dirname, '../quote_create.js'), 'utf8');
const books = [
    { file: { path: 'Книги/Non-fiction/A.md', basename: 'A' }, fm: { title: 'Одинаковая книга', authors: ['Автор А'] } },
    { file: { path: 'Книги/Non-fiction/B.md', basename: 'B' }, fm: { title: 'Одинаковая книга', authors: ['Автор А', 'Автор Б'] } },
    { file: { path: 'Книги/Non-fiction/C.md', basename: 'C' }, fm: { title: 'Другая книга', authors: ['Автор Б'] } },
    { file: { path: 'Книги/Non-fiction/D.md', basename: 'D' }, fm: { title: '<img src=x onerror="window.injected=true">', authors: ['Автор В'] } }
];
const style = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-normal:#302e2a;--text-muted:#716b62;--text-error:#a83232;--text-accent:#9b561e;background:var(--background-primary);color:var(--text-normal)}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-normal:#ececec;--text-muted:#b4b8c2;--text-error:#ff8585;--text-accent:#efa76b}.modal-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:#0003}.modal{max-height:94vh;padding:20px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;box-shadow:0 16px 70px #0003}.modal-content{min-width:0}input,textarea,select{font:inherit;color:var(--text-normal);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:5px;padding:7px 9px}button{font:inherit;border:1px solid var(--background-modifier-border);border-radius:6px;padding:7px 13px;background:var(--background-secondary);color:var(--text-normal);cursor:pointer}.mod-cta{color:var(--text-accent)}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--text-accent);outline-offset:2px}`;

async function mount(browser, width, theme) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>${style}</style><body class="${theme}"></body>`);
    await page.evaluate(async ({ source, books }) => {
        const app = { vault: new Proxy({}, { get() { throw new Error('A creation form must not read or write the vault'); } }) };
        class Modal {
            constructor(app) {
                this.app = app; this.container = document.createElement('div'); this.container.className = 'modal-container';
                this.modalEl = document.createElement('div'); this.modalEl.className = 'modal'; this.container.append(this.modalEl);
                this.contentEl = document.createElement('div'); this.contentEl.className = 'modal-content'; this.modalEl.append(this.contentEl);
            }
            open() { document.body.append(this.container); this.opened = true; this.onOpen(); }
            close() { this.opened = false; this.container.remove(); }
        }
        const module = { exports: {} }; new Function('module', source)(module);
        window.calls = []; window.rejectSave = false;
        window.openModal = async initial => {
            window.creator = await module.exports({ app, obsidian: { Modal }, books, initial,
                onSave: async value => { if (window.rejectSave) throw new Error('Не удалось сохранить. Попробуйте снова.'); window.calls.push(value); } });
        };
        await window.openModal({ text: 'Важная мысль из заметки.', section: 'Мотивация/в' });
    }, { source, books });
    return { page, errors };
}
async function assertFit(page) {
    const overflowing = await page.evaluate(() => ['html', '.modal', '.modal-content'].flatMap(selector => {
        const element = document.querySelector(selector);
        return element.scrollWidth > element.clientWidth ? [{ selector, client: element.clientWidth, scroll: element.scrollWidth }] : [];
    }));
    assert.deepEqual(overflowing, [], 'Native modal fits the viewport without horizontal scrolling');
    assert.equal(await page.locator('img').count(), 0, 'Untrusted book titles are rendered as text');
    assert.equal(await page.evaluate(() => Boolean(window.injected)), false);
}
async function screenshot(page, name) {
    if (!process.env.QUOTES_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.QUOTES_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.QUOTES_SCREENSHOT_DIR, name) });
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let checks = 0;
    try {
        for (const width of [320, 390, 1024]) for (const theme of ['theme-light', 'theme-dark']) {
            const { page, errors } = await mount(browser, width, theme);
            try {
                assert.equal(await page.getByLabel('Источник', { exact: true }).inputValue(), 'free');
                assert.equal(await page.getByLabel('Автор', { exact: true }).isVisible(), true);
                assert.equal(await page.getByLabel('Книга', { exact: true }).isVisible(), false);
                assert.equal(await page.getByLabel('Раздел', { exact: true }).inputValue(), 'Мотивация/в');
                assert.equal(await page.evaluate(() => document.activeElement === window.creator.fields.text), true);
                await assertFit(page);
                if (width === 390 && theme === 'theme-light') await screenshot(page, 'quote-create-free-mobile.png');
                if (width === 1024 && theme === 'theme-dark') await screenshot(page, 'quote-create-free-desktop-dark.png');

                await page.getByLabel('Источник', { exact: true }).selectOption('book');
                await page.getByLabel('Автор книги', { exact: true }).selectOption('Автор Б');
                const optionValues = await page.getByLabel('Книга', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
                assert.deepEqual(optionValues.sort(), [books[1].file.path, books[2].file.path]);
                await page.getByLabel('Книга', { exact: true }).selectOption(books[1].file.path);
                assert.match(await page.getByLabel('Книга', { exact: true }).locator('option:checked').textContent(), /Non-fiction\/B\.md/u);
                await assertFit(page);
                if (width === 1024 && theme === 'theme-light') await screenshot(page, 'quote-create-book-desktop.png');
                await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
                await page.waitForFunction(() => window.calls.length === 1);
                assert.equal(await page.evaluate(() => window.calls[0].bookPath), books[1].file.path);
                assert.equal(await page.locator('.modal').count(), 0);

                await page.evaluate(() => window.openModal({ bookPath: 'Книги/Non-fiction/A.md', text: 'Текст из открытой книги.', section: 'Мотивация/в' }));
                assert.equal(await page.getByLabel('Источник', { exact: true }).inputValue(), 'book');
                assert.equal(await page.getByLabel('Книга', { exact: true }).inputValue(), books[0].file.path, 'Initial book context survives actual HTMLSelectElement option population');
                await page.getByLabel('Источник', { exact: true }).selectOption('free');
                await page.getByLabel('Автор', { exact: true }).fill('Автор, Имя; Второй автор');
                await page.getByLabel('Произведение', { exact: true }).fill('Внешнее произведение');
                await page.locator('.book-quote-create-additional > summary').click();
                await page.getByLabel('Мой вывод', { exact: true }).fill('Полезная мысль.');
                await assertFit(page);
                await page.evaluate(() => { window.rejectSave = true; });
                await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
                await page.getByRole('alert').waitFor({ state: 'visible' });
                assert.match(await page.getByRole('alert').textContent(), /Попробуйте снова/u);
                assert.equal(await page.getByLabel('Текст цитаты', { exact: true }).inputValue(), 'Текст из открытой книги.');
                assert.equal(await page.getByRole('button', { name: 'Сохранить', exact: true }).isEnabled(), true);
                await page.evaluate(() => { window.rejectSave = false; });
                await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
                await page.waitForFunction(() => window.calls.length === 2);
                assert.deepEqual(await page.evaluate(() => window.calls[1].sourceAuthors), ['Автор, Имя', 'Второй автор']);
                assert.equal(await page.evaluate(() => window.calls[1].sourceKind), 'free');
                assert.equal(await page.evaluate(() => window.calls[1].sourceTitle), 'Внешнее произведение');
                assert.equal(await page.locator('.modal').count(), 0);
                assert.deepEqual(errors, []); checks++;
            } finally { await page.close(); }
        }
        console.log(`${checks} native quote creation layouts passed: free/book source, author filtering, canonical book selection, initial context, preserved input, retry and responsive fields.`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
