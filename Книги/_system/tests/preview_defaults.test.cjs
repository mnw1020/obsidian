const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PreviewDefaults = require('../preview-defaults/main.js');
const { ensurePreview } = PreviewDefaults;

test('new frontmatter preserves prose, later horizontal rules and a BOM', () => {
    for (const body of ['', 'Текст без перевода строки', 'Первый абзац\n\n---\nВторой абзац\n']) {
        assert.equal(ensurePreview(body), `---\nobsidianUIMode: preview\n---\n${body}`);
    }
    const body = '\uFEFFТекст\r\n\r\n---\r\n';
    assert.equal(ensurePreview(body), '\uFEFF---\r\nobsidianUIMode: preview\r\n---\r\n' + body.slice(1));
});

test('only the mode changes in CRLF frontmatter with comments and multiline properties', () => {
    const before = '\uFEFF---\r\n# Свойства книги\r\nauthors:\r\n  - "Автор: один"\r\n  - Другой автор\r\nhistory: |\r\n  2026-10-09 — чтение\r\n  Следующая строка\r\nobsidianUIMode: source  # Режим\r\ncssclasses:\r\n  - book-page\r\n---\r\n\r\n# Текст\r\nobsidianUIMode: source\r\n---\r\n';
    assert.equal(ensurePreview(before), before.replace('obsidianUIMode: source  # Режим', 'obsidianUIMode: preview  # Режим'));
});

test('quoted keys and quoted values preserve spacing and real inline comments', () => {
    for (const key of ['obsidianUIMode', '"obsidianUIMode"', "'obsidianUIMode'"]) {
        const before = `---\n${key} :  "sou#rce"   # Comment\nname: "Other # text"\n---\nBody`;
        assert.equal(ensurePreview(before), before.replace('"sou#rce"', 'preview'));
        assert.equal(ensurePreview(ensurePreview(before)), ensurePreview(before));
    }
    assert.equal(ensurePreview("---\nobsidianUIMode: 'sou''rce#' # Keep\n---"), '---\nobsidianUIMode: preview # Keep\n---');
    assert.equal(ensurePreview('---\nobsidianUIMode: "sou\\\"rce#" # Keep\n---'), '---\nobsidianUIMode: preview # Keep\n---');
});

test('existing frontmatter supports EOF closing delimiters and document terminators', () => {
    assert.equal(ensurePreview('---\ntitle: Book\n---'), '---\ntitle: Book\nobsidianUIMode: preview\n---');
    assert.equal(ensurePreview('---\n---'), '---\nobsidianUIMode: preview\n---');
    assert.equal(ensurePreview('---\ntitle: Book\n...\nBody'), '---\ntitle: Book\nobsidianUIMode: preview\n...\nBody');
    assert.equal(ensurePreview('---\nobsidianUIMode: preview\n...'), '---\nobsidianUIMode: preview\n...');
});

test('only a top-level mode is changed, without adding duplicate keys', () => {
    const before = '---\nother:\n  obsidianUIMode: source\nobsidianUIMode: source\n"obsidianUIMode": source # Keep this comment\n---\nBody';
    assert.equal(ensurePreview(before), '---\nother:\n  obsidianUIMode: source\nobsidianUIMode: preview\n# Keep this comment\n---\nBody');
    const nestedOnly = '---\nother:\n  obsidianUIMode: source\n---\nBody';
    assert.equal(ensurePreview(nestedOnly), '---\nother:\n  obsidianUIMode: source\nobsidianUIMode: preview\n---\nBody');
});

test('a nested obsolete mode value is removed while other YAML stays byte-for-byte intact', () => {
    const before = '---\nobsidianUIMode:\n  - source\n  # Mode comment\n\nauthors:\n  - Author\n---\nBody';
    assert.equal(ensurePreview(before), '---\nobsidianUIMode: preview\n  # Mode comment\n\nauthors:\n  - Author\n---\nBody');
});

function harness({ ready = true } = {}) {
    const refs = new Set();
    const files = new Map();
    const contents = new Map();
    const timers = new Map();
    const processed = [];
    const errors = [];
    const layoutCallbacks = [];
    let nextTimer = 0;
    class Plugin {
        constructor(app) { this.app = app; this.refs = []; }
        registerEvent(ref) { this.refs.push(ref); }
        unload() { this.onunload(); for (const ref of this.refs) refs.delete(ref); }
    }
    const vault = {
        on(event, callback) { const ref = { event, callback }; refs.add(ref); return ref; },
        getAbstractFileByPath(filePath) { return files.get(filePath); },
        getMarkdownFiles() { return [...files.values()].filter(file => file.extension === 'md'); },
        async process(file, transform) {
            processed.push(file.path);
            contents.set(file, transform(contents.get(file)));
        }
    };
    const sandbox = {
        module: { exports: {} },
        require(name) { assert.equal(name, 'obsidian'); return { Plugin, Notice: class {} }; },
        setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        console: { error(...args) { errors.push(args); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preview-defaults/main.js'), 'utf8'), sandbox);
    const workspace = {
        layoutReady: ready,
        onLayoutReady(callback) { if (this.layoutReady) callback(); else layoutCallbacks.push(callback); }
    };
    const plugin = new sandbox.module.exports({ vault, workspace });
    plugin.onload();
    return {
        plugin, processed, errors, timers, contents, refs, vault,
        add(filePath, text = '') {
            const file = { path: filePath, extension: filePath.split('.').at(-1) };
            files.set(filePath, file); contents.set(file, text); return file;
        },
        emit(event, ...args) { for (const ref of refs) if (ref.event === event) ref.callback(...args); },
        ready() { workspace.layoutReady = true; for (const callback of layoutCallbacks.splice(0)) callback(); },
        rename(file, filePath) { const old = file.path; files.delete(old); file.path = filePath; files.set(filePath, file); this.emit('rename', file, old); },
        async tick() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } await Promise.resolve(); },
        text(file) { return contents.get(file); }
    };
}

test('the plugin watches creation only inside Books and never scans notes on startup', async () => {
    const h = harness();
    assert.deepEqual(h.processed, []);
    const book = h.add('Книги/Новая.md', 'Text');
    const other = h.add('Заметки/Новая.md', 'Text');
    const sibling = h.add('Книги ещё/Новая.md', 'Text');
    const image = h.add('Книги/Обложка.png', 'Binary');
    for (const file of [book, other, sibling, image]) h.emit('create', file);
    h.emit('modify', book);
    await h.tick();
    assert.deepEqual(h.processed, ['Книги/Новая.md']);
    assert.equal(h.text(book), ensurePreview('Text'));
    assert.equal(h.text(other), 'Text');
    assert.equal(h.text(sibling), 'Text');
    assert.equal(h.text(image), 'Binary');
});

test('startup create events for existing notes are ignored until the layout is ready', async () => {
    const h = harness({ ready: false });
    const existing = h.add('Книги/Существующая.md', '---\nobsidianUIMode: source\n---\nManual');
    h.emit('create', existing);
    assert.equal(h.refs.size, 0);
    await h.tick();
    assert.deepEqual(h.processed, []);
    h.ready();
    assert.equal(h.refs.size, 2);
    const created = h.add('Книги/Новая.md', 'New');
    h.emit('create', created);
    await h.tick();
    assert.deepEqual(h.processed, [created.path]);
    assert.equal(h.text(existing), '---\nobsidianUIMode: source\n---\nManual');
    assert.equal(h.text(created), ensurePreview('New'));
});

test('unload before layout readiness prevents deferred event subscriptions', async () => {
    const h = harness({ ready: false });
    h.plugin.unload();
    h.ready();
    assert.equal(h.refs.size, 0);
    const created = h.add('Книги/Новая.md', 'Body');
    h.emit('create', created);
    await h.tick();
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.processed, []);
    assert.equal(h.text(created), 'Body');
});

test('debouncing processes the latest complete contents atomically and does not watch modifications', async () => {
    const h = harness();
    const file = h.add('Книги/Новая.md', 'Initial');
    h.emit('create', file);
    h.emit('create', file);
    h.contents.set(file, '---\nauthors:\n  - Author\n---\nLatest text');
    assert.equal(h.timers.size, 1);
    await h.tick();
    assert.equal(h.text(file), ensurePreview('---\nauthors:\n  - Author\n---\nLatest text'));
    h.contents.set(file, '---\nobsidianUIMode: source\n---\nManual choice');
    h.emit('modify', file);
    await h.tick();
    assert.equal(h.text(file), '---\nobsidianUIMode: source\n---\nManual choice');
    assert.equal(h.processed.length, 1);
});

test('imports into Books receive the default; moves within Books preserve a manual mode', async () => {
    const h = harness();
    const imported = h.add('Импорт/Книга.md', 'Imported');
    const existing = h.add('Книги/Старая.md', '---\nobsidianUIMode: source\n---\nManual');
    h.rename(imported, 'Книги/Книга.md');
    h.rename(existing, 'Книги/Переименована.md');
    await h.tick();
    assert.deepEqual(h.processed, ['Книги/Книга.md']);
    assert.equal(h.text(imported), ensurePreview('Imported'));
    assert.equal(h.text(existing), '---\nobsidianUIMode: source\n---\nManual');
});

test('moving an imported folder into Books applies the rule to its markdown children', async () => {
    const h = harness();
    const folder = h.add('Книги/Импорт', '');
    const file = h.add('Книги/Импорт/Книга.md', 'Imported');
    h.add('Книги/Другой каталог/Книга.md', 'Other');
    h.emit('rename', folder, 'Входящие/Импорт');
    await h.tick();
    assert.deepEqual(h.processed, [file.path]);
});

test('a note moved out of Books before the timer and pending work after unload are skipped', async () => {
    const h = harness();
    const moved = h.add('Книги/Временная.md', 'Body');
    h.emit('create', moved);
    h.rename(moved, 'Заметки/Временная.md');
    await h.tick();
    assert.deepEqual(h.processed, []);
    const pending = h.add('Книги/Не готова.md', 'Body');
    h.emit('create', pending);
    assert.equal(h.timers.size, 1);
    h.plugin.unload();
    assert.equal(h.timers.size, 0);
    assert.equal(h.refs.size, 0);
    await h.tick();
    assert.deepEqual(h.processed, []);
    assert.equal(h.text(pending), 'Body');
});

test('unload while an atomic update is waiting leaves its contents untouched', async () => {
    const h = harness();
    let continueProcess;
    h.vault.process = async (file, transform) => { await new Promise(resolve => { continueProcess = resolve; }); h.contents.set(file, transform(h.text(file))); };
    const file = h.add('Книги/Новая.md', 'Latest');
    h.emit('create', file);
    await h.tick();
    h.plugin.unload();
    continueProcess();
    await Promise.resolve();
    assert.equal(h.text(file), 'Latest');
});
