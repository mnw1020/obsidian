// Pure Markdown mutations. Unchanged parts of the anthology retain their exact bytes.
const HEADING = /^(#{2,3})\s+(.+?)(?:\s+#+)?\s*$/u;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const FENCE = /^\s*(`{3,}|~{3,})/u;
const CONFLICT = 'Стихотворение изменилось или было удалено. Обновите сборник и попробуйте снова.';

function normalizeText(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/u, ''));
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    return lines.join('\n');
}

function normalizeValues(values = {}) {
    function name(value, label) {
        const raw = String(value ?? '');
        if (/[\p{Cc}\u2028\u2029]/u.test(raw)) throw new Error(`В поле «${label}» нельзя использовать переносы строк и управляющие символы.`);
        const result = raw.trim();
        if (!result) throw new Error(`Заполните поле «${label}».`);
        // A closing ATX marker would silently change the parsed name.
        if (/\s#+$/u.test(result)) throw new Error(`Поле «${label}» не должно заканчиваться отдельной последовательностью #.`);
        return result;
    }
    const author = name(values.author, 'Автор'), title = name(values.title, 'Название');
    const text = normalizeText(values.text);
    if (!text.trim()) throw new Error('Добавьте текст стихотворения.');
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029]/u.test(text)) throw new Error('В тексте нельзя использовать управляющие символы.');
    for (const line of text.split('\n')) {
        if (/^\s*#{2,3}(?:\s|$)/u.test(line)) throw new Error('Внутри стихотворения нельзя использовать строки-заголовки ## и ###.');
        if (RULE.test(line) || FENCE.test(line)) throw new Error('Строки-разделители и блоки кода внутри стихотворения не поддерживаются.');
    }
    return { author, title, text };
}

function parsed(raw, parsePoems) {
    if (typeof parsePoems !== 'function') throw new Error('Недоступен модуль чтения стихов.');
    const result = parsePoems(raw);
    if (!Array.isArray(result)) throw new Error('Не удалось прочитать сборник стихов.');
    return result;
}

function scan(raw) {
    const rows = [];
    let start = 0;
    while (start < raw.length) {
        const newline = raw.indexOf('\n', start), end = newline < 0 ? raw.length : newline + 1;
        let text = raw.slice(start, newline < 0 ? end : newline);
        if (text.endsWith('\r')) text = text.slice(0, -1);
        if (!rows.length) text = text.replace(/^\uFEFF/u, '');
        rows.push({ start, end, text, block: null });
        start = end;
    }
    if (!rows.length || /\n$/u.test(raw)) rows.push({ start: raw.length, end: raw.length, text: '', block: null });
    let frontmatter = rows[0].text === '---', fence = null;
    for (let line = 0; line < rows.length; line++) {
        const row = rows[line];
        if (frontmatter) { if (line > 0 && row.text === '---') frontmatter = false; continue; }
        const fenced = row.text.match(FENCE);
        if (fenced) {
            if (!fence) fence = fenced[1];
            else if (fence[0] === fenced[1][0] && fenced[1].length >= fence.length) fence = null;
            continue;
        }
        if (fence) continue;
        const heading = row.text.match(HEADING);
        if (heading) row.block = { kind: 'heading', level: heading[1].length, name: heading[2], line };
        else if (RULE.test(row.text)) row.block = { kind: 'rule', line };
    }
    return rows;
}

function comparisonText(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/ {2,}$/u, ''));
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    return lines.join('\n');
}

function currentPoem(raw, baseline, parsePoems) {
    const poems = parsed(raw, parsePoems);
    const matches = poems.filter(poem => poem.key === baseline?.key);
    if (matches.length !== 1 || typeof baseline?.text !== 'string') throw new Error(CONFLICT);
    const fresh = matches[0];
    if (fresh.author !== baseline.author || fresh.title !== baseline.title || comparisonText(fresh.text) !== comparisonText(baseline.text)) throw new Error(CONFLICT);
    return { fresh, poems };
}

function poemSpan(raw, fresh) {
    const rows = scan(raw), header = rows[fresh.line];
    if (!Number.isInteger(fresh.line) || header?.block?.level !== 3 || header.block.name !== fresh.title) throw new Error(CONFLICT);
    const owner = rows.slice(0, fresh.line).filter(row => row.block?.level === 2).at(-1);
    if (owner?.block?.name !== fresh.author) throw new Error(CONFLICT);
    let next = fresh.line + 1;
    while (next < rows.length && !rows[next].block) next++;
    let last = next - 1;
    while (last > fresh.line && !rows[last].text.trim()) last--;
    return { start: header.start, end: rows[last].end };
}

function newlineOf(raw) { return raw.match(/\r\n|\n/u)?.[0] || '\n'; }
function renderPoem(values, newline, finalNewline = true) {
    const body = values.text.split('\n').map(line => line.trim() ? line + '  ' : '').join(newline);
    return `### ${values.title}${newline}${body}${finalNewline ? newline : ''}`;
}
function beforePadding(before, newline) {
    if (!before || before === '\uFEFF' || /(?:\r\n|\n){2}$/u.test(before)) return '';
    return /\n$/u.test(before) ? newline : newline + newline;
}
function afterPadding(after, newline) { return after && !/^[ \t]*(?:\r\n|\n)/u.test(after) ? newline : ''; }

function rejectDuplicate(poems, values, exceptKey) {
    if (poems.some(poem => poem.key !== exceptKey && poem.author === values.author && poem.title === values.title)) {
        throw new Error('У этого автора уже есть стихотворение с таким названием. Укажите другое название.');
    }
}
function signatures(poems) { return poems.map(poem => JSON.stringify([poem.author, poem.title, poem.text])); }
function assertSignatures(before, after) {
    if (JSON.stringify(signatures(before)) !== JSON.stringify(signatures(after))) throw new Error('Не удалось сохранить стихотворение, сохранив остальные тексты. Проверьте разметку сборника.');
}

function appendValidated(raw, values, parsePoems, poems) {
    rejectDuplicate(poems, values);
    const newline = newlineOf(raw), rows = scan(raw);
    const section = rows.findIndex(row => row.block?.level === 2 && row.block.name === values.author);
    let insertion = raw.length, newAuthor = section < 0;
    if (!newAuthor) {
        let end = section + 1;
        while (end < rows.length && rows[end].block?.level !== 2) end++;
        let tail = end - 1;
        // Keep an existing section divider after all of its poems.
        while (tail > section && (!rows[tail].text.trim() || rows[tail].block?.kind === 'rule')) tail--;
        insertion = rows[tail].end;
    }
    const before = raw.slice(0, insertion), after = raw.slice(insertion);
    const content = (newAuthor ? `## ${values.author}${newline}${newline}` : '') + renderPoem(values, newline);
    const result = before + beforePadding(before, newline) + content + afterPadding(after, newline) + after;
    const updated = parsed(result, parsePoems);
    const addition = updated.find(poem => poem.author === values.author && poem.title === values.title);
    if (!addition || addition.text !== values.text) throw new Error('Разметка текста не позволяет сохранить стихотворение целиком.');
    assertSignatures(poems, updated.filter(poem => poem !== addition));
    return result;
}

function addPoem(raw, values, parsePoems) {
    raw = String(raw ?? '');
    return appendValidated(raw, normalizeValues(values), parsePoems, parsed(raw, parsePoems));
}

function replacePoem(raw, baseline, values, parsePoems) {
    raw = String(raw ?? '');
    const next = normalizeValues(values), { fresh, poems } = currentPoem(raw, baseline, parsePoems);
    const renamed = fresh.author !== next.author || fresh.title !== next.title;
    if (renamed) rejectDuplicate(poems, next, fresh.key);
    if (!renamed && fresh.text === next.text) return raw;
    const span = poemSpan(raw, fresh), index = poems.indexOf(fresh);
    if (fresh.author !== next.author) {
        const removed = raw.slice(0, span.start) + raw.slice(span.end);
        const remaining = parsed(removed, parsePoems);
        assertSignatures(poems.filter(poem => poem !== fresh), remaining);
        return appendValidated(removed, next, parsePoems, remaining);
    }
    const result = raw.slice(0, span.start) + renderPoem(next, newlineOf(raw), /\n$/u.test(raw.slice(span.start, span.end))) + raw.slice(span.end);
    const expected = poems.slice(); expected[index] = next;
    assertSignatures(expected, parsed(result, parsePoems));
    return result;
}

function removePoem(raw, baseline, parsePoems) {
    raw = String(raw ?? '');
    const { fresh, poems } = currentPoem(raw, baseline, parsePoems), span = poemSpan(raw, fresh);
    const result = raw.slice(0, span.start) + raw.slice(span.end);
    assertSignatures(poems.filter(poem => poem !== fresh), parsed(result, parsePoems));
    return result;
}

module.exports = { addPoem, replacePoem, removePoem, normalizeValues };
