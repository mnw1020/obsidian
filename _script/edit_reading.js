module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const BOOKS_ROOT = "Книги";
    const READINGS_FOLDER = "Книги/Чтения";
    const AUTHORS_FOLDER = "Книги/Авторы";
    const SYSTEM_FOLDER = "Книги/_system";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(BOOKS_ROOT + "/")) return false;
        if (file.path.startsWith(READINGS_FOLDER + "/")) return false;
        if (file.path.startsWith(AUTHORS_FOLDER + "/")) return false;
        if (file.path.startsWith(SYSTEM_FOLDER + "/")) return false;
        return getFrontmatter(file).kind === "book";
    }

    function isReading(file) {
        if (!file || file.extension !== "md") return false;
        if (!file.path.startsWith(READINGS_FOLDER + "/")) return false;
        const fm = getFrontmatter(file);
        return fm.kind === "reading" || (Array.isArray(fm.tags) && fm.tags.includes("reading"));
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

        await app.fileManager.processFrontMatter(bookFile, frontmatter => {
            frontmatter["read_count"] = records.length;
            if (latest?.date) frontmatter["date"] = latest.date;
            else delete frontmatter["date"];

            if (latestRated) frontmatter["rating"] = latestRated.rating;
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
            const rating = fm["Оценка"] ?? "-";
            return `${book} | #${number} | ${date} | ${rating}/10`;
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

    const values = await quickAddApi.requestInputs([
        {
            id: "date",
            label: `Дата чтения #${number}`,
            type: "date",
            dateFormat: "YYYY-MM-DD",
            defaultValue: /^\d{4}-\d{2}-\d{2}$/.test(oldDate)
                ? oldDate
                : quickAddApi.date.now("YYYY-MM-DD")
        },
        {
            id: "rating",
            label: "Оценка",
            type: "number",
            optional: true,
            defaultValue: oldRating === "" || oldRating === null ? "" : String(oldRating),
            numericConfig: { min: 1, max: 10, step: 1 }
        },
        {
            id: "comment",
            label: "Комментарий",
            type: "textarea",
            optional: true,
            defaultValue: oldComment
        }
    ]);

    if (!values) return;

    const date = String(values.date ?? "").trim().replace(/^@date:/, "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        new Notice("Некорректная дата.");
        return;
    }

    const ratingRaw = Number(values.rating);
    const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();
    const year = date.slice(0, 4);
    const bookLink = String(fm["Книга"] ?? "");

    let content = "---\n";
    content += "kind: reading\n";
    content += `Книга: ${yamlString(bookLink)}\n`;
    content += `Дата: ${yamlString(date)}\n`;
    content += `Год: ${year}\n`;
    content += `Чтение: ${number}\n`;
    content += rating !== null ? `Оценка: ${rating}\n` : "Оценка:\n";
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
