module.exports = async (params) => {
    const { app, quickAddApi, obsidian, variables = {} } = params;
    const { Notice, normalizePath } = obsidian;

    const PAGE_PATH = normalizePath("Книги/_system/Автор.md");

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (file.basename === "_index") return false;
        if (!(
            file.path.startsWith("Книги/Художественные/") ||
            file.path.startsWith("Книги/Non-fiction/")
        )) return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    function authorsOf(file) {
        const raw = getFrontmatter(file).authors;
        const values = Array.isArray(raw) ? raw : [raw];
        return values.map(v => String(v ?? "").trim()).filter(Boolean);
    }

    let author = String(variables.author ?? "").trim();

    if (!author) {
        const authors = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .flatMap(authorsOf)
        )].sort((a, b) => a.localeCompare(b, "ru"));

        if (!authors.length) {
            new Notice("Авторы не найдены.");
            return;
        }

        author = await quickAddApi.suggester(authors, authors, "Выбери автора");
        if (!author) return;
    }

    const content =
        `---\n` +
        `selected_author: ${JSON.stringify(author)}\n` +
        `obsidianUIMode: preview\n` +
        `---\n\n` +
        `# ${author}\n\n` +
        `![[Книги/Книги.base#Автор|no-new]]\n`;

    let page = app.vault.getAbstractFileByPath(PAGE_PATH);
    if (page) {
        await app.vault.modify(page, content);
    } else {
        page = await app.vault.create(PAGE_PATH, content);
    }

    // Даем metadata cache обновить selected_author перед рендером встроенной Base.
    await new Promise(resolve => setTimeout(resolve, 80));
    await app.workspace.getLeaf(false).openFile(page);
};
