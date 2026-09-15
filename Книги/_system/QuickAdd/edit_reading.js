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

    function isReading(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(READINGS_FOLDER + "/")) return false;
        const fm = getFrontmatter(file);
        const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags].filter(Boolean);
        return tags.map(String).map(t => t.replace(/^#/, "")).includes("reading");
    }

    function linkPath(value) {
        const text = String(value ?? "");
        const match = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
        return match ? match[1].replace(/\.md$/i, "") : "";
    }

    function findBookForReading(readingFile) {
        const fm = getFrontmatter(readingFile);
        const path = linkPath(fm["Книга"]);
        if (!path) return null;
        return app.vault.getAbstractFileByPath(path + ".md");
    }

    function readingsForBook(bookFile) {
        const target = bookFile.path.replace(/\.md$/i, "");
        return app.vault.getMarkdownFiles().filter(file => {
            if (!isReading(file)) return false;
            return linkPath(getFrontmatter(file)["Книга"]) === target;
        });
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
        if (!bookFile) return;
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

    const active = app.workspace.getActiveFile();
    let readingFile = null;

    if (isReading(active)) {
        readingFile = active;
    } else {
        let candidates;
        if (isBook(active)) {
            candidates = readingsForBook(active);
        } else {
            candidates = app.vault.getMarkdownFiles().filter(isReading);
        }

        candidates.sort((a, b) => {
            const afm = getFrontmatter(a);
            const bfm = getFrontmatter(b);
            const ad = String(afm["Дата"] ?? "");
            const bd = String(bfm["Дата"] ?? "");
            if (ad !== bd) return bd.localeCompare(ad);
            return Number(bfm["Чтение"] ?? 0) - Number(afm["Чтение"] ?? 0);
        });

        if (!candidates.length) {
            new Notice("Записи чтений не найдены.");
            return;
        }

        const labels = candidates.map(file => {
            const fm = getFrontmatter(file);
            const book = String(fm["Книга"] ?? "").replace(/^.*\|/, "").replace(/\]\]$/, "");
            const number = fm["Чтение"] ?? "?";
            const date = fm["Дата"] ?? "без даты";
            const linkedBook = findBookForReading(file);
            const isFiction = linkedBook?.path.startsWith("Книги/Художественные/");
            const rating = fm["Оценка"] ?? "-";
            return isFiction
                ? `${book} | #${number} | ${date} | ${rating}/10`
                : `${book} | #${number} | ${date}`;
        });

        readingFile = await quickAddApi.suggester(labels, candidates, "Какое чтение редактировать?");
        if (!readingFile) return;
    }

    const fm = getFrontmatter(readingFile);
    const bookFile = findBookForReading(readingFile);
    const numberRaw = Number(fm["Чтение"]);
    const number = Number.isFinite(numberRaw) && numberRaw > 0 ? Math.floor(numberRaw) : 1;
    const oldDate = String(fm["Дата"] ?? "");
    const oldRating = fm["Оценка"] ?? "";
    const oldComment = String(fm["Комментарий"] ?? "");

    const isFiction = bookFile?.path.startsWith("Книги/Художественные/") ?? false;
    const inputs = [
        {
            id: "date",
            label: `Дата чтения #${number}`,
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: /^\d{4}-\d{2}-\d{2}$/.test(oldDate)
                ? oldDate
                : quickAddApi.date.now("YYYY-MM-DD")
        }
    ];

    if (isFiction) {
        inputs.push({
            id: "rating",
            label: "Оценка",
            type: "number",
            optional: true,
            defaultValue: oldRating === "" || oldRating === null ? "" : String(oldRating),
            numericConfig: { min: 1, max: 10, step: 1 }
        });
    }

    inputs.push({
        id: "comment",
        label: "Комментарий",
        type: "textarea",
        optional: true,
        defaultValue: oldComment
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
    const bookLink = String(fm["Книга"] ?? "");

    let content = "---\n";
    content += `Книга: ${yamlString(bookLink)}\n`;
    content += `Дата: ${yamlString(date)}\n`;
    content += `Год: ${year}\n`;
    content += `Чтение: ${number}\n`;
    if (rating !== null) content += `Оценка: ${rating}\n`;
    content += `Комментарий: ${yamlString(comment)}\n`;
    content += "tags:\n  - reading\n";
    content += "---\n\n";
    if (comment) content += comment + "\n";

    await app.vault.modify(readingFile, content);

    const bookName = bookFile ? bookFile.basename : readingFile.basename.replace(/ - чтение.*$/, "");
    const baseName = `${safeName(bookName)} - чтение ${number} - ${date}`;
    let targetPath = normalizePath(`${READINGS_FOLDER}/${baseName}.md`);

    if (targetPath !== readingFile.path) {
        let suffix = 2;
        while (app.vault.getAbstractFileByPath(targetPath)) {
            targetPath = normalizePath(`${READINGS_FOLDER}/${baseName} (${suffix}).md`);
            suffix++;
        }
        await app.fileManager.renameFile(readingFile, targetPath);
    }

    await rebuildBook(bookFile);
    new Notice(`Чтение #${number} обновлено`);

    const finalFile = app.vault.getAbstractFileByPath(targetPath) || readingFile;
    await app.workspace.getLeaf(false).openFile(finalFile);
};
