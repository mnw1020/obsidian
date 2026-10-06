const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const knowledge = require('../knowledge.js');
const editQuote = require('../quote_edit.js');
const { replaceExcerpt } = editQuote;
const knowledgeSource = fs.readFileSync(path.join(__dirname, '../knowledge.js'), 'utf8');
const id = 'book-excerpt-edit-test';

function quote(value = {}, newline = '\n') {
    return knowledge.renderExcerpt({ id, text: 'Исходная цитата\nВторая строка', themes: ['Тема'], conclusion: 'Личный вывод\nЕго продолжение', location: 'Глава 3', savedDate: '2026-10-04', ...value }, newline);
}

function baseline(raw, quoteId = id) {
    const [entry] = knowledge.parseExcerpts(raw).filter(entry => entry.id === quoteId);
    assert.ok(entry);
    const lines = raw.match(/[^\n]*(?:\n|$)/g).filter(Boolean);
    const start = lines.slice(0, entry.line).join('').length;
    const end = lines.slice(0, entry.endLine).join('').length + lines[entry.endLine].replace(/\r?\n$/, '').length;
    return raw.slice(start, end);
}

test('replacing one quote preserves all surrounding bytes, other quotes, stable ID, saved date and CRLF', () => {
    const prefix = '---\r\ntitle: Книга\r\n---\r\n\r\nКонспект\n\n<!-- BOOK-READINGS:START -->\r\nЧтение и мой комментарий\r\n<!-- BOOK-READINGS:END -->\r\n\r\n';
    const target = quote({}, '\r\n');
    const suffix = '\r\nЛичная заметка\n' + quote({ id: 'book-excerpt-edit-other', text: 'Другая цитата' });
    const raw = prefix + target + suffix;
    const next = replaceExcerpt(raw, id, { text: 'Обновлённая цитата\n\nТретий абзац', conclusion: 'Новый вывод\nВторая строка', themes: ['Новая тема'], section: ' Раздел / Подраздел ' }, baseline(raw));
    assert.equal(next.slice(0, prefix.length), prefix);
    assert.equal(next.slice(-suffix.length), suffix);
    const changed = knowledge.parseExcerpts(next).find(entry => entry.id === id);
    assert.equal(changed.text, 'Обновлённая цитата\n\nТретий абзац');
    assert.equal(changed.conclusion, 'Новый вывод\nВторая строка');
    assert.equal(changed.savedDate, '2026-10-04');
    assert.equal(changed.section, 'Раздел/Подраздел');
    assert.deepEqual(changed.themes, ['Новая тема']);
    assert.equal(knowledge.parseExcerpts(next).length, 2);
    const changedBlock = baseline(next);
    assert.equal(changedBlock.replace(/\r\n/g, '').includes('\n'), false);
});

test('opaque metadata fields and their multiline payload remain byte-for-byte intact', () => {
    const opaque = '> **Будущее поле:** первая строка\r\n>   продолжение\n>   **Темы:** часть будущего поля\r\n';
    const raw = quote({}, '\r\n').replace('> **Место в источнике:**', opaque + '> **Место в источнике:**');
    const next = replaceExcerpt(raw, id, { conclusion: 'Исправленный личный вывод', sourceTitle: 'Другое произведение', sourceAuthors: ['Автор, Имя', 'Второй автор'] }, baseline(raw));
    assert.ok(next.includes(opaque));
    assert.equal(knowledge.parseExcerpts(next)[0].conclusion, 'Исправленный личный вывод');
    assert.equal(knowledge.parseExcerpts(next)[0].sourceTitle, 'Другое произведение');
    assert.deepEqual(knowledge.parseExcerpts(next)[0].sourceAuthors, ['Автор, Имя', 'Второй автор']);
});

test('outside changes are accepted; concurrent quote changes are rejected', () => {
    const raw = 'До\n\n' + quote() + '\nПосле\n';
    const snapshot = baseline(raw);
    const external = raw.replace('До', 'Обновлённый конспект').replace('После', 'Ещё одна внешняя заметка');
    const next = replaceExcerpt(external, id, { text: 'Новая цитата' }, snapshot);
    assert.ok(next.startsWith('Обновлённый конспект\n\n'));
    assert.ok(next.endsWith('\nЕщё одна внешняя заметка\n'));
    assert.throws(() => replaceExcerpt(raw.replace('Личный вывод', 'Параллельное исправление'), id, { text: 'Новая цитата' }, snapshot), /цитата изменилась/);
});

test('no-op preserves original formatting and date; payload cannot alter ID/date or erase omitted fields', () => {
    const raw = quote().replace('> **Темы:** Тема', '> **Темы:**   Тема');
    const values = knowledge.parseExcerpts(raw)[0];
    assert.equal(replaceExcerpt(raw, id, { text: values.text, themes: values.themes, conclusion: values.conclusion, location: values.location, id: 'book-excerpt-wrong', savedDate: '2000-01-01' }, baseline(raw)), raw);
    const next = replaceExcerpt(raw, id, { text: 'Исправлено', savedDate: '2000-01-01' }, baseline(raw));
    const changed = knowledge.parseExcerpts(next)[0];
    assert.equal(changed.id, id);
    assert.equal(changed.savedDate, '2026-10-04');
    assert.equal(changed.conclusion, values.conclusion);
});

test('explicit empty section is persisted, distinct from inherited absent section', () => {
    const raw = quote();
    assert.equal(knowledge.parseExcerpts(raw)[0].section, undefined);
    const next = replaceExcerpt(raw, id, { section: '' }, baseline(raw));
    assert.equal(knowledge.parseExcerpts(next)[0].section, '');
    assert.equal(replaceExcerpt(next, id, { section: '' }, baseline(next)), next);
});

test('missing/duplicate IDs, duplicate edited fields, empty text and embedded service markers fail safely', () => {
    const raw = quote();
    assert.throws(() => replaceExcerpt(raw, 'book-excerpt-missing', { text: 'Новое' }, baseline(raw)), /больше не найдена/);
    assert.throws(() => replaceExcerpt(raw + '\n' + raw, id, { text: 'Новое' }, baseline(raw)), /нескольких цитат/);
    const duplicated = raw.replace('> **Темы:** Тема', '> **Темы:** Тема\n> **Темы:** Другая');
    assert.throws(() => replaceExcerpt(duplicated, id, { themes: ['Новое'] }, baseline(duplicated)), /повторяется/);
    assert.throws(() => replaceExcerpt(raw, id, { text: ' ' }, baseline(raw)), /Введите текст/);
    assert.throws(() => replaceExcerpt(raw, id, { text: '<!-- BOOK-EXCERPT:META -->' }, baseline(raw)), /служебные маркеры/);
    const fenced = '```md\n' + raw + '\n```\n\n' + raw;
    assert.equal(knowledge.parseExcerpts(replaceExcerpt(fenced, id, { text: 'Новое' }, baseline(fenced))).length, 1);
    assert.ok(replaceExcerpt(fenced, id, { text: 'Новое' }, baseline(fenced)).startsWith('```md\n' + raw));
});

class Node {
    constructor(tagName, document) { this.tagName = tagName; this.ownerDocument = document; this.children = []; this.events = {}; this.attributes = {}; this.classList = { add() {} }; }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...children) { this.children = children; }
    empty() { this.replaceChildren(); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
}

function harness(raw = quote(), entryChanges = {}) {
    const document = { createElement: tag => new Node(tag, document) }, writes = [], folders = [], notices = [], callbacks = [];
    const file = { path: 'Книги/Цитаты/Подборка.md', basename: 'Подборка', text: raw };
    const moduleFile = { path: 'Книги/_system/knowledge.js', text: knowledgeSource };
    const files = new Map([[file.path, file], [moduleFile.path, moduleFile]]);
    files.set('Книги/_system/quote_storage.js', { path: 'Книги/_system/quote_storage.js', text: fs.readFileSync(path.join(__dirname, '../quote_storage.js'), 'utf8') });
    files.set('Книги', { path: 'Книги', children: [] });
    files.set('Книги/Цитаты', { path: 'Книги/Цитаты', children: [] });
    const entry = { path: file.path, id, collection: true, title: 'Подборка', authors: [], ...entryChanges };
    const app = { vault: {
        getAbstractFileByPath: path => files.get(path),
        read: async file => file.text,
        createFolder: async path => { const folder = { path, children: [] }; files.set(path, folder); folders.push(path); return folder; },
        process: async (file, transform) => { const next = transform(file.text); writes.push(next); file.text = next; },
        modify: async () => { throw new Error('Non-atomic write forbidden'); }
    } };
    class Modal {
        constructor(app) { this.app = app; this.contentEl = new Node('div', document); }
        open() { this.opened = true; this.onOpen(); }
        close() { this.opened = false; }
    }
    const obsidian = { Modal, Notice: class { constructor(message) { notices.push(message); } } };
    return { file, files, entry, app, obsidian, writes, folders, notices, callbacks, open: () => editQuote({ app, obsidian, entry, onSaved: value => callbacks.push(value) }) };
}

test('modal opens fresh data and offers collection provenance; cancel and inherited-section no-op do not write', async () => {
    const h = harness(quote(), { text: 'Устаревший текст', section: 'Мотивация' });
    const modal = await h.open();
    assert.equal(modal.fields.text.value, 'Исходная цитата\nВторая строка');
    assert.equal(modal.fields.section.value, 'Мотивация');
    assert.ok(modal.fields.sourceTitle);
    modal.close();
    assert.equal(h.writes.length, 0);
    const unchanged = await h.open();
    await unchanged.save();
    assert.equal(h.writes.length, 0);
    assert.equal(h.callbacks.length, 0);
    assert.deepEqual(h.folders, []);
    assert.equal(knowledge.parseExcerpts(h.file.text)[0].section, undefined);
});

test('editing a section creates its full folder hierarchy and retains the quote in its original note', async () => {
    const h = harness('Заметка до\n\n' + quote() + '\nЗаметка после', { section: 'Мотивация' });
    const modal = await h.open();
    modal.fields.section.value = 'Мотивация/в/Дальше';
    await modal.save();
    assert.equal(modal.opened, false);
    assert.deepEqual(h.folders, ['Книги/Цитаты/Мотивация', 'Книги/Цитаты/Мотивация/в', 'Книги/Цитаты/Мотивация/в/Дальше']);
    assert.equal(h.file.path, 'Книги/Цитаты/Подборка.md');
    assert.equal(h.writes.length, 1);
    const saved = knowledge.parseExcerpts(h.file.text)[0];
    assert.equal(saved.section, 'Мотивация/в/Дальше');
    assert.equal(saved.id, id); assert.equal(saved.savedDate, '2026-10-04');
    assert.ok(h.file.text.startsWith('Заметка до\n\n'));
    assert.ok(h.file.text.endsWith('\nЗаметка после'));
});

test('invalid paths and quotes changed before save create no folders and keep the form input', async () => {
    for (const invalid of [true, false]) {
        const h = harness(); const modal = await h.open();
        modal.fields.section.value = invalid ? '../Вне цитат' : 'Мотивация/в';
        if (!invalid) h.file.text = h.file.text.replace('Исходная цитата', 'Параллельная правка');
        await modal.save();
        assert.equal(modal.opened, true);
        assert.equal(h.writes.length, 0); assert.deepEqual(h.folders, []);
        assert.equal(modal.fields.section.value, invalid ? '../Вне цитат' : 'Мотивация/в');
        assert.ok(modal.errorEl.textContent);
    }
});

test('modal saves one atomic update, keeps external edits, and can clear an inherited section', async () => {
    const h = harness('До\n\n' + quote() + '\nПосле', { section: 'Мотивация' });
    const modal = await h.open();
    modal.fields.text.value = 'Новая цитата';
    modal.fields.section.value = '';
    modal.fields.sourceAuthors.value = 'Автор, Имя; Второй автор';
    h.file.text = h.file.text.replace('До', 'Новая заметка до цитаты');
    await modal.save();
    assert.equal(h.writes.length, 1);
    assert.equal(h.callbacks.length, 1);
    assert.equal(modal.opened, false);
    assert.ok(h.file.text.startsWith('Новая заметка до цитаты\n\n'));
    const changed = knowledge.parseExcerpts(h.file.text)[0];
    assert.equal(changed.text, 'Новая цитата');
    assert.equal(changed.section, '');
    assert.equal(changed.savedDate, '2026-10-04');
    assert.deepEqual(changed.sourceAuthors, ['Автор, Имя', 'Второй автор']);
});

test('collection authors inherit for the form; no-op stays absent, explicit clearing stores blank and stops fallback', async () => {
    const h = harness(quote(), { authors: ['Сергей Стиллавин'] });
    assert.equal(knowledge.parseExcerpts(h.file.text)[0].sourceAuthors, undefined);
    const unchanged = await h.open();
    assert.equal(unchanged.fields.sourceAuthors.value, 'Сергей Стиллавин');
    await unchanged.save();
    assert.equal(h.writes.length, 0);
    assert.equal(knowledge.parseExcerpts(h.file.text)[0].sourceAuthors, undefined);
    const clearing = await h.open();
    clearing.fields.sourceAuthors.value = '';
    await clearing.save();
    assert.equal(h.writes.length, 1);
    assert.match(h.file.text, /> \*\*Автор:\*\* \n/);
    assert.deepEqual(knowledge.parseExcerpts(h.file.text)[0].sourceAuthors, []);
    const reopened = await h.open();
    assert.equal(reopened.fields.sourceAuthors.value, '');
    await reopened.save();
    assert.equal(h.writes.length, 1);
});

test('book provenance is read-only and absent metadata is not injected on unrelated edits', async () => {
    const h = harness(quote(), { collection: false, title: 'Книга', authors: ['Автор'], section: 'Воспитание' });
    const modal = await h.open();
    assert.equal(modal.fields.sourceTitle, undefined);
    assert.equal(modal.fields.sourceAuthors, undefined);
    modal.fields.location.value = 'Глава 7';
    await modal.save();
    assert.equal(h.writes.length, 1);
    assert.equal(knowledge.parseExcerpts(h.file.text)[0].section, undefined);
    assert.equal(knowledge.parseExcerpts(h.file.text)[0].location, 'Глава 7');
});

test('modal rejects a concurrent quote edit without writing or losing user input', async () => {
    const h = harness();
    const modal = await h.open();
    modal.fields.conclusion.value = 'Мой новый вывод';
    h.file.text = h.file.text.replace('Личный вывод', 'Вывод из другой вкладки');
    await modal.save();
    assert.equal(h.writes.length, 0);
    assert.equal(h.callbacks.length, 0);
    assert.equal(modal.opened, true);
    assert.match(modal.errorEl.textContent, /цитата изменилась/);
    assert.equal(modal.fields.conclusion.value, 'Мой новый вывод');
    assert.equal(modal.saveButton.disabled, false);
});

test('modal reports missing or renamed files and duplicate IDs, without opening or writing', async () => {
    const h = harness();
    h.files.delete(h.entry.path);
    assert.equal(await h.open(), null);
    assert.match(h.notices[0], /больше не найден/);
    const duplicate = harness(quote() + '\n' + quote());
    assert.equal(await duplicate.open(), null);
    assert.match(duplicate.notices[0], /нескольких цитат/);
    const renamed = harness();
    const modal = await renamed.open();
    modal.fields.text.value = 'Изменение';
    renamed.file.path = 'Книги/Цитаты/Новое имя.md';
    await modal.save();
    assert.equal(renamed.writes.length, 0);
    assert.match(modal.errorEl.textContent, /больше не доступен/);
});
