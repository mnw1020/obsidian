module.exports = async ({ app, quickAddApi, obsidian }) => {
    const { Notice } = obsidian;
    const moduleFile = app.vault.getAbstractFileByPath("Книги/_system/knowledge.js");
    if (!moduleFile) { new Notice("Не найден модуль выписок."); return; }
    const mod = { exports: {} };
    let knowledge, core;
    try {
        new Function("module", await app.vault.read(moduleFile))(mod);
        knowledge = mod.exports;
        core = await knowledge.loadCore(app, obsidian);
    } catch (error) { new Notice(`Не удалось открыть форму выписки: ${error.message || error}`, 7000); return; }
    const active = app.workspace.getActiveFile();
    let file = core.isBook(active) ? active : null;
    if (!file) {
        const cards = core.snapshot().sort((a, b) => String(a.fm.title).localeCompare(String(b.fm.title), "ru"));
        if (!cards.length) { new Notice("В библиотеке пока нет карточек книг."); return; }
        file = await quickAddApi.suggester(
            cards.map(({ file, fm }) => `${fm.title} · ${core.listValues(fm.authors).join(", ")} · ${file.path}`),
            cards.map(card => card.file), "В какую книгу добавить выписку?"
        );
        if (!file) return;
    }
    const view = app.workspace.activeEditor;
    const editor = view?.file?.path === file.path ? view.editor : null;
    const selectedText = editor?.getSelection?.() || "";
    let selection = null;
    let operation = "new";
    if (selectedText.trim()) {
        operation = await quickAddApi.suggester(
            ["Добавить новую выписку из выделения", "Оформить выделенный фрагмент конспекта"],
            ["new", "format"], "Как использовать выделение?"
        );
        if (!operation) return;
        if (operation === "format") {
            selection = {
                baseline: editor.getValue().replace(/\r\n/g, "\n"), text: selectedText.replace(/\r\n/g, "\n"),
                from: editor.posToOffset(editor.getCursor("from")), to: editor.posToOffset(editor.getCursor("to"))
            };
        }
    }
    const type = await quickAddApi.suggester(["💬 Цитата", "💡 Идея"], ["quote", "idea"], "Тип выписки");
    if (!type) return;
    // QuickAdd remembers values by input id. Fresh ids keep every invocation editable.
    const token = `excerpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const fields = [
        { key: "text", label: "Текст выписки", type: "textarea", defaultValue: selectedText },
        { key: "themes", label: "Темы, через точку с запятой", type: "text", optional: true },
        { key: "conclusion", label: "Мой вывод", type: "textarea", optional: true },
        { key: "location", label: "Место в источнике: страница, глава или время", type: "text", optional: true }
    ];
    const values = await quickAddApi.requestInputs(fields.map(({ key, ...field }) => ({ ...field, id: `${token}-${key}` })));
    if (!values) return;
    const input = { type };
    for (const { key } of fields) input[key] = values[`${token}-${key}`] ?? "";
    try {
        if (!String(input.text).trim()) throw new Error("Введите текст выписки.");
        if (!app.vault.process) throw new Error("Для безопасного сохранения требуется актуальная версия Obsidian с Vault.process.");
        if (!core.isBook(app.vault.getAbstractFileByPath(file.path))) throw new Error("Карточка книги больше не доступна.");
        let id;
        await app.vault.process(file, raw => {
            id = knowledge.createId(raw);
            return knowledge.applyExcerpt(raw, { ...input, id }, selection);
        });
        const target = `${file.path.replace(/\.md$/i, "")}#^${id}`;
        await app.workspace.openLinkText(target, file.path, false);
        new Notice(operation === "format" ? "Фрагмент оформлен и добавлен в общий индекс." : "Выписка сохранена в книге и добавлена в общий индекс.");
    } catch (error) { new Notice(error.message || String(error), 7000); }
};
