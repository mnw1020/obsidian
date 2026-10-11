// Presentation wraps ordinary Markdown; storage and parsing never depend on the UI.
const START = '<!-- BOOK-MAINTENANCE:START -->', END = '<!-- BOOK-MAINTENANCE:END -->';
const PREFIX = '<!-- BOOK-MAINTENANCE:';
const newline = text => text.includes('\r\n') ? '\r\n' : '\n';
function documentParts(text) {
    const match = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
    return { frontmatter: match?.[0] || '', body: text.slice(match?.[0].length || 0) };
}
function region(text) {
    if (!text.includes(PREFIX)) return null;
    const count = token => text.split(token).length - 1;
    if (count(PREFIX) !== 2 || count(START) !== 1 || count(END) !== 1 || text.indexOf(END) < text.indexOf(START)) {
        throw new Error('Повреждены маркеры служебной страницы. Обновление отменено.');
    }
    const start = text.indexOf(START), end = text.indexOf(END) + END.length;
    return { start, end, text: text.slice(start, end) };
}
function loader(mode, nl) {
    if (!['audit', 'journal'].includes(mode)) throw new Error('Неизвестный вид служебной страницы.');
    return [START, '```dataviewjs', 'const file = app.vault.getAbstractFileByPath("Книги/_system/maintenance_ui.js");', 'if (file) {', '    const m = { exports: {} };', '    new Function("module", await app.vault.read(file))(m);', `    await m.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {}, mode: "${mode}" });`, '} else { dv.paragraph("Модуль оформления не найден. Данные страницы приведены ниже."); }', '```', END].join(nl);
}
function page(text, mode) {
    const nl = newline(text), generated = loader(mode, nl), existing = region(text);
    if (existing) return text.slice(0, existing.start) + generated + text.slice(existing.end);
    const { frontmatter, body } = documentParts(text);
    return frontmatter + (frontmatter ? nl : '') + generated + nl + nl + body;
}
function clearJournal(text) {
    const decorated = page(text, 'journal'), { frontmatter } = documentParts(decorated), nl = newline(decorated);
    const generated = region(decorated).text;
    const fallback = ['# Журнал изменений', '', '[[Книги/_index|← Библиотека]] · [[Книги/_system/Проверка библиотеки|Проверка библиотеки]]', '', '> Автоматическая история обслуживания книжной базы.', ''].join(nl);
    return frontmatter + (frontmatter ? nl : '') + generated + nl + nl + fallback;
}
function dataBody(text) {
    const { body } = documentParts(text), existing = region(body);
    return existing ? body.slice(0, existing.start) + body.slice(existing.end) : body;
}
function headings(text) {
    const result = [];
    let fence = null;
    for (const line of text.matchAll(/([^\r\n]*)(\r?\n|$)/g)) {
        if (!line[0]) continue;
        const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line[1]);
        if (fence) {
            if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) fence = null;
            continue;
        }
        if (fenceMatch) { fence = { char: fenceMatch[1][0], length: fenceMatch[1].length }; continue; }
        const match = /^ {0,3}##[ \t]+(.+)$/.exec(line[1]);
        if (match) result.push({ title: match[1].replace(/[ \t]+#+[ \t]*$/, '').trim(), start: line.index, body: line.index + line[0].length });
    }
    return result;
}
function parseAudit(text) {
    const body = dataBody(text), rows = headings(body);
    const count = pattern => Number(pattern.exec(body)?.[1] || 0);
    return {
        timestamp: /Последняя проверка:\s*\*\*([^*\r\n]+)\*\*/.exec(body)?.[1] || '',
        checked: count(/Произведений проверено:\s*\*\*(\d+)\*\*/),
        errors: count(/Ошибок:\s*\*\*(\d+)\*\*/), warnings: count(/Предупреждений:\s*\*\*(\d+)\*\*/),
        sections: rows.map((row, index) => ({ title: row.title, markdown: body.slice(row.body, rows[index + 1]?.start ?? body.length) }))
    };
}
function parseJournal(text) {
    const body = dataBody(text), rows = headings(body);
    const entries = rows.map(row => {
        const before = body.slice(0, row.start);
        const marker = /(?:^|\n)(<!-- BOOK-[^\r\n]* -->\r?\n(?:[ \t]*\r?\n)*)$/.exec(before);
        const at = marker?.[1].match(/^<!-- BOOK-LIBRARY-EVENT\b[^\r\n]*\bat="([^"]*)"/)?.[1] || '';
        return { ...row, start: marker ? marker.index + marker[0].indexOf('<!--') : row.start, at };
    });
    return entries.map((row, index) => ({ title: row.title, markdown: body.slice(row.body, entries[index + 1]?.start ?? body.length), at: row.at }));
}
module.exports = { page, clearJournal, parseAudit, parseJournal };
