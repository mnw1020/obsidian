// Shared creation flow for the quote index and the book/QuickAdd action.
async function load(app, name) {
    const file = app.vault.getAbstractFileByPath(`Книги/_system/${name}.js`);
    if (!file) throw new Error(`Не найден модуль ${name}.`);
    const module = { exports: {} };
    new Function("module", await app.vault.read(file))(module);
    return module.exports;
}

async function addQuote({ app, obsidian, quickAddApi, initial = {}, onSaved, openAfterSave = true } = {}) {
    try {
        const knowledge = await load(app, "knowledge");
        const core = await knowledge.loadCore(app, obsidian);
        const storage = await load(app, "quote_storage");
        const openCreate = await load(app, "quote_create");
        const active = app.workspace.getActiveFile?.();
        const book = core.isBook(active) ? active : null;
        const editor = book && app.workspace.activeEditor?.file?.path === book.path ? app.workspace.activeEditor.editor : null;
        const defaults = {
            sourceKind: book ? "book" : "free",
            bookPath: book?.path || "",
            text: editor?.getSelection?.() || "",
            section: book ? "" : String(core.getFrontmatter(active).quote_section || ""),
            ...initial
        };
        return await openCreate({ app, obsidian, books: core.snapshot(), initial: defaults, onSave: async value => {
            const result = await storage.saveQuote({ app, knowledge, core, value: {
                ...value, savedDate: quickAddApi?.date?.now?.("YYYY-MM-DD") || knowledge.localDate()
            } });
            // Saving has succeeded. A navigation failure must not invite a duplicate save.
            try {
                if (onSaved) await onSaved({ ...result, value });
                if (openAfterSave) await app.workspace.openLinkText(`${result.path.replace(/\.md$/i, "")}#^${result.id}`, result.path, false);
            } catch (error) {
                if (obsidian?.Notice) new obsidian.Notice("Цитата сохранена. Не удалось открыть или обновить страницу: " + (error.message || error), 7000);
            }
            if (obsidian?.Notice) new obsidian.Notice("Цитата сохранена.");
            return result;
        } });
    } catch (error) {
        if (obsidian?.Notice) new obsidian.Notice("Не удалось открыть форму цитаты: " + (error.message || error), 7000);
        return null;
    }
}

module.exports = addQuote;
