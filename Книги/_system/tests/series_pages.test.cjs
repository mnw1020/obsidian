const assert = require('node:assert/strict'), { test } = require('node:test');
const pages = require('../series_pages.js');
const START = '<!-- BOOK-SERIES-GENERATED:START -->', END = '<!-- BOOK-SERIES-GENERATED:END -->';
const ALL_START = '<!-- BOOK-SERIES-INDEX-GENERATED:START -->', ALL_END = '<!-- BOOK-SERIES-INDEX-GENERATED:END -->';
function legacyOverview() {
    const command = (label, choice, key, value) => `[${label}](obsidian://quickadd?choice=${encodeURIComponent(choice)}${key ? '&value-' + key + '=' + encodeURIComponent(value) : ''})`;
    const nav = ['[[Книги/_index|← Библиотека]]', command('👥 Авторы', 'Книги - Авторы'), command('🧩 Серии', 'Книги - Серии'), command('🎬 Экранизации', 'Книги - Экранизации'), '[[Книги/Цитаты|✒️ Выписки]]', '[[Книги/_system/Проверка библиотеки|🔎 Проверка]]'].join(' · ');
    return ['---', 'cssclasses:', '  - books-library', 'obsidianUIMode: preview', 'custom: true', '---', '', '# 🧩 Серии', '', nav, '', '> [!info] Обзор', '> **Серий:** 2 · **Произведений:** 5 · **Прочитано:** 4 · **С оценкой:** 3', '', 'Количество относится к карточкам в библиотеке, а не ко всем выпущенным частям. Средняя оценка — по оценённым художественным произведениям.', '', '| Серия | Автор(ы) | В библиотеке | Прочитано | ⭐ ср. | Последнее чтение |', '| --- | --- | ---: | ---: | ---: | --- |', `| ${command('Тёмные начала', 'Книги - Открыть серию', 'series', 'Тёмные начала')} | ${command('Филип Пулман', 'Книги - Открыть автора', 'author', 'Филип Пулман')} | 3 | 2 | 7.3 | [[Книги/Художественные/Филип Пулман/Янтарный телескоп\\|Янтарный телескоп · 25.09.2023]] |`, `| ${command('Тайпи и Ому', 'Книги - Открыть серию', 'series', 'Тайпи и Ому')} | ${command('Герман Мелвилл', 'Книги - Открыть автора', 'author', 'Герман Мелвилл')} | 2 | 2 | 5.0 | [[Книги/Художественные/Герман Мелвилл/Ому\\|Ому · 10.11.2025]] |`, ''].join('\n');
}
const legacyChooser = ['---', 'cssclasses:', '  - books-entity', 'obsidianUIMode: preview', '---', '', '# 🧩 Серия', '', '[[Книги/_index|← Библиотека]] · [Выбрать серию](obsidian://quickadd?choice=Книги%20-%20Открыть%20серию) · [Все серии](obsidian://quickadd?choice=Книги%20-%20Серии)', '', 'У каждой серии теперь своя постоянная страница. Открой серию по ссылке в каталоге или выбери её выше; личные заметки на её странице сохраняются при обновлении.', ''].join('\n');
test('series replacement preserves properties, personal notes, literal tokens and their newlines', () => {
    const prefix = '---\r\nselected_series: "Серия $&"\r\ncustom: true\r\n---\r\n\r\nЛичное предисловие\n\n';
    const suffix = '\r\n## Мои заметки\r\n\nЛичные сведения $& $` $\' [[Ссылка]] ^anchor\r\n  ';
    const raw = prefix + START + '\r\nСтарая шапка\r\n' + END + suffix;
    const next = pages.mergeSeries(raw);
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    assert.match(next, /mode: "series"/); assert.match(next, /authors_ui\.js/);
    assert.equal(pages.mergeSeries(next), next);
});
test('unmanaged series notes are appended to without stripping trailing whitespace', () => {
    const raw = '---\nselected_series: Серия\n---\n\nМои заметки $&\n  \n\t';
    const next = pages.mergeSeries(raw);
    assert.ok(next.startsWith(raw)); assert.match(next, /BOOK-SERIES-GENERATED:START/);
    assert.equal(pages.mergeSeries(next), next);
});
test('series and catalogue reject missing, duplicated, reversed and malformed markers', () => {
    for (const [merge, start, end] of [[pages.mergeSeries, START, END], [pages.mergeOverview, ALL_START, ALL_END]]) {
        for (const raw of [start, end, end + start, start + end + start + end, start.replace(':START -->', ':BROKEN -->'), start + end + start.replace(':START -->', ':BROKEN -->')]) {
            assert.throws(() => merge(raw), /маркеры/);
        }
    }
});
test('marked catalogue updates preserve all user text and are idempotent', () => {
    const prefix = '---\r\ncustom: true\r\n---\r\n\r\nПредисловие $&\n';
    const suffix = '\r\n## Мои заметки\n\nТекст $& [[Ссылка]] ^anchor\r\n  ';
    const next = pages.mergeOverview(prefix + ALL_START + '\r\nСтарая таблица\r\n' + ALL_END + suffix);
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    assert.match(next, /mode: "series-index"/); assert.equal(pages.mergeOverview(next), next);
});
test('legacy catalogue migrates only its recognized presentation and preserves frontmatter and personal suffix', () => {
    const legacy = legacyOverview(), heading = legacy.indexOf('# 🧩 Серии');
    const prefix = legacy.slice(0, heading) + 'Личное предисловие $&\r\n\r\n';
    const suffix = '\r\n## Мои заметки\r\n\nТекст $& [[Ссылка]] ^anchor\r\n\r\n| Моя таблица |\r\n| --- |\r\n| Личная запись |\r\n';
    const next = pages.mergeOverview(prefix + legacy.slice(heading) + suffix);
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    assert.doesNotMatch(next, /\| Серия \| Автор/); assert.equal(pages.mergeOverview(next), next);
});
test('legacy empty catalogue migrates while preserving following personal material', () => {
    const legacy = legacyOverview(), table = legacy.indexOf('| Серия |');
    const suffix = '\nМой текст $&\n';
    const next = pages.mergeOverview(legacy.slice(0, table) + '_Серий пока нет._\n' + suffix);
    assert.ok(next.endsWith(suffix)); assert.match(next, /mode: "series-index"/);
});
test('legacy catalogue supports CRLF without changing existing personal newline bytes', () => {
    const legacy = legacyOverview().replace(/\n/g, '\r\n'), prefix = legacy.slice(0, legacy.indexOf('# 🧩 Серии'));
    const suffix = '\r\nЛичные заметки\n  \r\n';
    const next = pages.mergeOverview(legacy + suffix);
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    assert.ok(next.includes(ALL_START + '\r\n```dataviewjs'));
});
test('legacy migration rejects unknown page structure and malformed generated rows', () => {
    const legacy = legacyOverview();
    assert.throws(() => pages.mergeOverview('Мои личные заметки'), /Исходный текст сохранён/);
    assert.throws(() => pages.mergeOverview(legacy.replace('Количество относится к карточкам', 'Моя личная формулировка относится к карточкам')), /Исходный текст сохранён/);
    assert.throws(() => pages.mergeOverview(legacy.replace('| --- | --- | ---: | ---: | ---: | --- |', '| Своя таблица |')), /Исходный текст сохранён/);
    assert.throws(() => pages.mergeOverview(legacy + '| [Личная серия](obsidian://quickadd?choice=unknown) | 0 |\n'), /Исходный текст сохранён/);
});
test('legacy series chooser migrates only its exact old body and preserves surrounding personal text', () => {
    const legacy = legacyChooser;
    const heading = legacy.indexOf('# 🧩 Серия');
    assert.ok(heading > 0, 'legacy chooser fixture is the original page');
    const prefix = legacy.slice(0, heading) + 'Личное предисловие $&\r\n\n';
    const suffix = '\r\n## Мои заметки\n\nТекст $& [[Ссылка]]\n  ';
    const raw = prefix + legacy.slice(heading).replace(/\s*$/, '') + suffix;
    const next = pages.mergePlaceholder(raw);
    assert.ok(next.startsWith(prefix)); assert.ok(next.endsWith(suffix));
    assert.match(next, /mode: "series"/); assert.equal(pages.mergePlaceholder(next), next);
    assert.throws(() => pages.mergePlaceholder(raw.replace('У каждой серии', 'Мой текст серии')), /Исходный текст сохранён/);
    assert.throws(() => pages.mergePlaceholder('Мои личные заметки'), /Исходный текст сохранён/);
});
