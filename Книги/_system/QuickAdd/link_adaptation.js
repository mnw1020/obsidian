module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;

    const BOOK_PREFIXES = ["Книги/Художественные/", "Книги/Non-fiction/"];
    const MEDIA_ROOT = "Кино/";
    const MEDIA_EXCLUDED = ["Кино/Просмотры/", "Кино/Сезоны/", "Кино/_system/"];
    const CHANGELOG_PATH = "Книги/_system/Журнал изменений.md";

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

    async function appendJournal(line) {
        const now = new Date();
        const pad = value => String(value).padStart(2, "0");
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let block = `<!-- BOOK-LIBRARY-EVENT at="${iso}" normalization="false" structure="true" -->\n`;
        block += `## ${stamp}\n\n- ${line}\n\n`;
        const path = obsidian.normalizePath(CHANGELOG_PATH);
        let file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            file = await app.vault.create(path, "# Журнал изменений\n\n[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n> Автоматическая история обслуживания книжной базы.\n\n" + block);
            return;
        }
        const current = await app.vault.read(file);
        await app.vault.modify(file, current.replace(/\s*$/, "\n\n") + block);
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

    const bookTitle = String(getFrontmatter(bookFile).title ?? bookFile.basename);
    try {
        await appendJournal(`Связь с кино: **${bookTitle}** ↔ **${mediaFile.basename}**.`);
    } catch (error) {
        new Notice(`Связь создана, но журнал не обновлен: ${error?.message || error}`, 7000);
    }
    new Notice(`Связано: ${bookTitle} ↔ ${mediaFile.basename}`);
};
