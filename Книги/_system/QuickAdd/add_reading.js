module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const READINGS_FOLDER = "Книги/Чтения";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        const inBooksFolder =
            file.path.startsWith("Книги/Художественные/") ||
            file.path.startsWith("Книги/Non-fiction/");
        if (!inBooksFolder || file.basename === "_index") return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    function linkPath(value) {
        const text = String(value ?? "");
        const match = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
        return match ? match[1].replace(/\.md$/i, "") : "";
    }

    function readingsForBook(bookFile) {
        const target = bookFile.path.replace(/\.md$/i, "");
        return app.vault.getMarkdownFiles().filter(file => {
            if (!file.path.startsWith(READINGS_FOLDER + "/")) return false;
            const fm = getFrontmatter(file);
            return linkPath(fm["Книга"]) === target;
        });
    }

    async function ensureFolder(path) {
        if (!app.vault.getAbstractFileByPath(path)) {
            await app.vault.createFolder(path);
        }
    }

    function record(file) {
        const fm = getFrontmatter(file);
        const n = Number(fm["Чтение"]);
        const rating = Number(fm["Оценка"]);
        return {
            file,
            date: String(fm["Дата"] ?? ""),
            number: Number.isFinite(n) ? n : 0,
            rating: Number.isFinite(rating) ? rating : null
        };
    }

    async function rebuildBook(bookFile) {
        const records = readingsForBook(bookFile).map(record);
        records.sort((a, b) => {
            const byDate = a.date.localeCompare(b.date);
            return byDate !== 0 ? byDate : a.number - b.number;
        });

        const latest = records.length ? records[records.length - 1] : null;
        const latestRated = [...records].reverse().find(r => r.rating !== null) || null;
        const isFiction = bookFile.path.startsWith("Книги/Художественные/");

        await app.fileManager.processFrontMatter(bookFile, frontmatter => {
            frontmatter["read_count"] = records.length;
            if (latest?.date) frontmatter["date"] = latest.date;
            else delete frontmatter["date"];

            if (isFiction && latestRated) frontmatter["rating"] = latestRated.rating;
            else delete frontmatter["rating"];
        });
    }

    let bookFile = app.workspace.getActiveFile();
    if (!isBook(bookFile)) {
        const books = app.vault.getMarkdownFiles()
            .filter(isBook)
            .sort((a, b) => {
                const at = String(getFrontmatter(a).title || a.basename);
                const bt = String(getFrontmatter(b).title || b.basename);
                return at.localeCompare(bt, "ru");
            });

        if (!books.length) {
            new Notice("Книги не найдены.");
            return;
        }

        const labels = books.map(file => {
            const fm = getFrontmatter(file);
            const title = String(fm.title || file.basename);
            const authors = Array.isArray(fm.authors) ? fm.authors.join(", ") : String(fm.authors || "");
            return authors ? `${title} | ${authors}` : title;
        });

        bookFile = await quickAddApi.suggester(labels, books, "Выбери книгу");
        if (!bookFile) return;
    }

    const bookFm = getFrontmatter(bookFile);
    const title = String(bookFm.title || bookFile.basename);
    const existing = readingsForBook(bookFile).map(record);
    const maxNumber = existing.reduce((max, r) => Math.max(max, r.number), 0);
    const nextNumber = maxNumber + 1;

    const isFiction = bookFile.path.startsWith("Книги/Художественные/");
    const inputs = [
        {
            id: "date",
            label: `Дата чтения #${nextNumber}`,
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD")
        }
    ];

    if (isFiction) {
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
        label: "Комментарий",
        type: "textarea",
        optional: true,
        placeholder: "Что изменилось при этом чтении?"
    });

    const values = await quickAddApi.requestInputs(inputs);

    if (!values) return;

    const date = String(values.date ?? "").trim().replace(/^@date:/, "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        new Notice("Некорректная дата.");
        return;
    }

    const ratingRaw = Number(values.rating);
    const rating = isFiction && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();
    const year = date.slice(0, 4);

    await ensureFolder(READINGS_FOLDER);

    const bookPath = bookFile.path.replace(/\.md$/i, "");
    const bookLink = `[[${bookPath}|${title}]]`;
    const baseName = `${safeName(bookFile.basename)} - чтение ${nextNumber} - ${date}`;
    let readingPath = normalizePath(`${READINGS_FOLDER}/${baseName}.md`);
    let suffix = 2;
    while (app.vault.getAbstractFileByPath(readingPath)) {
        readingPath = normalizePath(`${READINGS_FOLDER}/${baseName} (${suffix}).md`);
        suffix++;
    }

    let content = "---\n";
    content += `Книга: ${yamlString(bookLink)}\n`;
    content += `Дата: ${yamlString(date)}\n`;
    content += `Год: ${year}\n`;
    content += `Чтение: ${nextNumber}\n`;
    if (rating !== null) content += `Оценка: ${rating}\n`;
    content += `Комментарий: ${yamlString(comment)}\n`;
    content += "tags:\n  - reading\n";
    content += "---\n\n";
    if (comment) content += comment + "\n";

    const readingFile = await app.vault.create(readingPath, content);
    await rebuildBook(bookFile);

    new Notice(`${title}: добавлено чтение #${nextNumber}`);
    await app.workspace.getLeaf(false).openFile(readingFile);
};
