module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const BOOKS_ROOT = "Книги";
    const READINGS_FOLDER = "Книги/Чтения";
    const AUTHOR_PAGE = "Книги/_system/Автор.md";
    const SERIES_PAGE = "Книги/_system/Серия.md";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    async function ensureFolder(path) {
        const normalized = normalizePath(path);
        if (!app.vault.getAbstractFileByPath(normalized)) {
            await app.vault.createFolder(normalized);
        }
    }

    function historyBlock() {
        return (
            `## История чтений\n\n` +
            "```button\n" +
            "name 📖 Добавить чтение\n" +
            "type command\n" +
            "action QuickAdd: Книги - Добавить чтение\n" +
            "color green\n" +
            "```\n\n" +
            "```button\n" +
            "name ✏️ Редактировать чтение\n" +
            "type command\n" +
            "action QuickAdd: Книги - Редактировать чтение\n" +
            "```\n\n" +
            `![[Книги/Чтения.base#История книги|no-new]]\n`
        );
    }

    async function createReading(bookFile, title, number, date, rating, comment) {
        await ensureFolder(READINGS_FOLDER);
        const year = date ? String(date).slice(0, 4) : "";
        const bookPath = bookFile.path.replace(/\.md$/i, "");
        const bookLink = `[[${bookPath}|${title}]]`;
        const dateForName = date || "без-даты";
        const baseName = `${safeName(bookFile.basename)} - чтение ${number} - ${dateForName}`;

        let path = normalizePath(`${READINGS_FOLDER}/${baseName}.md`);
        let suffix = 2;
        while (app.vault.getAbstractFileByPath(path)) {
            path = normalizePath(`${READINGS_FOLDER}/${baseName} (${suffix}).md`);
            suffix++;
        }

        let content = "---\n";
        content += `Книга: ${yamlString(bookLink)}\n`;
        content += date ? `Дата: ${yamlString(date)}\n` : "Дата:\n";
        content += year ? `Год: ${year}\n` : "Год:\n";
        content += `Чтение: ${number}\n`;
        if (rating !== null) content += `Оценка: ${rating}\n`;
        content += `Комментарий: ${yamlString(comment)}\n`;
        content += "tags:\n  - reading\n";
        content += "---\n\n";
        if (comment) content += comment + "\n";

        return await app.vault.create(path, content);
    }

    const active = app.workspace.getActiveFile();
    let defaultAuthor = "";
    let defaultSeries = "";

    if (active?.path === AUTHOR_PAGE) {
        defaultAuthor = String(getFrontmatter(active).selected_author ?? "").trim();
    }
    if (active?.path === SERIES_PAGE) {
        defaultSeries = String(getFrontmatter(active).selected_series ?? "").trim();
    }

    const section = await quickAddApi.suggester(
        ["Художественные", "Non-fiction"],
        ["Художественные", "Non-fiction"],
        "Раздел"
    );
    if (!section) return;

    const inputs = [
        {
            id: "title",
            label: "Название книги",
            type: "text"
        },
        {
            id: "authors",
            label: "Автор(ы), через запятую",
            type: "text",
            defaultValue: defaultAuthor
        },
        {
            id: "series",
            label: "Серия",
            type: "text",
            optional: true,
            defaultValue: defaultSeries
        },
        {
            id: "seriesIndex",
            label: "Номер в серии",
            type: "number",
            optional: true,
            numericConfig: { min: 1, step: 1 }
        },
        {
            id: "date",
            label: "Дата чтения",
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD")
        }
    ];

    if (section === "Художественные") {
        inputs.push({
            id: "rating",
            label: "Оценка",
            type: "number",
            optional: true,
            numericConfig: { min: 1, max: 10, step: 1 }
        });
    }

    inputs.push({
        id: "comment",
        label: "Комментарий к чтению",
        type: "textarea",
        optional: true
    });

    const values = await quickAddApi.requestInputs(inputs);
    if (!values) return;

    const title = String(values.title ?? "").trim();
    const authors = String(values.authors ?? "")
        .split(/[,;]+/)
        .map(v => v.trim())
        .filter(Boolean);

    if (!title) {
        new Notice("Не указано название книги.");
        return;
    }
    if (authors.length === 0) {
        new Notice("Не указан автор.");
        return;
    }

    const series = String(values.series ?? "").trim();
    const seriesIndexRaw = Number(values.seriesIndex);
    const seriesIndex = Number.isFinite(seriesIndexRaw) && seriesIndexRaw > 0
        ? Math.floor(seriesIndexRaw)
        : null;
    const date = String(values.date ?? "").trim().replace(/^@date:/, "");
    const ratingRaw = Number(values.rating);
    const rating = section === "Художественные" && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();

    const sectionFolder = normalizePath(`${BOOKS_ROOT}/${section}`);
    await ensureFolder(sectionFolder);

    // Сохраняем твою физическую структуру: если подпапка автора уже существует,
    // новая книга идет туда. Новые папки авторов автоматически не создаются.
    const authorFolder = normalizePath(`${sectionFolder}/${safeName(authors[0])}`);
    const hasAuthorFolder = !!app.vault.getAbstractFileByPath(authorFolder);
    const destinationFolder = hasAuthorFolder ? authorFolder : sectionFolder;

    const rawFileName = hasAuthorFolder ? title : `${authors[0]}. ${title}`;
    const filePath = normalizePath(`${destinationFolder}/${safeName(rawFileName)}.md`);

    if (app.vault.getAbstractFileByPath(filePath)) {
        new Notice(`Книга уже существует:\n${filePath}`);
        return;
    }

    let content = "---\n";
    content += `title: ${yamlString(title)}\n`;
    content += "authors:\n";
    for (const author of authors) {
        content += `  - ${yamlString(author)}\n`;
    }
    content += date ? `date: ${yamlString(date)}\n` : "date:\n";
    if (rating !== null) content += `rating: ${rating}\n`;
    content += `read_count: ${date ? 1 : 0}\n`;
    content += series ? `series: ${yamlString(series)}\n` : "series:\n";
    content += seriesIndex !== null ? `series_index: ${seriesIndex}\n` : "series_index:\n";
    content += "---\n";
    content += `# ${title}\n\n`;
    content += "## Заметки\n\n";
    content += historyBlock();

    const bookFile = await app.vault.create(filePath, content);

    if (date) {
        await createReading(bookFile, title, 1, date, rating, comment);
    }

    new Notice(`${title}: книга добавлена`);
    await app.workspace.getLeaf(false).openFile(bookFile);
};
