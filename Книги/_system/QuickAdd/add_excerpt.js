module.exports = async ({ app, quickAddApi, obsidian }) => {
    const { Notice } = obsidian;
    const moduleFile = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!moduleFile) { new Notice("Не найден модуль цитат."); return; }
    const mod = { exports: {} };
    let knowledge, core;
    try {
        new Function("module", await app.vault.read(moduleFile))(mod);
        knowledge = mod.exports;
        core = await knowledge.loadCore(app, obsidian);
    } catch (error) { new Notice(`Не удалось открыть форму цитаты: ${error.message || error}`, 7000); return; }
    const active = app.workspace.getActiveFile();
    let file = core.isBook(active) ? active : null;
    if (!file) {
        const cards = core.snapshot().sort((a, b) => String(a.fm.title).localeCompare(String(b.fm.title), "ru"));
        if (!cards.length) { new Notice("В библиотеке пока нет карточек книг."); return; }
        file = await quickAddApi.suggester(
            cards.map(({ file, fm }) => `${fm.title} · ${core.listValues(fm.authors).join(", ")} · ${file.path}`),
            cards.map(card => card.file), "В какую книгу добавить цитату?"
        );
        if (!file) return;
    }
    const view = app.workspace.activeEditor;
    const editor = view?.file?.path === file.path ? view.editor : null;
    const selectedText = editor?.getSelection?.() || "";
    // QuickAdd remembers values by input id. Fresh ids keep every invocation editable.
    const token = `excerpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const fields = [
        { key: "text", label: "Текст цитаты", type: "textarea", defaultValue: selectedText },
        { key: "section", label: "Раздел: путь через /", type: "text", optional: true },
        { key: "themes", label: "Темы, через точку с запятой", type: "text", optional: true },
        { key: "conclusion", label: "Мой вывод", type: "textarea", optional: true },
        { key: "location", label: "Место в источнике: страница, глава или время", type: "text", optional: true }
    ];
    const values = await quickAddApi.requestInputs(fields.map(({ key, ...field }) => ({ ...field, id: `${token}-${key}` })));
    if (!values) return;
    const input = { type: "quote" };
    for (const { key } of fields) input[key] = values[`${token}-${key}`] ?? "";
    input.savedDate = quickAddApi.date?.now?.("YYYY-MM-DD") || knowledge.localDate();
    try {
        if (!String(input.text).trim()) throw new Error("Введите текст цитаты.");
        if (!app.vault.process) throw new Error("Для безопасного сохранения требуется актуальная версия Obsidian с Vault.process.");
        if (!core.isBook(app.vault.getAbstractFileByPath(file.path))) throw new Error("Карточка книги больше не доступна.");
        let id;
        await app.vault.process(file, raw => {
            id = knowledge.createId(raw);
            return knowledge.applyExcerpt(raw, { ...input, id });
        });
        const target = `${file.path.replace(/\.md$/i, "")}#^${id}`;
        await app.workspace.openLinkText(target, file.path, false);
        new Notice("Цитата сохранена в книге и добавлена в общий индекс.");
    } catch (error) { new Notice(error.message || String(error), 7000); }
};
