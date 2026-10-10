module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Не найден общий модуль библиотеки book_core.js."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian }), list = core.listValues;
    const targetPath = file => file.path.replace(/\.md$/i, "");
    const linkTarget = raw => {
        const text = String(raw ?? "").trim(), match = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return (match ? match[1] : text).replace(/\.md$/i, "").trim();
    };
    function contains(values, target, sourcePath) {
        return values.some(raw => {
            const dest = app.metadataCache.getFirstLinkpathDest(linkTarget(raw), sourcePath);
            return dest ? dest.path === target.path : linkTarget(raw) === targetPath(target);
        });
    }
    const isMedia = file => file?.extension === "md" && file.path.startsWith("Кино/") &&
        !/^Кино\/(?:Просмотры|Сезоны|_system)\//.test(file.path) &&
        list(core.getFrontmatter(file).tags).map(tag => tag.replace(/^#/, "")).some(tag => ["movies", "serial"].includes(tag));
    const request = params.variables?.bookAdaptationRequest;
    let bookFile = request?.path ? app.vault.getAbstractFileByPath(request.path) : app.workspace.getActiveFile();
    if (request?.path && !core.isBook(bookFile)) { new Notice("Карточка произведения больше недоступна."); return; }
    if (!core.isBook(bookFile)) {
        const books = core.books().sort((a, b) => String(core.getFrontmatter(a).title).localeCompare(String(core.getFrontmatter(b).title), "ru"));
        if (!books.length) { new Notice("Произведения не найдены."); return; }
        bookFile = await quickAddApi.suggester(books.map(file => `${core.getFrontmatter(file).title} | ${list(core.getFrontmatter(file).authors).join(", ")}`), books, "Выбери произведение");
        if (!bookFile) return;
    }
    const media = app.vault.getMarkdownFiles().filter(isMedia).sort((a, b) => a.basename.localeCompare(b.basename, "ru"));
    if (!media.length) { new Notice("Не найдены карточки фильмов/сериалов в Кино с тегами movies/serial.", 9000); return; }
    const mediaFile = await quickAddApi.suggester(media.map(file => `${list(core.getFrontmatter(file).tags).includes("serial") ? "📺" : "🎬"} ${file.basename}`), media, "Выбери экранизацию");
    if (!mediaFile) return;
    async function add(file, property, target) {
        const { result } = await core.updateFrontmatter(file, fm => {
            const current = list(fm[property]);
            if (contains(current, target, file.path)) return false;
            fm[property] = [...current, `[[${targetPath(target)}]]`];
            return true;
        });
        return result;
    }
    async function removeOwn(file, property, target) {
        await core.updateFrontmatter(file, fm => {
            const current = list(fm[property]), ownLink = `[[${targetPath(target)}]]`, index = current.lastIndexOf(ownLink);
            if (index < 0) return;
            current.splice(index, 1);
            if (current.length) fm[property] = current;
            else delete fm[property];
        });
    }
    let addedBook = false, addedMedia = false;
    try {
        addedBook = await add(bookFile, "adaptations", mediaFile);
        addedMedia = await add(mediaFile, "Первоисточники", bookFile);
    } catch (error) {
        const failures = [];
        if (addedBook) try { await removeOwn(bookFile, "adaptations", mediaFile); } catch (rollbackError) { failures.push(rollbackError.message); }
        if (addedMedia) try { await removeOwn(mediaFile, "Первоисточники", bookFile); } catch (rollbackError) { failures.push(rollbackError.message); }
        new Notice(`Не удалось создать взаимную связь: ${error.message}${failures.length ? `. Проверь одностороннюю связь: ${failures.join("; ")}` : ""}`, 10000);
        return;
    }
    // Pass saved values directly to the rendered card: metadata cache may still be stale.
    if (typeof request?.onLinked === "function") request.onLinked(list(core.getFrontmatter(bookFile).adaptations));
    if (!addedBook && !addedMedia) { new Notice("Эта книга и экранизация уже связаны."); return; }
    const title = core.getFrontmatter(bookFile).title || bookFile.basename;
    try { await core.appendJournal([`Связь с кино: **${title}** ↔ **${mediaFile.basename}**.`]); }
    catch (error) { new Notice(`Связь создана, но журнал не обновлён: ${error.message}`, 7000); }
    new Notice(`Связано: ${title} ↔ ${mediaFile.basename}`);
};
