const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePoems } = require('../poetry.js');
const { addPoem, replacePoem, removePoem, normalizeValues } = require('../poetry_storage.js');

const intro = '\uFEFF---\r\ncssclasses:\r\n  - book-poetry-page\r\nprivate: "$& $` $\'"\r\n---\r\n\r\n# ✒ Стихи\r\n\r\n[[Книги/_index|← Книги]]\r\n\r\n```dataviewjs\r\n// ## Это не автор\r\n// ### Это не стих\r\n```\r\n\r\n';
const first = '## Автор один\r\n\r\n### Первый\r\nПервая строка  \r\nВторая строка  \r\n\r\nСледующая строфа  \r\n';
const separator = '\r\n---\r\n\r\n';
const second = '## Автор два\n\n### Второй\nСлова $& и $` и $\' и \\  \nЕщё строка';
const source = intro + first + separator + second;
const choose = (raw, title) => parsePoems(raw).find(poem => poem.title === title);
const values = { author: 'Автор один', title: 'Новый', text: 'Новая строка\nЕщё строка\n\nНовая строфа' };

test('add to an existing author retains properties, introduction, other poems and their mixed line endings', () => {
    const result = addPoem(source, values, parsePoems), poems = parsePoems(result);
    assert.equal(poems.length, 3);
    assert.deepEqual(poems.map(poem => [poem.author, poem.title]), [['Автор один', 'Первый'], ['Автор один', 'Новый'], ['Автор два', 'Второй']]);
    assert.ok(result.startsWith(intro + first));
    assert.ok(result.endsWith(separator + second));
    assert.ok(result.includes('### Новый\r\nНовая строка  \r\nЕщё строка  \r\n\r\nНовая строфа  \r\n'));
    assert.equal(choose(result, 'Новый').text, values.text);
});

test('add a new author appends without changing existing bytes or an absent final newline', () => {
    const result = addPoem(source, { author: 'Автор три', title: 'Третий', text: 'Свет\r\n\r\nТишина\r\n' }, parsePoems);
    assert.ok(result.startsWith(source));
    assert.ok(result.includes('\r\n\r\n## Автор три\r\n\r\n### Третий\r\nСвет  \r\n\r\nТишина  \r\n'));
    assert.equal(choose(result, 'Третий').text, 'Свет\n\nТишина');
});

test('add uses an empty existing author section and does not create another heading', () => {
    const raw = '# Стихи\n\n## Новый автор\n\n---\n\n## Другой автор\n\n### Остальное\nТекст  \n';
    const result = addPoem(raw, { author: 'Новый автор', title: 'Первый текст', text: 'Строка' }, parsePoems);
    assert.equal((result.match(/^## Новый автор$/gmu) || []).length, 1);
    assert.ok(result.endsWith('\n---\n\n## Другой автор\n\n### Остальное\nТекст  \n'));
    assert.equal(parsePoems(result)[0].author, 'Новый автор');
});

test('replace text and title touches only the selected block', () => {
    const baseline = choose(source, 'Первый');
    const result = replacePoem(source, baseline, { author: baseline.author, title: 'Переименованный', text: 'Почти $&\n\nНе $` и не $\'\nФинал \\' }, parsePoems);
    assert.ok(result.startsWith(intro + '## Автор один\r\n\r\n'));
    assert.ok(result.endsWith(separator + second));
    assert.equal(choose(result, 'Переименованный').text, 'Почти $&\n\nНе $` и не $\'\nФинал \\');
    assert.equal(choose(result, 'Первый'), undefined);
});

test('a no-op is byte-identical, including existing body whitespace and mixed newlines', () => {
    const baseline = choose(source, 'Первый');
    assert.equal(replacePoem(source, baseline, baseline, parsePoems), source);
});

test('replace the EOF poem keeps the original absence of a final newline', () => {
    const baseline = choose(source, 'Второй');
    const result = replacePoem(source, baseline, { author: baseline.author, title: baseline.title, text: 'Новый финал' }, parsePoems);
    assert.ok(result.startsWith(intro + first + separator + '## Автор два\n\n'));
    assert.ok(result.endsWith('### Второй\r\nНовый финал  '));
    assert.equal(result.endsWith('\n'), false);
});

test('changing the author moves one poem into the existing destination section and retains all others', () => {
    const baseline = choose(source, 'Первый');
    const result = replacePoem(source, baseline, { author: 'Автор два', title: 'Первый', text: baseline.text }, parsePoems);
    assert.ok(result.startsWith(intro + '## Автор один\r\n\r\n' + separator));
    assert.ok(result.includes(second));
    assert.deepEqual(parsePoems(result).map(poem => [poem.author, poem.title]), [['Автор два', 'Второй'], ['Автор два', 'Первый']]);
    assert.equal(choose(result, 'Первый').text, baseline.text);
    assert.equal((result.match(/^## Автор два$/gmu) || []).length, 1);
});

test('moving to a new author leaves the old author heading and all section dividers intact', () => {
    const baseline = choose(source, 'Первый');
    const result = replacePoem(source, baseline, { author: 'Другой', title: 'Переезд', text: baseline.text }, parsePoems);
    const retained = intro + '## Автор один\r\n\r\n' + separator + second;
    assert.ok(result.startsWith(retained));
    assert.equal(choose(result, 'Переезд').author, 'Другой');
    assert.equal(choose(result, 'Первый'), undefined);
});

test('delete removes exactly one poem and leaves blank separators and empty author headings', () => {
    assert.equal(removePoem(source, choose(source, 'Первый'), parsePoems), intro + '## Автор один\r\n\r\n' + separator + second);
    assert.equal(removePoem(source, choose(source, 'Второй'), parsePoems), intro + first + separator + '## Автор два\n\n');
});

test('existing fenced Markdown is part of the target span; its fake headings do not delimit it', () => {
    const raw = '# Стихи\n\n## Автор\n\n### Первый\nДо  \n```markdown\n## Чужое\n### Чужое\n---\n```\nПосле  \n\n---\n\n### Второй\nСохранить  \n';
    const result = removePoem(raw, choose(raw, 'Первый'), parsePoems);
    assert.equal(result, '# Стихи\n\n## Автор\n\n\n---\n\n### Второй\nСохранить  \n');
});

test('unrelated edits can shift the target line; stale target changes fail without producing a mutation', () => {
    const baseline = choose(source, 'Первый');
    const shifted = source.replace('# ✒ Стихи', '# ✒ Стихи\r\n\r\nЛичная заметка');
    assert.notEqual(choose(shifted, 'Первый').line, baseline.line);
    assert.ok(removePoem(shifted, baseline, parsePoems).includes('Личная заметка'));
    for (const changed of [source.replace('Первая строка', 'Другая строка'), source.replace('### Первый', '### Изменённый'), removePoem(source, baseline, parsePoems)]) {
        assert.throws(() => removePoem(changed, baseline, parsePoems), /изменилось или было удалено/u);
        assert.throws(() => replacePoem(changed, baseline, values, parsePoems), /изменилось или было удалено/u);
    }
});

test('a baseline copied with CRLF and Markdown hard breaks still matches the parsed target', () => {
    const baseline = choose(source, 'Первый');
    baseline.text = baseline.text.split('\n').map(line => line ? line + '  ' : line).join('\r\n');
    assert.equal(removePoem(source, baseline, parsePoems), intro + '## Автор один\r\n\r\n' + separator + second);
});

test('duplicates are rejected when adding or renaming, while an existing duplicate can be removed precisely', () => {
    const firstPoem = choose(source, 'Первый');
    assert.throws(() => addPoem(source, firstPoem, parsePoems), /уже есть/u);
    assert.throws(() => replacePoem(source, firstPoem, { author: 'Автор два', title: 'Второй', text: 'Переезд' }, parsePoems), /уже есть/u);
    const duplicateRaw = '## Автор\n\n### Имя\nПервое  \n\n### Имя\nВторое  \n';
    const duplicates = parsePoems(duplicateRaw);
    assert.equal(removePoem(duplicateRaw, duplicates[1], parsePoems), '## Автор\n\n### Имя\nПервое  \n\n');
});

test('empty input and Markdown structure injection fail before changing the source', () => {
    const invalid = [
        { author: '', title: 'Название', text: 'Строка' }, { author: 'Автор', title: ' ', text: 'Строка' }, { author: 'Автор', title: 'Название', text: '\n \n' },
        { author: 'Автор\n## Ещё', title: 'Название', text: 'Строка' }, { author: 'Автор', title: 'Название\r### Ещё', text: 'Строка' },
        { author: 'Ав\u0000тор', title: 'Название', text: 'Строка' }, { author: 'Автор', title: 'Название ###', text: 'Строка' },
        { author: 'Автор', title: 'Название', text: 'До\n## Ещё автор\nПосле' }, { author: 'Автор', title: 'Название', text: 'До\n ### Ещё текст\nПосле' },
        { author: 'Автор', title: 'Название', text: 'До\n---\nПосле' }, { author: 'Автор', title: 'Название', text: 'До\n```text\nСкрыто\n```' },
        { author: 'Автор', title: 'Название', text: 'До\u0000После' }
    ];
    for (const value of invalid) assert.throws(() => addPoem(source, value, parsePoems), Error);
    assert.throws(() => addPoem(source, values), /модуль чтения/u);
});

test('empty/BOM-only documents work, and standalone module evaluation needs no require', () => {
    const module = { exports: {} };
    new Function('module', fs.readFileSync(path.join(__dirname, '../poetry_storage.js'), 'utf8'))(module);
    for (const raw of ['', '\uFEFF']) {
        const result = module.exports.addPoem(raw, { author: 'Автор', title: 'Стих', text: 'Текст' }, parsePoems);
        assert.ok(result.startsWith(raw + '## Автор\n\n### Стих\nТекст  \n'));
        assert.equal(parsePoems(result).length, 1);
    }
    assert.deepEqual(normalizeValues({ author: ' Автор ', title: ' Стих ', text: '\nСтрока  \r\n\r\n  Ещё\t\r\n' }), { author: 'Автор', title: 'Стих', text: 'Строка\n\n  Ещё' });
});
