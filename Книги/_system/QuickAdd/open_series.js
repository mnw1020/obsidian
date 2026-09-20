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
        const active = app.workspace.getActiveFile();
        if (isBook(active)) {
            series = String(getFrontmatter(active).series ?? "").trim();
            if (!series) {
                new Notice("У этой книги серия не указана.");
                return;
            }
        }
    }

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
        `[[Книги/_index|← Книги]] · [👥 Авторы](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%90%D0%B2%D1%82%D0%BE%D1%80%D1%8B) · [🧩 Серии](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%A1%D0%B5%D1%80%D0%B8%D0%B8) · [🎬 Экранизации](obsidian://quickadd?choice=%D0%9A%D0%BD%D0%B8%D0%B3%D0%B8%20-%20%D0%AD%D0%BA%D1%80%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) · [[Книги/_system/Проверка библиотеки|🔎 Проверка]] · [[Книги/_system/Журнал изменений|📜 Журнал]]\n\n` +
        `[➕ Произведение](obsidian://quickadd?choice=${encodeURIComponent("Книги - Добавить книгу")})\n\n` +
        `![[Книги/Книги.base#Серия]]\n`;

    let page = app.vault.getAbstractFileByPath(PAGE_PATH);
    if (page) await app.vault.modify(page, content);
    else page = await app.vault.create(PAGE_PATH, content);

    await new Promise(resolve => setTimeout(resolve, 80));
    await app.workspace.getLeaf(false).openFile(page);
};
