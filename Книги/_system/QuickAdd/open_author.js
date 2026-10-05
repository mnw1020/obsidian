module.exports = async (params) => {
    const { app, quickAddApi, obsidian, variables = {} } = params;
    const { Notice, normalizePath } = obsidian;
    const coreFile = app.vault.getAbstractFileByPath("Книги/_system/book_core.js");
    if (!coreFile) { new Notice("Модуль библиотеки не найден."); return; }
    const coreModule = { exports: {} };
    new Function("module", await app.vault.read(coreFile))(coreModule);
    const core = coreModule.exports({ app, obsidian });
    const authorsOf = fm => [...new Set((Array.isArray(fm.authors) ? fm.authors : [fm.authors]).map(value => String(value ?? "").trim()).filter(Boolean))];

    let author = String(variables.author ?? "").trim();
    if (!author) {
        const active = app.workspace.getActiveFile();
        if (core.isBook(active)) {
            const current = authorsOf(core.getFrontmatter(active));
            author = current.length === 1 ? current[0] : await quickAddApi.suggester(current, current, "Автор этого произведения");
            if (!author) return;
        } else {
            author = String(core.getFrontmatter(active)?.selected_author ?? "").trim();
        }
    }
    if (!author) {
        const names = [...new Set(core.snapshot().flatMap(({ fm }) => authorsOf(fm)))].sort((a, b) => a.localeCompare(b, "ru"));
        if (!names.length) { new Notice("Авторы не найдены."); return; }
        author = await quickAddApi.suggester(names, names, "Выбери автора");
        if (!author) return;
    }

    function entityName(value) {
        let hash = 2166136261;
        for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
        const safe = value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/[. ]+$/g, "").slice(0, 96).trim() || "Автор";
        return `${safe}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }
    const folder = "Книги/_system/Авторы";
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    const pagePath = normalizePath(`${folder}/${entityName(author)}.md`);
    const layoutFile = app.vault.getAbstractFileByPath("Книги/_system/author_pages.js");
    if (!layoutFile) throw new Error("Модуль страниц авторов не найден.");
    const layout = { exports: {} };
    new Function("module", await app.vault.read(layoutFile))(layout);
    const generated = layout.exports.authorRegion();
    const existing = app.vault.getAbstractFileByPath(pagePath);
    let page;
    if (existing) {
        const merge = layout.exports.mergeAuthor;
        const original = await app.vault.read(existing);
        // Merge against the newest text inside the atomic Vault callback.
        if (merge(original) !== original) await app.vault.process(existing, merge);
        page = existing;
    } else {
        const content = `---\nselected_author: ${JSON.stringify(author)}\ncssclasses:\n  - books-entity\nobsidianUIMode: preview\n---\n\n${generated}\n\n## Мои заметки\n\n`;
        page = await core.writeIfChanged(pagePath, content);
    }
    await core.refreshFrontmatter?.(page);
    await app.workspace.getLeaf(false).openFile(page);
};
