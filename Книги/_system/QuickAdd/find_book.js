module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;

    const ROOT = "Книги";
    const FICTION = `${ROOT}/Художественные/`;
    const NONFICTION = `${ROOT}/Non-fiction/`;
    const AUTHOR_PAGE = `${ROOT}/_system/Автор.md`;
    const SERIES_PAGE = `${ROOT}/_system/Серия.md`;

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (!(file.path.startsWith(FICTION) || file.path.startsWith(NONFICTION))) return false;

        const fm = getFrontmatter(file);
        return Boolean(String(fm.title ?? "").trim()) && Boolean(fm.authors);
    }

    function toList(value) {
        const values = Array.isArray(value) ? value : [value];
        return values
            .map(item => String(item ?? "").trim())
            .filter(Boolean);
    }

    function sameText(a, b) {
        return String(a ?? "").trim().localeCompare(String(b ?? "").trim(), "ru", {
            sensitivity: "base"
        }) === 0;
    }

    function displayName(file) {
        const fm = getFrontmatter(file);
        const title = String(fm.title ?? file.basename).trim() || file.basename;
        const authors = toList(fm.authors).join(", ");
        const series = String(fm.series ?? "").trim();
        const rawIndex = fm.series_index;
        const indexText = rawIndex === undefined || rawIndex === null || String(rawIndex).trim() === ""
            ? ""
            : ` #${String(rawIndex).trim()}`;

        const parts = [title];
        if (authors) parts.push(authors);
        if (series) parts.push(`${series}${indexText}`);
        return parts.join(" | ");
    }

    const active = app.workspace.getActiveFile();
    let mode = "all";
    let contextValue = "";

    if (active?.path === AUTHOR_PAGE) {
        mode = "author";
        contextValue = String(getFrontmatter(active).selected_author ?? "").trim();
    } else if (active?.path === SERIES_PAGE) {
        mode = "series";
        contextValue = String(getFrontmatter(active).selected_series ?? "").trim();
    }

    let books = app.vault.getMarkdownFiles().filter(isBook);

    if (mode === "author") {
        if (!contextValue) {
            new Notice("Сначала выбери автора.");
            return;
        }

        books = books.filter(file =>
            toList(getFrontmatter(file).authors).some(author => sameText(author, contextValue))
        );
    } else if (mode === "series") {
        if (!contextValue) {
            new Notice("Сначала выбери серию.");
            return;
        }

        books = books.filter(file => sameText(getFrontmatter(file).series, contextValue));
    }

    books.sort((a, b) => {
        const aFm = getFrontmatter(a);
        const bFm = getFrontmatter(b);

        if (mode === "series") {
            const aIndex = Number(aFm.series_index);
            const bIndex = Number(bFm.series_index);
            const aValid = Number.isFinite(aIndex);
            const bValid = Number.isFinite(bIndex);

            if (aValid && bValid && aIndex !== bIndex) return aIndex - bIndex;
            if (aValid !== bValid) return aValid ? -1 : 1;
        }

        return displayName(a).localeCompare(displayName(b), "ru", { sensitivity: "base" });
    });

    if (!books.length) {
        const suffix = contextValue ? `: ${contextValue}` : "";
        new Notice(`Книги не найдены${suffix}`);
        return;
    }

    let prompt = "Найти книгу — название, автор или серия";
    if (mode === "author") prompt = `Книги автора: ${contextValue}`;
    if (mode === "series") prompt = `Книги серии: ${contextValue}`;

    const selected = await quickAddApi.suggester(
        books.map(displayName),
        books,
        prompt
    );

    if (!selected) return;
    await app.workspace.getLeaf(false).openFile(selected);
};
