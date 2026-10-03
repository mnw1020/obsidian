module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Не найден общий модуль библиотеки book_core.js."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const request = params.variables?.bookReadingRequest;
    let bookFile = request ? app.vault.getAbstractFileByPath(request.path) : app.workspace.getActiveFile();
    if (request && !core.isBook(bookFile)) { new Notice("Карточка для нового чтения не найдена."); return; }
    if (!core.isBook(bookFile)) {
        const books = core.books().sort((a, b) => String(core.getFrontmatter(a).title).localeCompare(String(core.getFrontmatter(b).title), "ru"));
        if (!books.length) { new Notice("Произведения не найдены."); return; }
        bookFile = await quickAddApi.suggester(books.map(file => `${core.getFrontmatter(file).title} | ${core.listValues(core.getFrontmatter(file).authors).join(", ")}`), books, "Выбери произведение");
        if (!bookFile) return;
    }
    let history;
    try { history = core.parseHistory(await app.vault.read(bookFile)); }
    catch (error) { new Notice(error.message, 10000); return; }
    const expectedNumber = history.entries.reduce((max, entry) => Math.max(max, entry.number), 0) + 1;
    let draft = request?.values ?? { date: quickAddApi.date.now("YYYY-MM-DD"), rating: "", comment: "" };
    let supplied = Boolean(request?.values), attempt = 0;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    function inputs(seed) {
        const prefix = `book-reading-${session}-${attempt++}-`;
        const fields = [ { id: prefix + "date", label: `Дата чтения #${expectedNumber}`, type: "text", defaultValue: String(seed.date ?? ""), placeholder: "YYYY-MM-DD, YYYY-MM или YYYY" } ];
        if (core.isFiction(bookFile)) fields.push({ id: prefix + "rating", label: "Оценка", type: "number", optional: true, defaultValue: String(seed.rating ?? ""), numericConfig: { min: 1, max: 10, step: 1 } });
        fields.push({ id: prefix + "comment", label: "Комментарий", type: "textarea", optional: true, defaultValue: String(seed.comment ?? ""), placeholder: "Что изменилось при этом чтении?" });
        return { fields, prefix };
    }
    let result;
    while (!result) {
        if (!supplied) {
            const { fields, prefix } = inputs(draft);
            const response = await quickAddApi.requestInputs(fields);
            if (!response) return;
            draft = { date: response[prefix + "date"], rating: response[prefix + "rating"], comment: response[prefix + "comment"] };
        }
        supplied = false;
        const date = String(draft.date ?? "").trim().replace(/^@date:/, "");
        const rawRating = String(draft.rating ?? "").trim();
        const rating = core.isFiction(bookFile) && rawRating ? Number(rawRating) : null;
        const comment = String(draft.comment ?? "").trim();
        if (!core.isValidDate(date)) { new Notice("Некорректная дата. Исправь её; остальные поля сохранены.", 7000); continue; }
        if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 10)) { new Notice("Оценка должна быть от 1 до 10. Остальные поля сохранены.", 7000); continue; }
        if (/<!-- BOOK-READINGS?:/.test(comment)) { new Notice("Удали служебные маркеры истории из комментария. Остальные поля сохранены.", 7000); continue; }
        try { result = await core.appendReading(bookFile, { date, rating, comment }); }
        catch (error) { new Notice(`${error.message} Введённые поля сохранены в форме QuickAdd.`, 10000); return; }
    }
    try { await core.updateHomeStats(); }
    catch (error) { new Notice(`Чтение сохранено, но сводка не обновлена: ${error.message}`, 7000); }
    new Notice(`${core.getFrontmatter(bookFile).title || bookFile.basename}: добавлено чтение #${result.entry.number}`);
    await app.workspace.getLeaf(false).openFile(bookFile);
};
