module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;
    const { Notice } = obsidian;

    const HISTORY_START = "<!-- BOOK-READINGS:START -->";
    const HISTORY_END = "<!-- BOOK-READINGS:END -->";
    const COMMENT_MARK = "<!-- BOOK-READING:COMMENT -->";

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

    function isFiction(file) {
        return file.path.startsWith("Книги/Художественные/");
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

    function parseEntries(text) {
        const start = text.indexOf(HISTORY_START);
        const end = text.indexOf(HISTORY_END, start + HISTORY_START.length);
        if (start < 0 || end < 0) return [];

        const managed = text.slice(start + HISTORY_START.length, end);
        const re = /<!-- BOOK-READING:START number="(\d+)" date="([^"]*)" rating="([^"]*)" -->\s*\n([\s\S]*?)\n<!-- BOOK-READING:END -->/g;
        const entries = [];
        let match;

        while ((match = re.exec(managed)) !== null) {
            const number = Number(match[1]);
            const date = match[2];
            const ratingText = match[3];
            const ratingNumber = Number(ratingText);
            const inner = match[4];
            const commentPos = inner.indexOf(COMMENT_MARK);
            const comment = commentPos >= 0
                ? inner.slice(commentPos + COMMENT_MARK.length).trim()
                : "";

            entries.push({
                number: Number.isFinite(number) ? number : 0,
                date,
                rating: ratingText !== "" && Number.isFinite(ratingNumber) ? ratingNumber : null,
                comment
            });
        }
        return entries;
    }

    function renderEntry(entry) {
        const number = Number(entry.number);
        const date = String(entry.date ?? "").trim();
        const rating = entry.rating;
        const comment = String(entry.comment ?? "").trim();
        const ratingAttr = rating === null || rating === undefined ? "" : String(rating);

        let out = `<!-- BOOK-READING:START number="${number}" date="${date}" rating="${ratingAttr}" -->\n`;
        out += `### Чтение ${number}${date ? ` - ${displayDate(date)}` : ""}\n\n`;
        if (rating !== null && rating !== undefined) {
            out += `**Оценка:** ${rating}/10\n\n`;
        }
        out += `${COMMENT_MARK}\n`;
        if (comment) out += `${comment}\n`;
        out += "<!-- BOOK-READING:END -->";
        return out;
    }

    function replaceEntries(text, entries) {
        const sorted = [...entries].sort((a, b) => a.number - b.number);
        const rendered = sorted.length
            ? "\n\n" + sorted.map(renderEntry).join("\n\n") + "\n\n"
            : "\n\n_История пока пуста._\n\n";

        const start = text.indexOf(HISTORY_START);
        const end = text.indexOf(HISTORY_END, start + HISTORY_START.length);
        if (start >= 0 && end >= 0) {
            return text.slice(0, start + HISTORY_START.length) + rendered + text.slice(end);
        }

        const block =
            `\n\n## История чтений\n\n` +
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
            HISTORY_START + rendered + HISTORY_END + "\n";
        return text.trimEnd() + block;
    }

    async function rebuildBook(bookFile, entries) {
        const chronological = [...entries].sort((a, b) => {
            const byDate = String(a.date ?? "").localeCompare(String(b.date ?? ""));
            return byDate !== 0 ? byDate : a.number - b.number;
        });
        const latest = chronological.length ? chronological[chronological.length - 1] : null;
        const latestRated = [...chronological].reverse().find(e => e.rating !== null) || null;

        await app.fileManager.processFrontMatter(bookFile, frontmatter => {
            frontmatter.read_count = entries.length;
            if (latest?.date) frontmatter.date = latest.date;
            else delete frontmatter.date;

            if (isFiction(bookFile) && latestRated) frontmatter.rating = latestRated.rating;
            else delete frontmatter.rating;
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

    const text = await app.vault.read(bookFile);
    const entries = parseEntries(text);
    const nextNumber = entries.reduce((max, entry) => Math.max(max, entry.number), 0) + 1;
    const fiction = isFiction(bookFile);

    const inputs = [
        {
            id: "date",
            label: `Дата чтения #${nextNumber}`,
            type: "text",
            defaultValue: quickAddApi.date.now("YYYY-MM-DD"),
            placeholder: "YYYY-MM-DD"
        }
    ];

    if (fiction) {
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
    if (!isValidDate(date)) {
        new Notice("Некорректная дата. Используй YYYY-MM-DD, YYYY-MM или YYYY.");
        return;
    }

    const ratingRaw = Number(values.rating);
    const rating = fiction && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 10
        ? ratingRaw
        : null;
    const comment = String(values.comment ?? "").trim();

    entries.push({ number: nextNumber, date, rating, comment });
    const updated = replaceEntries(text, entries);
    await app.vault.modify(bookFile, updated);
    await rebuildBook(bookFile, entries);

    const title = String(getFrontmatter(bookFile).title || bookFile.basename);
    new Notice(`${title}: добавлено чтение #${nextNumber}`);
    await app.workspace.getLeaf(false).openFile(bookFile);
};
