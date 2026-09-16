module.exports = async (params) => {
    const { app, quickAddApi, obsidian, variables = {} } = params;
    const { Notice, normalizePath } = obsidian;

    const PAGE_PATH = normalizePath("Книги/_system/Серия.md");

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (file.basename === "_index") return false;
        if (!(file.path.startsWith("Книги/Художественные/") || file.path.startsWith("Книги/Non-fiction/"))) return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    let series = String(variables.series ?? "").trim();

    if (!series) {
        const allSeries = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .map(file => String(getFrontmatter(file).series ?? "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));
        if (!allSeries.length) {
            new Notice("Серии не найдены.");
            return;
        }
        series = await quickAddApi.suggester(allSeries, allSeries, "Выбери серию");
        if (!series) return;
    }

    const content =
        `---\n` +
        `selected_series: ${JSON.stringify(series)}\n` +
        `obsidianUIMode: preview\n` +
        `---\n\n` +
        `# 🧩 ${series}\n\n` +
        `[← Все серии](obsidian://quickadd?choice=${encodeURIComponent("Книги - Серии")}) · [[Книги/_index|Книги]] · [➕ Добавить книгу](obsidian://quickadd?choice=${encodeURIComponent("Книги - Добавить книгу")})\n\n` +
        `![[Книги/Книги.base#Серия]]\n`;

    let page = app.vault.getAbstractFileByPath(PAGE_PATH);
    if (page) await app.vault.modify(page, content);
    else page = await app.vault.create(PAGE_PATH, content);

    await new Promise(resolve => setTimeout(resolve, 80));
    await app.workspace.getLeaf(false).openFile(page);
};
