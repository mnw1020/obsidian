module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const CHANGELOG_PATH = "Книги/_system/Журнал изменений.md";
    const BOOK_PREFIXES = ["Книги/Художественные/", "Книги/Non-fiction/"];
    const MEDIA_ROOT = "Кино/";
    const MEDIA_EXCLUDED = ["Кино/Просмотры/", "Кино/Сезоны/", "Кино/_system/"];
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";

    const RELATION_RULES = [
        {
            name: "книга ↔ кино",
            leftType: "book",
            leftProp: "adaptations",
            rightType: "media",
            rightProp: "Первоисточники"
        },
        {
            name: "related",
            leftType: "book",
            leftProp: "related",
            rightType: "book",
            rightProp: "related"
        },
        {
            name: "продолжение",
            leftType: "book",
            leftProp: "continued_by",
            rightType: "book",
            rightProp: "continues"
        },
        {
            name: "adapted_from → adaptations",
            leftType: "media",
            leftProp: "adapted_from",
            rightType: "book",
            rightProp: "adaptations",
            sourceOnly: true
        }
    ];

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function listValues(value) {
        if (value === null || value === undefined || value === "") return [];
        return (Array.isArray(value) ? value : [value])
            .map(value => String(value ?? "").trim())
            .filter(Boolean);
    }

    function tags(frontmatter) {
        return listValues(frontmatter?.tags).map(tag => tag.replace(/^#/, ""));
    }

    function isBook(file) {
        if (!file || file.extension !== "md" || file.basename === "_index") return false;
        return BOOK_PREFIXES.some(prefix => file.path.startsWith(prefix));
    }

    function isMedia(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_ROOT)) return false;
        if (MEDIA_EXCLUDED.some(prefix => file.path.startsWith(prefix))) return false;
        const fileTags = tags(getFrontmatter(file));
        return fileTags.includes("movies") || fileTags.includes("serial");
    }


    async function updateHomeStats() {
        const home = app.vault.getAbstractFileByPath("Книги/_index.md");
        if (!home) return;
        await new Promise(resolve => setTimeout(resolve, 100));
        const allBooks = app.vault.getMarkdownFiles().filter(isBook);
        const authors = new Set();
        const series = new Set();
        let rated = 0;
        let reread = 0;
        for (const file of allBooks) {
            const fm = getFrontmatter(file);
            const rawAuthors = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
            for (const author of rawAuthors) {
                const value = String(author ?? "").trim();
                if (value) authors.add(value);
            }
            const seriesName = String(fm.series ?? "").trim();
            if (seriesName) series.add(seriesName);
            if (file.path.startsWith("Книги/Художественные/")) {
                const value = Number(fm.rating);
                if (Number.isFinite(value) && value >= 1 && value <= 10) rated++;
            }
            const count = Number(fm.read_count);
            if (Number.isInteger(count) && count > 1) reread++;
        }
        const block = `<!-- BOOK-HOME-STATS:START -->\n> [!abstract] Библиотека\n> **${allBooks.length} книг** · **${authors.size} авторов** · **${series.size} серий** · **${rated} оценено** · **${reread} перечитано**\n<!-- BOOK-HOME-STATS:END -->`;
        const current = await app.vault.read(home);
        const updated = /<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/.test(current)
            ? current.replace(/<!-- BOOK-HOME-STATS:START -->[\s\S]*?<!-- BOOK-HOME-STATS:END -->/, block)
            : current;
        if (updated !== current) await app.vault.modify(home, updated);
    }

    function matchesType(file, type) {
        if (type === "book") return isBook(file);
        if (type === "media") return isMedia(file);
        return false;
    }

    function targetPath(file) {
        return file.path.replace(/\.md$/i, "");
    }

    function wikiLink(file) {
        return `[[${targetPath(file)}]]`;
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
        }
        for (const candidate of [target, `${target}.md`]) {
            const exact = app.vault.getAbstractFileByPath(normalizePath(candidate));
            if (exact?.extension === "md") return exact;
        }
        return null;
    }

    function cleanAuthor(value) {
        return String(value ?? "")
            .trim()
            .replace(/\s+/g, " ")
            .replace(/[.]+$/g, "")
            .trim();
    }

    function authorSafeKey(value) {
        return cleanAuthor(value).toLocaleLowerCase("ru").replace(/ё/g, "е");
    }

    function parseReadCount(text) {
        const start = text.indexOf(HISTORY_START);
        const end = text.indexOf(HISTORY_END, start + HISTORY_START.length);
        if (start < 0 || end < 0) return null;
        const managed = text.slice(start + HISTORY_START.length, end);
        const starts = (managed.match(/<!-- BOOK-READING:START number="\d+"/g) || []).length;
        const ends = (managed.match(/<!-- BOOK-READING:END -->/g) || []).length;
        const parsed = [...managed.matchAll(/<!-- BOOK-READING:START number="(\d+)" date="([^"]*)" rating="([^"]*)" -->[\s\S]*?<!-- BOOK-READING:END -->/g)].length;
        if (starts !== ends || starts !== parsed) return null;
        return parsed;
    }

    async function appendJournal(lines, structural) {
        if (!lines.length) return;
        const now = new Date();
        const pad = value => String(value).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let block = `<!-- BOOK-LIBRARY-EVENT at="${iso}" normalization="false" structure="${structural ? "true" : "false"}" -->\n`;
        block += `## ${stamp}\n\n`;
        for (const line of lines) block += `- ${line}\n`;
        block += "\n";

        const path = normalizePath(CHANGELOG_PATH);
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            file = await app.vault.create(path, "# Журнал изменений\n\n[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n> Автоматическая история обслуживания книжной базы.\n\n" + block);
            return;
        }
        const current = await app.vault.read(file);
        await app.vault.modify(file, current.replace(/\s*$/, "\n\n") + block);
    }

    const books = app.vault.getMarkdownFiles().filter(isBook);
    const mediaFiles = app.vault.getMarkdownFiles().filter(isMedia);
    const filesByType = { book: books, media: mediaFiles };
    const journal = [];
    let structuralChanged = false;
    let fixes = 0;

    // Канонические варианты авторов: безопасно исправляем только пробелы/конечную точку,
    // причем только если такой канонический вариант уже существует в библиотеке.
    const authorVariants = new Map();
    for (const book of books) {
        for (const author of listValues(getFrontmatter(book).authors)) {
            const key = authorSafeKey(author);
            if (!authorVariants.has(key)) authorVariants.set(key, new Map());
            const variants = authorVariants.get(key);
            variants.set(author, (variants.get(author) || 0) + 1);
        }
    }
    const canonicalAuthors = new Map();
    for (const [key, variants] of authorVariants.entries()) {
        const candidates = [...variants.keys()].sort((a, b) => {
            const aClean = cleanAuthor(a);
            const bClean = cleanAuthor(b);
            const aExact = a === aClean ? 1 : 0;
            const bExact = b === bClean ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            const countDiff = variants.get(b) - variants.get(a);
            return countDiff !== 0 ? countDiff : a.localeCompare(b, "ru");
        });
        canonicalAuthors.set(key, cleanAuthor(candidates[0]));
    }

    for (const book of books) {
        const fm = getFrontmatter(book);
        const rawAuthors = listValues(fm.authors);
        const fixedAuthors = [];
        const seenAuthors = new Set();
        let authorsChanged = false;

        for (const raw of rawAuthors) {
            const key = authorSafeKey(raw);
            const canonical = canonicalAuthors.get(key) || cleanAuthor(raw);
            const canonicalRawExists = authorVariants.has(key) && [...authorVariants.get(key).keys()].some(value => value === cleanAuthor(value) && cleanAuthor(value) === canonical);
            const spaceNormalized = raw.trim().replace(/\s+/g, " ");
            const next = canonicalRawExists ? canonical : spaceNormalized;
            if (next !== raw) authorsChanged = true;
            const dedupe = next.toLocaleLowerCase("ru").replace(/ё/g, "е");
            if (seenAuthors.has(dedupe)) {
                authorsChanged = true;
                continue;
            }
            seenAuthors.add(dedupe);
            fixedAuthors.push(next);
        }

        let expectedReadCount = null;
        try {
            expectedReadCount = parseReadCount(await app.vault.read(book));
        } catch (_) {
        }
        const currentReadCount = Number(fm.read_count);
        const readCountChanged = expectedReadCount !== null && Number.isInteger(expectedReadCount) && currentReadCount !== expectedReadCount;

        if (authorsChanged || readCountChanged) {
            await app.fileManager.processFrontMatter(book, frontmatter => {
                if (authorsChanged) frontmatter.authors = fixedAuthors;
                if (readCountChanged) frontmatter.read_count = expectedReadCount;
            });
            if (authorsChanged) {
                journal.push(`Авторы: **${book.path}** — безопасно нормализованы пробелы/конечные точки и удалены точные дубли.`);
                fixes++;
                structuralChanged = true;
            }
            if (readCountChanged) {
                journal.push(`read_count: **${book.path}** — ${Number.isFinite(currentReadCount) ? currentReadCount : "пусто"} → ${expectedReadCount}.`);
                fixes++;
            }
        }
    }

    function dedupeResolved(values, sourceFile) {
        const output = [];
        const seen = new Set();
        let changed = false;
        for (const raw of values) {
            const resolved = resolveNoteLink(raw, sourceFile.path);
            const key = resolved ? targetPath(resolved) : linkTarget(raw);
            if (seen.has(key)) {
                changed = true;
                continue;
            }
            seen.add(key);
            output.push(raw);
        }
        return { output, changed };
    }

    // Удаляем точные дубли во всех известных взаимных свойствах.
    const propertiesByType = {
        book: [...new Set(RELATION_RULES.flatMap(rule => [rule.leftType === "book" ? rule.leftProp : null, rule.rightType === "book" ? rule.rightProp : null]).filter(Boolean))],
        media: [...new Set(RELATION_RULES.flatMap(rule => [rule.leftType === "media" ? rule.leftProp : null, rule.rightType === "media" ? rule.rightProp : null]).filter(Boolean))]
    };

    for (const type of ["book", "media"]) {
        for (const file of filesByType[type]) {
            const fm = getFrontmatter(file);
            const updates = new Map();
            for (const prop of propertiesByType[type]) {
                const values = listValues(fm[prop]);
                if (values.length < 2) continue;
                const deduped = dedupeResolved(values, file);
                if (deduped.changed) updates.set(prop, deduped.output);
            }
            if (!updates.size) continue;
            await app.fileManager.processFrontMatter(file, frontmatter => {
                for (const [prop, values] of updates.entries()) frontmatter[prop] = values;
            });
            for (const prop of updates.keys()) {
                journal.push(`Ссылки: **${file.path}** — удалены точные дубли в \`${prop}\`.`);
                fixes++;
                structuralChanged = true;
            }
        }
    }

    function containsTarget(file, prop, expectedFile) {
        const expected = targetPath(expectedFile);
        return listValues(getFrontmatter(file)[prop]).some(raw => {
            const resolved = resolveNoteLink(raw, file.path);
            return resolved ? targetPath(resolved) === expected : linkTarget(raw) === expected;
        });
    }

    async function addReverse(file, prop, targetFile) {
        if (containsTarget(file, prop, targetFile)) return false;
        await app.fileManager.processFrontMatter(file, frontmatter => {
            const current = listValues(frontmatter[prop]);
            frontmatter[prop] = [...current, wikiLink(targetFile)];
        });
        return true;
    }

    // Восстанавливаем только однозначные обратные связи по известным правилам.
    for (const rule of RELATION_RULES) {
        for (const leftFile of filesByType[rule.leftType]) {
            for (const raw of listValues(getFrontmatter(leftFile)[rule.leftProp])) {
                const rightFile = resolveNoteLink(raw, leftFile.path);
                if (!rightFile || !matchesType(rightFile, rule.rightType)) continue;
                if (await addReverse(rightFile, rule.rightProp, leftFile)) {
                    journal.push(`Взаимная связь: **${leftFile.path}** ↔ **${rightFile.path}** — добавлена недостающая \`${rule.rightProp}\` (${rule.name}).`);
                    fixes++;
                    structuralChanged = true;
                }
            }
        }
        if (!rule.sourceOnly) {
            for (const rightFile of filesByType[rule.rightType]) {
                for (const raw of listValues(getFrontmatter(rightFile)[rule.rightProp])) {
                    const leftFile = resolveNoteLink(raw, rightFile.path);
                    if (!leftFile || !matchesType(leftFile, rule.leftType)) continue;
                    if (await addReverse(leftFile, rule.leftProp, rightFile)) {
                        journal.push(`Взаимная связь: **${leftFile.path}** ↔ **${rightFile.path}** — добавлена недостающая \`${rule.leftProp}\` (${rule.name}).`);
                        fixes++;
                        structuralChanged = true;
                    }
                }
            }
        }
    }

    await updateHomeStats();

    try {
        await appendJournal(journal, structuralChanged);
    } catch (error) {
        new Notice(`Исправления выполнены, но журнал не обновлен: ${error?.message || error}`, 7000);
    }

    if (!fixes) {
        new Notice("Безопасных исправлений не найдено.");
        return;
    }
    new Notice(`Безопасно исправлено: ${fixes}. Теперь запусти «Книги - Проверить библиотеку» еще раз.`, 9000);
};
