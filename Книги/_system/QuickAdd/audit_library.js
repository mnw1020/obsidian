module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const REPORT_PATH = "Книги/_system/Проверка библиотеки.md";
    const CHANGELOG_PATH = "Книги/_system/Журнал изменений.md";
    const FICTION_PREFIX = "Книги/Художественные/";
    const NONFICTION_PREFIX = "Книги/Non-fiction/";
    const MEDIA_ROOT = "Кино/";
    const MEDIA_EXCLUDED = ["Кино/Просмотры/", "Кино/Сезоны/", "Кино/_system/"];
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const ENTRY_START_PREFIX = "<!-- BOOK-READING:START ";
    const ENTRY_END = "<!-- BOOK-READING:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";
    const RELATION_RULES = [
        { name: "книга ↔ кино", leftType: "book", leftProp: "adaptations", rightType: "media", rightProp: "Первоисточники", section: "cinema" },
        { name: "related", leftType: "book", leftProp: "related", rightType: "book", rightProp: "related", section: "general" },
        { name: "продолжение", leftType: "book", leftProp: "continued_by", rightType: "book", rightProp: "continues", section: "general" },
        { name: "adapted_from → adaptations", leftType: "media", leftProp: "adapted_from", rightType: "book", rightProp: "adaptations", section: "general", sourceOnly: true }
    ];

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

    function rawListValues(value) {
        if (value === null || value === undefined || value === "") return [];
        return (Array.isArray(value) ? value : [value])
            .map(v => String(v ?? "").trim())
            .filter(Boolean);
    }

    function tags(frontmatter) {
        return rawListValues(frontmatter?.tags)
            .map(tag => tag.replace(/^#/, ""));
    }

    function isMedia(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_ROOT)) return false;
        if (MEDIA_EXCLUDED.some(prefix => file.path.startsWith(prefix))) return false;
        const fileTags = tags(getFrontmatter(file));
        return fileTags.includes("movies") || fileTags.includes("serial");
    }

    function noteTargetPath(file) {
        return file.path.replace(/\.md$/i, "");
    }

    function linkTarget(value) {
        const text = String(value ?? "").trim();
        const match = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return (match ? match[1] : text).replace(/\.md$/i, "").trim();
    }

    function resolveNoteLink(value, sourcePath) {
        const target = linkTarget(value);
        if (!target) return null;

        try {
            const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
            if (resolved) return resolved;
        } catch (_) {
            // Fallback ниже.
        }

        const exactCandidates = [target, `${target}.md`];
        for (const candidate of exactCandidates) {
            const exact = app.vault.getAbstractFileByPath(normalizePath(candidate));
            if (exact?.extension === "md") return exact;
        }
        return null;
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

    function duplicateTitleKey(value) {
        return normalizeTitle(value)
            .replace(/[^0-9a-zа-я]+/gi, "")
            .trim();
    }

    function titleNumbers(value) {
        return normalizeTitle(value).match(/\d+/g) ?? [];
    }

    function obviousNumberedPair(a, b) {
        const na = titleNumbers(a);
        const nb = titleNumbers(b);
        if (!na.length || !nb.length || na.join(",") === nb.join(",")) return false;
        const strip = value => normalizeTitle(value).replace(/\d+/g, "#").replace(/[^a-zа-я#]+/gi, "");
        return strip(a) === strip(b);
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

    const IMAGE_EXTENSIONS = new Set([
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
        "avif", "heic", "heif", "tif", "tiff"
    ]);
    const ATTACHMENT_EXTENSIONS = new Set([
        ...IMAGE_EXTENSIONS,
        "pdf", "epub", "djvu", "doc", "docx", "xls", "xlsx",
        "ppt", "pptx", "rtf", "txt", "csv", "zip", "7z", "rar",
        "mp3", "m4a", "wav", "ogg", "flac", "mp4", "mov", "mkv", "webm"
    ]);

    function cleanLocalTarget(value) {
        let text = asText(value);
        if (!text) return "";
        if (/^(?:https?:|data:|mailto:|obsidian:|file:)/i.test(text)) return "";
        text = text.replace(/^<|>$/g, "");
        text = text.split("#", 1)[0].split("?", 1)[0].trim();
        try {
            text = decodeURIComponent(text);
        } catch (_) {
            // Оставляем исходный текст, если URI поврежден.
        }
        return text.trim();
    }

    function extensionOfLink(value) {
        const target = cleanLocalTarget(value);
        if (!target) return "";
        const name = target.split("/").pop() || "";
        const dot = name.lastIndexOf(".");
        return dot >= 0 ? name.slice(dot + 1).toLocaleLowerCase("en") : "";
    }

    function resolveLocalLink(link, sourcePath) {
        const raw = asText(link);
        const clean = cleanLocalTarget(raw);
        if (!clean) return null;

        const candidates = [...new Set([raw, clean].filter(Boolean))];
        for (const candidate of candidates) {
            try {
                const resolved = app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
                if (resolved) return resolved;
            } catch (_) {
                // Переходим к следующему варианту.
            }
        }

        // Fallback для явного vault-relative пути вроде Книги/Non-fiction/_attach/x.png.
        if (clean.startsWith("Книги/")) {
            const exact = app.vault.getAbstractFileByPath(normalizePath(clean));
            if (exact) return exact;
        }
        return null;
    }

    function markdownReferences(file) {
        const cache = app.metadataCache.getFileCache(file);
        const refs = [];
        for (const item of [...(cache?.embeds ?? []), ...(cache?.links ?? [])]) {
            const link = asText(item?.link);
            if (!link) continue;
            refs.push({
                link,
                line: Number(item?.position?.start?.line ?? 0) + 1
            });
        }
        return refs;
    }

    const books = app.vault.getMarkdownFiles()
        .filter(isCandidateBook)
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));

    // Нормализация авторов встроена в эту же проверку.
    // Ничего не меняется без явного выбора пользователя.
    function authorTokenSignature(value) {
        return normalizeEntity(value)
            .split(" ")
            .map(part => part.trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "ru"))
            .join(" ");
    }

    function collectAuthorVariantStats() {
        const stats = new Map();
        for (const file of books) {
            const authors = listValues(getFrontmatter(file).authors);
            for (const author of authors) {
                if (!stats.has(author)) {
                    stats.set(author, { name: author, count: 0, files: new Set() });
                }
                const item = stats.get(author);
                item.count++;
                item.files.add(file.path);
            }
        }
        return stats;
    }

    function buildAuthorNormalizationGroups(stats) {
        const names = [...stats.keys()];
        const edges = new Map(names.map(name => [name, new Set()]));

        function connect(a, b) {
            edges.get(a).add(b);
            edges.get(b).add(a);
        }

        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const a = names[i];
                const b = names[j];
                const normA = normalizeEntity(a);
                const normB = normalizeEntity(b);
                const tokensA = authorTokenSignature(a);
                const tokensB = authorTokenSignature(b);

                // Самые надежные случаи: пунктуация/регистр и перестановка слов.
                if (normA === normB || (tokensA && tokensA === tokensB)) {
                    connect(a, b);
                    continue;
                }

                // Небольшая опечатка: только как предложение, никогда не автообъединение.
                if (Math.abs(normA.length - normB.length) > 2) continue;
                if (Math.min(normA.length, normB.length) < 7) continue;
                const distance = levenshtein(normA, normB);
                if (distance > 0 && distance <= 2) connect(a, b);
            }
        }

        const visited = new Set();
        const groups = [];
        for (const name of names) {
            if (visited.has(name) || !edges.get(name).size) continue;
            const stack = [name];
            const members = [];
            visited.add(name);
            while (stack.length) {
                const current = stack.pop();
                members.push(current);
                for (const next of edges.get(current)) {
                    if (visited.has(next)) continue;
                    visited.add(next);
                    stack.push(next);
                }
            }
            if (members.length > 1) {
                members.sort((a, b) => {
                    const countDiff = stats.get(b).count - stats.get(a).count;
                    return countDiff !== 0 ? countDiff : a.localeCompare(b, "ru");
                });
                groups.push(members);
            }
        }
        return groups;
    }

    async function applyAuthorMerge(members, canonical) {
        const memberSet = new Set(members);
        let changedFiles = 0;
        let replacements = 0;
        const variantChanges = new Map();

        for (const file of books) {
            const rawAuthors = getFrontmatter(file).authors;
            if (rawAuthors === null || rawAuthors === undefined || rawAuthors === "") continue;
            const source = Array.isArray(rawAuthors) ? rawAuthors : [rawAuthors];
            let touched = false;

            const updated = source.map(raw => {
                const plain = stripWiki(raw);
                if (!memberSet.has(plain)) return raw;
                if (plain !== canonical || asText(raw) !== canonical) {
                    replacements++;
                    if (plain !== canonical) {
                        variantChanges.set(plain, (variantChanges.get(plain) || 0) + 1);
                    }
                }
                touched = true;
                return canonical;
            });

            if (!touched) continue;

            // После объединения в одной карточке не должны остаться дубли автора.
            const deduped = [];
            const seen = new Set();
            for (const value of updated) {
                const key = normalizeEntity(stripWiki(value));
                if (seen.has(key)) continue;
                seen.add(key);
                deduped.push(value);
            }

            await app.fileManager.processFrontMatter(file, frontmatter => {
                frontmatter.authors = deduped;
            });
            changedFiles++;
        }

        return { changedFiles, replacements, variantChanges };
    }

    const normalizationLog = [];
    const seriesNormalizationLog = [];
    const journalEntries = [];
    const authorVariantStatsBefore = collectAuthorVariantStats();
    const authorNormalizationGroups = buildAuthorNormalizationGroups(authorVariantStatsBefore);

    if (authorNormalizationGroups.length && quickAddApi) {
        const mode = await quickAddApi.suggester(
            [
                `🔧 Проверить варианты авторов (${authorNormalizationGroups.length})`,
                "⏭ Только проверить библиотеку"
            ],
            ["normalize", "skip"],
            "Найдены похожие написания авторов"
        );

        if (mode === "normalize") {
            for (let i = 0; i < authorNormalizationGroups.length; i++) {
                const members = authorNormalizationGroups[i];
                const labels = members.map(name => {
                    const stat = authorVariantStatsBefore.get(name);
                    return `${name}  ·  ${stat.count} книг`;
                });
                labels.push("⏭ Не объединять эту группу");

                const values = [...members, "__SKIP__"];
                const canonical = await quickAddApi.suggester(
                    labels,
                    values,
                    `Авторы ${i + 1}/${authorNormalizationGroups.length}: выбери правильное написание`
                );

                if (!canonical || canonical === "__SKIP__") continue;

                const result = await applyAuthorMerge(members, canonical);
                normalizationLog.push(
                    `**${members.join(" / ")}** → **${canonical}**; изменено файлов: ${result.changedFiles}.`
                );
                for (const [from, count] of result.variantChanges.entries()) {
                    journalEntries.push({ type: "Автор", from, to: canonical, count });
                }
            }

            if (normalizationLog.length) {
                // Даем metadata cache перечитать измененный YAML до основной проверки.
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }
    }

    function collectSeriesVariantStats() {
        const stats = new Map();
        for (const file of books) {
            const series = asText(getFrontmatter(file).series);
            if (!series) continue;
            if (!stats.has(series)) stats.set(series, { name: series, count: 0, files: new Set() });
            const item = stats.get(series);
            item.count++;
            item.files.add(file.path);
        }
        return stats;
    }

    function buildSeriesNormalizationGroups(stats) {
        const names = [...stats.keys()];
        const edges = new Map(names.map(name => [name, new Set()]));

        function connect(a, b) {
            edges.get(a).add(b);
            edges.get(b).add(a);
        }

        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const a = names[i];
                const b = names[j];
                const normA = normalizeEntity(a);
                const normB = normalizeEntity(b);

                if (normA === normB) {
                    connect(a, b);
                    continue;
                }

                if (Math.abs(normA.length - normB.length) > 2) continue;
                if (Math.min(normA.length, normB.length) < 6) continue;
                const distance = levenshtein(normA, normB);
                if (distance > 0 && distance <= 2) connect(a, b);
            }
        }

        const visited = new Set();
        const groups = [];
        for (const name of names) {
            if (visited.has(name) || !edges.get(name).size) continue;
            const stack = [name];
            const members = [];
            visited.add(name);
            while (stack.length) {
                const current = stack.pop();
                members.push(current);
                for (const next of edges.get(current)) {
                    if (visited.has(next)) continue;
                    visited.add(next);
                    stack.push(next);
                }
            }
            if (members.length > 1) {
                members.sort((a, b) => {
                    const countDiff = stats.get(b).count - stats.get(a).count;
                    return countDiff !== 0 ? countDiff : a.localeCompare(b, "ru");
                });
                groups.push(members);
            }
        }
        return groups;
    }

    async function applySeriesMerge(members, canonical) {
        const memberSet = new Set(members);
        let changedFiles = 0;
        const variantChanges = new Map();

        for (const file of books) {
            const current = asText(getFrontmatter(file).series);
            if (!memberSet.has(current) || current === canonical) continue;
            await app.fileManager.processFrontMatter(file, frontmatter => {
                frontmatter.series = canonical;
            });
            changedFiles++;
            variantChanges.set(current, (variantChanges.get(current) || 0) + 1);
        }
        return { changedFiles, variantChanges };
    }

    const seriesVariantStatsBefore = collectSeriesVariantStats();
    const seriesNormalizationGroups = buildSeriesNormalizationGroups(seriesVariantStatsBefore);

    if (seriesNormalizationGroups.length && quickAddApi) {
        const mode = await quickAddApi.suggester(
            [
                `🔧 Проверить варианты серий (${seriesNormalizationGroups.length})`,
                "⏭ Продолжить без нормализации серий"
            ],
            ["normalize", "skip"],
            "Найдены похожие названия серий"
        );

        if (mode === "normalize") {
            for (let i = 0; i < seriesNormalizationGroups.length; i++) {
                const members = seriesNormalizationGroups[i];
                const labels = members.map(name => {
                    const stat = seriesVariantStatsBefore.get(name);
                    return `${name}  ·  ${stat.count} книг`;
                });
                labels.push("⏭ Не объединять эту группу");

                const canonical = await quickAddApi.suggester(
                    labels,
                    [...members, "__SKIP__"],
                    `Серии ${i + 1}/${seriesNormalizationGroups.length}: выбери правильное название`
                );

                if (!canonical || canonical === "__SKIP__") continue;
                const result = await applySeriesMerge(members, canonical);
                seriesNormalizationLog.push(
                    `**${members.join(" / ")}** → **${canonical}**; изменено файлов: ${result.changedFiles}.`
                );
                for (const [from, count] of result.variantChanges.entries()) {
                    journalEntries.push({ type: "Серия", from, to: canonical, count });
                }
            }

            if (seriesNormalizationLog.length) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }
    }

    async function appendNormalizationJournal(entries) {
        if (!entries.length) return;
        const now = new Date();
        const pad = n => String(n).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let block = `<!-- BOOK-LIBRARY-EVENT at="${iso}" normalization="true" structure="true" -->\n`;
        block += `## ${stamp}\n\n`;
        for (const entry of entries) {
            block += `- ${entry.type}: **${entry.from}** → **${entry.to}**, изменено книг: **${entry.count}**.\n`;
        }
        block += "\n";

        const path = normalizePath(CHANGELOG_PATH);
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            const header = "# Журнал изменений\n\n[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n> Автоматическая история обслуживания книжной базы.\n\n";
            file = await app.vault.create(path, header + block);
            return;
        }
        const current = await app.vault.read(file);
        await app.vault.modify(file, current.replace(/\s*$/, "\n\n") + block);
    }

    try {
        await appendNormalizationJournal(journalEntries);
    } catch (error) {
        new Notice(`Нормализация выполнена, но журнал не обновлен: ${error?.message || error}`, 7000);
    }

    async function journalState() {
        const path = normalizePath(CHANGELOG_PATH);
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) return { lastNormalization: "—", lastStructure: "—" };
        const text = await app.vault.read(file);
        const re = /<!-- BOOK-LIBRARY-EVENT at="([^"]+)" normalization="(true|false)" structure="(true|false)" -->/g;
        let match;
        let lastNormalization = "";
        let lastStructure = "";
        while ((match = re.exec(text)) !== null) {
            if (match[2] === "true") lastNormalization = match[1];
            if (match[3] === "true") lastStructure = match[1];
        }
        const display = value => value ? value.replace("T", " ") : "—";
        return {
            lastNormalization: display(lastNormalization),
            lastStructure: display(lastStructure)
        };
    }

    const errors = [];
    const warnings = [];
    const cinemaErrors = [];
    const mutualErrors = [];
    const adaptationSuggestions = [];
    const duplicateSuggestions = [];
    const info = [];
    const authorsMap = new Map();
    const seriesMap = new Map();
    const titleAuthorMap = new Map();
    const seriesRecords = new Map();

    let fictionCount = 0;
    let nonfictionCount = 0;
    let readingEntriesCount = 0;
    let rereadBooksCount = 0;
    let ratedBooksCount = 0;
    let missingAttachmentCount = 0;
    let orphanImageCount = 0;
    let cinemaRelationCount = 0;
    let completeCinemaRelationCount = 0;
    let mutualRelationCount = 0;
    let completeMutualRelationCount = 0;

    for (const file of books) {
        const fm = getFrontmatter(file);
        const fiction = isFiction(file);
        if (fiction) fictionCount++;
        else nonfictionCount++;
        const numericRating = Number(fm.rating);
        if (fiction && Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 10) ratedBooksCount++;

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
            const key = `${duplicateTitleKey(title)}|||${authors.map(normalizeEntity).sort().join("|")}`;
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

    // Взаимные связи по явным правилам. Не угадываем семантику произвольных YAML-полей:
    // новые пары добавляются в RELATION_RULES одной строкой.
    const mediaFiles = app.vault.getMarkdownFiles()
        .filter(isMedia)
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));
    const filesByType = { book: books, media: mediaFiles };

    function matchesType(file, type) {
        if (type === "book") return isCandidateBook(file);
        if (type === "media") return isMedia(file);
        return false;
    }

    function relationKey(leftFile, rightFile, rule) {
        const a = noteTargetPath(leftFile);
        const b = noteTargetPath(rightFile);
        if (rule.leftType === rule.rightType && rule.leftProp === rule.rightProp) {
            return [a, b].sort().join("|||") + `|||${rule.leftProp}`;
        }
        return `${a}|||${rule.leftProp}|||${b}|||${rule.rightProp}`;
    }

    function canonicalRelationTarget(value, sourceFile) {
        const resolved = resolveNoteLink(value, sourceFile.path);
        return {
            raw: String(value ?? "").trim(),
            target: linkTarget(value),
            resolved,
            key: resolved ? noteTargetPath(resolved) : linkTarget(value)
        };
    }

    function reverseContains(sourceFile, propertyName, expectedFile) {
        const expectedPath = noteTargetPath(expectedFile);
        return rawListValues(getFrontmatter(sourceFile)[propertyName]).some(value => {
            const relation = canonicalRelationTarget(value, sourceFile);
            return relation.resolved
                ? noteTargetPath(relation.resolved) === expectedPath
                : relation.target === expectedPath;
        });
    }

    function relationFileLabel(file, type) {
        if (type === "book") return wikiLink(file, asText(getFrontmatter(file).title) || file.basename);
        return wikiLink(file, file.basename);
    }

    for (const rule of RELATION_RULES) {
        const validPairs = new Set();
        const completePairs = new Set();
        const output = rule.section === "cinema" ? cinemaErrors : mutualErrors;

        async function scanSide(files, prop, sourceType, targetType, reverseProp, isLeftSide) {
            for (const sourceFile of files) {
                const values = rawListValues(getFrontmatter(sourceFile)[prop]);
                if (!values.length) continue;
                const seen = new Set();
                for (const value of values) {
                    const relation = canonicalRelationTarget(value, sourceFile);
                    const sourceLink = relationFileLabel(sourceFile, sourceType);
                    const duplicateKey = relation.key || relation.raw;
                    if (seen.has(duplicateKey)) {
                        output.push(`${sourceLink} - в \`${prop}\` повторяется ссылка \`${relation.raw}\`.`);
                        continue;
                    }
                    seen.add(duplicateKey);

                    if (!relation.resolved) {
                        output.push(`${sourceLink} - \`${prop}\` ведет на отсутствующий файл \`${relation.target || relation.raw}\`.`);
                        continue;
                    }
                    if (!matchesType(relation.resolved, targetType)) {
                        output.push(`${sourceLink} - \`${prop}\` ведет на объект неверного типа: ${wikiLink(relation.resolved, relation.resolved.basename)}.`);
                        continue;
                    }

                    const leftFile = isLeftSide ? sourceFile : relation.resolved;
                    const rightFile = isLeftSide ? relation.resolved : sourceFile;
                    const pair = relationKey(leftFile, rightFile, rule);
                    validPairs.add(pair);
                    if (!reverseContains(relation.resolved, reverseProp, sourceFile)) {
                        output.push(`${sourceLink} → ${relationFileLabel(relation.resolved, targetType)} - нет обратной ссылки в \`${reverseProp}\` (${rule.name}).`);
                    } else {
                        completePairs.add(pair);
                    }
                }
            }
        }

        await scanSide(filesByType[rule.leftType], rule.leftProp, rule.leftType, rule.rightType, rule.rightProp, true);
        if (!rule.sourceOnly && !(rule.leftType === rule.rightType && rule.leftProp === rule.rightProp)) {
            await scanSide(filesByType[rule.rightType], rule.rightProp, rule.rightType, rule.leftType, rule.leftProp, false);
        }

        if (rule.section === "cinema") {
            cinemaRelationCount += validPairs.size;
            completeCinemaRelationCount += completePairs.size;
        } else {
            mutualRelationCount += validPairs.size;
            completeMutualRelationCount += completePairs.size;
        }
    }

    // Подсказки по потенциальным экранизациям. Ничего не связывается автоматически.
    function comparableTitle(value) {
        return normalizeTitle(value)
            .replace(/\((?:19|20)\d{2}\)/g, "")
            .replace(/\b(?:19|20)\d{2}\b/g, "")
            .replace(/[^a-zа-я0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function titleSimilarity(a, b) {
        const left = comparableTitle(a);
        const right = comparableTitle(b);
        if (!left || !right) return 0;
        if (left === right) return 100;
        if (Math.min(left.length, right.length) >= 6 && levenshtein(left, right) <= 2) return 90;
        const leftTokens = new Set(left.split(" ").filter(Boolean));
        const rightTokens = new Set(right.split(" ").filter(Boolean));
        const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
        const union = new Set([...leftTokens, ...rightTokens]).size;
        const jaccard = union ? intersection / union : 0;
        return jaccard >= 0.8 && intersection >= 2 ? 80 : 0;
    }

    for (const bookFile of books) {
        if (rawListValues(getFrontmatter(bookFile).adaptations).length) continue;
        const bookTitle = asText(getFrontmatter(bookFile).title) || bookFile.basename;
        const candidates = [];
        for (const mediaFile of mediaFiles) {
            const mediaFm = getFrontmatter(mediaFile);
            const names = [mediaFile.basename, asText(mediaFm["Название"])].filter(Boolean);
            const score = Math.max(...names.map(name => titleSimilarity(bookTitle, name)), 0);
            if (score >= 80) candidates.push({ mediaFile, score });
        }
        candidates.sort((a, b) => b.score - a.score || a.mediaFile.basename.localeCompare(b.mediaFile.basename, "ru"));
        for (const candidate of candidates.slice(0, 3)) {
            adaptationSuggestions.push(`${wikiLink(bookFile, bookTitle)} ↔ ${wikiLink(candidate.mediaFile, candidate.mediaFile.basename)} — возможно, это экранизация.`);
        }
    }

    // Вложения и изображения.
    // Ссылки считаем по всему vault, чтобы картинка из Книги не считалась сиротой,
    // если на нее ссылается заметка за пределами книжного раздела.
    const allMarkdownFiles = app.vault.getMarkdownFiles()
        .filter(file => file.path !== REPORT_PATH);
    const referencedImages = new Set();
    const reportedMissing = new Set();

    for (const sourceFile of allMarkdownFiles) {
        const sourceIsInBooks = sourceFile.path.startsWith("Книги/");
        for (const ref of markdownReferences(sourceFile)) {
            const ext = extensionOfLink(ref.link);
            if (!ATTACHMENT_EXTENSIONS.has(ext)) continue;

            const resolved = resolveLocalLink(ref.link, sourceFile.path);
            if (resolved) {
                const resolvedExt = asText(resolved.extension).toLocaleLowerCase("en");
                if (IMAGE_EXTENSIONS.has(resolvedExt) && resolved.path.startsWith("Книги/")) {
                    referencedImages.add(resolved.path);
                }
                continue;
            }

            // Полный аудит Книги сообщает о битых вложениях только внутри книжного раздела.
            if (!sourceIsInBooks) continue;
            const clean = cleanLocalTarget(ref.link);
            const dedupeKey = `${sourceFile.path}|||${ref.line}|||${clean || ref.link}`;
            if (reportedMissing.has(dedupeKey)) continue;
            reportedMissing.add(dedupeKey);
            missingAttachmentCount++;
            const sourceLink = wikiLink(sourceFile, sourceFile.basename);
            errors.push(`${sourceLink} - строка ${ref.line}: отсутствует локальное вложение \`${clean || ref.link}\`.`);
        }
    }

    const imageFiles = app.vault.getFiles()
        .filter(file => file.path.startsWith("Книги/"))
        .filter(file => IMAGE_EXTENSIONS.has(asText(file.extension).toLocaleLowerCase("en")))
        .sort((a, b) => a.path.localeCompare(b.path, "ru"));

    for (const imageFile of imageFiles) {
        if (referencedImages.has(imageFile.path)) continue;
        orphanImageCount++;
        warnings.push(`Картинка без ссылок: \`${imageFile.path}\`.`);
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

    // Дубли книг: сначала одинаковое название после удаления пунктуации, затем очень близкие названия.
    // Сравниваем только книги с одинаковым набором авторов и не считаем дублями очевидные разные номера/части.
    const duplicatePairKeys = new Set();
    for (const files of titleAuthorMap.values()) {
        if (files.length > 1) {
            duplicateSuggestions.push(`Одинаковое название + автор: ${files.map(file => wikiLink(file, asText(getFrontmatter(file).title) || file.basename)).join("; ")}.`);
            for (let i = 0; i < files.length; i++) {
                for (let j = i + 1; j < files.length; j++) {
                    duplicatePairKeys.add([files[i].path, files[j].path].sort().join("|||"));
                }
            }
        }
    }

    const duplicateCandidates = books.map(file => {
        const fm = getFrontmatter(file);
        const title = asText(fm.title);
        const authors = listValues(fm.authors).map(normalizeEntity).sort();
        return { file, title, key: duplicateTitleKey(title), authorsKey: authors.join("|") };
    }).filter(item => item.title && item.key && item.authorsKey);

    for (let i = 0; i < duplicateCandidates.length; i++) {
        for (let j = i + 1; j < duplicateCandidates.length; j++) {
            const a = duplicateCandidates[i];
            const b = duplicateCandidates[j];
            if (a.authorsKey !== b.authorsKey) continue;
            const pairKey = [a.file.path, b.file.path].sort().join("|||");
            if (duplicatePairKeys.has(pairKey)) continue;
            if (obviousNumberedPair(a.title, b.title)) continue;
            if (Math.abs(a.key.length - b.key.length) > 3) continue;
            if (Math.min(a.key.length, b.key.length) < 6) continue;
            const distance = levenshtein(a.key, b.key);
            const similarity = 1 - distance / Math.max(a.key.length, b.key.length);
            if (distance > 0 && distance <= 2 && similarity >= 0.88) {
                duplicatePairKeys.add(pairKey);
                duplicateSuggestions.push(`Похожие названия у одного автора: ${wikiLink(a.file, a.title)} ↔ ${wikiLink(b.file, b.title)} (проверь вручную).`);
            }
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
    info.push(`Картинок в \`Книги/\`: **${imageFiles.length}**; без ссылок: **${orphanImageCount}**.`);
    info.push(`Ссылок на отсутствующие локальные вложения: **${missingAttachmentCount}**.`);
    info.push(`Карточек кино/сериалов найдено: **${mediaFiles.length}**; связей книга ↔ кино: **${cinemaRelationCount}**; полностью взаимных: **${completeCinemaRelationCount}**.`);
    info.push(`Прочих взаимных связей: **${mutualRelationCount}**; полностью взаимных: **${completeMutualRelationCount}**.`);
    info.push(`Подсказок возможных дублей книг: **${duplicateSuggestions.length}**.`);
    info.push(`Подсказок возможных экранизаций: **${adaptationSuggestions.length}**.`);

    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const state = await journalState();

    function renderSection(title, items, emptyText) {
        let out = `## ${title}\n\n`;
        if (!items.length) return out + `${emptyText}\n\n`;
        return out + items.map(item => `- ${item}`).join("\n") + "\n\n";
    }

    let report = `# Проверка библиотеки\n\n`;
    report += `[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n`;
    report += `> Последняя проверка: **${timestamp}**  \n`;
    report += `> Аудит сам не исправляет ошибки, кроме подтвержденной тобой нормализации авторов/серий. Для однозначных исправлений используй ссылку «Исправить безопасное».\n\n`;
    report += `[🔎 Проверить еще раз](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%9F%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%B8%D1%82%D1%8C%20%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D1%83) · [🛠 Исправить безопасное](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%98%D1%81%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%B1%D0%B5%D0%B7%D0%BE%D0%BF%D0%B0%D1%81%D0%BD%D0%BE%D0%B5)\n\n`;
    report += `## Состояние библиотеки\n\n`;
    report += `**${books.length} книг** · **${authorsMap.size} авторов** · **${seriesRecords.size} серий** · **${imageFiles.length} изображений** · **${fictionCount} fiction** · **${nonfictionCount} non-fiction** · **${rereadBooksCount} перечитано** · **${ratedBooksCount} оценено**\n\n`;
    report += `- Последняя проверка: **${timestamp}**.\n`;
    report += `- Последняя нормализация: **${state.lastNormalization}**.\n`;
    report += `- Последнее изменение структуры: **${state.lastStructure}**.\n`;
    report += `- Текущее состояние: **${errors.length + cinemaErrors.length + mutualErrors.length} ошибок**, **${warnings.length} предупреждений**.\n\n`;
    report += `Журнал нормализаций: [[Книги/_system/Журнал изменений|открыть журнал]].\n\n`;
    report += `## Итог\n\n`;
    const totalErrors = errors.length + cinemaErrors.length + mutualErrors.length;
    report += `- Ошибок: **${totalErrors}**.\n`;
    report += `- Предупреждений: **${warnings.length}**.\n`;
    report += info.map(item => `- ${item}`).join("\n") + "\n\n";
    report += renderSection("🔧 Нормализация авторов", normalizationLog, "Изменений авторов в этом запуске не было.");
    report += renderSection("🔧 Нормализация серий", seriesNormalizationLog, "Изменений серий в этом запуске не было.");
    report += renderSection("🎬 Связи с кино", cinemaErrors, "Ошибок двусторонних связей книга ↔ кино не найдено.");
    report += renderSection("🔗 Прочие взаимные связи", mutualErrors, "Ошибок прочих взаимных связей не найдено.");
    report += renderSection("📚 Возможные дубли книг", duplicateSuggestions, "Похожих дублей книг не найдено.");
    report += renderSection("🎬 Возможные экранизации", adaptationSuggestions, "Подходящих неподтвержденных совпадений названий не найдено.");
    report += renderSection("❌ Ошибки", errors, "Ошибок не найдено.");
    report += renderSection("⚠️ Предупреждения", warnings, "Предупреждений нет.");
    report += "## Что проверяется\n\n";
    report += "- обязательные `title` и `authors`;\n";
    report += "- остаточные wikilinks в авторах/сериях;\n";
    report += "- даты, `read_count`, рейтинг fiction и отсутствие рейтинга у Non-fiction;\n";
    report += "- целостность блока `BOOK-READINGS` и каждой записи чтения;\n";
    report += "- совпадение агрегатов YAML с историей чтений;\n";
    report += "- точные и потенциальные дубли книг: одинаковый автор + название с учетом пунктуации, пробелов, тире и небольших опечаток; очевидные разные номера/части исключаются;\n";
    report += "- варианты и похожие написания авторов с предложением объединить их;\n";
    report += "- варианты и похожие написания серий с предложением объединить их;\n";
    report += "- `series` / `series_index`, повторяющиеся номера и пробелы в сериях;\n";
    report += "- ссылки на отсутствующие локальные вложения в Markdown-файлах внутри `Книги/`;\n";
    report += "- картинки внутри `Книги/`, на которые не ссылается ни один Markdown-файл vault;\n";
    report += "- двусторонность `adaptations` ↔ `Первоисточники`, битые ссылки, дубли и типы целей;\n";
    report += "- взаимность `related` ↔ `related` и `continued_by` ↔ `continues`; новые пары добавляются явно в `RELATION_RULES`;\n";
    report += "- книги без `adaptations`, у которых найден фильм/сериал с очень похожим названием — только как подсказка, без автосвязи.\n";

    // Обновляем компактную статистику на главной теми же проверенными счетчиками.
    const homeFile = app.vault.getAbstractFileByPath(normalizePath("Книги/_index.md"));
    if (homeFile) {
        const homeBlock = `<!-- BOOK-HOME-STATS:START -->\n> [!abstract] Библиотека\n> **${books.length} книг** · **${authorsMap.size} авторов** · **${seriesRecords.size} серий** · **${ratedBooksCount} оценено** · **${rereadBooksCount} перечитано**\n<!-- BOOK-HOME-STATS:END -->`;
        const homeText = await app.vault.read(homeFile);
        if (/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/.test(homeText)) {
            await app.vault.modify(homeFile, homeText.replace(/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/, homeBlock));
        }
    }

    const reportPath = normalizePath(REPORT_PATH);
    let reportFile = app.vault.getAbstractFileByPath(reportPath);
    if (reportFile) {
        await app.vault.modify(reportFile, report);
    } else {
        reportFile = await app.vault.create(reportPath, report);
    }

    new Notice(`Проверка завершена: ошибок ${errors.length + cinemaErrors.length + mutualErrors.length}, предупреждений ${warnings.length}`);
    await app.workspace.getLeaf(false).openFile(reportFile);
};
