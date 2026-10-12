// Only generated presentation is replaced; properties and personal notes stay intact.
const START = '<!-- BOOK-SERIES-GENERATED:START -->', END = '<!-- BOOK-SERIES-GENERATED:END -->';
const ALL_START = '<!-- BOOK-SERIES-INDEX-GENERATED:START -->', ALL_END = '<!-- BOOK-SERIES-INDEX-GENERATED:END -->';
const LEGACY_DESCRIPTION = 'Количество относится к карточкам в библиотеке, а не ко всем выпущенным частям. Средняя оценка — по оценённым художественным произведениям.';
const TABLE_HEADER = '| Серия | Автор(ы) | В библиотеке | Прочитано | ⭐ ср. | Последнее чтение |';
const TABLE_RULE = '| --- | --- | ---: | ---: | ---: | --- |';
function block(mode) {
    return ['```dataviewjs', 'const file = app.vault.getAbstractFileByPath("Книги/_system/authors_ui.js");', 'if (file) {', '    const m = { exports: {} };', '    new Function("module", await app.vault.read(file))(m);', `    await m.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "${mode}" });`, '} else { dv.paragraph("Модуль страниц серий не найден. [[Книги/_index|← Библиотека]]"); }', '```'].join('\n');
}
function seriesRegion() { return [START, block('series'), END].join('\n'); }
function overviewRegion() { return [ALL_START, block('series-index'), ALL_END].join('\n'); }
function newline(raw) { return raw.includes('\r\n') ? '\r\n' : '\n'; }
function replaceRegion(raw, start, end, prefix, generated) {
    const count = token => raw.split(token).length - 1;
    if (count(start) !== 1 || count(end) !== 1 || count(prefix) !== 2 || raw.indexOf(end) < raw.indexOf(start)) {
        throw new Error('Повреждены маркеры страницы серии. Обновление отменено.');
    }
    return raw.slice(0, raw.indexOf(start)) + generated.replace(/\n/g, newline(raw)) + raw.slice(raw.indexOf(end) + end.length);
}
function mergeSeries(raw) {
    const prefix = '<!-- BOOK-SERIES-GENERATED:';
    if (raw.includes(prefix)) return replaceRegion(raw, START, END, prefix, seriesRegion());
    const nl = newline(raw);
    const separator = !raw || raw.endsWith(nl + nl) ? '' : raw.endsWith(nl) ? nl : nl + nl;
    return raw + separator + seriesRegion().replace(/\n/g, nl) + nl;
}
function overviewPage() {
    return '---\ncssclasses:\n  - books-library\n  - books-catalog-page\nobsidianUIMode: preview\n---\n\n' + overviewRegion() + '\n';
}
function mergePlaceholder(raw) {
    if (raw.includes('<!-- BOOK-SERIES-GENERATED:')) return mergeSeries(raw);
    const legacy = ['# 🧩 Серия', '', '[[Книги/_index|← Библиотека]] · [Выбрать серию](obsidian://quickadd?choice=Книги%20-%20Открыть%20серию) · [Все серии](obsidian://quickadd?choice=Книги%20-%20Серии)', '', 'У каждой серии теперь своя постоянная страница. Открой серию по ссылке в каталоге или выбери её выше; личные заметки на её странице сохраняются при обновлении.'];
    const escaped = legacy.map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\r?\\n');
    const matches = [...raw.matchAll(new RegExp('^' + escaped + '(?=\\r?\\n|$)', 'gm'))];
    if (matches.length !== 1) throw new Error('Не распознана прежняя страница «Серия». Исходный текст сохранён.');
    const match = matches[0];
    return raw.slice(0, match.index) + seriesRegion().replace(/\n/g, newline(raw)) + raw.slice(match.index + match[0].length);
}
function legacyNav() {
    const command = (label, name) => `[${label}](obsidian://quickadd?choice=${encodeURIComponent(name)})`;
    return ['[[Книги/_index|← Библиотека]]', command('👥 Авторы', 'Книги - Авторы'), command('🧩 Серии', 'Книги - Серии'), command('🎬 Экранизации', 'Книги - Экранизации'), '[[Книги/Цитаты|✒️ Выписки]]', '[[Книги/_system/Проверка библиотеки|🔎 Проверка]]'].join(' · ');
}
function legacyRow(line) {
    if (!line.startsWith('| ') || !line.endsWith(' |')) return false;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim());
    const seriesPrefix = '](obsidian://quickadd?choice=' + encodeURIComponent('Книги - Открыть серию') + '&value-series=';
    return cells.length === 6 && cells[0].startsWith('[') && cells[0].includes(seriesPrefix) && cells[0].endsWith(')')
        && /^\d+$/.test(cells[2]) && /^\d+$/.test(cells[3]) && /^(?:—|\d+\.\d)$/.test(cells[4])
        && (cells[5] === '—' || /^\[\[Книги\/.+\]\]$/.test(cells[5]));
}
function mergeOverview(raw) {
    const prefix = '<!-- BOOK-SERIES-INDEX-GENERATED:';
    if (raw.includes(prefix)) return replaceRegion(raw, ALL_START, ALL_END, prefix, overviewRegion());
    const failure = () => { throw new Error('Не распознана прежняя страница «Все серии». Исходный текст сохранён.'); };
    const headings = [...raw.matchAll(/^# 🧩 Серии\r?$/gm)];
    if (headings.length !== 1) return failure();
    const start = headings[0].index;
    const lines = [...raw.slice(start).matchAll(/([^\r\n]*)(\r?\n|$)/g)].filter(match => match[0]);
    const expected = ['# 🧩 Серии', '', legacyNav(), '', '> [!info] Обзор'];
    if (!expected.every((value, index) => lines[index]?.[1] === value)
        || !/^> \*\*Серий:\*\* \d+ · \*\*Произведений:\*\* \d+ · \*\*Прочитано:\*\* \d+ · \*\*С оценкой:\*\* \d+$/.test(lines[5]?.[1] || '')
        || lines[6]?.[1] !== '' || lines[7]?.[1] !== LEGACY_DESCRIPTION || lines[8]?.[1] !== '') return failure();
    let endLine;
    if (lines[9]?.[1] === '_Серий пока нет._') endLine = 9;
    else {
        if (lines[9]?.[1] !== TABLE_HEADER || lines[10]?.[1] !== TABLE_RULE || !legacyRow(lines[11]?.[1] || '')) return failure();
        endLine = 11;
        while (legacyRow(lines[endLine + 1]?.[1] || '')) endLine++;
        // A malformed generated row must never be mistaken for disposable user text.
        const next = lines[endLine + 1]?.[1] || '';
        if (next.startsWith('| ') && next.includes('obsidian://quickadd?choice=')) return failure();
    }
    const last = lines[endLine], end = start + last.index + last[0].length;
    const nl = newline(raw);
    return raw.slice(0, start) + overviewRegion().replace(/\n/g, nl) + nl + raw.slice(end);
}
module.exports = { seriesRegion, overviewPage, mergeSeries, mergeOverview, mergePlaceholder };
