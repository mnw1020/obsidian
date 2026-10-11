const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const sourceNames = ['maintenance_ui.js', 'maintenance-ui.css', 'maintenance_pages.js', 'authors-ui.css', 'books-library.css'];
const sources = Object.fromEntries(sourceNames.map(name => ['Книги/_system/' + name, fs.readFileSync(path.join(root, '_system', name), 'utf8')]));
const helper = require('../maintenance_pages.js');
const auditPath = 'Книги/_system/Проверка библиотеки.md', journalPath = 'Книги/_system/Журнал изменений.md';
const auditText = fs.readFileSync(path.join(root, '_system/Проверка библиотеки.md'), 'utf8');
const realJournalText = fs.readFileSync(path.join(root, '_system/Журнал изменений.md'), 'utf8');
const journalText = helper.parseJournal(realJournalText).length ? realJournalText : helper.page(realJournalText, 'journal') + '\n<!-- BOOK-LIBRARY-EVENT at="2026-10-11T18:20:00" normalization="true" structure="false" -->\n## 11.10.2026 18:20\n\n- Нормализация автора: **Автор Первый** → **Первый автор**, изменено книг: **2**.\n\n<!-- BOOK-LIBRARY-EVENT at="2026-10-12T17:10:00" normalization="false" structure="true" -->\n## 12.10.2026 17:10\n\n- Добавлено произведение: [[Книги/Художественные/Не менять|Не менять]] — `Книги/Художественные/Достаточно длинное название произведения для проверки узкой панели.md`.\n';
const originalEntries = helper.parseJournal(journalText);
assert(originalEntries.length, 'The in-memory journal fixture contains entries');
const audit = helper.parseAudit(auditText);
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:var(--background-primary);color:var(--text-normal);--font-interface:"JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e;--interactive-accent:#9b561e;--text-error:#a83232}main{width:100%;max-width:1100px;margin:auto;padding:24px;min-width:0}.markdown-preview-sizer{width:100%;min-width:0}button,select{font:inherit;cursor:pointer}a{color:var(--text-accent)}p{margin:12px 0}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b;--interactive-accent:#efa76b;--text-error:#ff8585}@media(max-width:500px){main{padding:16px}}`;
// Portable copy of the active gruvbox heading rules, including their cascade priority.
const gruvboxHeadings = `.cm-header-1,.markdown-preview-section h1{font-weight:900!important;font-size:2.2em!important;color:var(--text-title-h1)!important}.cm-header-2,.markdown-preview-section h2{font-weight:900!important;font-size:2em!important;color:var(--text-title-h2)!important}.cm-header-3,.markdown-preview-section h3{font-weight:900!important;font-size:1.8em!important;color:var(--text-title-h3)!important}`;

async function mount(browser, layout, mode, theme) {
    const page = await browser.newPage({ viewport: { width: layout.width, height: 1100 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.setContent(`<style>${baseline}</style><style>${gruvboxHeadings}</style><style>${sources['Книги/_system/books-library.css']}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered books-library books-maintenance-page"><div class="markdown-preview-sizer markdown-preview-section"><div class="inline-title">Прежний заголовок</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div><div class="el-h1" id="native-title"><h1>Исходный заголовок</h1></div><div class="el-p" id="native-body"><p>Исходный Markdown отчёта или журнала</p></div></div></main></body>`);
    await page.evaluate(async ({ sources, auditText, journalText, auditPath, journalPath, mode }) => {
        class Events {
            constructor() { this.refs = new Set(); }
            on(name, callback) { const ref = { emitter: this, name, callback }; this.refs.add(ref); return ref; }
            offref(ref) { this.refs.delete(ref); }
            emit(name, ...args) { for (const ref of [...this.refs]) if (ref.name === name) ref.callback(...args); }
        }
        const components = [];
        class Component {
            constructor() { this.children = new Set(); this.cleanups = []; this.refs = []; this.unloaded = false; components.push(this); }
            load() {}
            register(callback) { if (this.unloaded) callback(); else this.cleanups.push(callback); }
            registerEvent(ref) { if (this.unloaded) ref.emitter.offref(ref); else this.refs.push(ref); }
            addChild(child) { if (this.unloaded) child.unload(); else this.children.add(child); return child; }
            removeChild(child) { this.children.delete(child); child.unload(); return child; }
            unload() { if (this.unloaded) return; this.unloaded = true; for (const callback of this.cleanups.splice(0)) callback(); for (const ref of this.refs.splice(0)) ref.emitter.offref(ref); for (const child of this.children) child.unload(); this.children.clear(); }
        }
        const map = new Map(Object.entries(sources).map(([path, text]) => [path, { path, text }]));
        for (const [path, text] of [[auditPath, auditText], [journalPath, journalText], ['Книги/Художественные/Не менять.md', '---\ntitle: Не менять\n---\n\nЛичные заметки $& [[Ссылка]]\n']]) map.set(path, { path, text });
        const processCalls = [], modifyCalls = [], choices = [], opened = [], renderCalls = [], notices = [];
        const vault = Object.assign(new Events(), {
            getAbstractFileByPath: path => map.get(path), read: async file => file.text, cachedRead: async file => file.text,
            process: async (file, callback) => { processCalls.push(file.path); file.text = callback(file.text); vault.emit('modify', file); return file.text; },
            modify: async (file, text) => { modifyCalls.push(file.path); file.text = text; vault.emit('modify', file); },
            create: async (path, text) => { throw new Error('Maintenance view must not create files: ' + path); }
        });
        const metadataCache = new Events(), sourcePath = mode === 'audit' ? auditPath : journalPath;
        const app = { vault, metadataCache, workspace: { openLinkText: (...args) => opened.push(args) }, plugins: { plugins: { quickadd: { api: { executeChoice: async (...args) => choices.push(args) } } } } };
        const component = new Component();
        function inline(parent, text) {
            const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
            let offset = 0, match;
            while ((match = pattern.exec(text))) {
                parent.append(document.createTextNode(text.slice(offset, match.index)));
                if (match[1] || match[5]) {
                    const anchor = document.createElement('a'), internal = Boolean(match[1]), target = match[1] || match[6];
                    anchor.textContent = internal ? match[2] || target.split('/').at(-1) : match[5]; anchor.href = target;
                    if (internal) { anchor.className = 'internal-link'; anchor.setAttribute('data-href', target); anchor.addEventListener('click', event => { event.preventDefault(); app.workspace.openLinkText(target, sourcePath, false); }); }
                    parent.append(anchor);
                } else { const node = document.createElement(match[3] ? 'strong' : 'code'); node.textContent = match[3] || match[4]; parent.append(node); }
                offset = pattern.lastIndex;
            }
            parent.append(document.createTextNode(text.slice(offset)));
        }
        const obsidian = { Component, normalizePath: path => path, Notice: class { constructor(message) { notices.push(String(message)); } }, MarkdownRenderer: { render: async (_app, markdown, container, source, child) => {
            renderCalls.push({ markdown, source, child });
            for (const line of String(markdown).split(/\r?\n/)) {
                if (!line.trim() || /^\s*<!--/.test(line)) continue;
                const heading = line.match(/^(#{1,6})\s+(.+)$/), node = document.createElement(heading ? 'h' + heading[1].length : line.startsWith('- ') ? 'li' : 'p');
                inline(node, heading ? heading[2] : line.replace(/^[->]\s*/, '')); container.append(node);
            }
        } } };
        const dv = { container: document.querySelector('#content'), component, current: () => ({ file: { path: sourcePath } }), paragraph: text => { const p = document.createElement('p'); p.textContent = text; document.querySelector('#content').append(p); } };
        window.fixture = { map, vault, metadataCache, app, component, components, processCalls, modifyCalls, choices, opened, renderCalls, notices,
            appendJournal() { const file = map.get(journalPath); file.text += '\n<!-- BOOK-LIBRARY-EVENT at="2026-10-12T19:30:00" normalization="false" structure="true" -->\n## 12.10.2026 19:30\n\n- Новое событие после очистки: [[Книги/Художественные/Не менять|Не менять]].\n'; vault.emit('modify', file); }
        };
        const module = { exports: {} }; new Function('module', sources['Книги/_system/maintenance_ui.js'])(module);
        window.handle = await module.exports({ dv, app, obsidian, mode });
    }, { sources, auditText, journalText, auditPath, journalPath, mode });
    await page.waitForSelector('.book-maintenance-ui[data-ready="true"]');
    return { page, errors };
}

async function assertTypography(page, layout, mode) {
    const typography = await page.locator('.book-maintenance-ui').evaluate(root => ({
        width: root.getBoundingClientRect().width,
        name: parseFloat(getComputedStyle(root.querySelector('.book-authors-name')).fontSize),
        sections: [...root.querySelectorAll('.book-authors-section-heading h2')].map(node => parseFloat(getComputedStyle(node).fontSize)),
        rows: [...root.querySelectorAll('.book-maintenance-section > summary,.book-maintenance-entry h2')].map(node => parseFloat(getComputedStyle(node).fontSize))
    }));
    const context = `${mode},${JSON.stringify(layout)}`;
    const name = typography.width <= 620 ? 29 : Math.min(43, Math.max(29, layout.width * .04));
    assert(Math.abs(typography.name - name) <= .02, `Page heading size: ${JSON.stringify(typography)},${context}`);
    assert(typography.sections.length, 'The page has a section heading');
    assert(typography.sections.every(size => size === 21), `Section headings stay at 21px: ${context}`);
    assert(typography.rows.length && typography.rows.every(size => size === 15), `Compact row headings stay at 15px: ${context}`);
}

async function assertBounded(page, context) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, context);
    const overflowing = await page.locator('.book-maintenance-ui').evaluate(root => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll('button,a,summary,.book-maintenance-entry,.book-authors-stat')].filter(node => {
            const rect = node.getBoundingClientRect(); return rect.width && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        }).map(node => ({ className: node.className, text: node.textContent.slice(0, 80) }));
    });
    assert.deepEqual(overflowing, [], context);
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let checks = 0;
    try {
        for (const layout of [{ width: 320 }, { width: 390 }, { width: 688 }, { width: 1024 }]) for (const mode of ['audit', 'journal']) for (const theme of ['theme-light', 'theme-dark']) {
            const { page, errors } = await mount(browser, layout, mode, theme), context = `${mode},${theme},${JSON.stringify(layout)}`;
            assert.equal(await page.locator('.book-authors-ui.book-maintenance-ui').getAttribute('data-mode'), mode);
            assert.equal(await page.locator('.inline-title').isVisible(), false);
            for (const selector of ['#native-title', '#native-body']) assert.equal(await page.locator(selector).isVisible(), false, 'Native fallback hides while the UI is ready');
            await assertTypography(page, layout, mode); await assertBounded(page, context);
            if (process.env.MAINTENANCE_SCREENSHOT_DIR && (layout.width === 390 && theme === 'theme-light' || layout.width === 688 && theme === 'theme-dark')) await page.screenshot({ path: path.join(process.env.MAINTENANCE_SCREENSHOT_DIR, `maintenance-${mode}-${layout.width}.png`), fullPage: mode === 'audit' });
            if (mode === 'audit') {
                const stats = await page.locator('.book-authors-stat').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.querySelector('.book-authors-stat-label').textContent, node.querySelector('.book-authors-stat-value').textContent])));
                assert.deepEqual(stats, { 'Произведений': String(audit.checked), 'Ошибок': String(audit.errors), 'Предупреждений': String(audit.warnings) });
                for (const [label, choice] of [['Проверить', 'Книги - Проверить библиотеку'], ['Исправить безопасное', 'Книги - Исправить безопасное'], ['Нормализовать', 'Книги - Нормализовать библиотеку']]) await page.getByRole('link', { name: label, exact: true }).click();
                assert.deepEqual(await page.evaluate(() => window.fixture.choices.map(call => call[0])), ['Книги - Проверить библиотеку', 'Книги - Исправить безопасное', 'Книги - Нормализовать библиотеку']);
                const detail = page.locator('.book-maintenance-section').filter({ has: page.locator('summary', { hasText: 'Возможные экранизации' }) });
                assert.equal(await detail.getAttribute('open'), null, 'Secondary audit sections start collapsed');
                const callsBefore = await page.evaluate(() => window.fixture.renderCalls.length);
                await detail.locator('summary').click();
                await page.waitForFunction(count => window.fixture.renderCalls.length > count, callsBefore);
                assert((await detail.locator('a.internal-link').count()) > 0, 'Expanded sections retain note links');
                await detail.locator('a.internal-link').first().click();
                assert.match((await page.evaluate(() => window.fixture.opened.at(-1)))[0], /^Книги\//u);
                await assertBounded(page, context + ',expanded');
                assert.deepEqual(await page.evaluate(() => window.fixture.processCalls), []);
            } else {
                assert.equal(await page.locator('.book-maintenance-entry').count(), originalEntries.length);
                const clear = page.getByRole('button', { name: 'Очистить журнал', exact: true });
                assert.equal(await clear.isDisabled(), false);
                await clear.click();
                await page.waitForFunction(() => document.querySelector('.book-maintenance-clear')?.disabled === true && document.querySelectorAll('.book-maintenance-entry').length === 0);
                assert.deepEqual(await page.evaluate(() => window.fixture.processCalls), [journalPath], 'Clearing uses one atomic journal process');
                assert.deepEqual(await page.evaluate(() => window.fixture.modifyCalls), [], 'Clearing does not replace the journal through a stale read');
                assert.equal(await page.evaluate(path => window.fixture.map.get(path).text, journalPath), helper.clearJournal(journalText));
                assert.equal(await page.evaluate(path => window.fixture.map.get(path).text, auditPath), auditText);
                assert.equal(await page.evaluate(() => window.fixture.map.get('Книги/Художественные/Не менять.md').text), '---\ntitle: Не менять\n---\n\nЛичные заметки $& [[Ссылка]]\n');
                await clear.evaluate(button => button.click());
                assert.deepEqual(await page.evaluate(() => window.fixture.processCalls), [journalPath], 'The empty journal cannot be cleared again');
                await page.evaluate(() => window.fixture.appendJournal());
                await page.waitForFunction(() => document.querySelectorAll('.book-maintenance-entry').length === 1 && document.querySelector('.book-maintenance-clear')?.disabled === false);
                assert.match(await page.locator('.book-maintenance-entry').innerText(), /Новое событие после очистки/u);
                await assertBounded(page, context + ',append');
            }
            await page.evaluate(() => { window.handle.dispose(); window.fixture.component.unload(); });
            const leaks = await page.evaluate(() => ({ vault: window.fixture.vault.refs.size, metadata: window.fixture.metadataCache.refs.size, children: window.fixture.components.reduce((sum, component) => sum + component.children.size, 0), activeChildren: window.fixture.components.slice(1).filter(component => !component.unloaded).length }));
            assert.deepEqual(leaks, { vault: 0, metadata: 0, children: 0, activeChildren: 0 }, 'Cleanup removes subscriptions and Markdown children');
            for (const selector of ['#native-title', '#native-body']) assert.equal(await page.locator(selector).isVisible(), true, 'Native fallback returns after cleanup');
            assert.deepEqual(errors, []); checks++; await page.close();
        }
    } finally { await browser.close(); }
    console.log(`${checks} maintenance Chromium scenarios passed: audit actions and lazy links, journal entries/atomic clear/empty/append, theme typography, narrow panes and cleanup.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
