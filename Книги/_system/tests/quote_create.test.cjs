const assert = require('node:assert/strict');
const { test } = require('node:test');
const openCreate = require('../quote_create.js');

class Node {
    constructor(tagName, document) {
        this.tagName = tagName; this.ownerDocument = document; this.children = []; this.events = {}; this.attributes = {};
        this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false;
        this.classList = { add() {} };
    }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...children) { this.children = children; }
    empty() { this.replaceChildren(); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    focus() { this.ownerDocument.activeElement = this; }
    emit(name) { return this.events[name]?.({ target: this }); }
}
const books = [
    { file: { path: 'Книги/Non-fiction/A.md', basename: 'A' }, fm: { title: 'Одинаковая книга', authors: ['Автор А'] } },
    { file: { path: 'Книги/Non-fiction/B.md', basename: 'B' }, fm: { title: 'Одинаковая книга', authors: ['Автор А', 'Автор Б'] } },
    { file: { path: 'Книги/Non-fiction/C.md', basename: 'C' }, fm: { title: 'Другая книга', authors: ['Автор Б'] } }
];
function harness(options = {}) {
    const document = { createElement: tag => new Node(tag, document) }, calls = [], notices = [];
    class Modal {
        constructor(app) { this.app = app; this.contentEl = new Node('div', document); this.modalEl = new Node('div', document); }
        open() { this.opened = true; this.onOpen(); }
        close() { this.opened = false; }
    }
    const app = { vault: new Proxy({}, { get() { throw new Error('The form must not access the vault'); } }) };
    const obsidian = { Modal, Notice: class { constructor(message) { notices.push(message); } } };
    return { document, calls, notices, open: () => openCreate({ app, obsidian, books, onSave: value => calls.push(value), ...options }) };
}
function options(select) { return select.children.filter(node => node.tagName === 'option'); }

test('index opens a free quote immediately with initial text/section and no vault access or save', async () => {
    const h = harness({ initial: { text: 'Выделенный фрагмент', section: 'Мотивация/в' } });
    const modal = await h.open();
    assert.equal(modal.opened, true); assert.equal(modal.fields.sourceKind.value, 'free');
    assert.equal(modal.fields.text.value, 'Выделенный фрагмент'); assert.equal(modal.fields.section.value, 'Мотивация/в');
    assert.equal(h.document.activeElement, modal.fields.text); assert.equal(modal.bookFields.hidden, true);
    assert.equal(modal.freeFields.hidden, false); assert.equal(h.calls.length, 0);
});

test('active-book initial context selects the canonical book path without another menu', async () => {
    const h = harness({ initial: { bookPath: books[1].file.path, text: 'Часть абзаца', sourceTitle: 'Другой источник' } });
    const modal = await h.open();
    assert.equal(modal.fields.sourceKind.value, 'book'); assert.equal(modal.fields.bookPath.value, books[1].file.path);
    assert.equal(modal.bookFields.hidden, false); assert.equal(modal.freeFields.hidden, true);
    await modal.save();
    assert.equal(h.calls[0].bookPath, books[1].file.path); assert.equal(h.calls[0].sourceKind, 'book');
    assert.equal(Object.hasOwn(h.calls[0], 'sourceTitle'), false, 'Book metadata stays canonical');
    assert.equal(Object.hasOwn(h.calls[0], 'sourceAuthors'), false); assert.equal(modal.opened, false);
});

test('author and AND text filters disambiguate equal book titles and clear an excluded selection', async () => {
    const h = harness({ initial: { bookPath: books[0].file.path, text: 'Сохранённый ввод' } }), modal = await h.open();
    const labels = options(modal.fields.bookPath).map(node => node.textContent);
    assert(labels.some(label => label.includes('Non-fiction/A.md'))); assert(labels.some(label => label.includes('Non-fiction/B.md')));
    modal.fields.authorFilter.value = 'Автор Б'; await modal.fields.authorFilter.emit('change');
    assert.deepEqual(options(modal.fields.bookPath).map(node => node.value).filter(Boolean).sort(), [books[1].file.path, books[2].file.path]);
    assert.equal(modal.fields.bookPath.value, ''); assert.equal(modal.fields.text.value, 'Сохранённый ввод');
    modal.fields.bookSearch.value = 'Автор Б Одинаковая'; await modal.fields.bookSearch.emit('input');
    assert.deepEqual(options(modal.fields.bookPath).map(node => node.value).filter(Boolean), [books[1].file.path]);
    modal.fields.bookSearch.value = 'такой книги нет'; await modal.fields.bookSearch.emit('input');
    assert.equal(options(modal.fields.bookPath).length, 1); assert.match(options(modal.fields.bookPath)[0].textContent, /не найдены/);
});

test('source-mode switches preserve both free metadata and book selection', async () => {
    const h = harness({ initial: { sourceKind: 'free', bookPath: books[1].file.path, sourceAuthors: ['Писатель'], sourceTitle: 'Внешняя книга', text: 'Текст' } });
    const modal = await h.open();
    modal.fields.sourceKind.value = 'book'; await modal.fields.sourceKind.emit('change');
    assert.equal(modal.fields.bookPath.value, books[1].file.path); assert.equal(modal.freeFields.hidden, true);
    modal.fields.sourceKind.value = 'free'; await modal.fields.sourceKind.emit('change');
    assert.equal(modal.fields.sourceAuthors.value, 'Писатель'); assert.equal(modal.fields.sourceTitle.value, 'Внешняя книга');
    assert.equal(modal.fields.text.value, 'Текст'); assert.equal(modal.freeFields.hidden, false);
});

test('free quotes work with an empty library and preserve names containing commas', async () => {
    const h = harness({ books: [], initial: { text: '  Первая строка\r\nВторая строка  ', section: ' Мотивация/в ', sourceAuthors: 'Фамилия, Имя; Другой; другой', sourceTitle: ' Внешний источник ', themes: 'Сон; сон; Утро', conclusion: ' Мой вывод\r\nДальше ', location: ' Глава 3 ' } });
    const modal = await h.open(); await modal.save();
    assert.deepEqual(h.calls, [{ sourceKind: 'free', text: 'Первая строка\nВторая строка', section: 'Мотивация/в', themes: ['Сон', 'Утро'], conclusion: 'Мой вывод\nДальше', location: 'Глава 3', sourceAuthors: ['Фамилия, Имя', 'Другой'], sourceTitle: 'Внешний источник' }]);
    assert.equal(modal.opened, false);
});

test('empty text and missing book selection produce inline errors without invoking save', async () => {
    const h = harness({ initial: { sourceKind: 'book' } }), modal = await h.open();
    await modal.save(); assert.match(modal.errorEl.textContent, /Введите текст/); assert.equal(modal.errorEl.hidden, false);
    modal.fields.text.value = 'Текст'; await modal.save(); assert.match(modal.errorEl.textContent, /Выберите книгу/);
    assert.equal(h.calls.length, 0); assert.equal(modal.opened, true); assert.equal(modal.saveButton.disabled, false);
    modal.fields.bookPath.value = 'Книги/Незнакомая.md'; await modal.save(); assert.equal(h.calls.length, 0);
});

test('a failed callback preserves fields and allows a successful retry', async () => {
    let attempts = 0;
    const h = harness({ initial: { text: '  Мой текст  ', section: 'Мотивация/в' }, onSave: async () => { if (++attempts === 1) throw new Error('Ошибка сохранения'); } });
    const modal = await h.open(); await modal.save();
    assert.equal(modal.opened, true); assert.equal(modal.fields.text.value, '  Мой текст  '); assert.equal(modal.fields.section.value, 'Мотивация/в');
    assert.equal(modal.errorEl.textContent, 'Ошибка сохранения'); assert.equal(modal.fields.text.disabled, false);
    assert.equal(modal.saveButton.disabled, false); await modal.save(); assert.equal(attempts, 2); assert.equal(modal.opened, false);
});

test('a pending callback disables submission and ignores repeated saves and cancellation', async () => {
    let finish, calls = 0;
    const h = harness({ initial: { text: 'Текст' }, onSave: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
    const modal = await h.open(), pending = modal.save();
    assert.equal(modal.saveButton.disabled, true); assert.equal(modal.fields.text.disabled, true);
    await modal.save(); await modal.cancelButton.emit('click'); assert.equal(calls, 1); assert.equal(modal.opened, true);
    finish(); await pending; assert.equal(modal.opened, false); assert.equal(modal.saving, false);
});

test('cancel does not invoke persistence and preparing options does not mutate book records', async () => {
    const before = JSON.stringify(books), h = harness(), modal = await h.open();
    modal.fields.text.value = 'Несохранённый текст'; await modal.cancelButton.emit('click');
    assert.equal(modal.opened, false); assert.equal(h.calls.length, 0); assert.equal(JSON.stringify(books), before);
});
