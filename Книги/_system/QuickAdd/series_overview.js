module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const PAGE_PATH = normalizePath("Книги/_system/Серии.md");
    const BOOK_ROOTS = [
        "Книги/Художественные/",
        "Книги/Non-fiction/"
    ];

    function getFrontmatter(file) {
        return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }

    function isBook(file) {
        if (!file || file.extension !== "md") return false;
        if (!BOOK_ROOTS.some(root => file.path.startsWith(root))) return false;
        const fm = getFrontmatter(file);
        return Boolean(fm.title) && Boolean(fm.authors);
    }

    function authorsOf(frontmatter) {
        const raw = frontmatter.authors;
        const values = Array.isArray(raw) ? raw : [raw];
        return [...new Set(
            values
                .map(value => String(value ?? "").trim())
                .filter(Boolean)
        )];
    }

    function numericRating(value) {
        if (value === null || value === undefined || value === "") return null;
        const rating = Number(String(value).replace(",", "."));
        return Number.isFinite(rating) ? rating : null;
    }

    function normalizeDate(value) {
        const text = String(value ?? "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        if (/^\d{4}-\d{2}$/.test(text)) return `${text}-00`;
        if (/^\d{4}$/.test(text)) return `${text}-00-00`;
        return "";
    }

    function displayDate(value) {
        const text = String(value ?? "").trim();
        let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return `${match[3]}.${match[2]}.${match[1]}`;
        match = text.match(/^(\d{4})-(\d{2})$/);
        if (match) return `${match[2]}.${match[1]}`;
        return text || "—";
    }

    function escapeMarkdownTable(value) {
        return String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/\|/g, "\\|")
            .replace(/\r?\n/g, " ")
            .trim();
    }

    function seriesLink(series) {
        const uri =
            "obsidian://quickadd?choice=" +
            encodeURIComponent("Книги - Открыть серию") +
            "&value-series=" +
            encodeURIComponent(series);
        return `[${escapeMarkdownTable(series)}](${uri})`;
    }

    function bookLink(file, title, date) {
        const target = file.path.replace(/\.md$/i, "");
        const label = date ? `${title} · ${displayDate(date)}` : title;
        return `[[${target}\\|${escapeMarkdownTable(label)}]]`;
    }

    const aggregates = new Map();

    for (const file of app.vault.getMarkdownFiles().filter(isBook)) {
        const fm = getFrontmatter(file);
        const series = String(fm.series ?? "").trim();
        if (!series) continue;

        const title = String(fm.title ?? file.basename).trim() || file.basename;
        const rating = numericRating(fm.rating);
        const date = String(fm.date ?? "").trim();
        const dateKey = normalizeDate(date);
        const readCount = Number(fm.read_count);

        if (!aggregates.has(series)) {
            aggregates.set(series, {
                series,
                books: new Set(),
                authors: new Set(),
                readBooks: 0,
                ratingSum: 0,
                ratingCount: 0,
                latest: null
            });
        }

        const item = aggregates.get(series);
        item.books.add(file.path);
        for (const author of authorsOf(fm)) item.authors.add(author);
        if (Number.isFinite(readCount) && readCount > 0) item.readBooks += 1;

        if (rating !== null) {
            item.ratingSum += rating;
            item.ratingCount += 1;
        }

        if (dateKey && Number.isFinite(readCount) && readCount > 0) {
            const candidate = { file, title, date, dateKey };
            if (
                !item.latest ||
                candidate.dateKey > item.latest.dateKey ||
                (
                    candidate.dateKey === item.latest.dateKey &&
                    candidate.title.localeCompare(item.latest.title, "ru") < 0
                )
            ) {
                item.latest = candidate;
            }
        }
    }

    const seriesItems = [...aggregates.values()]
        .sort((a, b) => a.series.localeCompare(b.series, "ru"));

    if (!seriesItems.length) {
        new Notice("Серии не найдены.");
        return;
    }

    const rows = seriesItems.map(item => {
        const average = item.ratingCount > 0
            ? (item.ratingSum / item.ratingCount).toFixed(1)
            : "—";
        const authors = [...item.authors]
            .sort((a, b) => a.localeCompare(b, "ru"))
            .map(escapeMarkdownTable)
            .join(", ") || "—";
        const latest = item.latest
            ? bookLink(item.latest.file, item.latest.title, item.latest.date)
            : "—";

        return `| ${seriesLink(item.series)} | ${authors} | ${item.books.size} | ${item.readBooks} | ${average} | ${latest} |`;
    });

    const content =
        `---\n` +
        `obsidianUIMode: preview\n` +
        `---\n\n` +
        `# 📚 Серии\n\n` +
        `[[Книги/_index|← Книги]]\n\n` +
        "```button\n" +
        "name 🔄 Обновить обзор серий\n" +
        "type command\n" +
        "action QuickAdd: Книги - Серии\n" +
        "```\n\n" +
        `Всего серий: **${seriesItems.length}**\n\n` +
        `Средняя оценка считается только по книгам, где оценка указана.\n\n` +
        `| Серия | Автор(ы) | Книг в базе | Прочитано | Средняя оценка | Последняя книга |\n` +
        `| --- | --- | ---: | ---: | ---: | --- |\n` +
        rows.join("\n") +
        `\n`;

    let page = app.vault.getAbstractFileByPath(PAGE_PATH);
    if (page) {
        await app.vault.modify(page, content);
    } else {
        page = await app.vault.create(PAGE_PATH, content);
    }

    await app.workspace.getLeaf(false).openFile(page);
};
