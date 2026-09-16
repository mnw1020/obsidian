module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const BOOKS_ROOT = "Книги";
    const AUTHOR_PAGE = "Книги/_system/Автор.md";
    const SERIES_PAGE = "Книги/_system/Серия.md";
    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";

    const yamlString = value => JSON.stringify(String(value ?? ""));
    const safeName = value => String(value ?? "").replace(/[\\/:*?"<>|]/g, "-").trim();

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

    function isFiction(file) {
        return file.path.startsWith("Книги/Художественные/");
    }

    function authorList(frontmatter) {
        const raw = frontmatter?.authors;
        if (!raw) return [];
        return (Array.isArray(raw) ? raw : [raw])
            .map(v => String(v).trim())
            .filter(Boolean);
    }

    async function ensureFolder(path) {
        const normalized = normalizePath(path);
        if (!app.vault.getAbstractFileByPath(normalized)) {
            await app.vault.createFolder(normalized);
        }
    }

    function displayDate(value) {
        const text = String(value ?? "").trim();
        let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}.${m[2]}.${m[1]}`;
        m = text.match(/^(\d{4})-(\d{2})$/);
        if (m) return `${m[2]}.${m[1]}`;
        return text;
    }

    function isValidDate(value) {
        const text = String(value ?? "").trim();
        let m = text.match(/^(\d{4})$/);
        if (m) return Number(m[1]) >= 1;
        m = text.match(/^(\d{4})-(\d{2})$/);
        if (m) {
            const month = Number(m[2]);
            return month >= 1 && month <= 12;
        }
        m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }

    function renderEntry(number, date, rating, comment) {
        const ratingAttr = rating === null || rating === undefined ? "" : String(rating);
        let out = `<!-- BOOK-READING:START number="${number}" date="${date}" rating="${ratingAttr}" -->\n`;
        out += `### Чтение ${number}${date ? ` - ${displayDate(date)}` : ""}\n\n`;
        if (rating !== null && rating !== undefined) {
            out += `**Оценка:** ${rating}/10\n\n`;
        }
        out += `${COMMENT_MARK}\n`;
        if (comment) out += `${comment.trim()}\n`;
        out += "<!-- BOOK-READING:END -->";
        return out;
    }

    function historyBlock(date, rating, comment) {
        let content =
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
            HISTORY_START + "\n\n";

        if (date) content += renderEntry(1, date, rating, comment) + "\n\n";
        else content += "_История пока пуста._\n\n";

        content += HISTORY_END + "\n";
        return content;
    }


    async function lightCheckBook(bookFile, entries) {
        let fm = getFrontmatter(bookFile);
        for (let attempt = 0; attempt < 6 && !fm.title; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 60));
            fm = getFrontmatter(bookFile);
        }
        const issues = [];
        const title = String(fm.title ?? "").trim();
        const authorsRaw = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
        const authors = authorsRaw.map(v => String(v ?? "").trim()).filter(Boolean);
        const series = String(fm.series ?? "").trim();
        const hasSeriesIndex = fm.series_index !== undefined && String(fm.series_index ?? "").trim() !== "";
        const seriesIndex = Number(fm.series_index);

        if (!title) issues.push("нет title");
        if (!authors.length) issues.push("нет authors");
        if (series && !hasSeriesIndex) issues.push("у серии нет series_index");
        if (!series && hasSeriesIndex) issues.push("series_index есть без series");
        if (series && hasSeriesIndex && (!Number.isInteger(seriesIndex) || seriesIndex < 1)) {
            issues.push("некорректный series_index");
        }

        const readCount = Number(fm.read_count);
        if (!Number.isInteger(readCount) || readCount !== entries.length) {
            issues.push(`read_count=${String(fm.read_count ?? "пусто")}, записей=${entries.length}`);
        }

        for (const entry of entries) {
            if (!isValidDate(String(entry.date ?? ""))) issues.push(`ошибка даты чтения #${entry.number}`);
        }

        const chronological = [...entries].sort((a, b) => {
            const byDate = String(a.date ?? "").localeCompare(String(b.date ?? ""));
            return byDate !== 0 ? byDate : Number(a.number) - Number(b.number);
        });
        const latest = chronological.length ? chronological[chronological.length - 1] : null;
        const latestRated = [...chronological].reverse().find(entry => entry.rating !== null && entry.rating !== undefined) || null;

        if (latest && String(fm.date ?? "").trim() !== String(latest.date ?? "").trim()) {
            issues.push("date не совпадает с последним чтением");
        }
        if (isFiction(bookFile)) {
            const fmRating = fm.rating === undefined || fm.rating === "" ? null : Number(fm.rating);
            const expectedRating = latestRated ? Number(latestRated.rating) : null;
            if (fmRating !== expectedRating) issues.push("rating не совпадает с последней оценкой");
        } else if (Object.prototype.hasOwnProperty.call(fm, "rating")) {
            issues.push("rating у Non-fiction");
        }

        let text = "";
        try {
            text = await app.vault.read(bookFile);
        } catch (error) {
            issues.push("файл не читается");
        }
        if (text) {
            const starts = (text.match(/<!-- BOOK-READING:START /g) || []).length;
            const ends = (text.match(/<!-- BOOK-READING:END -->/g) || []).length;
            if (!text.includes(HISTORY_START) || !text.includes(HISTORY_END)) issues.push("нет блока BOOK-READINGS");
            if (starts !== entries.length || ends !== entries.length) issues.push("маркеры чтений не совпадают с историей");
        }

        if (series && Number.isInteger(seriesIndex) && seriesIndex > 0) {
            const conflicts = app.vault.getMarkdownFiles()
                .filter(isBook)
                .filter(file => file.path !== bookFile.path)
                .filter(file => {
                    const other = getFrontmatter(file);
                    return String(other.series ?? "").trim() === series && Number(other.series_index) === seriesIndex;
                });
            if (conflicts.length) issues.push(`номер ${seriesIndex} уже есть в серии «${series}»`);
        }

        return [...new Set(issues)];
    }

    const active = app.workspace.getActiveFile();
    let defaultAuthor = "";
    let defaultSeries = "";

    if (active?.path === AUTHOR_PAGE) {
        defaultAuthor = String(getFrontmatter(active).selected_author ?? "").trim();
    }
    if (active?.path === SERIES_PAGE) {
        defaultSeries = String(getFrontmatter(active).selected_series ?? "").trim();

        // Если в серии сейчас только один автор, подставляем его автоматически.
        const seriesAuthors = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .filter(file => String(getFrontmatter(file).series ?? "").trim() === defaultSeries)
                .flatMap(file => authorList(getFrontmatter(file)))
        )];
        if (seriesAuthors.length === 1) defaultAuthor = seriesAuthors[0];
    }

    const section = await quickAddApi.suggester(
        ["Художественные", "Non-fiction"],
        ["Художественные", "Non-fiction"],
        "Раздел"
    );
    if (!section) return;

    const inputs = [
        { id: "title", label: "Название книги", type: "text" },
        {
            id: "authors",
            label: "Автор(ы), через запятую",
            type: "text",
            defaultValue: defaultAuthor
        },
        {
            id: "date",
            label: "Дата чтения",
            type: "text",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD"),
            placeholder: "YYYY-MM-DD"
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

    const date = String(values.date ?? "").trim().replace(/^@date:/, "");
    if (!isValidDate(date)) {
        new Notice("Некорректная дата. Используй YYYY-MM-DD, YYYY-MM или YYYY.");
        return;
    }

    const ratingRaw = Number(values.rating);
    const rating = section === "Художественные" && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();

    // Серия выбирается ПОСЛЕ автора. Так нет опечаток и дубликатов названий серий.
    let series = defaultSeries;
    if (!series) {
        const authorSeries = [...new Set(
            app.vault.getMarkdownFiles()
                .filter(isBook)
                .filter(file => authorList(getFrontmatter(file)).includes(authors[0]))
                .map(file => String(getFrontmatter(file).series ?? "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));

        const labels = ["Без серии", ...authorSeries, "➕ Новая серия"];
        const valuesForChoice = ["", ...authorSeries, "__NEW__"];

        const seriesChoice = await quickAddApi.suggester(
            labels,
            valuesForChoice,
            "Серия"
        );
        if (seriesChoice === undefined || seriesChoice === null) return;

        if (seriesChoice === "__NEW__") {
            series = String(await quickAddApi.inputPrompt("Название новой серии") ?? "").trim();
            if (!series) return;
        } else {
            series = String(seriesChoice).trim();
        }
    }

    let seriesIndex = null;
    if (series) {
        const existingIndexes = app.vault.getMarkdownFiles()
            .filter(isBook)
            .map(file => getFrontmatter(file))
            .filter(fm => String(fm.series ?? "").trim() === series)
            .map(fm => Number(fm.series_index))
            .filter(v => Number.isFinite(v) && v > 0);

        const suggestedIndex = existingIndexes.length
            ? Math.max(...existingIndexes) + 1
            : 1;

        const indexValues = await quickAddApi.requestInputs([
            {
                id: "seriesIndex",
                label: `Номер в серии "${series}"`,
                type: "number",
                defaultValue: String(suggestedIndex),
                numericConfig: { min: 1, step: 1 }
            }
        ]);
        if (!indexValues) return;

        const raw = Number(indexValues.seriesIndex);
        if (!Number.isFinite(raw) || raw < 1) {
            new Notice("Некорректный номер в серии.");
            return;
        }
        seriesIndex = Math.floor(raw);
    }

    const sectionFolder = normalizePath(`${BOOKS_ROOT}/${section}`);
    await ensureFolder(sectionFolder);

    // Сохраняем существующую физическую структуру. Если папка автора уже есть,
    // книга идет туда. Новые папки авторов автоматически не создаются.
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
    for (const author of authors) content += `  - ${yamlString(author)}\n`;
    content += `date: ${yamlString(date)}\n`;
    if (rating !== null) content += `rating: ${rating}\n`;
    content += "read_count: 1\n";
    if (series) {
        content += `series: ${yamlString(series)}\n`;
        content += `series_index: ${seriesIndex}\n`;
    }
    content += "---\n";
    content += `# ${title}\n\n`;
    content += "## Заметки\n\n";
    content += historyBlock(date, rating, comment);

    const bookFile = await app.vault.create(filePath, content);
    const entries = [{ number: 1, date, rating }];
    const issues = await lightCheckBook(bookFile, entries);
    if (issues.length) {
        new Notice(`${title}: книга добавлена. ⚠️ ${issues.join("; ")}. Запусти «Проверить библиотеку».`, 9000);
    } else {
        new Notice(`${title}: книга добавлена`);
    }
    await app.workspace.getLeaf(false).openFile(bookFile);
};
