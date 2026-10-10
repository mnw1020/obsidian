const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { fromText } = require('./yaml_fixture.cjs');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const target = 'Художественные/Лю Цысинь/Память о прошлом Земли. 03. Вечная жизнь смерти.md';
const card = { path: 'Книги/' + target, basename: 'Вечная жизнь смерти', fm: fromText(fs.readFileSync(path.join(root, target), 'utf8')) };
const source = fs.readFileSync(path.join(root, '_system/book_card.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/books-library.css'), 'utf8');
async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        for (const width of [320, 390, 1024]) for (const empty of [false, true]) {
            const example = empty ? { ...card, fm: { ...card.fm, adaptations: [] } } : card;
            const page = await browser.newPage({ viewport: { width, height: 1100 } });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.setContent('<style>body{margin:0;background:#20242a;color:#eee;font:16px/1.5 Arial;--background-primary:#20242a;--background-secondary:#292e36;--background-modifier-border:#454b56;--text-muted:#b4b8c2;--text-normal:#eee;--text-accent:#efa76b;--interactive-accent:#efa76b;--text-on-accent:#20242a}*{box-sizing:border-box}article{padding:16px;max-width:860px;margin:auto}a{color:#efa76b}</style><style>' + css + '</style><article class="book-card markdown-preview-view"><div id="card"></div></article>');
            await page.evaluate(async ({ card, source }) => {
                const container = document.querySelector('#card');
                const properties = document.createElement('div'); properties.className = 'metadata-container'; properties.textContent = 'YAML';
                document.querySelector('article').prepend(properties);
                window.calls = [];
                let active;
                const leaf = { view: { file: card, containerEl: document.querySelector('article') } };
                const app = {
                    vault: { getAbstractFileByPath: target => target === card.path ? card : null, getMarkdownFiles: () => [] },
                    metadataCache: { getFileCache: () => ({ frontmatter: card.fm }) },
                    workspace: { getLeavesOfType: () => [leaf], setActiveLeaf: () => { active = card; }, getActiveFile: () => active, openLinkText: (...args) => window.calls.push(args) },
                    plugins: { plugins: { quickadd: { api: { executeChoice: async (name, variables) => {
                        if (name !== 'Книги - Связать с кино' || variables.bookAdaptationRequest.path !== card.path) throw new Error('Wrong command context');
                        // Simulate a committed command while the metadata cache remains unchanged.
                        variables.bookAdaptationRequest.onLinked([...card.fm.adaptations, '[[Кино/Media/Новая связь]]']);
                    } } } } }
                };
                const module = { exports: {} }; new Function('module', source)(module);
                await module.exports.render({ app, dv: { current: () => ({ file: { path: card.path } }), container } });
            }, { card: example, source });
            const links = page.locator('.book-card-adaptation-links a');
            assert.equal(await links.count(), empty ? 0 : 3);
            assert.equal(await page.locator('.book-card-adaptations').isVisible(), !empty);
            if (!empty) {
                await page.getByText('Задача 3 тел', { exact: true }).click();
                assert.deepEqual(await page.evaluate(() => window.calls[0]), ['Кино/Media/Задача 3 тел', card.path, false]);
            }
            if (process.env.ADAPTATIONS_SCREENSHOT && width === 390 && !empty) await page.screenshot({ path: process.env.ADAPTATIONS_SCREENSHOT, fullPage: true });
            assert.equal(await page.locator('details, summary').count(), 0);
            assert.equal(await page.getByText('Экранизации', { exact: true }).count(), 0);
            for (const label of ['Записать чтение', 'Сохранить выписку', 'Редактировать чтение', 'Связать с кино', 'Показать свойства']) {
                assert.equal(await page.getByText(label, { exact: true }).isVisible(), true);
            }
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            await page.getByText('Показать свойства', { exact: true }).click();
            assert.equal(await page.locator('.metadata-container').isVisible(), true);
            await page.getByText('Скрыть свойства', { exact: true }).click();
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            await page.getByText('Связать с кино', { exact: true }).click();
            assert.equal(await links.count(), empty ? 1 : 4);
            assert.equal(await page.locator('.book-card-adaptations').isVisible(), true);
            assert.equal(await page.getByText('Новая связь', { exact: true }).count(), 1);
            assert.deepEqual(errors, []);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
            await page.close();
        }
        console.log('6 browser cases passed: empty block hidden, links styled, navigation and immediate first-link update, no overflow.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
