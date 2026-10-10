// Real Chromium rendering of the card module and note body. Does not launch or modify Obsidian.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { fromText } = require('./yaml_fixture.cjs');
const { migrate } = require('../tools/redesign_cards.cjs');
const { displayDate } = require('../book_card.js');
const deps = process.env.CODEX_TASK_NODE_MODULES || 'C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(deps, 'playwright'));
const root = path.resolve(__dirname, '../..');
const out = process.argv.find(x => x.startsWith('--screenshots='))?.slice(14);
const cards = [];
function scan(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, item.name);
        if (item.isDirectory()) { scan(full); continue; }
        if (!item.name.endsWith('.md') || item.name === '_index.md') continue;
        const text = fs.readFileSync(full, 'utf8'), fm = fromText(text);
        if (!fm.title || !fm.authors) continue;
        const original = fs.readFileSync(path.join(root, '_system/backups/card-redesign', path.relative(root, full) + '.before'), 'utf8');
        assert.equal(migrate(original), text, 'Migration changed personal text: ' + full);
        assert.equal(migrate(text), text, 'Migration must be idempotent');
        cards.push({ path: 'Книги/' + path.relative(root, full).replaceAll('\\', '/'), basename: item.name.slice(0, -3), fm, text });
    }
}
scan(path.join(root, 'Художественные')); scan(path.join(root, 'Non-fiction'));
assert.equal(displayDate('2021-12'), 'декабрь 2021');
assert.equal(displayDate('2026-09-25'), '25.09.2026');
const source = fs.readFileSync(path.join(root, '_system/book_card.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/books-library.css'), 'utf8');
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif;background:var(--background-primary);color:var(--text-normal);--font-interface:Arial;--background-primary:#20242a;--background-secondary:#292e36;--background-modifier-border:#454b56;--text-muted:#b4b8c2;--text-normal:#ececec;--text-error:#ff8383;--text-accent:#efa76b;--interactive-accent:#efa76b;--text-on-accent:#20242a}.markdown-preview-view{max-width:860px;margin:auto;padding:24px;min-width:0}a{color:var(--text-accent)}h2{font-size:1.4em}h3{font-size:1em}.metadata-container{padding:20px;border:1px solid var(--background-modifier-border)}.light{--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e;--interactive-accent:#9b561e;--text-on-accent:#fff} @media(max-width:520px){.markdown-preview-view{padding:16px}}`;
async function main() {
    const { marked } = await import(pathToFileURL(path.join(deps, 'marked/lib/marked.esm.js')).href);
    const azimov = cards.find(c => c.fm.title === 'Все грехи мира');
    const kurpatov = cards.find(c => c.fm.title === 'Красная таблетка');
    const long = { ...azimov, path: 'Книги/Художественные/Длинная.md', fm: { ...azimov.fm, title: 'Очень длинное название произведения: размышления о человеческом сознании и далёком будущем', authors: ['Первый автор с длинным именем', 'Второй автор'], series: 'История цивилизаций далёкого будущего', series_index: 12 } };
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let count = 0;
    try {
        for (const layout of [{ width: 320 }, { width: 390 }, { width: 1024 }, { width: 1024, pane: 320 }, { width: 1024, pane: 390 }]) for (const theme of ['dark', 'light']) for (const card of [azimov, kurpatov, long]) {
            const { width, pane } = layout;
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            const body = card.text.split('<!-- BOOK-CARD:END -->')[1];
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + baseline + '\n' + css + '</style></head><body class="' + theme + '"><article class="book-card markdown-preview-view"' + (pane ? ' style="width:' + pane + 'px"' : '') + '><div class="inline-title">Duplicate title</div><div class="metadata-container">Свойства карточки</div><div id="header"></div><div class="notes">' + marked.parse(body) + '</div></article></body></html>');
            await page.evaluate(async ({ card, source }) => {
                const container = document.querySelector('#header');
                const leaf = { view: { file: card, containerEl: document.querySelector('article') } };
                let active = { path: 'Другая.md' };
                window.calls = [];
                const app = {
                    vault: { getAbstractFileByPath: p => p === card.path ? card : null },
                    metadataCache: { getFileCache: () => ({ frontmatter: card.fm }) },
                    workspace: { getLeavesOfType: () => [leaf], setActiveLeaf: l => { active = l.view.file; }, getActiveFile: () => active, openLinkText: (...args) => window.calls.push({ link: args }) },
                    plugins: { plugins: { quickadd: { api: { executeChoice: async (name, vars) => window.calls.push({ name, vars, active: active.path }) } } } }
                };
                const module = { exports: {} }; new Function('module', source)(module);
                await module.exports.render({ app, dv: { current: () => ({ file: { path: card.path } }), container } });
            }, { card, source });
            assert.deepEqual(errors, []);
            assert.equal(await page.locator('.book-card-title').textContent(), card.fm.title);
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            assert.equal(await page.locator('.inline-title').isVisible(), false);
            assert.equal(await page.locator('.book-card-rating').count(), card.path.includes('Non-fiction') ? 0 : 1);
            const bounds = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('.book-card-hero a,.book-card-title,.book-card-rating')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < 0); }).map(el => el.textContent) }));
            assert(bounds.scroll <= width + 1, 'Page overflow: ' + JSON.stringify(bounds)); assert.deepEqual(bounds.clipped, []);
            if (pane || width < 520) assert(await page.evaluate(() => Math.abs(document.querySelector('.book-card-primary').getBoundingClientRect().width - document.querySelector('.book-card-actions').getBoundingClientRect().width) < 2), 'Actions must expand in a narrow pane');
            await page.getByText('Записать чтение', { exact: true }).click();
            await page.locator('.book-card-author').first().click();
            assert.deepEqual(await page.evaluate(() => window.calls.slice(0, 2)), [{ name: 'Книги - Добавить чтение', vars: {}, active: card.path }, { name: 'Книги - Открыть автора', vars: { author: [].concat(card.fm.authors)[0] }, active: card.path }]);
            if (out && card === azimov) { fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: path.join(out, `book-${theme}-${width}${pane ? '-pane-' + pane : ''}.png`), fullPage: true }); }
            await page.getByText('Показать свойства', { exact: true }).click();
            assert.equal(await page.locator('.metadata-container').isVisible(), true);
            await page.getByText('Скрыть свойства', { exact: true }).click();
            assert.equal(await page.locator('.metadata-container').isVisible(), false);
            await page.close(); count++;
        }
    } finally { await browser.close(); }
    console.log(JSON.stringify({ migratedCards: cards.length, renderCases: count, widths: [320, 390, 1024], themes: ['dark', 'light'], preservation: 'passed', contextActions: 'passed', limitations: 'Chromium fixture; native Obsidian theme and mobile app are separate checks.' }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
