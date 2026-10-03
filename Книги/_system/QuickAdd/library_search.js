module.exports = async ({ app, quickAddApi, obsidian }) => {
    const { Notice } = obsidian;
    const file = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!file) { new Notice("Не найден модуль поиска библиотеки."); return; }
    const mod = { exports: {} };
    new Function("module", await app.vault.read(file))(mod);
    const id = `library-search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const values = await quickAddApi.requestInputs([{ id, label: "Найти в названиях, авторах и конспектах книг", type: "text", placeholder: "Не меньше двух символов" }]);
    if (!values) return;
    const query = String(values[id] ?? "").trim();
    if (query.length < 2) { new Notice("Введите не меньше двух символов."); return; }
    try {
        const service = await mod.exports.getService({ app, obsidian });
        const results = service.search(await service.snapshot(), query);
        if (!results.length) { new Notice("В книгах и их конспектах ничего не найдено."); return; }
        const selected = await quickAddApi.suggester(
            results.map(result => `${result.title} · ${result.authors.join(", ")}\n${result.snippet}`),
            results, `Найдено книг: ${results.length}`
        );
        if (!selected) return;
        if (!app.vault.getAbstractFileByPath(selected.file.path)) { new Notice("Карточка была удалена. Повторите поиск."); return; }
        await app.workspace.getLeaf(false).openFile(selected.file, { eState: { line: selected.line } });
    } catch (error) { new Notice(`Не удалось выполнить поиск: ${error.message || error}`, 7000); }
};
