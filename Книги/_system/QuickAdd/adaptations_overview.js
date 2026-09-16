module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const OUTPUT_PATH = "Книги/_system/Экранизации.md";
    const BOOK_PREFIXES = ["Книги/Художественные/", "Книги/Non-fiction/"];
    const MEDIA_ROOT = "Кино/";
    const MEDIA_EXCLUDED = ["Кино/Просмотры/", "Кино/Сезоны/", "Кино/_system/"];

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

    function commandLink(label, choice) {
        const uri = "obsidian://quickadd?choice=" + encodeURIComponent(choice);
        return `[${label}](${uri})`;
    }

    function tableLink(file, label) {
        const target = file.path.replace(/\.md$/i, "");
        const safeLabel = String(label ?? file.basename).replace(/\|/g, "¦");
        return `[[${target}\\|${safeLabel}]]`;
    }

    function authorLink(author) {
        const uri =
            "obsidian://quickadd?choice=" +
            encodeURIComponent("Книги - Открыть автора") +
            "&value-author=" +
            encodeURIComponent(author);
        return `[${String(author).replace(/\|/g, "¦")}](${uri})`;
    }

    function numberOrDash(value) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 1 && number <= 10 ? String(number) : "—";
    }

    const books = app.vault.getMarkdownFiles().filter(isBook);
    const rows = [];
    const linkedBooks = new Set();
    const linkedMedia = new Set();

    for (const bookFile of books) {
        const bookFm = getFrontmatter(bookFile);
        const adaptations = listValues(bookFm.adaptations);
        if (!adaptations.length) continue;

        const title = String(bookFm.title ?? bookFile.basename).trim();
        const authors = listValues(bookFm.authors).map(authorLink).join("<br>") || "—";
        const bookRating = numberOrDash(bookFm.rating);
        const seen = new Set();

        for (const raw of adaptations) {
            const mediaFile = resolveNoteLink(raw, bookFile.path);
            if (!mediaFile || !isMedia(mediaFile)) continue;
            if (seen.has(mediaFile.path)) continue;
            seen.add(mediaFile.path);
            linkedBooks.add(bookFile.path);
            linkedMedia.add(mediaFile.path);

            const mediaFm = getFrontmatter(mediaFile);
            const mediaTags = tags(mediaFm);
            const type = mediaTags.includes("serial") ? "📺 Сериал" : "🎬 Фильм";
            const mediaRating = numberOrDash(mediaFm["Оценка"]);
            rows.push({
                bookFile,
                title,
                authors,
                bookRating,
                mediaFile,
                mediaRating,
                type
            });
        }
    }

    rows.sort((a, b) => {
        const byTitle = a.title.localeCompare(b.title, "ru");
        if (byTitle !== 0) return byTitle;
        return a.mediaFile.basename.localeCompare(b.mediaFile.basename, "ru");
    });

    const nav = [
        "[[Книги/_index|← Книги]]",
        commandLink("👥 Авторы", "Книги - Авторы"),
        commandLink("🧩 Серии", "Книги - Серии"),
        commandLink("🎬 Экранизации", "Книги - Экранизации"),
        "[[Книги/_system/Проверка библиотеки|🔎 Проверка]]",
        "[[Книги/_system/Журнал изменений|📜 Журнал]]",
        commandLink("↻ Обновить", "Книги - Экранизации")
    ].join(" · ");

    let text = "---\nobsidianUIMode: preview\n---\n\n";
    text += "# 🎬 Экранизации\n\n";
    text += `${nav}\n\n`;
    text += "> [!info] Обзор\n";
    text += `> **Связей:** ${rows.length} · **Книг:** ${linkedBooks.size} · **Экранизаций:** ${linkedMedia.size}\n\n`;

    if (!rows.length) {
        text += "> Связей книга ↔ кино пока нет или папка `Кино/` недоступна в этом vault.\n";
    } else {
        text += "| Книга | Автор | Экранизация | Тип | Книга ⭐ | Кино ⭐ |\n";
        text += "| --- | --- | --- | --- | ---: | ---: |\n";
        for (const row of rows) {
            text += `| ${tableLink(row.bookFile, row.title)} | ${row.authors} | ${tableLink(row.mediaFile, row.mediaFile.basename)} | ${row.type} | ${row.bookRating} | ${row.mediaRating} |\n`;
        }
    }

    const path = normalizePath(OUTPUT_PATH);
    let output = app.vault.getAbstractFileByPath(path);
    if (output) await app.vault.modify(output, text);
    else output = await app.vault.create(path, text);

    new Notice(`Обзор экранизаций обновлен: ${rows.length} связей.`);
    await app.workspace.getLeaf(false).openFile(output);
};
