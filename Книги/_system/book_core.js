// Shared book logic. Loaded through Vault.read, including on mobile.
module.exports = ({ app, obsidian }) => {
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";
    const HOME_PATH = "Книги/_index.md";
    const JOURNAL_PATH = "Книги/_system/Журнал изменений.md";
    const fresh = new Map();
    const listValues = value => (Array.isArray(value) ? value : [value])
        .map(item => String(item ?? "").trim()).filter(Boolean);
    const getFrontmatter = file => file
        ? fresh.get(file.path) ?? app.metadataCache.getFileCache(file)?.frontmatter ?? {}
        : {};
    const remember = (file, fm) => { fresh.set(file.path, { ...fm }); return fm; };
    const hasBookPath = file => Boolean(file && file.extension === "md" &&
        file.path.startsWith("Книги/") && file.basename !== "_index" &&
        !/^Книги\/(?:_system|Цитаты|Конспекты|Идеи)\//.test(file.path));
    const isBook = file => {
        if (!hasBookPath(file)) return false;
        const fm = getFrontmatter(file);
        return !["quote", "summary", "idea"].includes(String(fm.note_type ?? "")) &&
            Boolean(String(fm.title ?? "").trim()) && listValues(fm.authors).length > 0;
    };
    const isFiction = file => Boolean(file?.path.startsWith("Книги/Художественные/"));
    const isCandidateBook = file => hasBookPath(file) &&
        (isFiction(file) || file.path.startsWith("Книги/Non-fiction/") || isBook(file));
    const books = () => app.vault.getMarkdownFiles().filter(isBook);
    const snapshot = () => books().map(file => ({ file, fm: getFrontmatter(file) }));
    function stats(items = snapshot()) {
        const authors = new Set(), series = new Set();
        let rated = 0, reread = 0, readings = 0;
        for (const { file, fm } of items) {
            for (const author of listValues(fm.authors)) authors.add(author);
            if (String(fm.series ?? "").trim()) series.add(String(fm.series).trim());
            const rating = Number(fm.rating), count = Number(fm.read_count);
            if (isFiction(file) && Number.isFinite(rating) && rating >= 1 && rating <= 10) rated++;
            if (Number.isInteger(count) && count >= 0) readings += count;
            if (Number.isInteger(count) && count > 1) reread++;
        }
        return { books: items.length, authors: authors.size, series: series.size, rated, reread, readings };
    }
    function displayDate(value) {
        const text = String(value ?? "").trim();
        let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return `${match[3]}.${match[2]}.${match[1]}`;
        match = text.match(/^(\d{4})-(\d{2})$/);
        return match ? `${match[2]}.${match[1]}` : text;
    }
    function isValidDate(value) {
        const match = String(value ?? "").trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
        if (!match || Number(match[1]) < 1) return false;
        if (!match[2]) return true;
        const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
        if (month < 1 || month > 12) return false;
        if (!match[3]) return true;
        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }
    function readFrontmatter(text) {
        const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        if (!match) {
            if (/^\uFEFF?---(?:\r?\n|$)/.test(text)) throw new Error("YAML карточки повреждён: отсутствует закрывающий маркер ---.");
            return {};
        }
        if (!obsidian.parseYaml) throw new Error("Obsidian parseYaml недоступен.");
        const fm = obsidian.parseYaml(match[1]) ?? {};
        if (typeof fm !== "object" || Array.isArray(fm)) throw new Error("YAML карточки должен содержать свойства.");
        return fm;
    }
    async function refreshFrontmatter(file) {
        return remember(file, readFrontmatter(await app.vault.read(file)));
    }
    function historyError(message) {
        const error = new Error(`История чтений повреждена: ${message}. Запись отменена; проверь служебные маркеры.`);
        error.code = "BOOK_HISTORY_INVALID";
        return error;
    }
    function parseHistory(text) {
        const count = marker => text.split(marker).length - 1;
        if (count(HISTORY_START) !== 1 || count(HISTORY_END) !== 1) throw historyError("нужна одна пара BOOK-READINGS");
        const start = text.indexOf(HISTORY_START), end = text.indexOf(HISTORY_END);
        if (end < start) throw historyError("закрывающий маркер стоит раньше открывающего");
        const contentStart = start + HISTORY_START.length;
        const managed = text.slice(contentStart, end), entries = [], numbers = new Set();
        const re = /<!-- BOOK-READING:START number="(\d+)" date="([^"]*)" rating="([^"]*)" -->([\s\S]*?)<!-- BOOK-READING:END -->/g;
        let match;
        while ((match = re.exec(managed))) {
            const number = Number(match[1]), rating = match[3] === "" ? null : Number(match[3]);
            if (!Number.isInteger(number) || number < 1 || numbers.has(number)) throw historyError("некорректные или повторяющиеся номера чтений");
            if (!isValidDate(match[2])) throw historyError(`некорректная дата чтения #${number}`);
            if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 10)) throw historyError(`некорректная оценка чтения #${number}`);
            const inner = match[4], markerIndex = inner.indexOf(COMMENT_MARK);
            if (inner.includes("<!-- BOOK-READING:START") || inner.split(COMMENT_MARK).length > 2) throw historyError(`вложенные маркеры чтения #${number}`);
            const header = inner.match(/^\s*### Чтение[^\r\n]*(?:\r?\n)/);
            let unmanaged = header ? inner.slice(header[0].length) : inner;
            unmanaged = unmanaged.replace(/^\s*\*\*Оценка:\*\*[^\r\n]*(?:\r?\n|$)/, "");
            entries.push({ number, date: match[2], rating,
                comment: (markerIndex >= 0 ? inner.slice(markerIndex + COMMENT_MARK.length) : unmanaged).trim(),
                hasCommentMarker: markerIndex >= 0, raw: match[0], inner,
                start: contentStart + match.index, end: contentStart + re.lastIndex });
            numbers.add(number);
        }
        const rawStarts = (managed.match(/<!-- BOOK-READING:START\b/g) ?? []).length;
        const rawEnds = (managed.match(/<!-- BOOK-READING:END\b/g) ?? []).length;
        if (rawStarts !== entries.length || rawEnds !== entries.length) throw historyError("не распознаны отдельные записи");
        return { entries, start, end, contentStart, contentEnd: end, managed, newline: text.includes("\r\n") ? "\r\n" : "\n" };
    }
    function validateReading(entry) {
        if (!isValidDate(entry.date)) throw new Error("Некорректная дата. Используй YYYY-MM-DD, YYYY-MM или YYYY.");
        if (entry.rating !== null && entry.rating !== undefined &&
            (!Number.isFinite(Number(entry.rating)) || Number(entry.rating) < 1 || Number(entry.rating) > 10)) {
            throw new Error("Оценка должна быть от 1 до 10.");
        }
        if (/<!-- BOOK-READINGS?:/.test(String(entry.comment ?? ""))) throw new Error("В комментарии обнаружен служебный маркер истории. Удали его из текста.");
    }
    function validateBookFrontmatter(fm) {
        if (!String(fm.title ?? "").trim() || !listValues(fm.authors).length) throw new Error("В актуальной карточке отсутствуют title или authors. Сначала исправь свойства книги.");
    }
    function renderEntry(entry) {
        validateReading(entry);
        const rating = entry.rating === null || entry.rating === undefined ? "" : String(entry.rating);
        return `<!-- BOOK-READING:START number="${entry.number}" date="${entry.date}" rating="${rating}" -->\n` +
            `### Чтение ${entry.number} - ${displayDate(entry.date)}\n\n` +
            (rating ? `**Оценка:** ${rating}/10\n\n` : "") + COMMENT_MARK + "\n" +
            (entry.comment ? `${String(entry.comment).trim()}\n` : "") + "<!-- BOOK-READING:END -->";
    }
    // Touch the generated heading/rating and the editable comment, retaining manual prefixes.
    function rewriteEntry(original, entry, nl) {
        if (!original.hasCommentMarker) return renderEntry(entry).replace(/\n/g, nl);
        const markerIndex = original.inner.indexOf(COMMENT_MARK);
        let prefix = original.inner.slice(0, markerIndex);
        const heading = `### Чтение ${entry.number} - ${displayDate(entry.date)}`;
        prefix = /^\s*### Чтение[^\r\n]*/.test(prefix)
            ? prefix.replace(/^(\s*)### Чтение[^\r\n]*/, `$1${heading}`)
            : nl + heading + nl + prefix;
        const ratingLine = /(^|\r?\n)\*\*Оценка:\*\*[^\r\n]*(?:\r?\n)?/;
        if (ratingLine.test(prefix)) prefix = prefix.replace(ratingLine, entry.rating === null ? "$1" : `$1**Оценка:** ${entry.rating}/10${nl}`);
        else if (entry.rating !== null) prefix += `**Оценка:** ${entry.rating}/10${nl}${nl}`;
        const comment = String(entry.comment ?? "").trim().replace(/\r?\n/g, nl);
        return `<!-- BOOK-READING:START number="${entry.number}" date="${entry.date}" rating="${entry.rating ?? ""}" -->` +
            prefix + COMMENT_MARK + nl + (comment ? comment + nl : "") + "<!-- BOOK-READING:END -->";
    }
    function summary(entries, file) {
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
        const latest = sorted[sorted.length - 1], rated = [...sorted].reverse().find(entry => entry.rating !== null && entry.rating !== undefined);
        return { read_count: entries.length, date: latest?.date, rating: isFiction(file) && rated ? rated.rating : undefined };
    }
    function yamlComment(line) {
        let single = false, double = false;
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
            if (double && char === "\\") { index++; continue; }
            if (!single && char === '"') double = !double;
            else if (!double && char === "'") {
                if (single && line[index + 1] === "'") index++;
                else single = !single;
            } else if (!single && !double && char === "#" && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(index).replace(/\r?\n$/, "");
        }
        return "";
    }
    function patchSummary(text, values) {
        const nl = text.includes("\r\n") ? "\r\n" : "\n";
        const match = text.match(/^(\uFEFF?)---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        let yaml = match ? match[2] : "";
        for (const [key, value] of Object.entries(values)) {
            const re = new RegExp(`^${key}:[^\\r\\n]*(?:\\r?\\n|$)`, "m");
            const existing = yaml.match(re);
            const scalar = value === undefined ? null : typeof value === "number" ? String(value) : JSON.stringify(value);
            const comment = existing ? yamlComment(existing[0]) : "";
            const replacement = scalar === null ? (comment ? `${comment}${nl}` : "") : `${key}: ${scalar}${comment ? ` ${comment}` : ""}${nl}`;
            if (existing) yaml = yaml.replace(re, replacement);
            else if (scalar !== null) yaml = yaml.replace(/\s*$/, "") + (yaml ? nl : "") + replacement;
        }
        const block = `${match?.[1] ?? ""}---${nl}${yaml.replace(/\r?\n$/, "")}${nl}---${nl}`;
        return block + (match ? text.slice(match[0].length) : nl + text);
    }
    function patchProperties(text, updates) {
        const nl = text.includes("\r\n") ? "\r\n" : "\n";
        const match = text.match(/^(\uFEFF?)---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        let yaml = match ? match[2] : "";
        for (const [key, value] of Object.entries(updates)) {
            const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const line = new RegExp(`^${escaped}:[^\\r\\n]*(?:\\r?\\n|$)`, "m").exec(yaml);
            let replacement = value === undefined ? "" : `${key}: ${JSON.stringify(value)}${nl}`;
            if (line) {
                let end = line.index + line[0].length;
                const comments = [];
                while (end < yaml.length) {
                    const next = /^[^\r\n]*(?:\r?\n|$)/.exec(yaml.slice(end))[0];
                    if (!next || (!/^(?:[ \t]|-[ \t])/.test(next) && next.trim())) break;
                    const comment = yamlComment(next);
                    if (comment) comments.push(comment);
                    end += next.length;
                }
                const inlineComment = yamlComment(line[0]);
                if (inlineComment) replacement = value === undefined ? `${inlineComment}${nl}` : replacement.replace(/\r?\n$/, ` ${inlineComment}${nl}`);
                if (comments.length) replacement += comments.map(comment => `${comment}${nl}`).join("");
                yaml = yaml.slice(0, line.index) + replacement + yaml.slice(end);
            } else if (value !== undefined) yaml = yaml.replace(/\s*$/, "") + (yaml ? nl : "") + replacement;
        }
        return `${match?.[1] ?? ""}---${nl}${yaml.replace(/\r?\n$/, "")}${nl}---${nl}` + (match ? text.slice(match[0].length) : nl + text);
    }
    async function updateFrontmatter(file, transform) {
        let result, fm, changed = false;
        await app.vault.process(file, current => {
            fm = readFrontmatter(current);
            const before = JSON.stringify(fm), original = JSON.parse(before);
            result = transform(fm, current);
            if (result?.then) throw new Error("Изменение свойств должно быть синхронным.");
            changed = before !== JSON.stringify(fm);
            if (!changed) return current;
            const updates = {};
            for (const key of new Set([...Object.keys(original), ...Object.keys(fm)])) {
                if (JSON.stringify(original[key]) !== JSON.stringify(fm[key])) updates[key] = fm[key];
            }
            const updated = patchProperties(current, updates);
            readFrontmatter(updated);
            return updated;
        });
        remember(file, fm);
        return { changed, result, fm };
    }
    async function appendReading(file, values) {
        const entry = { ...values, rating: isFiction(file) ? values.rating ?? null : null };
        validateReading(entry);
        let result;
        await app.vault.process(file, current => {
            validateBookFrontmatter(readFrontmatter(current)); // Refuse invalid YAML/properties before changing text.
            const history = parseHistory(current), nl = history.newline;
            entry.number = history.entries.reduce((max, item) => Math.max(max, item.number), 0) + 1;
            const managed = !history.entries.length && /^\s*_История пока пуста\._\s*$/.test(history.managed) ? "" : history.managed;
            const body = current.slice(0, history.contentStart) + managed + nl + nl + renderEntry(entry).replace(/\n/g, nl) + nl + nl + current.slice(history.end);
            const updated = patchSummary(body, summary([...history.entries, entry], file));
            const fm = readFrontmatter(updated);
            result = { entry: { ...entry }, fm, text: updated };
            return updated;
        });
        remember(file, result.fm);
        return result;
    }
    async function editReading(file, original, values) {
        const entry = { ...values, number: original.number, rating: isFiction(file) ? values.rating ?? null : null };
        validateReading(entry);
        let result;
        await app.vault.process(file, current => {
            validateBookFrontmatter(readFrontmatter(current));
            const history = parseHistory(current), selected = history.entries.find(item => item.number === original.number);
            if (!selected || selected.raw !== original.raw) {
                const error = new Error("Выбранное чтение изменилось, пока форма была открыта.");
                error.code = "BOOK_READING_CONFLICT";
                error.currentEntry = selected ?? null;
                throw error;
            }
            const entries = history.entries.map(item => item.number === original.number ? entry : item);
            const updated = patchSummary(current.slice(0, selected.start) + rewriteEntry(selected, entry, history.newline) + current.slice(selected.end), summary(entries, file));
            result = { entry, fm: readFrontmatter(updated), text: updated };
            return updated;
        });
        remember(file, result.fm);
        return result;
    }
    async function writeIfChanged(path, text) {
        path = obsidian.normalizePath ? obsidian.normalizePath(path) : path;
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            try { return await app.vault.create(path, text); }
            catch (error) { file = app.vault.getAbstractFileByPath(path); if (!file) throw error; }
        }
        const original = await app.vault.read(file);
        if (original === text) return file;
        await app.vault.process(file, current => {
            if (current !== original && current !== text) throw new Error(`Файл ${path} изменился во время обновления. Повтори команду.`);
            return text;
        });
        return file;
    }
    async function updateHomeStats() {
        const home = app.vault.getAbstractFileByPath(HOME_PATH);
        if (!home) return;
        // A newly created card can be absent from metadataCache; inspect only uncached candidates.
        for (const file of app.vault.getMarkdownFiles().filter(isCandidateBook)) {
            if (!fresh.has(file.path) && !app.metadataCache.getFileCache(file)?.frontmatter) await refreshFrontmatter(file);
        }
        const values = stats();
        const block = `<!-- BOOK-HOME-STATS:START -->\n> [!quote] Библиотека\n> **${values.books} произведений** · **${values.authors} авторов** · **${values.series} серий** · **${values.rated} оценено** · **${values.reread} перечитано**\n<!-- BOOK-HOME-STATS:END -->`;
        const current = await app.vault.read(home);
        const updated = current.replace(/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/, block);
        if (updated !== current) await app.vault.process(home, data => data.replace(/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/, block));
    }
    async function appendJournal(lines, structural = true, normalization = false) {
        if (!lines.length) return;
        const now = new Date(), pad = value => String(value).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const block = `<!-- BOOK-LIBRARY-EVENT at="${iso}" normalization="${normalization}" structure="${structural}" -->\n## ${stamp}\n\n` + lines.map(line => `- ${line}\n`).join("") + "\n";
        let file = app.vault.getAbstractFileByPath(JOURNAL_PATH);
        if (!file) {
            try { await app.vault.create(JOURNAL_PATH, `# Журнал изменений\n\n[[Книги/_index|← Книги]]\n\n> Автоматическая история обслуживания книжной базы.\n\n${block}`); return; }
            catch (error) { file = app.vault.getAbstractFileByPath(JOURNAL_PATH); if (!file) throw error; }
        }
        await app.vault.process(file, current => current.replace(/\s*$/, "\n\n") + block);
    }
    return { getFrontmatter, remember, readFrontmatter, refreshFrontmatter, isCandidateBook, isBook, isFiction, books, snapshot, stats,
        listValues, displayDate, isValidDate, parseHistory, renderEntry, summary, patchSummary, patchProperties, updateFrontmatter, appendReading, editReading,
        updateHomeStats, writeIfChanged, appendJournal, HISTORY_START, HISTORY_END, COMMENT_MARK };
};
