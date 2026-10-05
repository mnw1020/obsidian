// Generated presentation is isolated from author properties and personal notes.
const START = '<!-- BOOK-AUTHOR-GENERATED:START -->', END = '<!-- BOOK-AUTHOR-GENERATED:END -->';
const ALL_START = '<!-- BOOK-AUTHORS-GENERATED:START -->', ALL_END = '<!-- BOOK-AUTHORS-GENERATED:END -->';
function block(mode) {
    return ['```dataviewjs', 'const file = app.vault.getAbstractFileByPath("Книги/_system/authors_ui.js");', 'if (file) {', '    const m = { exports: {} };', '    new Function("module", await app.vault.read(file))(m);', `    await m.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "${mode}" });`, '} else { dv.paragraph("Модуль страниц авторов не найден. [[Книги/_index|← Библиотека]]"); }', '```'].join('\n');
}
function authorRegion() { return [START, block('author'), END].join('\n'); }
function overviewRegion() { return [ALL_START, block('index'), ALL_END].join('\n'); }
function replaceRegion(raw, start, end, generated) {
    const starts = raw.split(start).length - 1, ends = raw.split(end).length - 1;
    if (starts !== 1 || ends !== 1 || raw.indexOf(end) < raw.indexOf(start)) throw new Error('Повреждены маркеры страницы автора. Обновление отменено.');
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    return raw.slice(0, raw.indexOf(start)) + generated.replace(/\n/g, nl) + raw.slice(raw.indexOf(end) + end.length);
}
function mergeAuthor(raw) {
    if (!raw.includes(START) && !raw.includes(END)) return raw.replace(/\s*$/, '\n\n') + authorRegion() + '\n';
    return replaceRegion(raw, START, END, authorRegion());
}
function overviewPage() {
    return '---\ncssclasses:\n  - books-library\nobsidianUIMode: preview\n---\n\n' + overviewRegion() + '\n';
}
function mergeOverview(raw) {
    if (raw.includes(ALL_START) || raw.includes(ALL_END)) return replaceRegion(raw, ALL_START, ALL_END, overviewRegion());
    // The old overview was generated as two Markdown tables. Retain any text after them.
    const start = raw.indexOf('# 👥 Авторы');
    const heading = raw.indexOf('## Non-fiction', start);
    if (start < 0 || heading < 0 || !raw.includes('Баллы симпатии')) throw new Error('Не распознана прежняя страница «Все авторы». Исходный текст сохранён.');
    const tail = raw.slice(heading);
    const table = /^## Non-fiction\r?\n\r?\n(?:\|[^\r\n]*\r?\n)+/.exec(tail);
    const empty = /^## Non-fiction\r?\n\r?\n_Произведений пока нет\._\r?\n/.exec(tail);
    const region = table || empty;
    if (!region) throw new Error('Не распознана таблица авторов. Исходный текст сохранён.');
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    return raw.slice(0, start) + overviewRegion().replace(/\n/g, nl) + nl + raw.slice(heading + region[0].length);
}
module.exports = { authorRegion, overviewPage, mergeAuthor, mergeOverview };
