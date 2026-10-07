const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '_system/poetry_edit.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, '_system/poetry_storage.js'), 'utf8');
const parser = fs.readFileSync(path.join(root, '_system/poetry.js'), 'utf8');
const thingsCss = fs.readFileSync(path.resolve(root, '../.obsidian/themes/Things/theme.css'), 'utf8');
const gruvboxCss = fs.readFileSync(path.resolve(root, '../.obsidian/snippets/Obsidian gruvbox.css'), 'utf8');
const fixtureNote = `---
cssclasses:
  - book-poetry-page
---
# Стихи

Личное вступление, которое должно сохраниться.

## Пётр Ёлкин

### Память
Первая строка воспоминаний.  
Вторая строка.

### Другие строки
Этот текст остаётся неизменным.

---

## Другой автор

### Свет
Тихий свет.
`;
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-normal:#302e2a;--text-muted:#716b62;--text-error:#a83232;background:var(--background-primary);color:var(--text-normal)}body.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-normal:#ececec;--text-muted:#b4b8c2;--text-error:#ff8585}body.theme-light,body.theme-dark{--text-accent:#efa76b;--interactive-accent:#efa76b}.modal-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:#0003}.modal{max-height:94vh;padding:20px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;box-shadow:0 16px 70px #0003}.modal-content{min-width:0}input,textarea,select{font:inherit;color:var(--text-normal);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:5px;padding:7px 9px}button{font:inherit;border:1px solid var(--background-modifier-border);border-radius:6px;padding:7px 13px;background:var(--background-secondary);color:var(--text-normal);cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--text-accent);outline-offset:2px}`;

async function mount(browser, width, theme) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>${thingsCss}</style><style>${gruvboxCss}</style><style>${baseline}</style><body class="${theme}"></body>`);
    await page.evaluate(({ source, storage, parser, note }) => {
        const file = { path: 'Книги/Стихи.md', basename: 'Стихи', extension: 'md', text: note };
        const storageFile = { path: 'Книги/_system/poetry_storage.js', text: storage };
        const files = new Map([[file.path, file], [storageFile.path, storageFile]]);
        const app = { vault: { getAbstractFileByPath: filePath => files.get(filePath), read: async value => value.text,
            process: async (value, transform) => {
                window.fixture.processCalls++;
                if (window.fixture.rejectProcess) throw new Error('Не удалось сохранить. Попробуйте снова.');
                const updated = await transform(value.text);
                value.text = updated; window.fixture.writes++; return updated;
            } } };
        class Modal {
            constructor(app) {
                this.app = app; this.containerEl = document.createElement('div'); this.containerEl.className = 'modal-container';
                this.modalEl = document.createElement('div'); this.modalEl.className = 'modal'; this.containerEl.append(this.modalEl);
                this.titleEl = document.createElement('h2'); this.titleEl.className = 'modal-title'; this.modalEl.append(this.titleEl);
                this.contentEl = document.createElement('div'); this.contentEl.className = 'modal-content'; this.modalEl.append(this.contentEl);
                this.contentEl.empty = () => this.contentEl.replaceChildren();
            }
            setTitle(value) { this.titleEl.textContent = value; }
            open() { document.body.append(this.containerEl); this.opened = true; this.onOpen?.(); window.fixture.modal = this; }
            close() { if (!this.opened) return; this.opened = false; this.containerEl.remove(); this.onClose?.(); }
        }
        const parseModule = { exports: {} }; new Function('module', parser)(parseModule);
        const module = { exports: {} }; new Function('module', source)(module);
        window.fixture = { file, files, app, writes: 0, processCalls: 0, rejectProcess: false, saved: [], deleted: [], notices: [] };
        const obsidian = { Modal, Notice: class { constructor(message) { window.fixture.notices.push(String(message)); } } };
        window.currentPoems = () => parseModule.exports.parsePoems(file.text);
        window.openPoetryModal = (kind, entry) => {
            window.operation = { done: false, result: undefined, error: '' };
            const promise = module.exports[kind]({ app, obsidian, sourcePath: file.path, poems: window.currentPoems(), parsePoems: parseModule.exports.parsePoems, entry,
                onSaved: value => window.fixture.saved.push(value), onDeleted: value => window.fixture.deleted.push(value) });
            Promise.resolve(promise).then(result => { window.operation.result = result; window.operation.done = true; }, error => { window.operation.error = error.message; window.operation.done = true; });
        };
        window.openPoetryModal('openCreate');
    }, { source, storage, parser, note: fixtureNote });
    return { page, errors };
}

async function assertFit(page) {
    const overflowing = await page.evaluate(() => ['html', '.modal', '.modal-content'].flatMap(selector => {
        const node = document.querySelector(selector);
        if (!node || node.scrollWidth <= node.clientWidth + 1) return [];
        return [{ selector, client: node.clientWidth, scroll: node.scrollWidth }];
    }));
    assert.deepEqual(overflowing, [], 'Native poem forms fit narrow screens without horizontal scrolling');
}
async function settled(page) {
    await page.waitForFunction(() => window.operation.done);
    assert.equal(await page.evaluate(() => window.operation.error), '');
    assert.equal(await page.locator('.modal').count(), 0);
}
async function screenshot(page, name) {
    if (!process.env.POETRY_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.POETRY_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.POETRY_SCREENSHOT_DIR, name) });
}

async function scenario(browser, width, theme) {
    const { page, errors } = await mount(browser, width, theme);
    try {
        assert.equal(await page.getByLabel('Автор', { exact: true }).inputValue(), '');
        assert.equal(await page.getByLabel('Название', { exact: true }).inputValue(), '');
        assert.equal(await page.getByLabel('Текст стихотворения', { exact: true }).inputValue(), '');
        const suggestions = await page.locator('datalist option').evaluateAll(options => options.map(option => option.value));
        assert(suggestions.includes('Пётр Ёлкин')); assert(suggestions.includes('Другой автор'));
        await assertFit(page);
        await page.getByRole('button', { name: 'Отмена', exact: true }).click(); await settled(page);
        assert.equal(await page.evaluate(() => window.operation.result), null);
        assert.equal(await page.evaluate(() => window.fixture.file.text), fixtureNote, 'Cancelling leaves the entire source unchanged');
        assert.equal(await page.evaluate(() => window.fixture.writes), 0);

        await page.evaluate(() => window.openPoetryModal('openCreate'));
        await page.getByLabel('Автор', { exact: true }).fill('Новый автор');
        await page.getByLabel('Название', { exact: true }).fill('Новый текст');
        const createdText = 'Первая строка.\nВторая строка.\n\nНовая строфа.';
        await page.getByLabel('Текст стихотворения', { exact: true }).fill(createdText);
        await page.evaluate(() => { window.fixture.rejectProcess = true; });
        await page.getByRole('button', { name: 'Добавить', exact: true }).click();
        await page.getByRole('alert').waitFor({ state: 'visible' });
        assert.match(await page.getByRole('alert').textContent(), /Попробуйте снова/u);
        assert.equal(await page.getByLabel('Текст стихотворения', { exact: true }).inputValue(), createdText, 'A failed save preserves the entered poem');
        assert.equal(await page.getByRole('button', { name: 'Добавить', exact: true }).isEnabled(), true);
        assert.equal(await page.evaluate(() => window.fixture.writes), 0);
        await assertFit(page);
        if (width === 390 && theme === 'theme-light') await screenshot(page, 'poetry-create-mobile.png');
        await page.evaluate(() => { window.fixture.rejectProcess = false; });
        await page.getByRole('button', { name: 'Добавить', exact: true }).click(); await settled(page);
        const created = await page.evaluate(() => window.currentPoems().filter(poem => poem.title === 'Новый текст'));
        assert.equal(created.length, 1); assert.equal(created[0].author, 'Новый автор'); assert.equal(created[0].text, createdText);
        assert.equal(created[0].stanzas, 2);
        assert.equal(await page.evaluate(() => window.fixture.saved.length), 1);
        assert.equal(await page.evaluate(() => window.fixture.writes), 1);

        await page.evaluate(() => window.openPoetryModal('editPoem', window.currentPoems().find(poem => poem.title === 'Память')));
        assert.equal(await page.getByLabel('Автор', { exact: true }).inputValue(), 'Пётр Ёлкин');
        assert.equal(await page.getByLabel('Название', { exact: true }).inputValue(), 'Память');
        assert.match(await page.getByLabel('Текст стихотворения', { exact: true }).inputValue(), /воспоминаний/u);
        await page.getByLabel('Автор', { exact: true }).fill('Другой автор');
        await page.getByLabel('Название', { exact: true }).fill('Обновлённая память');
        const editedText = 'Строки <script>window.injected=true</script> & "кавычки".\n\nНовая строфа воспоминаний.';
        await page.getByLabel('Текст стихотворения', { exact: true }).fill(editedText);
        await assertFit(page);
        if (width === 1024 && theme === 'theme-dark') await screenshot(page, 'poetry-edit-desktop-dark.png');
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await settled(page);
        const edited = await page.evaluate(() => window.currentPoems().filter(poem => poem.title === 'Обновлённая память'));
        assert.equal(edited.length, 1); assert.equal(edited[0].author, 'Другой автор'); assert.equal(edited[0].text, editedText);
        assert.equal(await page.evaluate(() => window.currentPoems().some(poem => poem.title === 'Память')), false);
        assert.equal(await page.evaluate(() => window.currentPoems().find(poem => poem.title === 'Другие строки').text), 'Этот текст остаётся неизменным.');
        assert.match(await page.evaluate(() => window.fixture.file.text), /Личное вступление, которое должно сохраниться/u);
        assert.equal(await page.evaluate(() => window.fixture.writes), 2);

        const beforeDelete = await page.evaluate(() => window.fixture.file.text);
        await page.evaluate(() => window.openPoetryModal('deletePoem', window.currentPoems().find(poem => poem.title === 'Обновлённая память')));
        assert.match(await page.locator('.modal-content').textContent(), /Обновлённая память/u);
        assert.equal(await page.locator('.modal script').count(), 0);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        await assertFit(page);
        await page.getByRole('button', { name: 'Отмена', exact: true }).click(); await settled(page);
        assert.equal(await page.evaluate(() => window.fixture.file.text), beforeDelete, 'Cancelling deletion leaves the poem unchanged');
        assert.equal(await page.evaluate(() => window.fixture.writes), 2);
        await page.evaluate(() => window.openPoetryModal('deletePoem', window.currentPoems().find(poem => poem.title === 'Обновлённая память')));
        await page.getByRole('button', { name: 'Удалить', exact: true }).click(); await settled(page);
        assert.equal(await page.evaluate(() => window.currentPoems().some(poem => poem.title === 'Обновлённая память')), false);
        assert.equal(await page.evaluate(() => window.currentPoems().find(poem => poem.title === 'Другие строки').text), 'Этот текст остаётся неизменным.');
        assert.equal(await page.evaluate(() => window.fixture.deleted.length), 1);
        assert.equal(await page.evaluate(() => window.fixture.writes), 3);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
}

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let checks = 0;
    try {
        for (const width of [390, 1024]) for (const theme of ['theme-light', 'theme-dark']) { await scenario(browser, width, theme); checks++; }
        console.log(`${checks} native poetry CRUD layouts passed: cancel, author suggestions, create, multiline text, failed-save retry, edit author/title/text, delete confirmation, safe text rendering and source preservation.`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
