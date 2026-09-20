module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice, normalizePath } = obsidian;

    const PAGE_PATH = normalizePath("Книги/_system/Авторы.md");
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

    function commandLink(label, choice) {
        const uri = "obsidian://quickadd?choice=" + encodeURIComponent(choice);
        return `[${label}](${uri})`;
    }

    function authorLink(author) {
        const uri =
            "obsidian://quickadd?choice=" +
            encodeURIComponent("Книги - Открыть автора") +
            "&value-author=" +
            encodeURIComponent(author);
        return `[${escapeMarkdownTable(author)}](${uri})`;
    }

    function bookLink(file, title, date) {
        const target = file.path.replace(/\.md$/i, "");
        const label = date ? `${title} · ${displayDate(date)}` : title;
        return `[[${target}\\|${escapeMarkdownTable(label)}]]`;
    }

    const books = app.vault.getMarkdownFiles().filter(isBook);
    const ratedBooks = books.filter(file => numericRating(getFrontmatter(file).rating) !== null).length;
    const aggregates = new Map();

    for (const file of books) {
        const fm = getFrontmatter(file);
        const title = String(fm.title ?? file.basename).trim() || file.basename;
        const rating = numericRating(fm.rating);
        const date = String(fm.date ?? "").trim();
        const dateKey = normalizeDate(date);

        for (const author of authorsOf(fm)) {
            if (!aggregates.has(author)) {
                aggregates.set(author, {
                    author,
                    books: new Set(),
                    ratingSum: 0,
                    ratingCount: 0,
                    latest: null
                });
            }

            const item = aggregates.get(author);
            item.books.add(file.path);

            if (rating !== null) {
                item.ratingSum += rating;
                item.ratingCount += 1;
            }

            if (dateKey) {
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
    }

    const authors = [...aggregates.values()]
        .sort((a, b) => a.author.localeCompare(b.author, "ru"));

    if (!authors.length) {
        new Notice("Авторы не найдены.");
        return;
    }

    const rows = authors.map(item => {
        const average = item.ratingCount > 0
            ? (item.ratingSum / item.ratingCount).toFixed(1)
            : "—";
        const latest = item.latest
            ? bookLink(item.latest.file, item.latest.title, item.latest.date)
            : "—";
        return `| ${authorLink(item.author)} | ${item.books.size} | ${average} | ${latest} |`;
    });

    const nav = [
        "[[Книги/_index|← Книги]]",
        commandLink("👥 Авторы", "Книги - Авторы"),
        commandLink("🧩 Серии", "Книги - Серии"),
        commandLink("🎬 Экранизации", "Книги - Экранизации"),
        "[[Книги/_system/Проверка библиотеки|🔎 Проверка]]",
        "[[Книги/_system/Журнал изменений|📜 Журнал]]"
    ].join(" · ");

    const content =
        `---\n` +
        `obsidianUIMode: preview\n` +
        `---\n\n` +
        `# 👥 Авторы\n\n` +
        `${nav}\n\n` +
        `> [!info] Обзор\n` +
        `> **Авторов:** ${authors.length} · **Произведений:** ${books.length} · **С оценкой:** ${ratedBooks}\n\n` +
        `Средняя оценка — только по произведениям, где она указана.\n\n` +
        `| Автор | Произведений | ⭐ ср. | Последняя книга |\n` +
        `| --- | ---: | ---: | --- |\n` +
        rows.join("\n") +
        `\n`;

    let page = app.vault.getAbstractFileByPath(PAGE_PATH);
    if (page) await app.vault.modify(page, content);
    else page = await app.vault.create(PAGE_PATH, content);

    await app.workspace.getLeaf(false).openFile(page);
};
