module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;

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
        return listValues(frontmatter?.tags)
            .map(tag => tag.replace(/^#/, ""));
    }

    function isBook(file) {
        if (!file || file.extension !== "md" || file.basename === "_index") return false;
        if (!BOOK_PREFIXES.some(prefix => file.path.startsWith(prefix))) return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    function isMedia(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(MEDIA_ROOT)) return false;
        if (MEDIA_EXCLUDED.some(prefix => file.path.startsWith(prefix))) return false;
        const fileTags = tags(getFrontmatter(file));
        return fileTags.includes("movies") || fileTags.includes("serial");
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

    function addLink(frontmatter, key, file) {
        const target = targetPath(file);
        const current = listValues(frontmatter[key]);
        if (current.some(value => linkTarget(value) === target)) return false;
        frontmatter[key] = [...current, wikiLink(file)];
        return true;
    }

    let bookFile = app.workspace.getActiveFile();
    if (!isBook(bookFile)) {
        const books = app.vault.getMarkdownFiles()
            .filter(isBook)
            .sort((a, b) => {
                const aTitle = String(getFrontmatter(a).title ?? a.basename);
                const bTitle = String(getFrontmatter(b).title ?? b.basename);
                return aTitle.localeCompare(bTitle, "ru");
            });
        if (!books.length) {
            new Notice("Книги не найдены.");
            return;
        }
        const labels = books.map(file => {
            const fm = getFrontmatter(file);
            const title = String(fm.title ?? file.basename).trim();
            const authors = listValues(fm.authors).join(", ");
            return authors ? `${title} | ${authors}` : title;
        });
        bookFile = await quickAddApi.suggester(labels, books, "Выбери книгу");
        if (!bookFile) return;
    }

    const media = app.vault.getMarkdownFiles()
        .filter(isMedia)
        .sort((a, b) => a.basename.localeCompare(b.basename, "ru"));

    if (!media.length) {
        new Notice("В этом vault не найдены карточки фильмов/сериалов в папке Кино с тегами movies/serial.", 9000);
        return;
    }

    const mediaLabels = media.map(file => {
        const fm = getFrontmatter(file);
        const fileTags = tags(fm);
        const icon = fileTags.includes("serial") ? "📺" : "🎬";
        const original = String(fm["Название"] ?? "").trim();
        return original && original !== file.basename
            ? `${icon} ${file.basename} | ${original}`
            : `${icon} ${file.basename}`;
    });

    const mediaFile = await quickAddApi.suggester(mediaLabels, media, "Выбери экранизацию");
    if (!mediaFile) return;

    const bookTarget = targetPath(bookFile);
    const mediaTarget = targetPath(mediaFile);
    const bookFm = getFrontmatter(bookFile);
    const mediaFm = getFrontmatter(mediaFile);
    const alreadyBook = listValues(bookFm.adaptations).some(value => linkTarget(value) === mediaTarget);
    const alreadyMedia = listValues(mediaFm["Первоисточники"]).some(value => linkTarget(value) === bookTarget);

    if (alreadyBook && alreadyMedia) {
        new Notice("Эта книга и экранизация уже связаны.");
        return;
    }

    const originalBookLinks = listValues(bookFm.adaptations);
    const originalMediaLinks = listValues(mediaFm["Первоисточники"]);
    let bookUpdated = false;

    try {
        await app.fileManager.processFrontMatter(bookFile, frontmatter => {
            addLink(frontmatter, "adaptations", mediaFile);
        });
        bookUpdated = true;
        await app.fileManager.processFrontMatter(mediaFile, frontmatter => {
            addLink(frontmatter, "Первоисточники", bookFile);
        });
    } catch (error) {
        if (bookUpdated && !alreadyBook) {
            try {
                await app.fileManager.processFrontMatter(bookFile, frontmatter => {
                    if (originalBookLinks.length) frontmatter.adaptations = originalBookLinks;
                    else delete frontmatter.adaptations;
                });
            } catch (_) {
                // Если rollback не удался, полный аудит/ручная проверка покажут одностороннюю связь.
            }
        }
        if (!alreadyMedia) {
            try {
                await app.fileManager.processFrontMatter(mediaFile, frontmatter => {
                    if (originalMediaLinks.length) frontmatter["Первоисточники"] = originalMediaLinks;
                    else delete frontmatter["Первоисточники"];
                });
            } catch (_) {
                // Не скрываем исходную ошибку.
            }
        }
        new Notice(`Не удалось создать взаимную связь: ${error?.message || error}`, 10000);
        return;
    }

    new Notice(`Связано: ${String(getFrontmatter(bookFile).title ?? bookFile.basename)} ↔ ${mediaFile.basename}`);
};
