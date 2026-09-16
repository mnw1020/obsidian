module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const REPORT_PATH = "Книги/_system/Проверка библиотеки.md";
    const FICTION_PREFIX = "Книги/Художественные/";
    const NONFICTION_PREFIX = "Книги/Non-fiction/";
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const ENTRY_START_PREFIX = "<!-- BOOK-READING:START ";
    const ENTRY_END = "<!-- BOOK-READING:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isCandidateBook(file) {
        if (!file || file.extension !== "md") return false;
        if (file.basename === "_index") return false;
        return file.path.startsWith(FICTION_PREFIX) || file.path.startsWith(NONFICTION_PREFIX);
    }

    function isFiction(file) {
        return file.path.startsWith(FICTION_PREFIX);
    }

    function asText(value) {
        if (value === null || value === undefined) return "";
        return String(value).trim();
    }

    function stripWiki(value) {
        const text = asText(value);
        const match = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return match ? match[1].trim() : text;
    }

    function listValues(value) {
        if (value === null || value === undefined || value === "") return [];
        return (Array.isArray(value) ? value : [value])
            .map(v => stripWiki(v))
            .map(v => v.trim())
            .filter(Boolean);
    }

    function normalizeEntity(value) {
        return stripWiki(value)
            .toLocaleLowerCase("ru")
            .replace(/ё/g, "е")
            .replace(/[‐‑‒–—―]/g, "-")
            .replace(/[“”„«»'’`]/g, "")
            .replace(/[.,:;!?]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizeTitle(value) {
        return normalizeEntity(value)
            .replace(/^\d+[.)]\s*/, "")
            .trim();
    }

    function levenshtein(a, b) {
        const s = String(a ?? "");
        const t = String(b ?? "");
        if (s === t) return 0;
        if (!s.length) return t.length;
        if (!t.length) return s.length;
        const prev = Array.from({ length: t.length + 1 }, (_, i) => i);
        const curr = new Array(t.length + 1);
        for (let i = 1; i <= s.length; i++) {
            curr[0] = i;
            for (let j = 1; j <= t.length; j++) {
                const cost = s[i - 1] === t[j - 1] ? 0 : 1;
                curr[j] = Math.min(
                    prev[j] + 1,
                    curr[j - 1] + 1,
                    prev[j - 1] + cost
                );
            }
            for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
        }
        return prev[t.length];
    }

    function isValidDate(value) {
        const text = asText(value).replace(/^@date:/, "");
        let m = text.match(/^(\d{4})$/);
        if (m) return Number(m[1]) >= 1;

        m = text.match(/^(\d{4})-(\d{2})$/);
        if (m) {
            const year = Number(m[1]);
            const month = Number(m[2]);
            return year >= 1 && month >= 1 && month <= 12;
        }

        m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

    function countOccurrences(text, needle) {
        if (!needle) return 0;
        let count = 0;
        let pos = 0;
        while ((pos = text.indexOf(needle, pos)) >= 0) {
            count++;
            pos += needle.length;
        }
        return count;
    }

    function parseEntries(text) {
        const start = text.indexOf(HISTORY_START);
        const end = text.indexOf(HISTORY_END, start + HISTORY_START.length);
        if (start < 0 || end < 0) return [];

        const managed = text.slice(start + HISTORY_START.length, end);
        const re = /<!-- BOOK-READING:START number="(\d+)" date="([^"]*)" rating="([^"]*)" -->\s*\n([\s\S]*?)\n<!-- BOOK-READING:END -->/g;
        const entries = [];
        let match;
        while ((match = re.exec(managed)) !== null) {
            const ratingText = match[3];
            const ratingNumber = Number(ratingText);
            entries.push({
                number: Number(match[1]),
                date: asText(match[2]),
                rating: ratingText !== "" && Number.isFinite(ratingNumber) ? ratingNumber : null,
                hasCommentMarker: match[4].includes(COMMENT_MARK)
            });
        }
        return entries;
    }

    function wikiLink(file, label) {
        const target = file.path.replace(/\.md$/i, "");
        const safeLabel = asText(label || file.basename).replace(/\|/g, "¦");
        return `[[${target}|${safeLabel}]]`;
    }

    function valueExists(frontmatter, key) {
        return Object.prototype.hasOwnProperty.call(frontmatter, key);
    }

    function sameNumber(a, b) {
        if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "";
        const na = Number(a);
        const nb = Number(b);
        return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
    }

    const books = app.vault.getMarkdownFiles()
        .filter(isCandidateBook)
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));

    const errors = [];
    const warnings = [];
    const info = [];
    const authorsMap = new Map();
    const seriesMap = new Map();
    const titleAuthorMap = new Map();
    const seriesRecords = new Map();

    let fictionCount = 0;
    let nonfictionCount = 0;
    let readingEntriesCount = 0;
    let rereadBooksCount = 0;

    for (const file of books) {
        const fm = getFrontmatter(file);
        const fiction = isFiction(file);
        if (fiction) fictionCount++;
        else nonfictionCount++;

        const title = asText(fm.title);
        const authors = listValues(fm.authors);
        const series = asText(fm.series);
        const seriesIndexRaw = fm.series_index;
        const bookLabel = title || file.basename;
        const link = wikiLink(file, bookLabel);

        if (!title) errors.push(`${link} - отсутствует свойство \`title\`.`);
        if (!authors.length) errors.push(`${link} - отсутствует автор в \`authors\`.`);

        if (valueExists(fm, "authors")) {
            const rawAuthors = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
            for (const raw of rawAuthors) {
                if (/^\[\[/.test(asText(raw))) {
                    warnings.push(`${link} - в \`authors\` осталась wikilink-ссылка \`${asText(raw)}\`; ожидается обычный текст.`);
                }
            }
        }
        if (series && /^\[\[/.test(series)) {
            warnings.push(`${link} - в \`series\` осталась wikilink-ссылка; ожидается обычный текст.`);
        }

        for (const author of authors) {
            const norm = normalizeEntity(author);
            if (!authorsMap.has(norm)) authorsMap.set(norm, new Map());
            const variants = authorsMap.get(norm);
            variants.set(author, (variants.get(author) || 0) + 1);
        }

        if (series) {
            const norm = normalizeEntity(series);
            if (!seriesMap.has(norm)) seriesMap.set(norm, new Map());
            const variants = seriesMap.get(norm);
            variants.set(series, (variants.get(series) || 0) + 1);
        }

        if (title && authors.length) {
            const key = `${normalizeTitle(title)}|||${authors.map(normalizeEntity).sort().join("|")}`;
            if (!titleAuthorMap.has(key)) titleAuthorMap.set(key, []);
            titleAuthorMap.get(key).push(file);
        }

        const hasSeriesIndex = valueExists(fm, "series_index") && asText(seriesIndexRaw) !== "";
        if (series && !hasSeriesIndex) {
            errors.push(`${link} - указана серия **${series}**, но нет \`series_index\`.`);
        }
        if (!series && hasSeriesIndex) {
            errors.push(`${link} - есть \`series_index: ${asText(seriesIndexRaw)}\`, но нет \`series\`.`);
        }

        if (series && hasSeriesIndex) {
            const idx = Number(seriesIndexRaw);
            if (!Number.isFinite(idx) || idx <= 0 || !Number.isInteger(idx)) {
                errors.push(`${link} - некорректный \`series_index: ${asText(seriesIndexRaw)}\` для серии **${series}**.`);
            } else {
                const seriesKey = normalizeEntity(series);
                if (!seriesRecords.has(seriesKey)) seriesRecords.set(seriesKey, { name: series, items: [] });
                seriesRecords.get(seriesKey).items.push({ file, title: bookLabel, index: idx });
            }
        }

        if (!series && valueExists(fm, "series")) {
            warnings.push(`${link} - пустое свойство \`series\` лучше удалить.`);
        }
        if (!hasSeriesIndex && valueExists(fm, "series_index")) {
            warnings.push(`${link} - пустое свойство \`series_index\` лучше удалить.`);
        }

        const dateText = asText(fm.date);
        if (!dateText) errors.push(`${link} - отсутствует актуальная дата чтения \`date\`.`);
        else if (!isValidDate(dateText)) errors.push(`${link} - некорректная дата \`date: ${dateText}\`.`);

        const readCount = Number(fm.read_count);
        if (!Number.isInteger(readCount) || readCount < 0) {
            errors.push(`${link} - некорректный \`read_count: ${asText(fm.read_count)}\`.`);
        }
        if (Number.isInteger(readCount) && readCount > 1) rereadBooksCount++;

        if (fiction) {
            if (valueExists(fm, "rating") && asText(fm.rating) !== "") {
                const rating = Number(fm.rating);
                if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
                    errors.push(`${link} - оценка \`rating: ${asText(fm.rating)}\` должна быть от 1 до 10.`);
                }
            }
        } else if (valueExists(fm, "rating")) {
            warnings.push(`${link} - у Non-fiction присутствует свойство \`rating\`, хотя оно здесь не используется.`);
        }

        let text = "";
        try {
            text = await app.vault.read(file);
        } catch (e) {
            errors.push(`${link} - не удалось прочитать файл: ${e.message || e}.`);
            continue;
        }

        const historyStartCount = countOccurrences(text, HISTORY_START);
        const historyEndCount = countOccurrences(text, HISTORY_END);
        if (historyStartCount !== 1 || historyEndCount !== 1) {
            errors.push(`${link} - блок истории чтений поврежден: BOOK-READINGS:START=${historyStartCount}, END=${historyEndCount}.`);
            continue;
        }

        const containerStart = text.indexOf(HISTORY_START);
        const containerEnd = text.indexOf(HISTORY_END, containerStart + HISTORY_START.length);
        if (containerEnd < containerStart) {
            errors.push(`${link} - закрывающий маркер истории стоит раньше открывающего.`);
            continue;
        }

        const managed = text.slice(containerStart + HISTORY_START.length, containerEnd);
        const rawEntryStarts = countOccurrences(managed, ENTRY_START_PREFIX);
        const rawEntryEnds = countOccurrences(managed, ENTRY_END);
        const entries = parseEntries(text);
        readingEntriesCount += entries.length;

        if (rawEntryStarts !== rawEntryEnds || rawEntryStarts !== entries.length) {
            errors.push(`${link} - повреждены маркеры отдельных чтений: START=${rawEntryStarts}, END=${rawEntryEnds}, распознано=${entries.length}.`);
        }
        if (!entries.length) {
            errors.push(`${link} - история чтений пуста.`);
            continue;
        }

        const numbers = entries.map(e => e.number);
        const uniqueNumbers = new Set(numbers);
        if (uniqueNumbers.size !== numbers.length) {
            errors.push(`${link} - в истории повторяются номера чтений: ${numbers.join(", ")}.`);
        }
        const sortedNumbers = [...uniqueNumbers].sort((a, b) => a - b);
        const expectedNumbers = Array.from({ length: sortedNumbers.length }, (_, i) => i + 1);
        if (sortedNumbers.join(",") !== expectedNumbers.join(",")) {
            warnings.push(`${link} - нумерация чтений имеет пропуски: ${sortedNumbers.join(", ")}; ожидается ${expectedNumbers.join(", ")}.`);
        }

        for (const entry of entries) {
            if (!isValidDate(entry.date)) {
                errors.push(`${link} - Чтение #${entry.number}: некорректная дата \`${entry.date || "пусто"}\`.`);
            }
            if (!entry.hasCommentMarker) {
                errors.push(`${link} - Чтение #${entry.number}: отсутствует служебный маркер комментария.`);
            }
            if (entry.rating !== null && (!Number.isFinite(entry.rating) || entry.rating < 1 || entry.rating > 10)) {
                errors.push(`${link} - Чтение #${entry.number}: оценка ${entry.rating} вне диапазона 1-10.`);
            }
            if (!fiction && entry.rating !== null) {
                warnings.push(`${link} - Чтение #${entry.number}: у Non-fiction записана оценка ${entry.rating}, хотя рейтинги для Non-fiction отключены.`);
            }
        }

        const chronological = [...entries].sort((a, b) => {
            const byDate = a.date.localeCompare(b.date);
            return byDate !== 0 ? byDate : a.number - b.number;
        });
        const latest = chronological[chronological.length - 1];
        const latestRated = [...chronological].reverse().find(e => e.rating !== null) || null;

        if (Number.isInteger(readCount) && readCount !== entries.length) {
            errors.push(`${link} - \`read_count: ${readCount}\`, но в истории найдено ${entries.length} чтений.`);
        }
        if (latest?.date && dateText !== latest.date) {
            errors.push(`${link} - \`date: ${dateText || "пусто"}\`, а последнее чтение имеет дату \`${latest.date}\`.`);
        }
        if (fiction) {
            const fmRating = valueExists(fm, "rating") && asText(fm.rating) !== "" ? Number(fm.rating) : null;
            const expectedRating = latestRated ? latestRated.rating : null;
            if (!sameNumber(fmRating, expectedRating)) {
                errors.push(`${link} - актуальный \`rating\` (${fmRating ?? "пусто"}) не совпадает с последней оцененной записью чтения (${expectedRating ?? "пусто"}).`);
            }
        }
    }

    // Точные варианты одного и того же имени после нормализации.
    for (const variants of authorsMap.values()) {
        if (variants.size > 1) {
            warnings.push(`Варианты написания одного автора: ${[...variants.entries()].map(([name, count]) => `**${name}** (${count})`).join(", ")}.`);
        }
    }
    for (const variants of seriesMap.values()) {
        if (variants.size > 1) {
            warnings.push(`Варианты написания одной серии: ${[...variants.entries()].map(([name, count]) => `**${name}** (${count})`).join(", ")}.`);
        }
    }

    // Похожие, но не идентичные написания - только предупреждение, без автоисправления.
    const authorCanonical = [...authorsMap.entries()].map(([norm, variants]) => ({
        norm,
        name: [...variants.keys()][0]
    }));
    const fuzzyAuthorPairs = new Set();
    for (let i = 0; i < authorCanonical.length; i++) {
        for (let j = i + 1; j < authorCanonical.length; j++) {
            const a = authorCanonical[i];
            const b = authorCanonical[j];
            if (Math.abs(a.norm.length - b.norm.length) > 2) continue;
            if (Math.min(a.norm.length, b.norm.length) < 7) continue;
            const distance = levenshtein(a.norm, b.norm);
            if (distance > 0 && distance <= 2) {
                const key = [a.name, b.name].sort().join("|||");
                if (!fuzzyAuthorPairs.has(key)) {
                    fuzzyAuthorPairs.add(key);
                    warnings.push(`Похожие имена авторов, проверь вручную: **${a.name}** ↔ **${b.name}** (расстояние ${distance}).`);
                }
            }
        }
    }

    const seriesCanonical = [...seriesMap.entries()].map(([norm, variants]) => ({
        norm,
        name: [...variants.keys()][0]
    }));
    const fuzzySeriesPairs = new Set();
    for (let i = 0; i < seriesCanonical.length; i++) {
        for (let j = i + 1; j < seriesCanonical.length; j++) {
            const a = seriesCanonical[i];
            const b = seriesCanonical[j];
            if (Math.abs(a.norm.length - b.norm.length) > 2) continue;
            if (Math.min(a.norm.length, b.norm.length) < 6) continue;
            const distance = levenshtein(a.norm, b.norm);
            if (distance > 0 && distance <= 2) {
                const key = [a.name, b.name].sort().join("|||");
                if (!fuzzySeriesPairs.has(key)) {
                    fuzzySeriesPairs.add(key);
                    warnings.push(`Похожие названия серий, проверь вручную: **${a.name}** ↔ **${b.name}** (расстояние ${distance}).`);
                }
            }
        }
    }

    // Дубли книг по нормализованному title + набору авторов.
    for (const files of titleAuthorMap.values()) {
        if (files.length > 1) {
            warnings.push(`Возможный дубль книги: ${files.map(file => wikiLink(file, asText(getFrontmatter(file).title) || file.basename)).join("; ")}.`);
        }
    }

    // Серии: дубли индексов и пробелы.
    for (const { name, items } of [...seriesRecords.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"))) {
        const byIndex = new Map();
        for (const item of items) {
            if (!byIndex.has(item.index)) byIndex.set(item.index, []);
            byIndex.get(item.index).push(item);
        }
        for (const [index, sameIndexItems] of byIndex.entries()) {
            if (sameIndexItems.length > 1) {
                errors.push(`Серия **${name}**: номер ${index} занят несколькими книгами - ${sameIndexItems.map(item => wikiLink(item.file, item.title)).join("; ")}.`);
            }
        }

        const indexes = [...byIndex.keys()].sort((a, b) => a - b);
        if (indexes.length) {
            const min = indexes[0];
            const max = indexes[indexes.length - 1];
            const missing = [];
            for (let n = 1; n <= max; n++) {
                if (!byIndex.has(n)) missing.push(n);
            }
            if (missing.length) {
                warnings.push(`Серия **${name}**: есть номера ${indexes.join(", ")}, отсутствуют ${missing.join(", ")}.`);
            }
            if (min !== 1) {
                warnings.push(`Серия **${name}** начинается с номера ${min}, а не с 1.`);
            }
        }
    }

    info.push(`Книг проверено: **${books.length}**.`);
    info.push(`Художественных: **${fictionCount}**, Non-fiction: **${nonfictionCount}**.`);
    info.push(`Уникальных авторов: **${authorsMap.size}**.`);
    info.push(`Серий: **${seriesRecords.size}**.`);
    info.push(`Записей чтений: **${readingEntriesCount}**; перечитанных книг: **${rereadBooksCount}**.`);

    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    function renderSection(title, items, emptyText) {
        let out = `## ${title}\n\n`;
        if (!items.length) return out + `${emptyText}\n\n`;
        return out + items.map(item => `- ${item}`).join("\n") + "\n\n";
    }

    let report = `# Проверка библиотеки\n\n`;
    report += `> Последняя проверка: **${timestamp}**  \n`;
    report += `> Скрипт только анализирует библиотеку и **ничего не исправляет автоматически**.\n\n`;
    report += "```button\n";
    report += "name 🔎 Проверить еще раз\n";
    report += "type command\n";
    report += "action QuickAdd: Книги - Проверить библиотеку\n";
    report += "```\n\n";
    report += `## Итог\n\n`;
    report += `- Ошибок: **${errors.length}**.\n`;
    report += `- Предупреждений: **${warnings.length}**.\n`;
    report += info.map(item => `- ${item}`).join("\n") + "\n\n";
    report += renderSection("❌ Ошибки", errors, "Ошибок не найдено.");
    report += renderSection("⚠️ Предупреждения", warnings, "Предупреждений нет.");
    report += "## Что проверяется\n\n";
    report += "- обязательные `title` и `authors`;\n";
    report += "- остаточные wikilinks в авторах/сериях;\n";
    report += "- даты, `read_count`, рейтинг fiction и отсутствие рейтинга у Non-fiction;\n";
    report += "- целостность блока `BOOK-READINGS` и каждой записи чтения;\n";
    report += "- совпадение агрегатов YAML с историей чтений;\n";
    report += "- дубли книг по названию + автору;\n";
    report += "- варианты и похожие написания авторов/серий;\n";
    report += "- `series` / `series_index`, повторяющиеся номера и пробелы в сериях.\n";

    const reportPath = normalizePath(REPORT_PATH);
    let reportFile = app.vault.getAbstractFileByPath(reportPath);
    if (reportFile) {
        await app.vault.modify(reportFile, report);
    } else {
        reportFile = await app.vault.create(reportPath, report);
    }

    new Notice(`Проверка завершена: ошибок ${errors.length}, предупреждений ${warnings.length}`);
    await app.workspace.getLeaf(false).openFile(reportFile);
};
