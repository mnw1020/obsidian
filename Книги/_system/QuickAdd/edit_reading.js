module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Не найден общий модуль библиотеки book_core.js."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    let bookFile = app.workspace.getActiveFile();
    if (!core.isBook(bookFile)) {
        const books = core.books().sort((a, b) => String(core.getFrontmatter(a).title).localeCompare(String(core.getFrontmatter(b).title), "ru"));
        if (!books.length) { new Notice("Произведения не найдены."); return; }
        bookFile = await quickAddApi.suggester(books.map(file => `${core.getFrontmatter(file).title} | ${core.listValues(core.getFrontmatter(file).authors).join(", ")}`), books, "Выбери произведение");
        if (!bookFile) return;
    }
    let history;
    try { history = core.parseHistory(await app.vault.read(bookFile)); }
    catch (error) { new Notice(error.message, 10000); return; }
    if (!history.entries.length) { new Notice("У этой книги пока нет записей чтения."); return; }
    const entries = [...history.entries].sort((a, b) => a.number - b.number);
    let selected = await quickAddApi.suggester(entries.map(entry => `Чтение #${entry.number} - ${core.displayDate(entry.date)}${entry.rating !== null ? ` - ${entry.rating}/10` : ""}`), entries, "Какое чтение редактировать?");
    if (!selected) return;
    let draft = { date: selected.date, rating: selected.rating ?? "", comment: selected.comment }, attempt = 0;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let result;
    while (!result) {
        const prefix = `book-reading-edit-${session}-${attempt++}-`;
        const fields = [{ id: "date__" + prefix, label: `Дата чтения #${selected.number}`, type: "text", defaultValue: String(draft.date ?? ""), placeholder: "YYYY-MM-DD, YYYY-MM или YYYY" }];
        if (core.isFiction(bookFile)) fields.push({ id: "rating__" + prefix, label: "Оценка", type: "number", optional: true, defaultValue: String(draft.rating ?? ""), numericConfig: { min: 1, max: 10, step: 1 } });
        fields.push({ id: "comment__" + prefix, label: "Комментарий", type: "textarea", optional: true, defaultValue: String(draft.comment ?? "") });
        const response = await quickAddApi.requestInputs(fields);
        if (!response) return;
        draft = { date: response["date__" + prefix], rating: response["rating__" + prefix], comment: response["comment__" + prefix] };
        const date = String(draft.date ?? "").trim().replace(/^@date:/, "");
        const rawRating = String(draft.rating ?? "").trim();
        const rating = core.isFiction(bookFile) && rawRating ? Number(rawRating) : null;
        const comment = String(draft.comment ?? "").trim();
        if (!core.isValidDate(date)) { new Notice("Некорректная дата. Исправь её; остальные поля сохранены.", 7000); continue; }
        if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 10)) { new Notice("Оценка должна быть от 1 до 10. Остальные поля сохранены.", 7000); continue; }
        if (/<!-- BOOK-READINGS?:/.test(comment)) { new Notice("Удали служебные маркеры истории из комментария. Остальные поля сохранены.", 7000); continue; }
        try { result = await core.editReading(bookFile, selected, { date, rating, comment }); }
        catch (error) {
            if (error.code !== "BOOK_READING_CONFLICT") { new Notice(error.message, 10000); return; }
            if (!error.currentEntry) { new Notice("Выбранное чтение удалено другим изменением. Запись отменена; введённые поля сохранены в форме QuickAdd.", 10000); return; }
            const latest = error.currentEntry;
            const action = await quickAddApi.suggester(["Вернуться к форме с моим вводом", "Отмена"], ["retry", "cancel"], `Чтение изменилось: ${core.displayDate(latest.date)}, оценка ${latest.rating ?? "—"}.\nТекущий комментарий: ${latest.comment.slice(0, 180)}\nТвой ввод сохранён. Проверь его перед повторным сохранением.`);
            if (action !== "retry") return;
            selected = latest;
        }
    }
    try { await core.updateHomeStats(); }
    catch (error) { new Notice(`Чтение сохранено, но сводка не обновлена: ${error.message}`, 7000); }
    new Notice(`Чтение #${result.entry.number} обновлено`);
    await app.workspace.getLeaf(false).openFile(bookFile);
};
